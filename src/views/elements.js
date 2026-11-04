/**
 * Builder — the quantum-number builder and a specimen index.
 *
 * Every dot is a Monte-Carlo sample of |psi_nlm|^2. The builder accepts
 * n = 1…5 and every real orbital through f, using exact hydrogen-like radial
 * functions with an effective nuclear charge. n, l, and m are the first
 * controls; the cloud, node counts, radius and energy respond immediately.
 */

import * as THREE from "three";
import { createStage, makeGlowTexture } from "../stage.js";
import { ELEMENTS, formatElementNumber } from "../data/elements.js";
import {
  sampleCloud,
  orbitalLabel,
  subshellLetter,
  radialFunction,
  angularShape,
  radialProfile,
  radialSummary,
  radialZeros,
} from "../physics/orbitals.js";
import {
  createSlider,
  createSwitch,
  createSegmented,
  debounce,
  clamp,
} from "../ui.js";
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
  PLATE_LINE,
  DATA_LIGHT,
} from "../plots.js";

const POSITIVE = "#b9d8fb";
const NEGATIVE = "#3f7fd9";
const CUSTOM_BASE = "#a9d3ff";
const NEGATIVE_RGB = new THREE.Color(NEGATIVE);
const POSITIVE_RGB = new THREE.Color(POSITIVE);
const CUSTOM_RGB = new THREE.Color(CUSTOM_BASE);

const M_ORDER = {
  0: [0],
  1: [0, 1, -1],
  2: [0, 1, -1, 2, -2],
  3: [0, 1, -1, 2, -2, 3, -3],
};

const SHELL_NAMES = ["K", "L", "M", "N", "O"];
const L_SHAPES = {
  0: "a sphere",
  1: "two lobes with one nodal plane",
  2: "a four-lobed d pattern (z² also has a ring)",
  3: "a multi-lobed f pattern",
};

const signed = (value) => (value < 0 ? `−${Math.abs(value)}` : `${value}`);
const signedM = (value) => (value > 0 ? `+${value}` : signed(value));
const customEnergy = (n, zEff) => (-13.605693 * zEff * zEff) / (n * n);

function orbitalHtml(label) {
  const split = label.indexOf("_");
  return split === -1
    ? label
    : `${label.slice(0, split)}<sub>${label.slice(split + 1)}</sub>`;
}

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

export function mountElementsPage(root) {
  const page = document.createElement("div");
  page.className = "page page-orbitals";
  page.innerHTML = `
    <aside class="side">
      <div class="side-head">
        <p class="eyebrow"><span>01</span> Builder</p>
        <h1 data-page-title>Build an<br><em>orbital</em></h1>
        <p class="lede" data-page-lede>Choose n, l, and m. Each choice redraws the cloud and changes its size, shape, or orientation.</p>
      </div>

      <div class="side-body">
        <div class="mode-tabs" role="tablist" aria-label="Orbital mode">
          <button type="button" data-mode="custom" id="tab-builder" class="active" role="tab" aria-selected="true" aria-controls="panel-builder">Builder <span>live</span></button>
          <button type="button" data-mode="elements" id="tab-atoms" role="tab" aria-selected="false" aria-controls="panel-atoms">Atoms <span>09</span></button>
        </div>

        <div class="mode-panel" data-panel="custom" id="panel-builder" role="tabpanel" aria-labelledby="tab-builder">
          <div class="section-head"><span>View</span><span data-view-label>3D cloud</span></div>
          <div data-view role="group" aria-label="Orbital visualization view"></div>

          <div class="section-head"><span>Quantum numbers</span><span data-custom-label>3d_z²</span></div>

          <div class="q-block">
            <div class="builder-row"><span>n</span><div class="seg" data-n role="group" aria-label="Principal quantum number n"></div></div>
            <p class="q-note"><span class="q-live" data-n-live></span><span class="q-effect">Higher n makes a larger cloud and moves its energy closer to zero.</span></p>
          </div>

          <div class="q-block">
            <div class="builder-row"><span>l</span><div class="seg" data-l role="group" aria-label="Angular momentum quantum number l"></div></div>
            <p class="q-note"><span class="q-live" data-l-live></span><span class="q-effect">l ≤ n − 1 sets the shape: s is round, p is two-lobed, d and f are multi-lobed.</span></p>
          </div>

          <div class="q-block">
            <div class="builder-row"><span>m</span><div class="seg" data-m role="group" aria-label="Magnetic quantum number m"></div></div>
            <p class="q-note"><span class="q-live" data-m-live></span><span class="q-effect">The 2l + 1 values rotate the lobes around z.</span></p>
          </div>

          <div class="section-head"><span>Model</span><span>hydrogen-like</span></div>
          <div class="controls" data-custom-controls></div>
        </div>

        <div class="mode-panel" data-panel="elements" id="panel-atoms" role="tabpanel" aria-labelledby="tab-atoms" hidden>
          <div class="section-head"><span>Specimens</span><span>Z 1–14</span></div>
          <div class="specimen-list" aria-label="Choose an element"></div>
        </div>

        <div class="section-head"><span>Rendering</span><span>monte carlo</span></div>
        <div class="controls" data-render-controls></div>
        <p class="side-note"><strong>One-electron model.</strong> Energy depends only on n and Z_eff here. l changes the shape; m changes the orientation. In many-electron atoms, screening also lets l affect energy.</p>
      </div>

      <div class="side-foot"><span>hydrogen-like</span><span data-side-foot>Z_eff model</span></div>
    </aside>

    <section class="work">
      <div class="stage" data-stage>
        <div class="stage-canvas"></div>
        <div class="stage-2d" data-stage-2d hidden></div>
        <div class="stage-head">
          <p class="eyebrow" data-stage-eyebrow>01 / Quantum number builder</p>
          <h1 class="stage-title" data-stage-title>3d<sub>z²</sub></h1>
          <p class="stage-copy" data-stage-copy aria-live="polite"></p>
        </div>
        <div class="stage-meta">
          <span data-stage-meta></span>
          <span class="plate-index">Plate 01</span>
        </div>
        <div class="stage-legend"></div>
        <div class="stage-hint">drag<span>·</span>orbit<span>·</span>scroll<span>·</span>zoom</div>
        <div class="stage-loader">Sampling |ψ|²</div>
      </div>
      <div class="ribbon"></div>
    </section>
  `;
  root.appendChild(page);

  const els = {
    list: page.querySelector(".specimen-list"),
    tabs: [...page.querySelectorAll(".mode-tabs button")],
    panels: {
      elements: page.querySelector('[data-panel="elements"]'),
      custom: page.querySelector('[data-panel="custom"]'),
    },
    nHost: page.querySelector("[data-n]"),
    lHost: page.querySelector("[data-l]"),
    mHost: page.querySelector("[data-m]"),
    nLive: page.querySelector("[data-n-live]"),
    lLive: page.querySelector("[data-l-live]"),
    mLive: page.querySelector("[data-m-live]"),
    pageTitle: page.querySelector("[data-page-title]"),
    pageLede: page.querySelector("[data-page-lede]"),
    sideFoot: page.querySelector("[data-side-foot]"),
    customLabel: page.querySelector("[data-custom-label]"),
    customControls: page.querySelector("[data-custom-controls]"),
    renderControls: page.querySelector("[data-render-controls]"),
    loader: page.querySelector(".stage-loader"),
    legend: page.querySelector(".stage-legend"),
    ribbon: page.querySelector(".ribbon"),
    eyebrow: page.querySelector("[data-stage-eyebrow]"),
    title: page.querySelector("[data-stage-title]"),
    copy: page.querySelector("[data-stage-copy]"),
    meta: page.querySelector("[data-stage-meta]"),
    stage: page.querySelector("[data-stage]"),
    stage2d: page.querySelector("[data-stage-2d]"),
    viewHost: page.querySelector("[data-view]"),
    viewLabel: page.querySelector("[data-view-label]"),
  };

  const stage = createStage(page.querySelector(".stage-canvas"), {
    fov: 38,
    cameraPosition: [14, 9, 24],
    target: [0, 0, 0],
    minDistance: 3,
    maxDistance: 500,
    minPolarAngle: 0.08,
    maxPolarAngle: Math.PI - 0.08,
    autoRotate: true,
    autoRotateSpeed: 0.38,
    enablePan: false,
  });

  const cloudsGroup = new THREE.Group();
  const nucleusGroup = new THREE.Group();
  // Orbital sampling uses z as its polar axis; Three.js uses y as up.
  cloudsGroup.rotation.x = -Math.PI / 2;
  stage.scene.add(cloudsGroup, nucleusGroup);

  const dotTexture = makeGlowTexture();

  const settings = {
    points: 30000,
    autoRotate: true,
    phaseTint: true,
  };

  let mode = "custom";
  let view = "cloud";
  let current = ELEMENTS[0];
  let custom = { n: 3, l: 2, m: 0, zEff: 1.0 };
  let lastChange = null;
  let cloudDirty = true;
  let visible = current.clouds.map(() => true);
  let cloudEntries = [];
  let sampleStats = null;
  let extent = 6;
  let buildToken = 0;
  let disposed = false;

  const mapCanvas = createOverlayCanvas(els.stage2d, "builder-plot");
  mapCanvas.onResize(() => {
    if (mode === "custom" && view !== "cloud") draw2D();
  });

  const viewSeg = createSegmented({
    options: [
      { value: "cloud", label: "Cloud", title: "Monte-Carlo probability cloud" },
      { value: "slice", label: "Slice", title: "Signed cross-section through the orbital" },
      { value: "profile", label: "Radial", title: "Radial probability density P(r)" },
    ],
    value: view,
    onChange: (value) => setView(value),
  });
  viewSeg.root.classList.add("wide");
  els.viewHost.appendChild(viewSeg.root);

  /* ---------------------------------------------------------------- specimen index */

  const cards = ELEMENTS.map((element) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "specimen";
    card.dataset.symbol = element.symbol;
    card.setAttribute("aria-pressed", "false");
    card.innerHTML = `
      <span class="z">${String(element.z).padStart(2, "0")}</span>
      <span class="sym">${element.symbol}</span>
      <span class="nm">${element.name}</span>
      <span class="cfg">${element.config}</span>
    `;
    card.addEventListener("click", () => selectElement(element.symbol));
    els.list.appendChild(card);
    return card;
  });

  function syncCards() {
    cards.forEach((card) => {
      const active = mode === "elements" && card.dataset.symbol === current.symbol;
      card.classList.toggle("active", active);
      card.setAttribute("aria-pressed", String(active));
    });
  }

  /* ---------------------------------------------------------------- builder */

  function renderChoice(host, options, active, onPick) {
    const hadFocus = host.contains(document.activeElement);
    host.innerHTML = "";
    options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.label;
      if (option.title) button.title = option.title;
      if (option.disabled) button.disabled = true;
      button.setAttribute(
        "aria-pressed",
        String(String(option.value) === String(active))
      );
      button.setAttribute("aria-label", option.ariaLabel ?? option.label);
      button.addEventListener("click", () => onPick(option.value));
      host.appendChild(button);
    });

    // Keep keyboard focus on the control the user just used.
    if (hadFocus) {
      const selected = [...host.querySelectorAll('button[aria-pressed="true"]')]
        .find((button) => !button.disabled);
      selected?.focus({ preventScroll: true });
    }
  }

  function renderBuilder() {
    renderChoice(
      els.nHost,
      [1, 2, 3, 4, 5].map((n) => ({
        value: n,
        label: String(n),
        title: `n = ${n} · ${SHELL_NAMES[n - 1]} shell`,
        ariaLabel: `n = ${n}, ${SHELL_NAMES[n - 1]} shell`,
      })),
      custom.n,
      (n) => {
        if (n === custom.n) return;
        lastChange = { key: "n", from: custom.n, fromL: custom.l };
        custom.n = n;
        custom.l = Math.min(custom.l, n - 1);
        if (!M_ORDER[custom.l].includes(custom.m)) custom.m = 0;
        renderBuilder();
        refreshCustom({ refit: true });
      }
    );

    // Show every subshell through f; values above n − 1 are visibly disabled.
    const lOptions = [0, 1, 2, 3].map((l) => {
      const enabled = l <= custom.n - 1;
      return {
        value: l,
        label: `${l} ${subshellLetter(l)}`,
        title: enabled
          ? `l = ${l} (${subshellLetter(l)})`
          : `l = ${l} needs n ≥ ${l + 1}`,
        ariaLabel: `l = ${l}, ${subshellLetter(l)} orbital${
          enabled ? "" : ", unavailable"
        }`,
        disabled: !enabled,
      };
    });
    renderChoice(els.lHost, lOptions, custom.l, (l) => {
      if (l === custom.l) return;
      lastChange = { key: "l", from: custom.l };
      custom.l = l;
      custom.m = 0;
      renderBuilder();
      refreshCustom({ refit: true });
    });

    renderChoice(
      els.mHost,
      M_ORDER[custom.l].map((m) => ({
        value: m,
        label: signedM(m),
        title: orbitalLabel(custom.n, custom.l, m),
        ariaLabel: `m = ${signedM(m)}, ${orbitalLabel(custom.n, custom.l, m)}`,
      })),
      custom.m,
      (m) => {
        if (m === custom.m) return;
        lastChange = { key: "m", from: custom.m };
        custom.m = m;
        renderBuilder();
        refreshCustom({ refit: true });
      }
    );

    els.customLabel.innerHTML = orbitalHtml(
      orbitalLabel(custom.n, custom.l, custom.m)
    );
    renderQuantumReadouts();
  }

  function renderQuantumReadouts() {
    const radialNodes = custom.n - custom.l - 1;
    const angularNodes = custom.l;
    const letter = subshellLetter(custom.l);

    els.nLive.textContent = `n = ${custom.n} · ${
      SHELL_NAMES[custom.n - 1]
    } shell · ${radialNodes} radial node${radialNodes === 1 ? "" : "s"}`;
    els.lLive.textContent = `l = ${custom.l} · ${letter} · ${angularNodes} angular node${
      angularNodes === 1 ? "" : "s"
    }`;

    if (custom.l === 0) {
      els.mLive.textContent = "m = 0 · the only value for an s orbital";
    } else {
      els.mLive.innerHTML = `m = ${signedM(custom.m)} · ${orbitalHtml(
        orbitalLabel(custom.n, custom.l, custom.m)
      )} orientation`;
    }
  }

  /* ---------------------------------------------------------------- controls */

  const pointsSlider = createSlider({
    label: "Sample points",
    note: "per state",
    min: 10000,
    max: 60000,
    step: 5000,
    value: settings.points,
    format: (value) => `${Math.round(value / 1000)}k`,
    onInput: (value) => {
      settings.points = value;
      cloudDirty = true;
      if (view === "cloud") scheduleBuild(false);
    },
  });

  const rotateSwitch = createSwitch({
    label: "Auto-orbit",
    checked: true,
    onChange: (checked) => {
      settings.autoRotate = checked;
      stage.controls.autoRotate = checked;
    },
  });

  const chargeSlider = createSlider({
    label: "Effective charge",
    note: "Z_eff",
    min: 1,
    max: 12,
    step: 0.1,
    value: custom.zEff,
    format: (value) => value.toFixed(1),
    onInput: (value) => {
      lastChange = { key: "z", from: custom.zEff };
      custom.zEff = value;
      scheduleRefresh(true);
    },
  });

  const phaseSwitch = createSwitch({
    label: "Phase tint",
    checked: true,
    onChange: (checked) => {
      settings.phaseTint = checked;
      if (view === "cloud") {
        cloudDirty = true;
        scheduleBuild(false);
      } else if (mode === "custom") {
        draw2D();
        renderLegend();
      }
    },
  });

  els.renderControls.append(pointsSlider.root, rotateSwitch.root);
  els.customControls.append(chargeSlider.root, phaseSwitch.root);

  const scheduleBuild = debounce((refit) => buildClouds({ refit }), 130);
  const scheduleRefresh = debounce((refit) => refreshCustom({ refit }), 130);

  const VIEW_NAMES = {
    cloud: "3D cloud",
    slice: "signed slice",
    profile: "radial P(r)",
  };
  const planeCache = new Map();

  function planePoint(key, u, v) {
    if (key === "yz") return [0, u, v];
    if (key === "xy") return [u, v, 0];
    if (key === "diag") return [u, v, u];
    return [u, 0, v];
  }

  function angularAt(key, u, v) {
    const [x, y, z] = planePoint(key, u, v);
    const r = Math.hypot(x, y, z) || 1;
    const transverse = Math.hypot(x, y) || 1;
    return angularShape(
      custom.l,
      custom.m,
      z / r,
      Math.hypot(x, y) / r,
      x / transverse,
      y / transverse
    );
  }

  function choosePlane(l, m) {
    const key = `${l}-${m}`;
    if (planeCache.has(key)) return planeCache.get(key);
    const candidates = [
      { key: "xz", label: "x–z", horizontal: "x", vertical: "z" },
      { key: "yz", label: "y–z", horizontal: "y", vertical: "z" },
      { key: "xy", label: "x–y", horizontal: "x", vertical: "y" },
      { key: "diag", label: "x = z", horizontal: "x = z", vertical: "y" },
    ];
    let best = candidates[0];
    let bestScore = -1;
    candidates.forEach((candidate) => {
      let score = 0;
      const steps = 19;
      for (let i = 1; i < steps; i++) {
        for (let j = 1; j < steps; j++) {
          const value = angularAt(
            candidate.key,
            (i / steps) * 2 - 1,
            (j / steps) * 2 - 1
          );
          score += value * value;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    });
    planeCache.set(key, best);
    return best;
  }

  function syncViewUI() {
    const isCustom = mode === "custom";
    const is2d = isCustom && view !== "cloud";
    page.dataset.view = isCustom ? view : "elements";
    els.stage2d.hidden = !is2d;
    els.viewLabel.textContent = VIEW_NAMES[view] ?? "3D cloud";
    stage.canvas.style.visibility = is2d ? "hidden" : "visible";

    if (is2d) {
      stage.stop();
      // Force layout before measuring the newly revealed plot host.
      void els.stage2d.offsetWidth;
      mapCanvas.resize();
      draw2D();
      window.requestAnimationFrame(() => {
        if (disposed || mode !== "custom" || view === "cloud") return;
        mapCanvas.resize();
        draw2D();
      });
    } else {
      stage.start();
    }
  }

  function setView(next) {
    if (mode !== "custom" || !VIEW_NAMES[next] || next === view) return;
    view = next;
    viewSeg.set(view);
    sampleStats = radialSummary(custom.n, custom.l, custom.zEff);
    syncViewUI();
    updateStageText();
    renderLegend();
    renderRibbon();

    if (view === "cloud") {
      if (cloudDirty) buildClouds({ refit: true });
      else stage.start();
    } else {
      mapCanvas.resize();
      draw2D();
    }
  }

  function refreshCustom({ refit = false } = {}) {
    sampleStats = radialSummary(custom.n, custom.l, custom.zEff);
    cloudDirty = true;
    updateStageText();
    renderLegend();
    renderRibbon();
    if (mode !== "custom") return;

    if (view === "cloud") {
      stage.start();
      buildClouds({ refit });
    } else {
      syncViewUI();
      draw2D();
    }
  }

  function draw2D() {
    if (mode !== "custom" || view === "cloud" || els.stage2d.hidden) return;
    const size = mapCanvas.resize();
    if (size.width < 40 || size.height < 80) return;

    const ctx = mapCanvas.ctx;
    const stageBox = els.stage.getBoundingClientRect();
    const headBox = page.querySelector(".stage-head").getBoundingClientRect();
    const headBottom = headBox.bottom - stageBox.top;
    const narrow = size.width < 700;
    const margin = narrow ? 20 : 34;
    const top = Math.min(size.height - 92, Math.max(narrow ? 190 : 200, headBottom + 24));
    const bottom = size.height - (narrow ? 58 : 72);
    const area = {
      x: margin,
      y: top,
      w: size.width - margin * 2,
      h: Math.max(60, bottom - top),
    };

    ctx.clearRect(0, 0, size.width, size.height);
    if (view === "slice") drawSlice(ctx, area, narrow);
    else drawRadial(ctx, area, narrow);
  }

  function drawSlice(ctx, area, narrow) {
    const plane = choosePlane(custom.l, custom.m);
    const summary = radialSummary(custom.n, custom.l, custom.zEff);
    const radius = summary.extent * 1.12;
    const square = Math.min(area.w, area.h, 430);
    const x = area.x + (area.w - square) / 2;
    const y = area.y;
    const resolution = 220;
    const source = document.createElement("canvas");
    source.width = resolution;
    source.height = resolution;
    const sourceCtx = source.getContext("2d");
    const image = sourceCtx.createImageData(resolution, resolution);
    const density = new Float32Array(resolution * resolution);
    const signed = new Float32Array(resolution * resolution);
    let maxDensity = 0;

    for (let row = 0; row < resolution; row++) {
      const v = (1 - (2 * row) / (resolution - 1)) * radius;
      for (let col = 0; col < resolution; col++) {
        const u = (2 * col / (resolution - 1) - 1) * radius;
        const [px, py, pz] = planePoint(plane.key, u, v);
        const r = Math.hypot(px, py, pz);
        const transverse = Math.hypot(px, py) || 1;
        const radial = radialFunction(custom.n, custom.l, custom.zEff, r);
        const angular = angularShape(
          custom.l,
          custom.m,
          r > 1e-9 ? pz / r : 1,
          r > 1e-9 ? Math.hypot(px, py) / r : 0,
          px / transverse,
          py / transverse
        );
        const psi = radial * angular;
        const value = psi * psi;
        const index = row * resolution + col;
        signed[index] = psi;
        density[index] = value;
        if (value > maxDensity) maxDensity = value;
      }
    }

    const positive = settings.phaseTint ? [185, 216, 251] : [169, 211, 255];
    const negative = [63, 127, 217];
    const base = [7, 11, 17];
    for (let i = 0; i < density.length; i++) {
      const t = maxDensity > 0 ? Math.pow(density[i] / maxDensity, 0.36) : 0;
      const tint = signed[i] < 0 ? negative : positive;
      const color = t < 0.004 ? base : tint;
      const offset = i * 4;
      image.data[offset] = base[0] + (color[0] - base[0]) * t;
      image.data[offset + 1] = base[1] + (color[1] - base[1]) * t;
      image.data[offset + 2] = base[2] + (color[2] - base[2]) * t;
      image.data[offset + 3] = 255;
    }
    sourceCtx.putImageData(image, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, x, y, square, square);
    ctx.strokeStyle = PLATE_RULE;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, square - 1, square - 1);

    ctx.strokeStyle = "rgba(169, 211, 255, 0.18)";
    ctx.beginPath();
    ctx.moveTo(x + square / 2, y);
    ctx.lineTo(x + square / 2, y + square);
    ctx.moveTo(x, y + square / 2);
    ctx.lineTo(x + square, y + square / 2);
    ctx.stroke();

    drawCaption(
      ctx,
      `slice ${plane.label} · ${settings.phaseTint ? "signed ψ" : "|ψ|²"}`,
      x,
      y - 14
    );
    mono(ctx, 7.5, PLATE_MUTED);
    ctx.textAlign = "right";
    ctx.fillText(
      narrow
        ? `r ≤ ${radius.toFixed(1)} a₀`
        : `auto plane · r ≤ ${radius.toFixed(1)} a₀`,
      x + square,
      y - 14
    );
    mono(ctx, 7.5, PLATE_FAINT);
    ctx.textAlign = "left";
    ctx.fillText(`−${radius.toFixed(0)}`, x, y + square + 14);
    ctx.textAlign = "center";
    ctx.fillText("0", x + square / 2, y + square + 14);
    ctx.textAlign = "right";
    ctx.fillText(`+${radius.toFixed(0)}`, x + square, y + square + 14);
    ctx.textAlign = "center";
    ctx.fillText(`${plane.horizontal} / a₀`, x + square / 2, y + square + 30);
    ctx.save();
    ctx.translate(x - 13, y + square / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${plane.vertical} / a₀`, 0, 0);
    ctx.restore();

    if (narrow) {
      mono(ctx, 7.2, PLATE_FAINT);
      ctx.textAlign = "left";
      ctx.fillText("AUTO PLANE · ψ→0 AT NODES", x, y + square + 44);
    }
  }

  function drawRadial(ctx, area, narrow) {
    const summary = radialSummary(custom.n, custom.l, custom.zEff);
    const profile = radialProfile(custom.n, custom.l, custom.zEff, 220);
    const rMax = summary.extent * 1.16;
    const plot = {
      x: area.x,
      y: area.y + 8,
      w: area.w,
      h: Math.max(54, area.h - 34),
    };
    const base = plot.y + plot.h;

    drawCaption(
      ctx,
      "radial probability · P(r) = r²|R|²",
      plot.x,
      plot.y - 14
    );
    mono(ctx, 7.5, PLATE_MUTED);
    ctx.textAlign = "right";
    ctx.fillText(
      `peak ${summary.mostProbable.toFixed(2)} · mean ${summary.mean.toFixed(2)} a₀`,
      plot.x + plot.w,
      plot.y - 14
    );

    for (let i = 0; i <= 4; i++) {
      const y = plot.y + plot.h * (i / 4);
      rule(ctx, plot.x, y, plot.x + plot.w, y, withAlpha(PLATE_RULE, i === 4 ? 1 : 0.55));
    }

    if (!narrow) {
      mono(ctx, 7.2, PLATE_FAINT);
      ctx.textAlign = "right";
      [0, 0.25, 0.5, 0.75, 1].forEach((fraction) => {
        const y = plot.y + plot.h * (1 - fraction);
        ctx.fillText(
          fraction === 0 ? "0" : fraction.toFixed(2),
          plot.x - 10,
          y + 2.5
        );
      });
    }

    const xFor = (r) => plot.x + (r / rMax) * plot.w;
    const yFor = (p) => base - p * plot.h;
    ctx.beginPath();
    ctx.moveTo(plot.x, base);
    profile.forEach(([r, p]) => ctx.lineTo(xFor(r), yFor(p)));
    ctx.lineTo(plot.x + plot.w, base);
    ctx.closePath();
    ctx.fillStyle = withAlpha(DATA_LIGHT, 0.16);
    ctx.fill();

    ctx.beginPath();
    profile.forEach(([r, p], index) => {
      const x = xFor(r);
      const y = yFor(p);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = DATA_LIGHT;
    ctx.lineWidth = 1.25;
    ctx.stroke();

    const zeros = radialZeros(custom.n, custom.l, custom.zEff).filter(
      (r) => r > 0.03 && r < rMax
    );
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = withAlpha(PLATE_LINE, 0.7);
    zeros.forEach((r) => {
      const x = xFor(r);
      rule(ctx, x, plot.y + 3, x, base, withAlpha(PLATE_LINE, 0.6));
    });
    ctx.restore();

    const meanX = xFor(summary.mean);
    rule(ctx, meanX, plot.y + 3, meanX, base, PLATE_LINE, 1);

    const peakPoint = profile.reduce(
      (best, point) => (point[1] > best[1] ? point : best),
      profile[0]
    );
    ctx.fillStyle = DATA_LIGHT;
    ctx.beginPath();
    ctx.arc(xFor(peakPoint[0]), yFor(peakPoint[1]), 2.6, 0, Math.PI * 2);
    ctx.fill();

    mono(ctx, 7.5, PLATE_FAINT);
    ctx.textAlign = "left";
    ctx.fillText("0", plot.x, base + 15);
    ctx.textAlign = "center";
    ctx.fillText((rMax / 2).toFixed(0), plot.x + plot.w / 2, base + 15);
    ctx.textAlign = "right";
    ctx.fillText(`${rMax.toFixed(0)} a₀`, plot.x + plot.w, base + 15);
    mono(ctx, 7.5, PLATE_MUTED);
    ctx.textAlign = "right";
    ctx.fillText("r / a₀", plot.x + plot.w, base + 30);

    if (zeros.length) {
      mono(ctx, 7.2, PLATE_FAINT);
      ctx.textAlign = "left";
      ctx.fillText(`${zeros.length} radial node${zeros.length === 1 ? "" : "s"}`, plot.x, base + 30);
    }
  }


  /* ---------------------------------------------------------------- scene */

  function disposeClouds() {
    for (const entry of cloudEntries) {
      cloudsGroup.remove(entry.points);
      entry.points.geometry.dispose();
      entry.points.material.dispose();
    }
    cloudEntries = [];

    nucleusGroup.traverse((object) => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
    nucleusGroup.clear();
  }

  function fitCamera() {
    const distance = extent * 3.9;
    const direction = new THREE.Vector3(0.52, 0.32, 0.86).normalize();
    stage.camera.position.copy(direction.multiplyScalar(distance));
    stage.controls.target.set(0, 0, 0);
    stage.controls.minDistance = extent * 1.05;
    stage.controls.maxDistance = extent * 18;
    stage.controls.update();
  }

  function buildNucleus() {
    const radius = Math.max(0.014, extent * 0.004);
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xb9d8fb })
    );
    sphere.renderOrder = 4;
    nucleusGroup.add(sphere);
  }

  function buildClouds({ refit = false } = {}) {
    if (mode === "custom" && view !== "cloud") return;
    const token = ++buildToken;
    els.loader.classList.add("visible");

    window.setTimeout(() => {
      if (disposed || token !== buildToken) return;

      disposeClouds();

      const defs =
        mode === "elements"
          ? current.clouds
          : [
              {
                n: custom.n,
                l: custom.l,
                m: custom.m,
                zEff: custom.zEff,
                occ: 1,
                color: CUSTOM_BASE,
                opacity: 0.92,
              },
            ];

      const count = Math.round(settings.points);
      const samples = defs.map((definition, index) =>
        sampleCloud({
          n: definition.n,
          l: definition.l,
          m: definition.m,
          zEff: definition.zEff,
          count,
          seed: 4271 + index * 131 + current.z * 17 + custom.n * 37,
        })
      );

      extent = Math.max(...samples.map((sample) => sample.extent), 1);
      const pointSize = clamp(extent * 0.021, 0.045, 2.1);
      const random = mulberry32(87211);

      samples.forEach((sample, index) => {
        const definition = defs[index];
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(sample.positions, 3)
        );

        const colors = new Float32Array(count * 3);
        const base =
          mode === "custom" && settings.phaseTint
            ? null
            : new THREE.Color(definition.color);

        for (let i = 0; i < count; i++) {
          const mixed =
            mode === "custom" && settings.phaseTint
              ? sample.signs[i] < 0
                ? NEGATIVE_RGB
                : POSITIVE_RGB
              : base;
          const shade = 0.7 + random() * 0.3;
          colors[i * 3] = mixed.r * shade;
          colors[i * 3 + 1] = mixed.g * shade;
          colors[i * 3 + 2] = mixed.b * shade;
        }
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geometry.computeBoundingSphere();

        const material = new THREE.PointsMaterial({
          size: pointSize,
          map: dotTexture,
          transparent: true,
          opacity: Math.min(1, (definition.opacity ?? 0.9) * 0.95),
          vertexColors: true,
          depthWrite: false,
          alphaTest: 0.03,
          sizeAttenuation: true,
        });

        const points = new THREE.Points(geometry, material);
        points.visible = mode === "custom" ? true : visible[index] !== false;
        points.renderOrder = 2;
        cloudsGroup.add(points);
        cloudEntries.push({ points, geometry, material });
      });

      buildNucleus();
      cloudDirty = false;
      sampleStats = mode === "custom" ? samples[0] : null;

      updateStageText();
      renderLegend();
      renderRibbon();
      syncCards();

      if (refit) fitCamera();

      els.loader.classList.remove("visible");
    }, 18);
  }

  function builderExplanation() {
    const { n, l, m } = custom;
    const radialNodes = n - l - 1;
    const letter = subshellLetter(l);
    const label = orbitalLabel(n, l, m);
    const energy = customEnergy(n, custom.zEff);
    const energyLabel = `${energy < 0 ? "−" : ""}${Math.abs(energy).toFixed(
      2
    )} eV`;

    if (!lastChange) {
      return `<strong>n = ${n}</strong> sets the shell, <strong>l = ${l}</strong> sets the ${letter} shape, and <strong>m = ${signedM(
        m
      )}</strong> picks the ${orbitalHtml(
        label
      )} orientation. Change one to see what it controls.`;
    }

    if (lastChange.key === "n") {
      const direction = n > lastChange.from ? "expands" : "contracts";
      const cap =
        lastChange.fromL !== l
          ? ` l is capped at ${l} because l ≤ n − 1.`
          : "";
      return `<strong>n ${lastChange.from} → ${n}</strong> ${direction} the cloud and sets its energy to <strong>${energyLabel}</strong>. This state has ${radialNodes} radial node${
        radialNodes === 1 ? "" : "s"
      }.${cap}`;
    }

    if (lastChange.key === "l") {
      return `<strong>l ${lastChange.from} → ${l}</strong> changes the shape to ${letter} — ${
        L_SHAPES[l]
      }. It now has ${l} angular node${
        l === 1 ? "" : "s"
      }; the energy stays at ${energyLabel}.`;
    }

    if (lastChange.key === "m") {
      return `<strong>m ${signedM(
        lastChange.from
      )} → ${signedM(
        m
      )}</strong> turns the ${letter} lobes into the ${orbitalHtml(
        label
      )} orientation. The cloud rotates; energy and node count do not change.`;
    }

    if (lastChange.key === "z") {
      const direction =
        custom.zEff > lastChange.from ? "contracts" : "expands";
      const energyDirection =
        custom.zEff > lastChange.from ? "lowers" : "raises";
      return `<strong>Z_eff ${lastChange.from.toFixed(
        1
      )} → ${custom.zEff.toFixed(
        1
      )}</strong> ${direction} the cloud and ${energyDirection} its energy to ${energyLabel}. Shape and node count are unchanged.`;
    }

    return "";
  }

  function updateStageText() {
    if (mode === "custom") {
      const label = orbitalLabel(custom.n, custom.l, custom.m);
      const radialNodes = custom.n - custom.l - 1;
      const summary = sampleStats ?? radialSummary(custom.n, custom.l, custom.zEff);
      els.title.innerHTML = orbitalHtml(label);

      if (view === "slice") {
        const plane = choosePlane(custom.l, custom.m);
        els.eyebrow.textContent = "01 / Orbital cross-section";
        els.copy.innerHTML = `<strong>Signed cross-section.</strong> The real ψ on the ${plane.label} plane. Cream is positive, rust is negative; the dark bands where ψ = 0 are nodes.`;
        els.meta.textContent = `${plane.label} plane · ${radialNodes} radial · ${custom.l} angular`;
      } else if (view === "profile") {
        els.eyebrow.textContent = "01 / Radial probability";
        els.copy.innerHTML = `<strong>P(r) = r²|R|².</strong> Radial probability, normalized to its peak: most likely at ${summary.mostProbable.toFixed(2)} a₀, mean ${summary.mean.toFixed(2)} a₀, with ${radialNodes} radial node${radialNodes === 1 ? "" : "s"}.`;
        els.meta.textContent = `${SHELL_NAMES[custom.n - 1]} shell · Z_eff ${custom.zEff.toFixed(1)}`;
      } else {
        els.eyebrow.textContent = "01 / Quantum number builder";
        els.copy.innerHTML = builderExplanation();
        els.meta.textContent = `${SHELL_NAMES[custom.n - 1]} shell · ${radialNodes} radial · ${custom.l} angular`;
      }
    } else {
      els.eyebrow.textContent = "01 / Atomic probability";
      els.title.textContent = current.name;
      els.copy.textContent = `${current.z} ${
        current.z === 1 ? "proton" : "protons"
      } · ${current.valence} valence ${
        current.valence === 1 ? "electron" : "electrons"
      } · ${current.phase} at STP.`;
      els.meta.textContent = `${current.clouds.length} ${
        current.clouds.length === 1 ? "orbital" : "orbitals"
      } · ${current.config}`;
    }
  }

  function renderLegend() {
    els.legend.innerHTML = "";

    if (mode === "custom") {
      if (view === "profile") {
        const profile = document.createElement("span");
        profile.className = "legend-key";
        profile.innerHTML = `<i style="background:${POSITIVE}"></i>P(r)`;
        const mean = document.createElement("span");
        mean.className = "legend-key";
        mean.innerHTML = `<i style="background:${PLATE_LINE};height:1px"></i>mean radius`;
        els.legend.append(profile);
        if (custom.n - custom.l - 1 > 0) {
          const node = document.createElement("span");
          node.className = "legend-key";
          node.innerHTML = `<i style="background:${PLATE_LINE};height:1px"></i>radial node`;
          els.legend.append(node);
        }
        els.legend.append(mean);
      } else if (settings.phaseTint) {
        const positive = document.createElement("span");
        positive.className = "legend-key";
        positive.innerHTML = `<i style="background:${POSITIVE}"></i>ψ &gt; 0`;
        const negative = document.createElement("span");
        negative.className = "legend-key";
        negative.innerHTML = `<i style="background:${NEGATIVE}"></i>ψ &lt; 0`;
        const node = document.createElement("span");
        node.className = "legend-key";
        node.innerHTML = `<i style="background:${PLATE_FAINT}"></i>node`;
        els.legend.append(positive, negative, node);
      } else {
        const density = document.createElement("span");
        density.className = "legend-key";
        density.innerHTML = `<i style="background:${CUSTOM_BASE}"></i>|ψ|²`;
        const node = document.createElement("span");
        node.className = "legend-key";
        node.innerHTML = `<i style="background:${PLATE_FAINT}"></i>node`;
        els.legend.append(density, node);
      }
      return;
    }

    current.clouds.forEach((cloud, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "shell-chip";
      chip.setAttribute("aria-pressed", String(visible[index]));
      const label = orbitalLabel(cloud.n, cloud.l, cloud.m);
      chip.innerHTML = `
        <span class="shell-swatch" style="background:${cloud.color}"></span>
        ${orbitalHtml(label)}
        <small>${cloud.occ}e⁻</small>
      `;
      chip.addEventListener("click", () => {
        visible[index] = !visible[index];
        chip.setAttribute("aria-pressed", String(visible[index]));
        const entry = cloudEntries[index];
        if (entry) entry.points.visible = visible[index];
      });
      els.legend.appendChild(chip);
    });
  }

  function renderRibbon() {
    let items;

    if (mode === "custom") {
      const radialNodes = custom.n - custom.l - 1;
      const angularNodes = custom.l;
      const letter = subshellLetter(custom.l);
      const energy = customEnergy(custom.n, custom.zEff);
      const mean = sampleStats?.mean ?? 0;
      const peak = sampleStats?.mostProbable ?? 0;
      const label = orbitalLabel(custom.n, custom.l, custom.m);
      const orientation =
        custom.l === 0
          ? "spherical · only value"
          : `${orbitalHtml(label)} orientation`;

      items = [
        [
          "Principal n",
          String(custom.n),
          `${SHELL_NAMES[custom.n - 1]} shell · ${radialNodes} radial node${
            radialNodes === 1 ? "" : "s"
          }`,
        ],
        [
          "Angular l",
          `${custom.l} <em>${letter}</em>`,
          `${angularNodes} angular node${angularNodes === 1 ? "" : "s"}`,
        ],
        ["Magnetic m", signedM(custom.m), orientation],
        ["Mean radius", `${mean.toFixed(2)} a₀`, `peak ${peak.toFixed(2)} a₀`],
        [
          "Energy",
          `${energy < 0 ? "−" : ""}${Math.abs(energy).toFixed(2)}<em>eV</em>`,
          `Z_eff = ${custom.zEff.toFixed(1)}`,
        ],
      ];
    } else {
      items = [
        ["Atomic number", `Z ${current.z}`, `${current.shells} shell${current.shells > 1 ? "s" : ""}`],
        [
          "Configuration",
          current.config,
          `${current.valence} valence ${
            current.valence === 1 ? "electron" : "electrons"
          }`,
        ],
        [
          "Ionization",
          `${formatElementNumber(current.ionization, 3)}<em>eV</em>`,
          "first electron",
        ],
        ["Atomic radius", `${current.radius}<em>pm</em>`, "empirical"],
        [
          "Electronegativity",
          current.electronegativity == null
            ? "—"
            : `${formatElementNumber(current.electronegativity, 2)}`,
          "Pauling",
        ],
      ];
    }

    els.ribbon.innerHTML = items
      .map(
        ([label, value, sub]) => `
          <div class="metric">
            <span class="label">${label}</span>
            <span class="value">${value}</span>
            <span class="sub">${sub}</span>
          </div>
        `
      )
      .join("");
  }

  /* ---------------------------------------------------------------- modes */

  function applyModeUI() {
    els.tabs.forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    els.panels.elements.hidden = mode !== "elements";
    els.panels.custom.hidden = mode !== "custom";
    page.dataset.mode = mode;

    if (mode === "custom") {
      els.pageTitle.innerHTML = "Build an<br><em>orbital</em>";
      els.pageLede.textContent =
        "Choose n, l, and m. Each choice redraws the cloud and changes its size, shape, or orientation.";
      els.sideFoot.textContent = "Z_eff model";
    } else {
      els.pageTitle.innerHTML = "Atomic<br><em>specimens</em>";
      els.pageLede.textContent =
        "Nine elements, drawn as hydrogen-like probability clouds with Slater screening for scale and shape.";
      els.sideFoot.textContent = "Slater Z";
    }

    syncCards();
    syncViewUI();
  }

  function selectElement(symbol) {
    const element = ELEMENTS.find((item) => item.symbol === symbol);
    if (!element) return;
    current = element;
    mode = "elements";
    view = "cloud";
    viewSeg.set("cloud");
    visible = current.clouds.map(() => true);
    applyModeUI();
    buildClouds({ refit: true });
  }

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    view = "cloud";
    viewSeg.set("cloud");
    if (mode === "elements") visible = current.clouds.map(() => true);
    if (mode === "custom") lastChange = null;
    applyModeUI();
    buildClouds({ refit: true });
  }

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
  });

  /* ---------------------------------------------------------------- boot */

  renderBuilder();
  applyModeUI();

  stage.start();

  buildClouds({ refit: true });

  return () => {
    disposed = true;
    scheduleBuild.cancel();
    scheduleRefresh.cancel();
    mapCanvas.dispose();
    stage.dispose();
    dotTexture.dispose();
  };
}
