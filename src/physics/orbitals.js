/**
 * Hydrogen-like orbital sampling.
 *
 * Radial functions are the exact non-relativistic Coulomb solutions,
 *   R_nl(r) = N e^(-rho/2) rho^l L_(n-l-1)^(2l+1)(rho),  rho = 2 Z r / n,
 * evaluated in Bohr units. Angular parts are real spherical harmonics, so
 * every orbital is a real function with an interpretable phase sign.
 *
 * |psi|^2 is sampled by inverting the radial CDF and rejection-sampling the
 * angular density. The result is a genuine Monte-Carlo estimate, not a
 * decorative shell.
 */

const TAU = Math.PI * 2;
const radialCache = new Map();
const angularCache = new Map();

const FACT = [1];
for (let i = 1; i <= 20; i++) FACT[i] = FACT[i - 1] * i;

const ORBITAL_SUFFIX = {
  0: { 0: "" },
  1: { 0: "_z", 1: "_x", "-1": "_y" },
  2: {
    0: "_z²",
    1: "_xz",
    "-1": "_yz",
    2: "_x²−y²",
    "-2": "_xy",
  },
  3: {
    0: "_z³",
    1: "_xz²",
    "-1": "_yz²",
    2: "_z(x²−y²)",
    "-2": "_xyz",
    3: "_x(x²−3y²)",
    "-3": "_y(3x²−y²)",
  },
};

export const SUBSHELL_LETTERS = ["s", "p", "d", "f"];

export function subshellLetter(l) {
  return SUBSHELL_LETTERS[l] ?? "?";
}

export function orbitalSuffix(l, m) {
  return ORBITAL_SUFFIX[l]?.[m] ?? "";
}

export function orbitalLabel(n, l, m) {
  return `${n}${subshellLetter(l)}${orbitalSuffix(l, m)}`;
}

/** Short m labels for builder buttons. */
export function mLabel(l, m) {
  if (l === 0) return "—";
  return (ORBITAL_SUFFIX[l]?.[m] ?? String(m)).replace(/^_/, "");
}

function laguerre(k, alpha, x) {
  if (k === 0) return 1;
  let l0 = 1;
  let l1 = 1 + alpha - x;
  for (let i = 1; i < k; i++) {
    const l2 = ((2 * i + 1 + alpha - x) * l1 - (i + alpha) * l0) / (i + 1);
    l0 = l1;
    l1 = l2;
  }
  return l1;
}

/** Exact hydrogen-like radial function in Bohr units. */
export function radialFunction(n, l, z, r) {
  const rho = (2 * z * r) / n;
  const norm = Math.sqrt(
    ((2 * z) / n) ** 3 * (FACT[n - l - 1] / (2 * n * FACT[n + l]))
  );
  return (
    norm *
    Math.exp(-rho / 2) *
    Math.pow(rho, Math.max(0, l)) *
    laguerre(n - l - 1, 2 * l + 1, rho)
  );
}

/** Real spherical-harmonic shape, unnormalised; only sign and relative |Y|² matter. */
export function angularShape(l, m, cosTheta, sinTheta, cosPhi, sinPhi) {
  if (l === 0) return 1;
  if (l === 1) {
    if (m === 0) return cosTheta;
    if (m === 1) return sinTheta * cosPhi;
    return sinTheta * sinPhi;
  }
  if (l === 2) {
    if (m === 0) return 3 * cosTheta * cosTheta - 1;
    if (m === 1) return sinTheta * cosTheta * cosPhi;
    if (m === -1) return sinTheta * cosTheta * sinPhi;
    if (m === 2) return sinTheta * sinTheta * (cosPhi * cosPhi - sinPhi * sinPhi);
    return sinTheta * sinTheta * 2 * sinPhi * cosPhi;
  }
  if (l === 3) {
    if (m === 0) return 5 * cosTheta ** 3 - 3 * cosTheta;
    if (m === 1) return sinTheta * (5 * cosTheta * cosTheta - 1) * cosPhi;
    if (m === -1) return sinTheta * (5 * cosTheta * cosTheta - 1) * sinPhi;
    if (m === 2) return sinTheta * sinTheta * cosTheta * (cosPhi * cosPhi - sinPhi * sinPhi);
    if (m === -2)
      return sinTheta * sinTheta * cosTheta * 2 * sinPhi * cosPhi;
    if (m === 3)
      return sinTheta ** 3 * (cosPhi ** 3 - 3 * cosPhi * sinPhi * sinPhi);
    return sinTheta ** 3 * (3 * cosPhi * cosPhi * sinPhi - sinPhi ** 3);
  }
  return 0;
}

function buildAngularMax(l, m) {
  const key = `${l}-${m}`;
  const cached = angularCache.get(key);
  if (cached) return cached;

  let max = 0;
  const steps = 96;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    for (let j = 0; j < steps * 2; j++) {
      const phi = (j / (steps * 2)) * TAU;
      const value = Math.abs(
        angularShape(l, m, ct, st, Math.cos(phi), Math.sin(phi))
      );
      if (value > max) max = value;
    }
  }
  max = max || 1;
  angularCache.set(key, max);
  return max;
}

function buildRadial(n, l, z) {
  const key = `${n}-${l}-${z.toFixed(4)}`;
  const cached = radialCache.get(key);
  if (cached) return cached;

  const samples = 6144;
  const rMax = Math.max(16, n * n * 4.2 + 22) / z;
  const dr = rMax / samples;
  const cdf = new Float64Array(samples + 1);
  const radii = new Float64Array(samples + 1);

  let total = 0;
  let weighted = 0;
  let peak = 0;
  let peakR = 0;

  radii[0] = 0;
  cdf[0] = 0;
  for (let i = 1; i <= samples; i++) {
    const r = i * dr;
    const R = radialFunction(n, l, z, r);
    const p = R * R * r * r;
    const w = p * dr;
    total += w;
    weighted += r * w;
    if (p > peak) {
      peak = p;
      peakR = r;
    }
    radii[i] = r;
    cdf[i] = total;
  }

  for (let i = 0; i <= samples; i++) cdf[i] /= total;

  let extent95 = radii[samples];
  let extent = radii[samples];
  for (let i = 0; i <= samples; i++) {
    if (extent95 === radii[samples] && cdf[i] >= 0.95) extent95 = radii[i];
    if (cdf[i] >= 0.985) {
      extent = radii[i];
      break;
    }
  }

  const result = {
    n,
    l,
    z,
    samples,
    rMax,
    dr,
    cdf,
    extent,
    extent95,
    mean: weighted / total,
    mostProbable: peakR,
  };
  radialCache.set(key, result);
  return result;
}

/** Small deterministic PRNG so a cloud is stable between renders. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleRadius(cdf, random) {
  const u = random();
  let lo = 0;
  let hi = cdf.cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf.cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? (lo - 0.5) * cdf.dr : 0;
}

/**
 * Sample a point cloud from |psi|^2.
 * @returns {{positions: Float32Array, signs: Int8Array, extent: number,
 *   mean: number, mostProbable: number, extent95: number}}
 */
export function sampleCloud({ n, l, m = 0, zEff = 1, count = 40000, seed = 1 }) {
  const radial = buildRadial(n, l, zEff);
  const angularMax = buildAngularMax(l, m);
  const positions = new Float32Array(count * 3);
  const signs = new Int8Array(count);
  const random = mulberry32(seed);

  for (let i = 0; i < count; i++) {
    const r = sampleRadius(radial, random);

    let ct = 0;
    let st = 1;
    let cp = 1;
    let sp = 0;
    let angular = 1;

    if (l === 0) {
      const u = 2 * random() - 1;
      const phi = TAU * random();
      ct = u;
      st = Math.sqrt(Math.max(0, 1 - u * u));
      cp = Math.cos(phi);
      sp = Math.sin(phi);
    } else {
      const maxSq = angularMax * angularMax;
      for (let attempt = 0; attempt < 48; attempt++) {
        const u = 2 * random() - 1;
        const phi = TAU * random();
        const sint = Math.sqrt(Math.max(0, 1 - u * u));
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);
        const value = angularShape(l, m, u, sint, cosPhi, sinPhi);
        if (random() * maxSq <= value * value) {
          ct = u;
          st = sint;
          cp = cosPhi;
          sp = sinPhi;
          angular = value;
          break;
        }
        if (attempt === 47) {
          ct = u;
          st = sint;
          cp = cosPhi;
          sp = sinPhi;
          angular = value;
        }
      }
    }

    positions[i * 3] = r * st * cp;
    positions[i * 3 + 1] = r * st * sp;
    positions[i * 3 + 2] = r * ct;

    const radialSign = radialFunction(n, l, zEff, r) < 0 ? -1 : 1;
    const angularSign = angular < 0 ? -1 : 1;
    signs[i] = radialSign * angularSign;
  }

  return {
    positions,
    signs,
    extent: radial.extent,
    extent95: radial.extent95,
    mean: radial.mean,
    mostProbable: radial.mostProbable,
  };
}

/** Radial probability density P(r) = r² R², on a small grid for charts. */
export function radialProfile(n, l, zEff, bins = 120) {
  const radial = buildRadial(n, l, zEff);
  const out = [];
  let peak = 0;
  for (let i = 1; i <= bins; i++) {
    const r = (i / bins) * radial.extent * 1.15;
    const R = radialFunction(n, l, zEff, r);
    const p = R * R * r * r;
    if (p > peak) peak = p;
    out.push([r, p]);
  }
  return out.map(([r, p]) => [r, peak > 0 ? p / peak : 0]);
}
