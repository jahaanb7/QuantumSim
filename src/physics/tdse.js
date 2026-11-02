/**
 * Time-dependent Schrödinger equation in 1D
 *   i ∂ψ/∂t = [ −½ ∂²/∂x² + V(x) ] ψ        (natural units: ħ = m = 1)
 *
 * Solved with the split-step Fourier method: exactly unitary between
 * applications of the absorbing mask, second-order accurate in dt.
 */

import { fft, ifft } from "./fft.js";

export const PARAM_LIMITS = Object.freeze({
  energy: { min: 1.0, max: 5.0, step: 0.1, default: 2.0, unit: "a.u." },
  barrier: { min: 0.5, max: 8.0, step: 0.1, default: 4.0, unit: "a.u." },
  width: { min: 0.5, max: 4.0, step: 0.1, default: 1.2, unit: "a.u." },
  sigma: { min: 1.0, max: 4.0, step: 0.1, default: 2.4, unit: "a.u." },
  x0: { min: -45, max: -25, step: 1, default: -35, unit: "a.u." },
});

export const DEFAULT_PARAMS = Object.freeze(
  Object.fromEntries(
    Object.entries(PARAM_LIMITS).map(([key, limit]) => [key, limit.default])
  )
);

export const DISPLAY_RANGE = Object.freeze({ min: -65, max: 65 });

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Normalize user-supplied parameters into the physically stable ranges. */
export function normalizeParams(input = {}) {
  const params = { ...DEFAULT_PARAMS, ...input };
  for (const [key, limit] of Object.entries(PARAM_LIMITS)) {
    const value = Number(params[key]);
    params[key] = Number.isFinite(value)
      ? clamp(value, limit.min, limit.max)
      : limit.default;
  }
  return params;
}

/** Transmission through a rectangular barrier for a single plane wave. */
export function planeWaveTransmission(energy, barrier, width) {
  const E = Math.max(1e-9, energy);
  const V = Math.max(0, barrier);
  const a = Math.max(1e-9, width);

  if (Math.abs(E - V) < 1e-9) {
    return 1 / (1 + (V * a * a) / 2);
  }

  if (E < V) {
    const kappa = Math.sqrt(2 * (V - E));
    const numerator = V * V * Math.sinh(kappa * a) ** 2;
    return 1 / (1 + numerator / (4 * E * (V - E)));
  }

  const q = Math.sqrt(2 * (E - V));
  const numerator = V * V * Math.sin(q * a) ** 2;
  return 1 / (1 + numerator / (4 * E * (E - V)));
}

/**
 * Run the simulation.
 *
 * @param {object} input  energy, barrier, width, sigma, x0 (natural units)
 * @param {object} options
 *   fast     – lower resolution for cheap preset thumbnails
 *   frames   – number of saved frames
 * @returns simulation result with density frames and region probabilities
 */
export function simulate(input = {}, options = {}) {
  const params = normalizeParams(input);
  const fast = Boolean(options.fast);

  const N = fast ? 512 : 1024;
  const L = 200;
  const dx = L / N;
  const nFrames = options.frames ?? (fast ? 60 : 100);

  const E = params.energy;
  const V0 = params.barrier;
  const a = params.width;
  const sigma = params.sigma;
  const x0 = params.x0;
  const k0 = Math.sqrt(2 * E);

  const x = new Float64Array(N);
  for (let i = 0; i < N; i++) x[i] = -L / 2 + (i + 0.5) * dx;

  // Frequencies for spectral derivatives (fftfreq ordering).
  const k = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const n = i < N / 2 ? i : i - N;
    k[i] = (2 * Math.PI * n) / L;
  }

  // Total simulated time: long enough to cross the barrier and separate,
  // short enough that neither packet reaches the absorbing layer.
  const travelDistance = Math.max(4, Math.abs(x0) - a / 2);
  const tEnd = clamp(travelDistance / k0 + 16, 28, 52);

  const dtTarget = 0.02;
  const stepsPerFrame = Math.max(
    4,
    Math.ceil(tEnd / (nFrames * dtTarget))
  );
  const dt = tEnd / (nFrames * stepsPerFrame);
  const steps = stepsPerFrame;

  // Initial normalized Gaussian wave packet.
  const psiR = new Float64Array(N);
  const psiI = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const envelope = Math.exp(-((x[i] - x0) ** 2) / (4 * sigma * sigma));
    const phase = k0 * x[i];
    psiR[i] = envelope * Math.cos(phase);
    psiI[i] = envelope * Math.sin(phase);
  }
  let norm = 0;
  for (let i = 0; i < N; i++) {
    norm += psiR[i] * psiR[i] + psiI[i] * psiI[i];
  }
  const amp = 1 / Math.sqrt(norm * dx);
  for (let i = 0; i < N; i++) {
    psiR[i] *= amp;
    psiI[i] *= amp;
  }

  // Potential phase and kinetic phase for this dt.
  const potentialHalfR = new Float64Array(N);
  const potentialHalfI = new Float64Array(N);
  const kineticHalfR = new Float64Array(N);
  const kineticHalfI = new Float64Array(N);
  const absorb = new Float64Array(N);

  for (let i = 0; i < N; i++) {
    const inBarrier = Math.abs(x[i]) < a / 2;
    const potential = inBarrier ? V0 : 0;
    const pAngle = -0.5 * potential * dt;
    potentialHalfR[i] = Math.cos(pAngle);
    potentialHalfI[i] = Math.sin(pAngle);

    const kAngle = -0.5 * k[i] * k[i] * dt;
    kineticHalfR[i] = Math.cos(kAngle);
    kineticHalfI[i] = Math.sin(kAngle);

    const edge = Math.abs(x[i]) - 78;
    absorb[i] = edge > 0 ? Math.exp(-0.035 * (edge / 20) ** 2) : 1;
  }

  const leftEnd = fractionIndex(x, -a / 2);
  const rightStart = fractionIndex(x, a / 2);

  const frames = [];
  const times = new Float64Array(nFrames + 1);
  const probabilities = [];

  const record = (frameIndex) => {
    const density = new Float32Array(N);
    let total = 0;
    let left = 0;
    let inside = 0;
    let right = 0;
    let peak = 0;

    for (let i = 0; i < N; i++) {
      const d = psiR[i] * psiR[i] + psiI[i] * psiI[i];
      density[i] = d;
      total += d;
      if (i < leftEnd) left += d;
      else if (i >= rightStart) right += d;
      else inside += d;
      if (d > peak) peak = d;
    }

    frames.push(density);
    times[frameIndex] = frameIndex * steps * dt;
    const denom = total > 0 ? total : 1;
    probabilities.push({
      left: left / denom,
      inside: inside / denom,
      right: right / denom,
    });

    return { total: total * dx, peak };
  };

  let totalNorm = 0;
  let peakDensity = 0;

  for (let frame = 0; frame <= nFrames; frame++) {
    const stats = record(frame);
    if (frame === nFrames) {
      totalNorm = stats.total;
      peakDensity = Math.max(peakDensity, stats.peak);
      break;
    }
    peakDensity = Math.max(peakDensity, stats.peak);

    for (let s = 0; s < steps; s++) {
      // Half potential
      for (let i = 0; i < N; i++) {
        const r = psiR[i];
        const m = psiI[i];
        const pr = potentialHalfR[i];
        const pi = potentialHalfI[i];
        psiR[i] = r * pr - m * pi;
        psiI[i] = r * pi + m * pr;
      }

      // Full kinetic step in momentum space
      fft(psiR, psiI);
      for (let i = 0; i < N; i++) {
        const r = psiR[i];
        const m = psiI[i];
        const pr = kineticHalfR[i];
        const pi = kineticHalfI[i];
        psiR[i] = r * pr - m * pi;
        psiI[i] = r * pi + m * pr;
      }
      ifft(psiR, psiI);

      // Half potential again
      for (let i = 0; i < N; i++) {
        const r = psiR[i];
        const m = psiI[i];
        const pr = potentialHalfR[i];
        const pi = potentialHalfI[i];
        psiR[i] = r * pr - m * pi;
        psiI[i] = r * pi + m * pr;
      }

      // Gentle absorbing boundary to stop circulation around the FFT box.
      for (let i = 0; i < N; i++) {
        psiR[i] *= absorb[i];
        psiI[i] *= absorb[i];
      }
    }
  }

  const final = probabilities[probabilities.length - 1];
  const peak = peakDensity > 0 ? peakDensity : 1;
  const displayIndices = [];
  for (let i = 0; i < N; i++) {
    if (x[i] >= DISPLAY_RANGE.min && x[i] <= DISPLAY_RANGE.max) {
      displayIndices.push(i);
    }
  }

  return {
    params,
    N,
    L,
    dx,
    x,
    k0,
    tEnd,
    dt,
    stepsPerFrame,
    nFrames,
    times,
    frames,
    probabilities,
    final,
    peak: peak,
    norm: totalNorm,
    analyticT: planeWaveTransmission(E, V0, a),
    display: {
      min: DISPLAY_RANGE.min,
      max: DISPLAY_RANGE.max,
      indices: Int32Array.from(displayIndices),
    },
  };
}

/** First index with x >= edge (used to split integration regions). */
function fractionIndex(x, edge) {
  let lo = 0;
  let hi = x.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (x[mid] < edge) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
