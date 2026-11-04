/**
 * Wavefunction — a 3D surface plot of a two-dimensional box eigenstate.
 *
 * The surface height is Re(psi) or |psi|^2 on a square domain. A ground-state
 * superposition animates the relative phase, showing how probability sloshes
 * between the lobes while the stationary state stays fixed.
 */

import * as THREE from "three";
import { createStage, makeTextSprite } from "../stage.js";
import { createSlider, createSwitch, createSegmented } from "../ui.js";
import {
  createOverlayCanvas,
  mono,
  rule,
  withAlpha,
  drawCaption,
  PLATE_INK,
  PLATE_MUTED,
  PLATE_FAINT,
  PLATE_RULE,
} from "../plots.js";

const SEGMENTS = 96;
const TAU = Math.PI * 2;


const PLAY_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6L19 12z"/></svg>';
const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

const BASE = new THREE.Color("#0a1018");
const POSITIVE = new THREE.Color("#b9d8fb");
const NEGATIVE = new THREE.Color("#3f7fd9");
const DENSITY = new THREE.Color("#a9d3ff");

const stateLabel = (nx, ny) =>
  `ψ<sub>${nx}</sub><sub>${ny}</sub>`;
const energyRatio = (nx, ny) => (nx * nx + ny * ny) / 2;

export function mountWavefunctionPage(root) {
  const page = document.createElement("div");
  page.className = "page page-wave";
  page.innerHTML = `
    <aside class="side">
      <div class="side-head">
        <p class="eyebrow"><span>02</span> Wavefunction</p>
        <h1>The shape of<br><em>probability</em></h1>
        <p class="lede">A particle in a square box, cut open as a surface. The wave is signed; its square is probability.</p>
      </div>

      <div class="side-body">
        <div class="section-head"><span>State</span><span data-state-label>ψ₂₁</span></div>
        <div class="choice-block"><span class="choice-label">n<sub>x</sub></span><div class="seg" data-nx></div></div>
        <div class="choice-block"><span class="choice-label">n<sub>y</sub></span><div class="seg" data-ny></div></div>

        <div class="section-head"><span>Display</span><span data-display-label>signed wave</span></div>
        <div class="seg wide" data-display></div>

        <div class="section-head"><span>Superposition</span><span data-mix-label>off</span></div>
        <div data-mix-host></div>
        <div class="controls" data-wave-controls></div>

        <p class="side-note" data-wave-note><strong>Read the surface.</strong> Positive lobes rise above the plane; negative lobes sink below it. Nodes are the dark lines at zero.</p>
      </div>

      <div class="side-foot"><span>2D box</span><span>L = 1</span></div>
    </aside>

    <section class="work">
      <div class="stage">
        <div class="stage-canvas"></div>
        <div class="stage-2d" data-stage-map hidden></div>
        <div class="stage-head">
          <p class="eyebrow">02 / Two-dimensional box</p>
          <h1 class="stage-title" data-stage-title>ψ₂₁</h1>
          <p class="stage-copy" data-stage-copy></p>
        </div>
        <div class="stage-meta">
          <span data-wave-meta>96 × 96 grid</span>
          <span class="plate-index">Plate 02</span>
        </div>
        <div class="stage-legend" data-legend></div>
        <div class="wave-playback" hidden>
          <button type="button" class="play-btn" data-play aria-label="Pause phase"></button>
          <span class="time" data-time>φ 0.00 rad</span>
        </div>
      </div>
      <div class="ribbon"></div>
    </section>
  `;
  root.appendChild(page);

  const els = {
    nxHost: page.querySelector("[data-nx]"),
    nyHost: page.querySelector("[data-ny]"),
    displayHost: page.querySelector("[data-display]"),
    mixHost: page.querySelector("[data-mix-host]"),
    waveControls: page.querySelector("[data-wave-controls]"),
    stateLabel: page.querySelector("[data-state-label]"),
    displayLabel: page.querySelector("[data-display-label]"),
    mixLabel: page.querySelector("[data-mix-label]"),
    title: page.querySelector("[data-stage-title]"),
    copy: page.querySelector("[data-stage-copy]"),
    legend: page.querySelector("[data-legend]"),
    ribbon: page.querySelector(".ribbon"),
    playback: page.querySelector(".wave-playback"),
    playButton: page.querySelector("[data-play]"),
    time: page.querySelector("[data-time]"),
    mapHost: page.querySelector("[data-stage-map]"),
    meta: page.querySelector("[data-wave-meta]"),
    note: page.querySelector("[data-wave-note]"),
  };

  const stage = createStage(page.querySelector(".stage-canvas"), {
    fov: 32,
    cameraPosition: [3.3, 2.7, 3.9],
    target: [0, 0.08, 0],
    minDistance: 2.6,
    maxDistance: 9,
    minPolarAngle: 0.12,
    maxPolarAngle: Math.PI / 2 - 0.06,
    autoRotate: false,
    enablePan: false,
  });

  const surfaceGroup = new THREE.Group();
  surfaceGroup.rotation.x = -Math.PI / 2;
  stage.scene.add(surfaceGroup);

  stage.scene.add(new THREE.HemisphereLight(0xf2f8ff, 0x0a1018, 1.5));
  const keyLight = new THREE.DirectionalLight(0xeaf4ff, 2.1);
  keyLight.position.set(4, 6, 5);
  stage.scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x9cc7fa, 0.9);
  rimLight.position.set(-5, 3, -4);
  stage.scene.add(rimLight);

  const grid = new THREE.GridHelper(2.62, 13, 0x1d2c3c, 0x111a24);
  grid.material.transparent = true;
  grid.material.opacity = 0.62;
  grid.material.depthWrite = false;
  stage.scene.add(grid);

  const framePoints = [
    new THREE.Vector3(-1.02, 0, -1.02),
    new THREE.Vector3(1.02, 0, -1.02),
    new THREE.Vector3(1.02, 0, 1.02),
    new THREE.Vector3(-1.02, 0, 1.02),
  ];
  const frame = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(framePoints),
    new THREE.LineBasicMaterial({
      color: 0x2c4056,
      transparent: true,
      opacity: 0.55,
    })
  );
  stage.scene.add(frame);

  const xLabel = makeTextSprite("x", {
    color: "#7f9ab5",
    fontSize: 46,
    height: 0.13,
  });
  xLabel.position.set(1.25, 0.02, 0);
  surfaceGroup.add(xLabel);

  const yLabel = makeTextSprite("y", {
    color: "#7f9ab5",
    fontSize: 46,
    height: 0.13,
  });
  yLabel.position.set(0, 1.25, 0);
  surfaceGroup.add(yLabel);

  const psiLabel = makeTextSprite("ψ", {
    color: "#7f9ab5",
    fontSize: 46,
    height: 0.13,
  });
  psiLabel.position.set(0, 0, 1.34);
  surfaceGroup.add(psiLabel);

  const geometry = new THREE.PlaneGeometry(2, 2, SEGMENTS, SEGMENTS);
  const count = (SEGMENTS + 1) * (SEGMENTS + 1);
  const colors = new Float32Array(count * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const positionAttr = geometry.attributes.position;
  const colorAttr = geometry.attributes.color;

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const surface = new THREE.Mesh(geometry, material);
  surfaceGroup.add(surface);

  const state = {
    nx: 2,
    ny: 1,
    display: "psi",
    mix: false,
    playing: false,
    phase: 0,
    height: 0.8,
  };

  const mapCanvas = createOverlayCanvas(els.mapHost, "wave-plan");
  mapCanvas.onResize(() => {
    if (state.display === "contour") drawContour();
  });

  let peak = 1;
  let lastRibbon = 0;
  let phaseRaf = 0;
  let lastPhase = 0;

  /* ---------------------------------------------------------------- surface */

  function updateSurface() {
    let maxValue = 0;

    for (let i = 0; i < count; i++) {
      const x = positionAttr.getX(i);
      const y = positionAttr.getY(i);

      const a =
        Math.sin((state.nx * Math.PI * (x + 1)) / 2) *
        Math.sin((state.ny * Math.PI * (y + 1)) / 2);
      let value = a;

      if (state.mix) {
        const ground =
          Math.sin((Math.PI * (x + 1)) / 2) *
          Math.sin((Math.PI * (y + 1)) / 2);
        // |cos(phase)·excited + ground|² integrates to
        // (1 + cos²phase)/4 for orthonormal states. Normalize the displayed
        // coherent state so its squared magnitude is a true density.
        const norm = 2 / Math.sqrt(1 + Math.cos(state.phase) ** 2);
        value = ((a * Math.cos(state.phase) + ground) / 2) * norm;
      }

      if (state.display === "density") value *= value;
      if (Math.abs(value) > maxValue) maxValue = Math.abs(value);

      positionAttr.setZ(i, value * state.height);

      const magnitude = Math.min(1, Math.abs(value));
      if (state.display === "density") {
        colorAttr.setXYZ(
          i,
          BASE.r + (DENSITY.r - BASE.r) * Math.pow(magnitude, 0.65),
          BASE.g + (DENSITY.g - BASE.g) * Math.pow(magnitude, 0.65),
          BASE.b + (DENSITY.b - BASE.b) * Math.pow(magnitude, 0.65)
        );
      } else {
        const target = value >= 0 ? POSITIVE : NEGATIVE;
        colorAttr.setXYZ(
          i,
          BASE.r + (target.r - BASE.r) * magnitude,
          BASE.g + (target.g - BASE.g) * magnitude,
          BASE.b + (target.b - BASE.b) * magnitude
        );
      }
    }

    peak = maxValue || 1;
    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }

  /* ---------------------------------------------------------------- labels */

  function updateCopy() {
    els.title.innerHTML = state.mix
      ? `${stateLabel(state.nx, state.ny)} + ψ<sub>1</sub><sub>1</sub>`
      : stateLabel(state.nx, state.ny);

    if (state.display === "contour") {
      els.copy.textContent =
        "A plan view of the same normalized state. Light blue is positive, deep blue is negative, and the thin dark curves are nodal lines.";
      els.note.innerHTML =
        "<strong>Read the map.</strong> This is the same sampled state as the surface, seen from above. The field crosses zero at the dark nodal lines; its sign tells you which way the wavefunction points.";
    } else if (state.display === "psi") {
      els.copy.textContent =
        "The real part of the wavefunction. Positive lobes rise above the plane; negative lobes sink below it.";
      els.note.innerHTML =
        "<strong>Read the surface.</strong> Positive lobes rise above the plane; negative lobes sink below it. Nodes are the dark lines at zero.";
    } else {
      els.copy.textContent =
        "The probability density, |ψ|². Every lobe is positive; the wavefunction is zero along the dark nodal lines.";
      els.note.innerHTML =
        "<strong>Read the density.</strong> Squaring removes the sign, so every lobe is positive. The dark lines mark where the wavefunction itself is zero.";
    }
  }

  function updateLegend() {
    if (state.display === "density") {
      els.legend.innerHTML = `
        <span class="legend-key"><i style="background:#a9d3ff"></i>|ψ|²</span>
        <span class="legend-key"><i style="background:#5e7388"></i>ψ = 0</span>
      `;
      return;
    }
    const plan = state.display === "contour"
      ? `<span class="legend-key">plan view</span>`
      : "";
    els.legend.innerHTML = `
      ${plan}
      <span class="legend-key"><i style="background:#b9d8fb"></i>ψ &gt; 0</span>
      <span class="legend-key"><i style="background:#3f7fd9"></i>ψ &lt; 0</span>
      <span class="legend-key"><i style="background:#5e7388"></i>ψ = 0</span>
    `;
  }

  function tickPhase(now) {
    phaseRaf = 0;
    if (!state.mix || !state.playing) return;

    const dt = lastPhase ? Math.min(0.05, (now - lastPhase) / 1000) : 0;
    lastPhase = now;
    if (dt > 0) {
      state.phase += dt * 0.85;
      if (state.display === "contour") drawContour();
      else updateSurface();
      els.time.textContent = `φ ${state.phase.toFixed(2)} rad`;

      lastRibbon += dt;
      if (lastRibbon > 0.12) {
        lastRibbon = 0;
        updateRibbon();
      }
    }
    phaseRaf = window.requestAnimationFrame(tickPhase);
  }

  function syncClock() {
    if (state.mix && state.playing) {
      if (!phaseRaf) {
        lastPhase = 0;
        phaseRaf = window.requestAnimationFrame(tickPhase);
      }
    } else {
      if (phaseRaf) window.cancelAnimationFrame(phaseRaf);
      phaseRaf = 0;
      lastPhase = 0;
    }
  }

  function updatePlayback() {
    els.playback.hidden = !state.mix;
    els.playButton.innerHTML = state.playing ? PAUSE_ICON : PLAY_ICON;
    els.playButton.setAttribute(
      "aria-label",
      state.playing ? "Pause phase" : "Play phase"
    );
    els.time.textContent = `φ ${state.phase.toFixed(2)} rad`;
    els.mixLabel.textContent = state.mix ? "on" : "off";
    els.stateLabel.innerHTML = stateLabel(state.nx, state.ny);
    syncClock();
  }

  function updateRibbon() {
    const nodes = state.nx - 1 + (state.ny - 1);
    const items = [
      [
        "State",
        stateLabel(state.nx, state.ny),
        `n_x = ${state.nx} · n_y = ${state.ny}`,
      ],
      [
        "Energy",
        `${energyRatio(state.nx, state.ny).toFixed(2)}<em>E₁₁</em>`,
        "E = (n_x² + n_y²)π²/2",
      ],
      [
        "Nodal lines",
        String(nodes),
        `${state.nx - 1} vertical · ${state.ny - 1} horizontal`,
      ],
      ["Peak density", peak.toFixed(2), "normalized height"],
      [
        "Mode",
        state.mix ? "Beat" : "Fixed",
        state.mix ? `relative phase ${state.phase.toFixed(2)} rad` : "time-independent",
      ],
    ];

    els.ribbon.innerHTML = items
      .map(
        ([label, value, note]) => `
          <div class="metric">
            <span class="label">${label}</span>
            <span class="value">${value}</span>
            <span class="sub">${note}</span>
          </div>
        `
      )
      .join("");
  }

  function refresh({ copy = true } = {}) {
    if (state.display !== "contour") updateSurface();
    if (copy) updateCopy();
    updateLegend();
    updateRibbon();
    updatePlayback();
    syncMapView();
  }

  function syncMapView() {
    const mapped = state.display === "contour";
    els.mapHost.hidden = !mapped;
    page.dataset.view = mapped ? "contour" : "wave";
    els.meta.textContent = mapped ? "256² plan map" : "96 × 96 grid";
    heightSlider.root.hidden = mapped;
    // Do not keep rendering a hidden WebGL surface underneath the plan map.
    if (mapped) stage.stop();
    else stage.start();
    if (mapped) {
      void els.mapHost.offsetWidth;
      mapCanvas.resize();
      drawContour();
      window.requestAnimationFrame(() => {
        if (state.display !== "contour") return;
        mapCanvas.resize();
        drawContour();
      });
    }
  }

  function drawContour() {
    if (state.display !== "contour" || els.mapHost.hidden) return;
    const size = mapCanvas.resize();
    if (size.width < 40 || size.height < 80) return;
    const ctx = mapCanvas.ctx;
    const stageBox = page.querySelector(".stage").getBoundingClientRect();
    const headBox = page.querySelector(".stage-head").getBoundingClientRect();
    const headBottom = headBox.bottom - stageBox.top;
    const narrow = size.width < 700;
    const margin = narrow ? 20 : 34;
    const top = Math.min(
      size.height - 100,
      Math.max(narrow ? 190 : 200, headBottom + 24)
    );
    const bottom = size.height - (state.mix ? (narrow ? 104 : 88) : narrow ? 58 : 72);
    const square = Math.min(
      size.width - margin * 2,
      Math.max(80, bottom - top),
      470
    );
    const x = (size.width - square) / 2;
    const y = top + Math.max(0, (bottom - top - square) / 2);
    const resolution = 256;
    const source = document.createElement("canvas");
    source.width = resolution;
    source.height = resolution;
    const sourceCtx = source.getContext("2d");
    const image = sourceCtx.createImageData(resolution, resolution);
    const values = new Float32Array(resolution * resolution);
    let maxValue = 0;

    for (let row = 0; row < resolution; row++) {
      const v = 1 - row / (resolution - 1);
      for (let col = 0; col < resolution; col++) {
        const u = col / (resolution - 1);
        const a =
          Math.sin(state.nx * Math.PI * u) *
          Math.sin(state.ny * Math.PI * v);
        let value = a;
        if (state.mix) {
          const ground = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
          const norm = 2 / Math.sqrt(1 + Math.cos(state.phase) ** 2);
          value = ((a * Math.cos(state.phase) + ground) / 2) * norm;
        }
        const index = row * resolution + col;
        values[index] = value;
        maxValue = Math.max(maxValue, Math.abs(value));
      }
    }

    const positive = [185, 216, 251];
    const negative = [63, 127, 217];
    const base = [8, 12, 18];
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const magnitude = maxValue > 0 ? Math.pow(Math.abs(value) / maxValue, 0.45) : 0;
      const tint = value < 0 ? negative : positive;
      const offset = i * 4;
      image.data[offset] = base[0] + (tint[0] - base[0]) * magnitude;
      image.data[offset + 1] = base[1] + (tint[1] - base[1]) * magnitude;
      image.data[offset + 2] = base[2] + (tint[2] - base[2]) * magnitude;
      image.data[offset + 3] = 255;
    }

    // A one-pixel zero crossing is more honest than a decorative outline:
    // it follows the same sampled state as the colour field.
    for (let row = 0; row < resolution; row++) {
      for (let col = 0; col < resolution; col++) {
        const index = row * resolution + col;
        const value = values[index];
        const right = col < resolution - 1 ? values[index + 1] : value;
        const below = row < resolution - 1 ? values[index + resolution] : value;
        if (Math.sign(value) !== Math.sign(right) || Math.sign(value) !== Math.sign(below)) {
          const offset = index * 4;
          image.data[offset] = 20;
          image.data[offset + 1] = 32;
          image.data[offset + 2] = 48;
        }
      }
    }

    sourceCtx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, x, y, square, square);
    ctx.strokeStyle = PLATE_RULE;
    ctx.strokeRect(x + 0.5, y + 0.5, square - 1, square - 1);

    drawCaption(
      ctx,
      state.mix ? "plan view · superposition" : "plan view · stationary state",
      x,
      y - 14
    );
    mono(ctx, 7.5, PLATE_MUTED);
    ctx.textAlign = "right";
    ctx.fillText(`φ ${state.phase.toFixed(2)} rad`, x + square, y - 14);
    mono(ctx, 7.5, PLATE_FAINT);
    ctx.textAlign = "left";
    ctx.fillText("0", x, y + square + 15);
    ctx.textAlign = "center";
    ctx.fillText("0.5", x + square / 2, y + square + 15);
    ctx.textAlign = "right";
    ctx.fillText("1", x + square, y + square + 15);
    ctx.textAlign = "center";
    ctx.fillText("x / L", x + square / 2, y + square + 30);
    ctx.save();
    ctx.translate(x - 13, y + square / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("y / L", 0, 0);
    ctx.restore();
  }

  /* ---------------------------------------------------------------- controls */

  const nxSeg = createSegmented({
    options: [1, 2, 3, 4].map((value) => ({ value, label: String(value) })),
    value: state.nx,
    onChange: (value) => {
      state.nx = value;
      refresh();
    },
  });
  els.nxHost.appendChild(nxSeg.root);

  const nySeg = createSegmented({
    options: [1, 2, 3, 4].map((value) => ({ value, label: String(value) })),
    value: state.ny,
    onChange: (value) => {
      state.ny = value;
      refresh();
    },
  });
  els.nyHost.appendChild(nySeg.root);

  const displaySeg = createSegmented({
    options: [
      { value: "psi", label: "ψ signed" },
      { value: "density", label: "|ψ|² density" },
      { value: "contour", label: "Plan map" },
    ],
    value: state.display,
    onChange: (value) => {
      state.display = value;
      els.displayLabel.textContent =
        value === "psi"
          ? "signed wave"
          : value === "density"
          ? "probability"
          : "plan view";
      refresh();
    },
  });
  displaySeg.root.classList.add("wide");
  els.displayHost.replaceWith(displaySeg.root);

  const mixSwitch = createSwitch({
    label: "Superpose ground state",
    checked: false,
    onChange: (checked) => {
      state.mix = checked;
      state.phase = 0;
      state.playing = checked;
      refresh();
    },
  });
  els.mixHost.appendChild(mixSwitch.root);

  const heightSlider = createSlider({
    label: "Amplitude",
    note: "surface height",
    min: 0.35,
    max: 1.25,
    step: 0.05,
    value: state.height,
    format: (value) => value.toFixed(2),
    onInput: (value) => {
      state.height = value;
      updateSurface();
    },
  });
  els.waveControls.appendChild(heightSlider.root);

  els.playButton.addEventListener("click", () => {
    state.playing = !state.playing;
    updatePlayback();
  });

  /* ---------------------------------------------------------------- loop */

  // The phase clock is independent of the Three.js render loop. That keeps
  // playback advancing in Plan map mode, where the WebGL canvas is hidden.
  stage.start();

  refresh();
  updatePlayback();

  return () => {
    if (phaseRaf) window.cancelAnimationFrame(phaseRaf);
    mapCanvas.dispose();
    stage.dispose();
  };
}
