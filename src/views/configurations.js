/**
 * Quantum Configurations — 3D wave-packet scattering lab.
 *
 * The 1-D time-dependent Schrödinger equation is solved with the split-step
 * Fourier method, then |ψ(x,t)|² is turned into a 3D point cloud: every dot is
 * a sampled detection position, offset transversally so the density reads as a
 * volume. Colour encodes the phase of ψ.
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
import {
  createSlider,
  debounce,
  clamp,
  percent,
} from "../ui.js";

const FRAMES = 120;
const PARTICLES = 9000;
const FPS = 30;
const TAU = Math.PI * 2;

const PHASE_STOPS = [
  [0, "#2b6fd6"],
  [0.28, "#46e0e6"],
  [0.55, "#b08cff"],
  [0.82, "#ffe6a6"],
  [1, "#2b6fd6"],
];

const PRESETS = [
  {
    id: "tunneling",
    name: "Deep tunneling",
    params: { energy: 2.0, barrier: 4.0, width: 1.2, sigma: 2.4, x0: -35 },
  },
  {
    id: "threshold",
    name: "Near threshold",
    params: { energy: 3.6, barrier: 4.0, width: 1.0, sigma: 2.4, x0: -35 },
  },
  {
    id: "over",
    name: "Over the top",
    params: { energy: 5.0, barrier: 2.0, width: 1.4, sigma: 2.2, x0: -35 },
  },
  {
    id: "wide",
    name: "Wide barrier",
    params: { energy: 2.6, barrier: 2.8, width: 3.4, sigma: 2.8, x0: -35 },
  },
  {
    id: "thin",
    name: "Razor thin",
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
      color: "#59e6ff",
      note: "The packet carries less energy than the barrier, yet its tail leaks through. A thinner, lower barrier transmits far more.",
    };
  }
  if (ratio <= 1.15) {
    return {
      name: "Threshold regime",
      color: "#ffc46b",
      note: "E sits close to V₀, where transmission is acutely sensitive to the barrier width and to the packet's energy spread.",
    };
  }
  return {
    name: "Over the barrier",
    color: "#6ef0b8",
    note: "Classically the packet simply passes over. Quantum mechanically, fringes and a small reflected packet survive.",
  };
}

export function mountConfigurationsPage(root) {
  const page = document.createElement("div");
  page.className = "page page-config";
  page.innerHTML = `
    <aside class="rail rail-left rail-scroll">
      <div class="rail-head">
        <div class="kicker"><span class="accent-dot"></span>Scattering lab</div>
        <h2>Quantum configurations</h2>
        <p>Six prepared encounters between a Gaussian wave packet and a rectangular barrier.</p>
      </div>
      <div class="preset-grid" aria-label="Simulation presets"></div>
      <div class="preset-actions">
        <button type="button" class="ghost-btn" data-action="reset">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3.2 12a8.8 8.8 0 1 0 2.7-6.3"/><path d="M3 4.2v4.4h4.4"/></svg>
          Reset
        </button>
        <button type="button" class="ghost-btn" data-action="randomize">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>
          Randomize
        </button>
      </div>
      <div class="panel-head params-head"><span>Parameters</span><span class="mono">natural units</span></div>
      <div class="controls"></div>
      <div class="rail-note">
        <span class="note-icon">i</span>
        <div><strong>Bounded by design.</strong> Sliders stay inside the stable range of the 1024-point split-step solver, so every setting produces a valid, normalised run.</div>
      </div>
    </aside>

    <section class="stage">
      <div class="stage-canvas"></div>
      <div class="stage-watermark" aria-hidden="true">Ψ</div>
      <div class="stage-head">
        <div class="kicker"><span class="accent-dot"></span>Time-dependent Schrödinger equation</div>
        <h1>Tunneling in 3D</h1>
        <p class="stage-copy"></p>
      </div>
      <div class="stage-badge"><span class="badge-dot"></span>split-step TDSE · N = 1024</div>
      <div class="stage-legend static">
        <span class="legend-key"><i class="white"></i>dot density ∝ |ψ|²</span>
        <span class="legend-key"><i class="gradient" data-phase-key></i>colour = phase</span>
        <span class="legend-key"><i class="amber"></i>barrier V₀</span>
      </div>
      <div class="stage-loader">Solving Schrödinger equation</div>
      <div class="stage-hint">drag<span>·</span>orbit<span>·</span>scroll<span>·</span>zoom</div>

      <div class="playback">
        <button type="button" class="play-btn" aria-label="Play simulation">${PLAY_ICON}</button>
        <div class="timeline-wrap">
          <input type="range" min="0" max="120" step="1" value="0" aria-label="Simulation time" />
          <div class="playback-meta">
            <span class="time-now mono">t = 0.0 a.u.</span>
            <span class="frame-now mono">0 / 120</span>
          </div>
        </div>
        <button type="button" class="replay-btn" aria-label="Replay from the start">${REPLAY_ICON}</button>
      </div>
    </section>

    <aside class="rail rail-right">
      <div class="panel stat-panel">
        <div class="panel-head"><span>Transmission</span><span class="status-pill">live</span></div>
        <div class="big-stat">
          <strong data-stat="right">0</strong><span>%</span>
          <small>of the probability is right of the barrier</small>
        </div>
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

        <dl class="readout">
          <div class="readout-row"><dt>Energy E</dt><dd data-read="energy"></dd></div>
          <div class="readout-row"><dt>Barrier V₀</dt><dd data-read="barrier"></dd></div>
          <div class="readout-row"><dt>Barrier width a</dt><dd data-read="width"></dd></div>
          <div class="readout-row"><dt>Analytic T (plane wave)</dt><dd data-read="analytic"></dd></div>
          <div class="readout-row"><dt>Final T (this packet)</dt><dd data-read="final"></dd></div>
          <div class="readout-row"><dt>Norm ⟨ψ|ψ⟩</dt><dd data-read="norm" class="dim"></dd></div>
        </dl>

        <div class="regime-row" style="margin-top:13px">
          <div class="regime"><span class="regime-dot"></span><span data-regime-name>Deep tunneling</span></div>
          <p class="regime-sub" data-regime-sub></p>
          <p class="regime-note" data-regime-note></p>
        </div>

        <div class="ratio-row">
          <div class="ratio-top"><span>Energy relative to barrier</span><b data-ratio-label></b></div>
          <div class="ratio-track"><div class="ratio-fill" data-ratio-fill></div></div>
        </div>

        <div class="meta-grid">
          <div><span>Wavenumber k₀</span><b data-meta="k0"></b></div>
          <div><span>de Broglie λ</span><b data-meta="lambda"></b></div>
          <div><span>Packet σ₀</span><b data-meta="sigma"></b></div>
          <div><span>Grid</span><b data-meta="grid"></b></div>
        </div>
      </div>
    </aside>
  `;
  root.appendChild(page);

  const canvasHost = page.querySelector(".stage-canvas");
  const loader = page.querySelector(".stage-loader");
  const stageCopy = page.querySelector(".stage-copy");
  const presetGrid = page.querySelector(".preset-grid");
  const controlsHost = page.querySelector(".controls");
  const playButton = page.querySelector(".play-btn");
  const timeline = page.querySelector(".timeline-wrap input");
  const timeNow = page.querySelector(".time-now");
  const frameNow = page.querySelector(".frame-now");

  const statEls = {
    right: page.querySelector('[data-stat="right"]'),
    segLeft: page.querySelector('[data-seg="left"]'),
    segInside: page.querySelector('[data-seg="inside"]'),
    segRight: page.querySelector('[data-seg="right"]'),
    splitLeft: page.querySelector('[data-split="left"]'),
    splitInside: page.querySelector('[data-split="inside"]'),
    splitRight: page.querySelector('[data-split="right"]'),
    energy: page.querySelector('[data-read="energy"]'),
    barrier: page.querySelector('[data-read="barrier"]'),
    width: page.querySelector('[data-read="width"]'),
    analytic: page.querySelector('[data-read="analytic"]'),
    final: page.querySelector('[data-read="final"]'),
    norm: page.querySelector('[data-read="norm"]'),
    regimeName: page.querySelector("[data-regime-name]"),
    regimeSub: page.querySelector("[data-regime-sub]"),
    regimeNote: page.querySelector("[data-regime-note]"),
    regimeDot: page.querySelector(".regime-dot"),
    ratioLabel: page.querySelector("[data-ratio-label]"),
    ratioFill: page.querySelector("[data-ratio-fill]"),
    k0: page.querySelector('[data-meta="k0"]'),
    lambda: page.querySelector('[data-meta="lambda"]'),
    sigma: page.querySelector('[data-meta="sigma"]'),
    grid: page.querySelector('[data-meta="grid"]'),
  };

  // Legend gradient mirrors the palette used for the point colours.
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

  /* ---------------------------------------------------------------- 3D pieces */

  const floor = new THREE.GridHelper(190, 19, 0x22334f, 0x142036);
  floor.position.y = -9.6;
  floor.material.transparent = true;
  floor.material.opacity = 0.42;
  floor.material.depthWrite = false;
  sceneContent.add(floor);

  const axisGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-68, -9.5, 0),
    new THREE.Vector3(68, -9.5, 0),
  ]);
  const axisLine = new THREE.Line(
    axisGeometry,
    new THREE.LineBasicMaterial({
      color: 0x3a4f72,
      transparent: true,
      opacity: 0.5,
    })
  );
  sceneContent.add(axisLine);

  const axisLabel = makeTextSprite("x", {
    color: "#6f86a8",
    fontSize: 44,
    height: 2.4,
  });
  axisLabel.position.set(70, -9.2, 0);
  sceneContent.add(axisLabel);

  const barrierGroup = new THREE.Group();
  const slabGeometry = new THREE.BoxGeometry(1, 17, 17);
  const slabMaterial = new THREE.MeshBasicMaterial({
    color: 0xffc46b,
    transparent: true,
    opacity: 0.085,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const slab = new THREE.Mesh(slabGeometry, slabMaterial);
  slab.renderOrder = 2;
  barrierGroup.add(slab);

  const edgeGeometry = new THREE.EdgesGeometry(slabGeometry);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0xffc46b,
    transparent: true,
    opacity: 0.55,
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
      color: "#ffc46b",
      fontSize: 46,
      height: 3,
    });
    barrierLabel.position.set(0, 9.6, 0);
    barrierLabel.renderOrder = 10;
    sceneContent.add(barrierLabel);
  }
  setBarrierLabel(DEFAULT_PARAMS.barrier);

  // Point cloud, resampled from |ψ|² for each simulation frame.
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
    size: 0.9,
    map: glowTexture,
    transparent: true,
    opacity: 0.58,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
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

  // Fixed transverse offsets: one particle keeps its y/z while its x is
  // resampled each frame, which keeps the cloud from flickering.
  const offsets = new Float32Array(PARTICLES * 2);
  for (let i = 0; i < PARTICLES; i++) {
    const radius = Math.min(4, Math.sqrt(-2 * Math.log(1 - random()))) * 1.7;
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

  /* ---------------------------------------------------------------- stats UI */

  function updateStaticReadouts() {
    if (!sim) return;
    const regime = regimeFor(params);
    const ratio = params.energy / params.barrier;

    statEls.energy.textContent = `${params.energy.toFixed(2)} a.u.`;
    statEls.barrier.textContent = `${params.barrier.toFixed(2)} a.u.`;
    statEls.width.textContent = `${params.width.toFixed(2)} a.u.`;
    statEls.analytic.textContent = percent(sim.analyticT);
    statEls.final.textContent = percent(sim.final.right);
    statEls.norm.textContent = sim.norm.toFixed(4);

    statEls.regimeName.textContent = regime.name;
    statEls.regimeSub.textContent = `E / V₀ = ${ratio.toFixed(2)} · barrier ${params.width.toFixed(
      2
    )} a.u. wide`;
    statEls.regimeNote.textContent = regime.note;
    statEls.regimeDot.style.background = regime.color;
    statEls.regimeDot.style.boxShadow = `0 0 10px ${regime.color}`;

    statEls.ratioLabel.textContent = `${ratio.toFixed(2)} ×`;
    statEls.ratioFill.style.width = `${clamp(ratio / 1.5, 0, 1) * 100}%`;

    statEls.k0.textContent = `${sim.k0.toFixed(2)}`;
    statEls.lambda.textContent = `${((TAU / sim.k0) || 0).toFixed(2)}`;
    statEls.sigma.textContent = `${params.sigma.toFixed(1)}`;
    statEls.grid.textContent = `${sim.N} pts`;

    stageCopy.innerHTML = `A Gaussian packet with <strong>E = ${params.energy.toFixed(
      1
    )}</strong> meets a barrier of height <strong>V₀ = ${params.barrier.toFixed(
      1
    )}</strong> and width <strong>a = ${params.width.toFixed(
      1
    )}</strong>. Every dot is a sampled position; dot density is |ψ|².`;
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
    timeline.value = String(frame);
    timeline.style.setProperty("--fill", `${(frame / total) * 100}%`);
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
      <canvas class="preset-map" width="160" height="49" aria-hidden="true"></canvas>
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

  /* ---------------------------------------------------------------- presets: real x–t maps */

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

    let peak = 0;
    for (const density of result.frames) {
      for (let i = 0; i < density.length; i += 3) {
        if (density[i] > peak) peak = density[i];
      }
    }
    peak = peak || 1;

    const stops = [
      [0.0, [10, 20, 36]],
      [0.32, [28, 103, 158]],
      [0.62, [78, 222, 235]],
      [0.85, [176, 140, 255]],
      [1.0, [255, 230, 166]],
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
        const value = Math.pow(clamp(density[bin] / peak, 0, 1), 0.42);
        const [r, g, b] = mix(value);
        const offset = (row * width + col) * 4;
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
        data[offset + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);

    // Mark the barrier position.
    const centre = ((0 - min) / span) * width;
    const thickness = Math.max(1.5, (result.params.width / span) * width);
    ctx.fillStyle = "rgba(255, 196, 107, 0.5)";
    ctx.fillRect(centre - thickness / 2, 0, thickness, height);
  }

  function buildThumbnail(index) {
    if (disposed) return;
    const preset = PRESETS[index];
    const button = presetButtons[index];
    if (!preset || !button) return;
    const canvas = button.querySelector("canvas");

    // Use the full 1024-point grid: a coarse grid widens the effective barrier
    // and would understate transmission in the thumbnail.
    const result = simulate(preset.params, { frames: 48 });
    drawSpacetime(canvas, result);
    const measured = Math.round(result.final.right * 100);
    const label = button.querySelector(".preset-t");
    label.textContent = `T ${measured}%`;
    label.setAttribute("title", `${measured}% transmitted in this run`);
  }

  function scheduleThumbnails() {
    // Independent timers (not a chain) so background-tab throttling cannot
    // strand the last thumbnail.
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

    // A short timeout lets the loader paint before the solver blocks the
    // thread. Unlike rAF it also fires when the tab is in the background.
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
    statEls.regimeSub.textContent = `E / V₀ = ${(
      params.energy / params.barrier
    ).toFixed(2)} · barrier ${params.width.toFixed(2)} a.u. wide`;
    statEls.regimeNote.textContent = regime.note;
    statEls.regimeDot.style.background = regime.color;
    statEls.regimeDot.style.boxShadow = `0 0 10px ${regime.color}`;
    statEls.ratioLabel.textContent = `${(params.energy / params.barrier).toFixed(
      2
    )} ×`;
    statEls.ratioFill.style.width = `${clamp(
      params.energy / params.barrier / 1.5,
      0,
      1
    ) * 100}%`;
    statEls.energy.textContent = `${params.energy.toFixed(2)} a.u.`;
    statEls.barrier.textContent = `${params.barrier.toFixed(2)} a.u.`;
    statEls.width.textContent = `${params.width.toFixed(2)} a.u.`;
    statEls.sigma.textContent = `${params.sigma.toFixed(1)}`;
  }

  /* ---------------------------------------------------------------- controls */

  const sliders = {};

  const sliderDefs = [
    ["energy", "Particle energy", "E", (value) => `${value.toFixed(1)}`],
    ["barrier", "Barrier height", "V₀", (value) => `${value.toFixed(1)}`],
    ["width", "Barrier width", "a", (value) => `${value.toFixed(1)}`],
    ["sigma", "Packet width", "σ", (value) => `${value.toFixed(1)}`],
    [
      "x0",
      "Start position",
      "x₀",
      (value) => `${Math.round(value)}`,
    ],
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
    stage.dispose();
    glowTexture.dispose();
  };
}
