/**
 * Hydrogen-like orbital sampling.
 *
 * |ψ_nlm|² is sampled directly with inverse-transform sampling in radius and
 * rejection sampling in angle, so every rendered point is a fair sample of the
 * probability density. One-electron radial functions are used with Slater
 * effective nuclear charges — a deliberately simple, legible model.
 *
 * Radial units are Bohr radii. Physical z is "up" in the renderer.
 */

const radialCache = new Map();

function radial(n, l, z, r) {
  if (n === 1 && l === 0) {
    return 2 * z ** 1.5 * Math.exp(-z * r);
  }
  if (n === 2 && l === 0) {
    return (1 / (2 * Math.SQRT2)) * z ** 1.5 * (2 - z * r) * Math.exp((-z * r) / 2);
  }
  if (n === 2 && l === 1) {
    return (1 / (2 * Math.sqrt(6))) * z ** 1.5 * (z * r) * Math.exp((-z * r) / 2);
  }
  // Not needed for the elements in this app, but keep a clear failure mode.
  throw new Error(`Unsupported orbital n=${n}, l=${l}`);
}

function buildRadialCdf(n, l, z) {
  const key = `${n}-${l}-${z.toFixed(4)}`;
  const cached = radialCache.get(key);
  if (cached) return cached;

  const samples = 4096;
  const rMax = n === 1 ? 15 / z : 60 / z;
  const dr = rMax / samples;
  const cdf = new Float64Array(samples + 1);
  const radii = new Float64Array(samples + 1);

  let total = 0;
  radii[0] = 0;
  cdf[0] = 0;
  for (let i = 1; i <= samples; i++) {
    const r = i * dr;
    const R = radial(n, l, z, r);
    const w = R * R * r * r * dr;
    total += w;
    radii[i] = r;
    cdf[i] = total;
  }
  for (let i = 0; i <= samples; i++) cdf[i] /= total;

  // 98% radius: where the cumulative probability reaches 0.98.
  let extent = radii[samples];
  for (let i = 0; i <= samples; i++) {
    if (cdf[i] >= 0.98) {
      extent = radii[i];
      break;
    }
  }

  const result = { samples, rMax, dr, cdf, extent };
  radialCache.set(key, result);
  return result;
}

/** Small deterministic PRNG so a cloud doesn't reshuffle on every edit. */
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

function sampleDirection(random, l, axis, out) {
  if (l === 0) {
    const u = 2 * random() - 1;
    const phi = 2 * Math.PI * random();
    const s = Math.sqrt(1 - u * u);
    out[0] = s * Math.cos(phi);
    out[1] = s * Math.sin(phi);
    out[2] = u;
    return;
  }

  // p orbital: |Y|² ∝ cos²θ about the chosen axis.
  let u = 1;
  for (let attempt = 0; attempt < 64; attempt++) {
    u = 2 * random() - 1;
    if (random() < u * u) break;
  }
  const phi = 2 * Math.PI * random();
  const s = Math.sqrt(Math.max(0, 1 - u * u));
  if (axis === "x") {
    out[0] = u;
    out[1] = s * Math.cos(phi);
    out[2] = s * Math.sin(phi);
  } else {
    out[0] = s * Math.cos(phi);
    out[1] = s * Math.sin(phi);
    out[2] = u;
  }
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
 * Sample a point cloud from |ψ|².
 * @returns {Float32Array} xyz triples (z is vertical)
 */
export function sampleCloud({ n, l, zEff, count, axis = "z", seed = 1 }) {
  const cdf = buildRadialCdf(n, l, zEff);
  const positions = new Float32Array(count * 3);
  const random = mulberry32(seed);
  const dir = [0, 0, 0];

  for (let i = 0; i < count; i++) {
    const r = sampleRadius(cdf, random);
    sampleDirection(random, l, axis, dir);
    positions[i * 3] = dir[0] * r;
    positions[i * 3 + 1] = dir[1] * r;
    positions[i * 3 + 2] = dir[2] * r;
  }

  return { positions, extent: cdf.extent };
}
