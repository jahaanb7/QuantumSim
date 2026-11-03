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

const SEGMENTS = 96;
const TAU = Math.PI * 2;


const PLAY_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6L19 12z"/></svg>';
const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

const BASE = new THREE.Color("#2b2c25");
const POSITIVE = new THREE.Color("#ede6d3");
const NEGATIVE = new THREE.Color("#c8663f");
const DENSITY = new THREE.Color("#bccbae");

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

        <p class="side-note"><strong>Read the surface.</strong> Positive lobes rise above the plane; negative lobes sink below it. Nodes are the dark lines at zero.</p>
      </div>

      <div class="side-foot"><span>2D box</span><span>L = 1</span></div>
    </aside>

    <section class="work">
      <div class="stage">
        <div class="stage-canvas"></div>
        <div class="stage-head">
          <p class="eyebrow">02 / Two-dimensional box</p>
          <h1 class="stage-title" data-stage-title>ψ₂₁</h1>
          <p class="stage-copy" data-stage-copy></p>
        </div>
        <div class="stage-meta">
          <span>96 × 96 grid</span>
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

  stage.scene.add(new THREE.HemisphereLight(0xfff7e7, 0x11120e, 1.5));
  const keyLight = new THREE.DirectionalLight(0xfff2d8, 2.1);
  keyLight.position.set(4, 6, 5);
  stage.scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x9fb2be, 0.9);
  rimLight.position.set(-5, 3, -4);
  stage.scene.add(rimLight);

  const grid = new THREE.GridHelper(2.62, 13, 0x404237, 0x292b23);
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
      color: 0x555849,
      transparent: true,
      opacity: 0.55,
    })
  );
  stage.scene.add(frame);

  const xLabel = makeTextSprite("x", {
    color: "#85877a",
    fontSize: 46,
    height: 0.13,
  });
  xLabel.position.set(1.25, 0.02, 0);
  surfaceGroup.add(xLabel);

  const yLabel = makeTextSprite("y", {
    color: "#85877a",
    fontSize: 46,
    height: 0.13,
  });
  yLabel.position.set(0, 1.25, 0);
  surfaceGroup.add(yLabel);

  const psiLabel = makeTextSprite("ψ", {
    color: "#85877a",
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

  let peak = 1;
  let lastRibbon = 0;

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
        value = (a * Math.cos(state.phase) + ground) / 2;
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

    els.copy.textContent =
      state.display === "psi"
        ? "The real part of the wavefunction. Positive lobes rise above the plane; negative lobes sink below it."
        : "The probability density, |ψ|². Every lobe is positive; the wavefunction is zero along the dark nodal lines.";
  }

  function updateLegend() {
    if (state.display === "density") {
      els.legend.innerHTML = `
        <span class="legend-key"><i style="background:#bccbae"></i>|ψ|²</span>
        <span class="legend-key"><i style="background:#5a5c4f"></i>ψ = 0</span>
      `;
      return;
    }
    els.legend.innerHTML = `
      <span class="legend-key"><i style="background:#ede6d3"></i>ψ &gt; 0</span>
      <span class="legend-key"><i style="background:#c8663f"></i>ψ &lt; 0</span>
      <span class="legend-key"><i style="background:#5a5c4f"></i>ψ = 0</span>
    `;
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
    updateSurface();
    if (copy) updateCopy();
    updateLegend();
    updateRibbon();
    updatePlayback();
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
    ],
    value: state.display,
    onChange: (value) => {
      state.display = value;
      els.displayLabel.textContent =
        value === "psi" ? "signed wave" : "probability";
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

  stage.start((dt) => {
    if (!state.mix || !state.playing) return;
    state.phase += Math.min(dt, 0.05) * 0.85;
    updateSurface();
    els.time.textContent = `φ ${state.phase.toFixed(2)} rad`;

    lastRibbon += dt;
    if (lastRibbon > 0.12) {
      lastRibbon = 0;
      updateRibbon();
    }
  });

  refresh();
  updatePlayback();

  return () => {
    stage.dispose();
  };
}
