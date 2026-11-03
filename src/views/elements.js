/**
 * Orbitals — probability clouds, a specimen index, and a custom state builder.
 *
 * Every dot is a Monte-Carlo sample of |psi_nlm|^2. The custom builder accepts
 * n = 1…5 and every real orbital through f, using exact hydrogen-like radial
 * functions with an effective nuclear charge.
 */

import * as THREE from "three";
import { createStage, makeGlowTexture } from "../stage.js";
import { ELEMENTS, formatElementNumber } from "../data/elements.js";
import {
  sampleCloud,
  orbitalLabel,
  subshellLetter,
  mLabel,
} from "../physics/orbitals.js";
import {
  createSlider,
  createSwitch,
  debounce,
  clamp,
} from "../ui.js";

const POSITIVE = "#e2d7bd";
const NEGATIVE = "#c76a44";
const CUSTOM_BASE = "#cfc3a7";
const NEGATIVE_RGB = new THREE.Color(NEGATIVE);
const POSITIVE_RGB = new THREE.Color(POSITIVE);
const CUSTOM_RGB = new THREE.Color(CUSTOM_BASE);

const M_ORDER = {
  0: [0],
  1: [0, 1, -1],
  2: [0, 1, -1, 2, -2],
  3: [0, 1, -1, 2, -2, 3, -3],
};

const signed = (value) => (value < 0 ? `−${Math.abs(value)}` : `${value}`);

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
        <p class="eyebrow"><span>01</span> Orbitals</p>
        <h1>Probability<br><em>clouds</em></h1>
        <p class="lede">Hydrogen-like states sampled from |ψ|². Every dot is a possible electron position.</p>
      </div>

      <div class="side-body">
        <div class="mode-tabs" role="tablist" aria-label="Orbital mode">
          <button type="button" data-mode="elements" class="active" role="tab">Atoms <span>09</span></button>
          <button type="button" data-mode="custom" role="tab">Builder</button>
        </div>

        <div class="mode-panel" data-panel="elements">
          <div class="section-head"><span>Specimens</span><span>Z 1–14</span></div>
          <div class="specimen-list" aria-label="Choose an element"></div>
        </div>

        <div class="mode-panel" data-panel="custom" hidden>
          <div class="section-head"><span>Quantum numbers</span><span data-custom-label>3d_xy</span></div>
          <div class="builder-row"><span>n</span><div class="seg" data-n></div></div>
          <div class="builder-row"><span>l</span><div class="seg" data-l></div></div>
          <div class="builder-row"><span>m</span><div class="seg" data-m></div></div>
          <div class="section-head"><span>Model</span><span>effective charge</span></div>
          <div class="controls" data-custom-controls></div>
        </div>

        <div class="section-head"><span>Rendering</span><span>monte carlo</span></div>
        <div class="controls" data-render-controls></div>
        <p class="side-note"><strong>One-electron model.</strong> Radial functions are exact for hydrogen; heavier atoms use Slater screening for scale and shape.</p>
      </div>

      <div class="side-foot"><span>hydrogen-like</span><span>Slater Z</span></div>
    </aside>

    <section class="work">
      <div class="stage">
        <div class="stage-canvas"></div>
        <div class="stage-head">
          <p class="eyebrow" data-stage-eyebrow>01 / Atomic probability</p>
          <h1 class="stage-title" data-stage-title>Hydrogen</h1>
          <p class="stage-copy" data-stage-copy></p>
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

  let mode = "elements";
  let current = ELEMENTS[0];
  let custom = { n: 3, l: 2, m: 0, zEff: 2.4 };
  let visible = current.clouds.map(() => true);
  let cloudEntries = [];
  let sampleStats = null;
  let extent = 6;
  let buildToken = 0;
  let disposed = false;

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
    host.innerHTML = "";
    options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.label;
      if (option.title) button.title = option.title;
      button.setAttribute(
        "aria-pressed",
        String(String(option.value) === String(active))
      );
      button.addEventListener("click", () => onPick(option.value));
      host.appendChild(button);
    });
  }

  function renderBuilder() {
    renderChoice(
      els.nHost,
      [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })),
      custom.n,
      (n) => {
        custom.n = n;
        custom.l = Math.min(custom.l, n - 1);
        if (!M_ORDER[custom.l].includes(custom.m)) custom.m = 0;
        renderBuilder();
        buildClouds({ refit: true });
      }
    );

    const lOptions = [];
    for (let l = 0; l <= Math.min(3, custom.n - 1); l++) {
      lOptions.push({ value: l, label: subshellLetter(l) });
    }
    renderChoice(els.lHost, lOptions, custom.l, (l) => {
      custom.l = l;
      custom.m = 0;
      renderBuilder();
      buildClouds({ refit: true });
    });

    renderChoice(
      els.mHost,
      M_ORDER[custom.l].map((m) => ({
        value: m,
        label: mLabel(custom.l, m),
        title: orbitalLabel(custom.n, custom.l, m),
      })),
      custom.m,
      (m) => {
        custom.m = m;
        renderBuilder();
        buildClouds({ refit: true });
      }
    );

    els.customLabel.innerHTML = orbitalHtml(
      orbitalLabel(custom.n, custom.l, custom.m)
    );
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
      scheduleBuild(false);
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
      custom.zEff = value;
      scheduleBuild(true);
    },
  });

  const phaseSwitch = createSwitch({
    label: "Phase tint",
    checked: true,
    onChange: (checked) => {
      settings.phaseTint = checked;
      scheduleBuild(false);
    },
  });

  els.renderControls.append(pointsSlider.root, rotateSwitch.root);
  els.customControls.append(chargeSlider.root, phaseSwitch.root);

  const scheduleBuild = debounce((refit) => buildClouds({ refit }), 130);

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
      new THREE.MeshBasicMaterial({ color: 0xf0ead9 })
    );
    sphere.renderOrder = 4;
    nucleusGroup.add(sphere);
  }

  function buildClouds({ refit = false } = {}) {
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
      sampleStats = mode === "custom" ? samples[0] : null;

      updateStageText();
      renderLegend();
      renderRibbon();
      syncCards();

      if (refit) fitCamera();

      els.loader.classList.remove("visible");
    }, 18);
  }

  function updateStageText() {
    const isCustom = mode === "custom";
    if (isCustom) {
      const label = orbitalLabel(custom.n, custom.l, custom.m);
      els.eyebrow.textContent = "01 / Orbital builder";
      els.title.innerHTML = orbitalHtml(label);
      els.copy.textContent = `n = ${custom.n} · l = ${custom.l} · m = ${signed(
        custom.m
      )} · Z_eff = ${custom.zEff.toFixed(1)}.`;
      els.meta.textContent = "single state · hydrogen-like";
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
      if (settings.phaseTint) {
        const positive = document.createElement("span");
        positive.className = "legend-key";
        positive.innerHTML = `<i style="background:${POSITIVE}"></i>ψ &gt; 0`;
        const negative = document.createElement("span");
        negative.className = "legend-key";
        negative.innerHTML = `<i style="background:${NEGATIVE}"></i>ψ &lt; 0`;
        const node = document.createElement("span");
        node.className = "legend-key";
        node.innerHTML = `<i style="background:#5a5c4f"></i>node`;
        els.legend.append(positive, negative, node);
      } else {
        const density = document.createElement("span");
        density.className = "legend-key";
        density.innerHTML = `<i style="background:${CUSTOM_BASE}"></i>|ψ|²`;
        els.legend.appendChild(density);
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
      const energy = (-13.605693 * custom.zEff * custom.zEff) /
        (custom.n * custom.n);
      const mean = sampleStats?.mean ?? 0;
      const peak = sampleStats?.mostProbable ?? 0;

      items = [
        [
          "State",
          orbitalHtml(orbitalLabel(custom.n, custom.l, custom.m)),
          `n = ${custom.n} · l = ${custom.l} · m = ${signed(custom.m)}`,
        ],
        [
          "Nodes",
          String(custom.n - 1),
          `${radialNodes} radial · ${angularNodes} angular`,
        ],
        ["Mean radius", `${mean.toFixed(2)} a₀`, "expectation ⟨r⟩"],
        ["Radial peak", `${peak.toFixed(2)} a₀`, "P(r) maximum"],
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
    syncCards();
  }

  function selectElement(symbol) {
    const element = ELEMENTS.find((item) => item.symbol === symbol);
    if (!element) return;
    current = element;
    mode = "elements";
    visible = current.clouds.map(() => true);
    applyModeUI();
    buildClouds({ refit: true });
  }

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    if (mode === "elements") visible = current.clouds.map(() => true);
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
    stage.dispose();
    dotTexture.dispose();
  };
}
