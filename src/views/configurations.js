/**
 * Tunneling — a time-dependent wave-packet scattering lab.
 *
 * The 1-D Schrödinger equation is solved with the split-step Fourier method,
 * then |psi(x,t)|^2 is turned into a 3D point cloud: every dot is a sampled
 * detection position, offset transversally so the density reads as a volume.
 * Colour encodes the phase of psi.
 */

import * as THREE from "three";
import {
  createStage,
  makeGlowTexture,
  makeGradient,
  makeTextSprite,
} from "../stage.js";
import {
  simulate,
  planeWaveTransmission,
  PARAM_LIMITS,
  DEFAULT_PARAMS,
  normalizeParams,
} from "../physics/tdse.js";
import { createSlider, debounce, clamp, percent } from "../ui.js";
import {
  createOverlayCanvas,
  mono,
  rule,
  withAlpha,
  PLATE_INK,
  PLATE_MUTED,
  PLATE_FAINT,
  PLATE_RULE,
  GOLD,
} from "../plots.js";

const FRAMES = 120;
const PARTICLES = 9000;
const FPS = 30;
const TAU = Math.PI * 2;

const PHASE_STOPS = [
  [0, "#4c6c8f"],
  [0.28, "#7fa79a"],
  [0.55, "#d3c19b"],
  [0.82, "#c46a45"],
  [1, "#4c6c8f"],
];

const PRESETS = [
  {
    id: "tunneling",
    name: "Deep tunnel",
    params: { energy: 2.0, barrier: 4.0, width: 1.2, sigma: 2.4, x0: -35 },
  },
  {
    id: "threshold",
    name: "Threshold",
    params: { energy: 3.6, barrier: 4.0, width: 1.0, sigma: 2.4, x0: -35 },
  },
  {
    id: "over",
    name: "Over barrier",
    params: { energy: 5.0, barrier: 2.0, width: 1.4, sigma: 2.2, x0: -35 },
  },
  {
    id: "wide",
    name: "Wide wall",
    params: { energy: 2.6, barrier: 2.8, width: 3.4, sigma: 2.8, x0: -35 },
  },
  {
    id: "thin",
    name: "Thin wall",
    params: { energy: 1.4, barrier: 6.5, width: 0.5, sigma: 2.0, x0: -35 },
  },
  {
    id: "fabry",
    name: "Fabry–Pérot",
    params: { energy: 4.9, barrier: 4.0, width: 2.4, sigma: 3.0, x0: -35 },
  },
];

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6L19 12z"/></svg>';
const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
const REPLAY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M3.2 12a8.8 8.8 0 1 0 2.7-6.3"/><path d="M3 4.2v4.4h4.4"/></svg>';

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

function regimeFor(params) {
  const ratio = params.energy / params.barrier;
  if (ratio < 0.85) {
    return {
      name: "Deep tunneling",
      note: "The packet carries less energy than the barrier, but its tail leaks through.",
    };
  }
  if (ratio <= 1.15) {
    return {
      name: "Threshold",
      note: "E sits close to V₀, where transmission is acutely sensitive to every parameter.",
    };
  }
  return {
    name: "Over barrier",
    note: "Classically the packet passes over; a reflected wave and interference fringes survive.",
  };
}

export function mountConfigurationsPage(root) {
  const page = document.createElement("div");
  page.className = "page page-tunnel";
  page.innerHTML = `
    <aside class="side">
      <div class="side-head">
        <p class="eyebrow"><span>03</span> Scattering</p>
        <h1>Through the<br><em>barrier</em></h1>
        <p class="lede">A Gaussian packet meets a rectangular wall. Watch the probability divide.</p>
      </div>

      <div class="side-body">
        <div class="section-head"><span>Presets</span><span>six states</span></div>
        <div class="preset-list" aria-label="Simulation presets"></div>
        <div class="btn-row">
          <button type="button" class="btn" data-action="reset">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3.2 12a8.8 8.8 0 1 0 2.7-6.3"/><path d="M3 4.2v4.4h4.4"/></svg>
            Reset
          </button>
          <button type="button" class="btn" data-action="randomize">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>
            Random
          </button>
        </div>

        <div class="section-head"><span>Parameters</span><span>atomic units</span></div>
        <div class="controls"></div>
        <p class="side-note" data-regime-note></p>
      </div>

      <div class="side-foot"><span>split-step</span><span>N = 1024</span></div>
    </aside>

    <section class="work">
      <div class="stage">
        <div class="stage-canvas"></div>
        <div class="stage-head">
          <p class="eyebrow">03 / Time-dependent Schrödinger</p>
          <h1 class="stage-title">Tunneling</h1>
          <p class="stage-copy"></p>
        </div>
        <div class="stage-meta">
          <span>split-step · 1024 points</span>
          <span class="plate-index">Plate 03</span>
        </div>
        <div class="stage-legend static">
          <span class="legend-key"><i style="background:#d3c19b"></i>density ∝ |ψ|²</span>
          <span class="legend-key"><i class="gradient" data-phase-key></i>phase</span>
          <span class="legend-key"><i class="amber"></i>barrier</span>
        </div>
        <div class="stage-loader">Solving Schrödinger</div>
        <div class="stage-hint">drag<span>·</span>orbit<span>·</span>scroll<span>·</span>zoom</div>

        <div class="playback">
          <button type="button" class="play-btn" aria-label="Play simulation">${PLAY_ICON}</button>
          <div class="timeline-wrap">
            <input type="range" min="0" max="120" step="1" value="0" aria-label="Simulation time" />
            <div class="playback-meta">
              <span class="time-now mono">t = 0.00 a.u.</span>
              <span class="frame-now mono">0 / 120</span>
            </div>
          </div>
          <button type="button" class="replay-btn" aria-label="Replay from the start">${REPLAY_ICON}</button>
        </div>
      </div>

      <div class="tunnel-plot" aria-label="Probability density as a function of position, synchronized with the simulation">
        <div class="tunnel-plot-head">
          <span>P(x,t) · |ψ|² <em>normalized</em></span>
          <span data-plot-meta>t = 0.00 a.u. · frame 0</span>
        </div>
        <div class="tunnel-plot-canvas" data-trace-plot></div>
      </div>

      <div class="ribbon ribbon-tunnel">
        <div class="metric lead">
          <span class="label">Transmitted</span>
          <span class="value"><span data-stat="right">0</span><em>%</em></span>
          <span class="sub">right of the barrier</span>
        </div>
        <div class="metric metric-split">
          <span class="label">Probability split</span>
          <div class="split-bar" role="img" aria-label="Probability split">
            <div class="split-seg left" data-seg="left"></div>
            <div class="split-seg inside" data-seg="inside"></div>
            <div class="split-seg right" data-seg="right"></div>
          </div>
          <div class="split-legend">
            <span class="l-left"><i></i>left <b data-split="left">0%</b></span>
            <span class="l-inside"><i></i>inside <b data-split="inside">0%</b></span>
            <span class="l-right"><i></i>right <b data-split="right">0%</b></span>
          </div>
        </div>
        <div class="metric">
          <span class="label">Analytic T</span>
          <span class="value" data-read="analytic">—</span>
          <span class="sub">packet <b data-read="final">—</b></span>
        </div>
        <div class="metric">
          <span class="label">Norm</span>
          <span class="value" data-read="norm">—</span>
          <span class="sub">⟨ψ|ψ⟩</span>
        </div>
        <div class="metric">
          <span class="label">Regime</span>
          <span class="value" data-regime-name>—</span>
          <span class="sub" data-regime-sub></span>
        </div>
      </div>
    </section>
  `;
  root.appendChild(page);

  const canvasHost = page.querySelector(".stage-canvas");
  const loader = page.querySelector(".stage-loader");
  const stageCopy = page.querySelector(".stage-copy");
  const presetGrid = page.querySelector(".preset-list");
  const controlsHost = page.querySelector(".controls");
  const playButton = page.querySelector(".play-btn");
  const timeline = page.querySelector(".timeline-wrap input");
  const timeNow = page.querySelector(".time-now");
  const frameNow = page.querySelector(".frame-now");
  const regimeNote = page.querySelector("[data-regime-note]");
  const plotHost = page.querySelector("[data-trace-plot]");
  const plotMeta = page.querySelector("[data-plot-meta]");

  const statEls = {
    right: page.querySelector('[data-stat="right"]'),
    segLeft: page.querySelector('[data-seg="left"]'),
    segInside: page.querySelector('[data-seg="inside"]'),
    segRight: page.querySelector('[data-seg="right"]'),
    splitLeft: page.querySelector('[data-split="left"]'),
    splitInside: page.querySelector('[data-split="inside"]'),
    splitRight: page.querySelector('[data-split="right"]'),
    analytic: page.querySelector('[data-read="analytic"]'),
    final: page.querySelector('[data-read="final"]'),
    norm: page.querySelector('[data-read="norm"]'),
    regimeName: page.querySelector("[data-regime-name]"),
    regimeSub: page.querySelector("[data-regime-sub]"),
  };

  const phaseKey = page.querySelector("[data-phase-key]");
  phaseKey.style.background = `linear-gradient(90deg, ${PHASE_STOPS.map(
    ([stop, color]) => `${color} ${(stop * 100).toFixed(0)}%`
  ).join(", ")})`;

  const stage = createStage(canvasHost, {
    fov: 38,
    cameraPosition: [16, 88, 168],
    target: [0, 0, 0],
    minDistance: 70,
    maxDistance: 400,
    minPolarAngle: 0.16,
    maxPolarAngle: Math.PI - 0.16,
    autoRotate: false,
    enablePan: false,
  });

  const sceneContent = new THREE.Group();
  stage.scene.add(sceneContent);

  const glowTexture = makeGlowTexture();
  const phaseGradient = makeGradient(PHASE_STOPS);
  const tracePlot = createOverlayCanvas(plotHost, "trace-plot");
  tracePlot.onResize(() => drawTrace());

  /* ---------------------------------------------------------------- 3D pieces */

  const floor = new THREE.GridHelper(190, 19, 0x3a3d31, 0x25271f);
  floor.position.y = -9.6;
  floor.material.transparent = true;
  floor.material.opacity = 0.5;
  floor.material.depthWrite = false;
  sceneContent.add(floor);

  const axisGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-68, -9.5, 0),
    new THREE.Vector3(68, -9.5, 0),
  ]);
  const axisLine = new THREE.Line(
    axisGeometry,
    new THREE.LineBasicMaterial({
      color: 0x4d5142,
      transparent: true,
      opacity: 0.55,
    })
  );
  sceneContent.add(axisLine);

  const axisLabel = makeTextSprite("x", {
    color: "#77796c",
    fontSize: 44,
    height: 2.2,
  });
  axisLabel.position.set(70, -9.2, 0);
  sceneContent.add(axisLabel);

  const barrierGroup = new THREE.Group();
  const slabGeometry = new THREE.BoxGeometry(1, 17, 17);
  const slabMaterial = new THREE.MeshBasicMaterial({
    color: 0xc2a052,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const slab = new THREE.Mesh(slabGeometry, slabMaterial);
  slab.renderOrder = 2;
  barrierGroup.add(slab);

  const edgeGeometry = new THREE.EdgesGeometry(slabGeometry);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0xd4b264,
    transparent: true,
    opacity: 0.78,
  });
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edges.renderOrder = 3;
  barrierGroup.add(edges);

  sceneContent.add(barrierGroup);

  let barrierLabel = null;
  function setBarrierLabel(value) {
    if (barrierLabel) {
      sceneContent.remove(barrierLabel);
      barrierLabel.material.map?.dispose();
      barrierLabel.material.dispose();
    }
    barrierLabel = makeTextSprite(`V₀ ${value.toFixed(1)}`, {
      color: "#c2a052",
      fontSize: 44,
      height: 2.8,
    });
    barrierLabel.position.set(0, 9.6, 0);
    barrierLabel.renderOrder = 10;
    sceneContent.add(barrierLabel);
  }
  setBarrierLabel(DEFAULT_PARAMS.barrier);

  const positions = new Float32Array(PARTICLES * 3);
  const colors = new Float32Array(PARTICLES * 3);
  const cloudGeometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  const colorAttr = new THREE.BufferAttribute(colors, 3);
  colorAttr.setUsage(THREE.DynamicDrawUsage);
  cloudGeometry.setAttribute("position", positionAttr);
  cloudGeometry.setAttribute("color", colorAttr);

  const cloudMaterial = new THREE.PointsMaterial({
    size: 1.7,
    map: glowTexture,
    transparent: true,
    opacity: 0.8,
    vertexColors: true,
    depthWrite: false,
    alphaTest: 0.02,
    sizeAttenuation: true,
  });
  const cloud = new THREE.Points(cloudGeometry, cloudMaterial);
  cloud.frustumCulled = false;
  sceneContent.add(cloud);

  const random = mulberry32(0x51f3a7);
  const quantiles = new Float64Array(PARTICLES);
  for (let i = 0; i < PARTICLES; i++) {
    quantiles[i] = (i + random()) / PARTICLES;
  }

  const offsets = new Float32Array(PARTICLES * 2);
  for (let i = 0; i < PARTICLES; i++) {
    const radius = Math.min(4.6, Math.sqrt(-2 * Math.log(1 - random()))) * 2.0;
    const angle = TAU * random();
    offsets[i * 2] = radius * Math.cos(angle);
    offsets[i * 2 + 1] = radius * Math.sin(angle);
  }

  const scratchColor = new THREE.Color();
  let sampleXs = [];
  let sim = null;
  let frame = 0;
  let playing = false;
  let accum = 0;
  let disposed = false;
  let params = normalizeParams(DEFAULT_PARAMS);

  /* ---------------------------------------------------------------- sampling */

  function buildSamples(result) {
    const nFrames = result.frames.length;
    const xsByFrame = new Array(nFrames);
    const indices = result.display.indices;
    const count = indices.length;
    const cumulative = new Float64Array(count);

    for (let f = 0; f < nFrames; f++) {
      const density = result.frames[f];
      let total = 0;
      for (let j = 0; j < count; j++) {
        total += density[indices[j]];
        cumulative[j] = total;
      }

      const xs = new Float32Array(PARTICLES);
      if (total > 0) {
        for (let i = 0; i < PARTICLES; i++) {
          const target = quantiles[i] * total;
          let lo = 0;
          let hi = count - 1;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (cumulative[mid] < target) lo = mid + 1;
            else hi = mid;
          }
          xs[i] = result.x[indices[lo]];
        }
      }
      xsByFrame[f] = xs;
    }

    sampleXs = xsByFrame;
  }

  function writeFrame(index) {
    if (!sim) return;
    const xs = sampleXs[index];
    if (!xs) return;
    const phase = sim.phaseFrames[index];
    const { L, dx } = sim;

    for (let i = 0; i < PARTICLES; i++) {
      const x = xs[i];
      positions[i * 3] = x;
      positions[i * 3 + 1] = offsets[i * 2];
      positions[i * 3 + 2] = offsets[i * 2 + 1];

      let bin = Math.round((x + L / 2) / dx - 0.5);
      if (bin < 0) bin = 0;
      else if (bin >= phase.length) bin = phase.length - 1;

      const t = (phase[bin] + Math.PI) / TAU;
      phaseGradient(t, scratchColor);
      colors[i * 3] = scratchColor.r;
      colors[i * 3 + 1] = scratchColor.g;
      colors[i * 3 + 2] = scratchColor.b;
    }

    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  /* ---------------------------------------------------------------- trace */

  function drawTrace() {
    if (!plotHost.isConnected) return;
    const size = tracePlot.resize();
    if (size.width < 40 || size.height < 20) return;
    const ctx = tracePlot.ctx;
    ctx.clearRect(0, 0, size.width, size.height);

    const padX = size.width < 600 ? 12 : 20;
    const top = 4;
    const bottom = size.height - 18;
    const plot = {
      x: padX,
      y: top,
      w: size.width - padX * 2,
      h: Math.max(12, bottom - top),
    };
    const base = plot.y + plot.h;

    if (!sim) {
      rule(ctx, plot.x, base, plot.x + plot.w, base, PLATE_RULE);
      mono(ctx, 6.5, PLATE_FAINT);
      ctx.textAlign = "left";
      ctx.fillText("waiting for the solver", plot.x, base + 13);
      return;
    }

    const xMin = sim.display.min;
    const xMax = sim.display.max;
    const density = sim.frames[frame];
    if (!density) return;
    const indices = sim.display.indices;
    const peak = sim.peak > 0 ? sim.peak : 1;
    const toX = (x) => plot.x + ((x - xMin) / (xMax - xMin)) * plot.w;
    const toY = (value) => base - Math.pow(clamp(value / peak, 0, 1), 0.55) * plot.h;

    // The barrier is drawn first, so the probability trace remains visible
    // inside it. Both come from the same solved state.
    const barrierLeft = toX(-params.width / 2);
    const barrierRight = toX(params.width / 2);
    ctx.fillStyle = withAlpha(GOLD, 0.11);
    ctx.fillRect(barrierLeft, plot.y, Math.max(1, barrierRight - barrierLeft), plot.h);

    ctx.beginPath();
    ctx.moveTo(plot.x, base);
    for (let j = 0; j < indices.length; j++) {
      const x = sim.x[indices[j]];
      ctx.lineTo(toX(x), toY(density[indices[j]]));
    }
    ctx.lineTo(plot.x + plot.w, base);
    ctx.closePath();
    ctx.fillStyle = withAlpha(PLATE_INK, 0.12);
    ctx.fill();

    ctx.beginPath();
    for (let j = 0; j < indices.length; j++) {
      const x = sim.x[indices[j]];
      const px = toX(x);
      const py = toY(density[indices[j]]);
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = PLATE_INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    rule(ctx, plot.x, base, plot.x + plot.w, base, PLATE_RULE);
    rule(ctx, barrierLeft, plot.y, barrierLeft, base, withAlpha(GOLD, 0.48));
    rule(ctx, barrierRight, plot.y, barrierRight, base, withAlpha(GOLD, 0.48));
    rule(ctx, plot.x, plot.y, plot.x, base, PLATE_RULE);

    mono(ctx, 7.5, PLATE_FAINT);
    ctx.textAlign = "center";
    [-60, -30, 0, 30, 60].forEach((value) => {
      const x = toX(value);
      if (x < plot.x || x > plot.x + plot.w) return;
      rule(ctx, x, base, x, base + 3, PLATE_RULE);
      ctx.fillText(value === 0 ? "0" : String(value).replace("-", "−"), x, base + 14);
    });
    ctx.textAlign = "left";
    ctx.fillStyle = GOLD;
    ctx.fillText("V₀", Math.min(barrierLeft + 4, plot.x + plot.w - 18), plot.y + 10);

    mono(ctx, 7.5, PLATE_MUTED);
    ctx.textAlign = "left";
    ctx.fillText("0", plot.x, plot.y + 10);
    ctx.textAlign = "right";
    ctx.fillStyle = PLATE_FAINT;
    ctx.fillText("normalized · x / a.u.", plot.x + plot.w, plot.y + 10);
  }

  /* ---------------------------------------------------------------- readouts */

  function updateStaticReadouts() {
    if (!sim) return;
    const regime = regimeFor(params);
    const ratio = params.energy / params.barrier;

    statEls.analytic.textContent = percent(sim.analyticT);
    statEls.final.textContent = percent(sim.final.right);
    statEls.norm.textContent = sim.norm.toFixed(4);
    statEls.regimeName.textContent = regime.name;
    statEls.regimeSub.textContent = `E/V₀ ${ratio.toFixed(2)} · a ${params.width.toFixed(2)}`;
    regimeNote.textContent = regime.note;

    stageCopy.innerHTML = `<strong>E = ${params.energy.toFixed(1)}</strong> against a barrier of <strong>V₀ = ${params.barrier.toFixed(1)}</strong>, width <strong>${params.width.toFixed(1)}</strong> a.u.`;

    setBarrierLabel(params.barrier);
    barrierGroup.scale.x = params.width;
  }

  function updateFrameUI() {
    if (!sim) return;
    const probability = sim.probabilities[frame];
    const total = sim.times.length - 1;
    const t = sim.times[frame];

    statEls.right.textContent = (probability.right * 100).toFixed(1);
    statEls.segLeft.style.flexBasis = `${(probability.left * 100).toFixed(2)}%`;
    statEls.segInside.style.flexBasis = `${(probability.inside * 100).toFixed(2)}%`;
    statEls.segRight.style.flexBasis = `${(probability.right * 100).toFixed(2)}%`;
    statEls.splitLeft.textContent = percent(probability.left, 0);
    statEls.splitInside.textContent = percent(probability.inside, 0);
    statEls.splitRight.textContent = percent(probability.right, 0);

    timeNow.textContent = `t = ${t.toFixed(2)} a.u.`;
    frameNow.textContent = `${frame} / ${total}`;
    plotMeta.textContent = `t = ${t.toFixed(2)} a.u. · frame ${frame}`;
    timeline.value = String(frame);
    timeline.style.setProperty("--fill", `${(frame / total) * 100}%`);
    drawTrace();
    page.dataset.frame = String(frame);
    page.dataset.transmission = probability.right.toFixed(4);
  }

  function setFrame(next, { force = false } = {}) {
    if (!sim) return;
    const value = clamp(Math.round(next), 0, sim.frames.length - 1);
    if (value === frame && !force) return;
    frame = value;
    writeFrame(frame);
    updateFrameUI();
  }

  /* ---------------------------------------------------------------- playback */

  function updatePlayButton() {
    playButton.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
    playButton.setAttribute(
      "aria-label",
      playing ? "Pause simulation" : "Play simulation"
    );
    page.dataset.playing = String(playing);
  }

  function play() {
    if (!sim) return;
    if (frame >= sim.frames.length - 1) {
      setFrame(0, { force: true });
    }
    playing = true;
    accum = 0;
    updatePlayButton();
  }

  function pause() {
    playing = false;
    updatePlayButton();
  }

  function replay() {
    if (!sim) return;
    setFrame(0, { force: true });
    playing = true;
    accum = 0;
    updatePlayButton();
  }

  playButton.addEventListener("click", () => {
    if (playing) pause();
    else play();
  });

  page.querySelector(".replay-btn").addEventListener("click", replay);

  timeline.addEventListener("input", () => {
    pause();
    setFrame(Number(timeline.value));
  });

  updatePlayButton();

  stage.start((dt) => {
    if (!playing || !sim) return;
    accum += Math.min(dt, 0.1);
    const step = 1 / FPS;
    let advanced = false;
    while (accum >= step) {
      accum -= step;
      if (frame >= sim.frames.length - 1) {
        playing = false;
        updatePlayButton();
        accum = 0;
        break;
      }
      frame += 1;
      advanced = true;
    }
    if (advanced) {
      writeFrame(frame);
      updateFrameUI();
    }
  });

  /* ---------------------------------------------------------------- presets */

  const presetButtons = PRESETS.map((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset";
    button.dataset.preset = preset.id;
    button.setAttribute(
      "title",
      `E ${preset.params.energy} · V₀ ${preset.params.barrier} · a ${preset.params.width}`
    );
    button.innerHTML = `
      <canvas class="preset-map" width="160" height="43" aria-hidden="true"></canvas>
      <span class="preset-info">
        <span class="preset-name">${preset.name}</span>
        <span class="preset-t">T ${Math.round(
          planeWaveTransmission(
            preset.params.energy,
            preset.params.barrier,
            preset.params.width
          ) * 100
        )}%</span>
      </span>
    `;
    button.addEventListener("click", () => {
      applyParams(preset.params);
      markActivePreset(preset.id);
    });
    presetGrid.appendChild(button);
    return button;
  });

  function markActivePreset(id) {
    presetButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.preset === id);
    });
    page.dataset.preset = id ?? "";
  }

  function activePresetFor(next) {
    return (
      PRESETS.find((preset) =>
        Object.keys(DEFAULT_PARAMS).every(
          (key) => Math.abs(preset.params[key] - next[key]) < 1e-6
        )
      )?.id ?? null
    );
  }

  /* ---------------------------------------------------------------- thumbnails */

  const thumbnailTimers = [];

  function drawSpacetime(canvas, result) {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const image = ctx.createImageData(width, height);
    const data = image.data;
    const { min, max } = result.display;
    const span = max - min;
    const nFrames = result.frames.length;

    let peakDensity = 0;
    for (const density of result.frames) {
      for (let i = 0; i < density.length; i += 3) {
        if (density[i] > peakDensity) peakDensity = density[i];
      }
    }
    peakDensity = peakDensity || 1;

    const stops = [
      [0.0, [17, 18, 15]],
      [0.32, [76, 108, 143]],
      [0.62, [127, 167, 154]],
      [0.85, [211, 193, 155]],
      [1.0, [196, 106, 69]],
    ];

    const mix = (t) => {
      let index = 0;
      while (index < stops.length - 2 && t > stops[index + 1][0]) index++;
      const a = stops[index];
      const b = stops[index + 1];
      const local = clamp((t - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1);
      return [
        a[1][0] + (b[1][0] - a[1][0]) * local,
        a[1][1] + (b[1][1] - a[1][1]) * local,
        a[1][2] + (b[1][2] - a[1][2]) * local,
      ];
    };

    for (let row = 0; row < height; row++) {
      const f = Math.round((1 - row / (height - 1)) * (nFrames - 1));
      const density = result.frames[f];
      for (let col = 0; col < width; col++) {
        const x = min + (col / (width - 1)) * span;
        const bin = clamp(
          Math.round((x + result.L / 2) / result.dx - 0.5),
          0,
          density.length - 1
        );
        const value = Math.pow(clamp(density[bin] / peakDensity, 0, 1), 0.42);
        const [r, g, b] = mix(value);
        const offset = (row * width + col) * 4;
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
        data[offset + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);

    const centre = ((0 - min) / span) * width;
    const thickness = Math.max(1.5, (result.params.width / span) * width);
    ctx.fillStyle = "rgba(194, 160, 82, 0.55)";
    ctx.fillRect(centre - thickness / 2, 0, thickness, height);
  }

  function buildThumbnail(index) {
    if (disposed) return;
    const preset = PRESETS[index];
    const button = presetButtons[index];
    if (!preset || !button) return;
    const canvas = button.querySelector("canvas");

    const result = simulate(preset.params, { frames: 48 });
    drawSpacetime(canvas, result);
    const measured = Math.round(result.final.right * 100);
    const label = button.querySelector(".preset-t");
    label.textContent = `T ${measured}%`;
    label.setAttribute("title", `${measured}% transmitted in this run`);
  }

  function scheduleThumbnails() {
    PRESETS.forEach((_, index) => {
      thumbnailTimers.push(
        window.setTimeout(() => buildThumbnail(index), 340 + index * 130)
      );
    });
  }

  /* ---------------------------------------------------------------- simulation */

  function syncControls() {
    sliders.energy?.set(params.energy);
    sliders.barrier?.set(params.barrier);
    sliders.width?.set(params.width);
    sliders.sigma?.set(params.sigma);
    sliders.x0?.set(params.x0);
  }

  function applyParams(next, { autoplay = true } = {}) {
    params = normalizeParams(next);
    syncControls();
    markActivePreset(activePresetFor(params));
    scheduleRun(autoplay);
  }

  function runSimulation(autoplay = true) {
    if (disposed) return;
    loader.classList.add("visible");

    window.setTimeout(() => {
      if (disposed) return;
      try {
        sim = simulate(params, { frames: FRAMES });
        buildSamples(sim);
        timeline.max = String(sim.frames.length - 1);
        updateStaticReadouts();
        frame = -1;
        setFrame(0, { force: true });
        pause();
        if (autoplay) play();
        page.dataset.frames = String(sim.frames.length);
        page.dataset.ready = "true";
      } catch (error) {
        console.error(error);
        page.dataset.error = String(error?.message || error);
      } finally {
        loader.classList.remove("visible");
      }
    }, 24);
  }

  const runDebounced = debounce((autoplay) => runSimulation(autoplay), 170);

  function scheduleRun(autoplay) {
    loader.classList.add("visible");
    if (sim) updateAnalyticPreview();
    runDebounced(autoplay);
  }

  function updateAnalyticPreview() {
    const regime = regimeFor(params);
    statEls.analytic.textContent = percent(
      planeWaveTransmission(params.energy, params.barrier, params.width)
    );
    statEls.regimeName.textContent = regime.name;
    statEls.regimeSub.textContent = `E/V₀ ${(params.energy / params.barrier).toFixed(
      2
    )} · a ${params.width.toFixed(2)}`;
    regimeNote.textContent = regime.note;
    stageCopy.innerHTML = `<strong>E = ${params.energy.toFixed(1)}</strong> against a barrier of <strong>V₀ = ${params.barrier.toFixed(1)}</strong>, width <strong>${params.width.toFixed(1)}</strong> a.u.`;
  }

  /* ---------------------------------------------------------------- controls */

  const sliders = {};

  const sliderDefs = [
    ["energy", "Energy", "E", (value) => value.toFixed(1)],
    ["barrier", "Barrier height", "V₀", (value) => value.toFixed(1)],
    ["width", "Barrier width", "a", (value) => value.toFixed(1)],
    ["sigma", "Packet width", "σ", (value) => value.toFixed(1)],
    ["x0", "Start position", "x₀", (value) => `${Math.round(value)}`],
  ];

  sliderDefs.forEach(([key, label, note, format]) => {
    const limit = PARAM_LIMITS[key];
    const slider = createSlider({
      label,
      note,
      min: limit.min,
      max: limit.max,
      step: limit.step,
      unit: limit.unit,
      value: params[key],
      format: (value) => format(value),
      onInput: (value) => {
        params = normalizeParams({ ...params, [key]: value });
        markActivePreset(activePresetFor(params));
        updateAnalyticPreview();
        scheduleRun(true);
      },
    });
    sliders[key] = slider;
    controlsHost.appendChild(slider.root);
  });

  page.querySelector('[data-action="reset"]').addEventListener("click", () => {
    applyParams(DEFAULT_PARAMS);
  });

  page.querySelector('[data-action="randomize"]').addEventListener("click", () => {
    const randomBetween = (min, max, step) =>
      Math.round((min + Math.random() * (max - min)) / step) * step;
    applyParams({
      energy: Number(randomBetween(1.2, 4.8, 0.1).toFixed(2)),
      barrier: Number(randomBetween(1.0, 7.0, 0.1).toFixed(2)),
      width: Number(randomBetween(0.6, 3.2, 0.1).toFixed(2)),
      sigma: Number(randomBetween(1.5, 3.6, 0.1).toFixed(2)),
      x0: -35,
    });
  });

  /* ---------------------------------------------------------------- boot */

  params = normalizeParams(DEFAULT_PARAMS);
  markActivePreset(activePresetFor(params));
  page.dataset.ready = "false";
  runSimulation(true);
  scheduleThumbnails();

  return () => {
    disposed = true;
    runDebounced.cancel();
    thumbnailTimers.forEach((timer) => window.clearTimeout(timer));
    tracePlot.dispose();
    stage.dispose();
    glowTexture.dispose();
  };
}
