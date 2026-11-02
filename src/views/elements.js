/**
 * Chemical Elements — 3D probability-density clouds.
 *
 * Each cloud is a Monte-Carlo sample of |ψ_nlm|² for a hydrogen-like orbital
 * with a Slater effective nuclear charge. Dots are possible electron
 * positions, so dot density is proportional to probability density.
 */

import * as THREE from "three";
import { createStage, makeGlowTexture } from "../stage.js";
import { ELEMENTS, formatElementNumber } from "../data/elements.js";
import { sampleCloud } from "../physics/orbitals.js";
import {
  createSlider,
  createSwitch,
  debounce,
  clamp,
  easeOutCubic,
} from "../ui.js";

const SETTINGS = {
  points: { min: 8000, max: 80000, step: 4000, value: 40000 },
  zScale: { min: 0.7, max: 1.5, step: 0.05, value: 1 },
  glow: { min: 0.1, max: 0.9, step: 0.05, value: 0.5 },
};

const number = (value, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);

const padZ = (z) => String(z).padStart(2, "0");

export function mountElementsPage(root) {
  const page = document.createElement("div");
  page.className = "page page-elements";
  page.innerHTML = `
    <aside class="rail rail-left rail-scroll">
      <div class="rail-head">
        <div class="kicker"><span class="accent-dot"></span>Atomic structure</div>
        <h2>Chemical elements</h2>
        <p>Four atoms, drawn from their occupied orbitals. Every dot is one sampled electron position.</p>
      </div>
      <div class="element-list" aria-label="Choose an element"></div>
      <div class="rail-note">
        <span class="note-icon">i</span>
        <div><strong>Model.</strong> Hydrogen-like orbitals with Slater screening. Shapes are exact; many-body energies are approximated.</div>
      </div>
    </aside>

    <section class="stage">
      <div class="stage-canvas"></div>
      <div class="stage-watermark" aria-hidden="true">H</div>
      <div class="stage-head">
        <div class="kicker"><span class="accent-dot"></span>Atomic probability density</div>
        <h1 class="stage-title">Hydrogen</h1>
        <p class="stage-copy"></p>
      </div>
      <div class="stage-badge"><span class="badge-dot"></span><span class="badge-text"></span></div>
      <div class="stage-legend" aria-label="Orbital visibility"></div>
      <div class="stage-loader">Sampling orbitals</div>
      <div class="stage-hint">drag<span>·</span>orbit<span>·</span>scroll<span>·</span>zoom</div>
    </section>

    <aside class="rail rail-right">
      <div class="panel">
        <div class="panel-head"><span>Atomic properties</span><span class="status-pill config-pill"></span></div>
        <div class="identity">
          <div class="identity-symbol">H</div>
          <div>
            <h3>Hydrogen</h3>
            <p>Z = 1 · 1 shell</p>
          </div>
        </div>
        <dl class="prop-list"></dl>
        <p class="blurb"></p>
      </div>

      <div class="panel">
        <div class="panel-head"><span>Orbital rendering</span><span class="mono">MC sample</span></div>
        <div class="controls"></div>
        <p class="blurb">Radial distances are in Bohr radii. Screening is scaled from the tabulated Slater charge, so the cloud grows as Z<sub>eff</sub> falls.</p>
      </div>
    </aside>
  `;
  root.appendChild(page);

  const canvasHost = page.querySelector(".stage-canvas");
  const watermark = page.querySelector(".stage-watermark");
  const title = page.querySelector(".stage-title");
  const copy = page.querySelector(".stage-copy");
  const badgeText = page.querySelector(".badge-text");
  const legend = page.querySelector(".stage-legend");
  const loader = page.querySelector(".stage-loader");
  const list = page.querySelector(".element-list");
  const propList = page.querySelector(".prop-list");
  const blurb = page.querySelector(".blurb");
  const identitySymbol = page.querySelector(".identity-symbol");
  const identityName = page.querySelector(".identity h3");
  const identityMeta = page.querySelector(".identity p");
  const configPill = page.querySelector(".config-pill");
  const controlsHost = page.querySelector(".controls");

  const stage = createStage(canvasHost, {
    fov: 38,
    cameraPosition: [12, 8, 22],
    target: [0, 0, 0],
    minDistance: 3,
    maxDistance: 400,
    minPolarAngle: 0.08,
    maxPolarAngle: Math.PI - 0.08,
    autoRotate: true,
    autoRotateSpeed: 0.55,
    enablePan: false,
  });

  const cloudsGroup = new THREE.Group();
  const nucleusGroup = new THREE.Group();
  // Orbital sampling uses z as its polar axis; Three.js uses y as up.
  cloudsGroup.rotation.x = -Math.PI / 2;
  stage.scene.add(cloudsGroup, nucleusGroup);

  const glowTexture = makeGlowTexture();

  const settings = {
    points: SETTINGS.points.value,
    zScale: SETTINGS.zScale.value,
    glow: SETTINGS.glow.value,
  };

  let current = ELEMENTS[0];
  let visible = [];
  let cloudEntries = [];
  let popStarted = performance.now();
  let extent = 6;

  /* ---------------------------------------------------------------- element UI */

  const cards = ELEMENTS.map((element) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "element-card";
    card.dataset.symbol = element.symbol;
    card.setAttribute("aria-pressed", "false");
    card.style.setProperty("--accent", element.accent);
    card.style.setProperty("--accent-rgb", element.accentRgb.join(", "));
    card.innerHTML = `
      <span class="element-z mono">${padZ(element.z)}</span>
      <span class="element-symbol">${element.symbol}</span>
      <span class="element-meta">
        <strong>${element.name}</strong>
        <small>${element.config}</small>
      </span>
      <span class="element-arrow" aria-hidden="true">→</span>
    `;
    card.addEventListener("click", () => selectElement(element.symbol));
    list.appendChild(card);
    return card;
  });

  /* ---------------------------------------------------------------- properties */

  const propertyRows = [
    ["Atomic number", (e) => `Z = ${e.z}`],
    ["Atomic mass", (e) => `${formatElementNumber(e.mass, 4)} u`],
    ["Configuration", (e) => e.config],
    ["Shells", (e) => e.shellCount],
    ["Ionization", (e) => `${formatElementNumber(e.ionization, 3)} eV`],
    [
      "Electronegativity",
      (e) =>
        e.electronegativity == null
          ? "—"
          : `${formatElementNumber(e.electronegativity, 2)} Pauling`,
    ],
    ["Atomic radius", (e) => `${number(e.radius)} pm`],
    ["Phase at STP", (e) => e.phase],
    ["Melting point", (e) => `${formatElementNumber(e.melting, 2)} K`],
    ["Boiling point", (e) => `${formatElementNumber(e.boiling, 2)} K`],
    ["Density", (e) => e.density],
    ["Discovered", (e) => e.discovered],
  ];

  function updateProperties(element) {
    propList.innerHTML = "";
    for (const [label, read] of propertyRows) {
      const row = document.createElement("div");
      row.className = "prop-row";
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = read(element);
      row.append(dt, dd);
      propList.appendChild(row);
    }

    identitySymbol.textContent = element.symbol;
    identityName.textContent = element.name;
    identityMeta.textContent = `Z = ${element.z} · ${element.shellCount}`;
    configPill.textContent = element.config;
    blurb.textContent = element.blurb;

    title.textContent = element.name;
    copy.innerHTML = `Showing <strong>${element.clouds.length}</strong> occupied orbital${
      element.clouds.length > 1 ? "s" : ""
    } · ${element.config} · ${number(settings.points / 1000)}k samples per cloud.`;
    watermark.textContent = element.symbol;
    badgeText.textContent = `${element.clouds
      .map((cloud) => cloud.label)
      .join(" · ")}  /  ${element.shellCount}`;
  }

  /* ---------------------------------------------------------------- legend */

  function buildLegend() {
    legend.innerHTML = "";
    current.clouds.forEach((cloud, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "shell-chip";
      chip.setAttribute("aria-pressed", String(visible[index]));
      chip.innerHTML = `
        <span class="shell-swatch" style="background:${cloud.color};color:${cloud.color}"></span>
        ${cloud.label}
        <small>${cloud.occ}e⁻</small>
      `;
      chip.addEventListener("click", () => {
        visible[index] = !visible[index];
        chip.setAttribute("aria-pressed", String(visible[index]));
        const entry = cloudEntries[index];
        if (entry) entry.points.visible = visible[index];
      });
      legend.appendChild(chip);
    });
  }

  /* ---------------------------------------------------------------- 3D scene */

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

  function buildClouds({ refit = false } = {}) {
    disposeClouds();

    const count = Math.round(settings.points);
    const samples = current.clouds.map((cloud, index) =>
      sampleCloud({
        n: cloud.n,
        l: cloud.l,
        zEff: cloud.zEff * settings.zScale,
        count,
        axis: cloud.axis,
        seed: 4271 + index * 131 + current.z * 17,
      })
    );

    extent = Math.max(...samples.map((sample) => sample.extent), 1);
    const pointSize = clamp(extent * 0.014, 0.05, 1.2);

    samples.forEach((sample, index) => {
      const cloud = current.clouds[index];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(sample.positions, 3)
      );

      // Slight per-dot brightness variation gives the cloud visual depth.
      const shades = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const shade = 0.62 + Math.random() * 0.38;
        shades[i * 3] = shade;
        shades[i * 3 + 1] = shade;
        shades[i * 3 + 2] = shade;
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(shades, 3));

      const material = new THREE.PointsMaterial({
        size: pointSize,
        map: glowTexture,
        transparent: true,
        opacity: settings.glow * (cloud.opacity ?? 0.9),
        vertexColors: true,
        color: new THREE.Color(cloud.color),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        alphaTest: 0.015,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(geometry, material);
      points.visible = visible[index] !== false;
      points.renderOrder = 1;
      cloudsGroup.add(points);
      cloudEntries.push({ points, geometry, material, extent: sample.extent });
    });

    buildNucleus();

    // Fit the camera to the largest sampled orbital. Sizes are physical, so
    // lithium's valence shell correctly dwarfs its 1s core.
    if (refit) {
      const distance = extent * 4.8;
      const direction = new THREE.Vector3(0.52, 0.34, 0.88).normalize();
      stage.camera.position.copy(direction.multiplyScalar(distance));
      stage.controls.target.set(0, 0, 0);
      stage.controls.minDistance = extent * 1.15;
      stage.controls.maxDistance = extent * 13;
      stage.controls.update();
      popStarted = performance.now();
    }
  }

  function buildNucleus() {
    const radius = Math.max(0.025, extent * 0.008);
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    sphere.renderOrder = 3;
    nucleusGroup.add(sphere);

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.scale.setScalar(extent * 0.09);
    halo.renderOrder = 3;
    nucleusGroup.add(halo);
  }

  function updateGlow() {
    cloudEntries.forEach((entry, index) => {
      const cloud = current.clouds[index];
      entry.material.opacity = settings.glow * (cloud.opacity ?? 0.9);
    });
  }

  const refreshClouds = debounce(() => {
    loader.classList.add("visible");
    window.setTimeout(() => {
      buildClouds({ refit: false });
      updateGlow();
      loader.classList.remove("visible");
    }, 20);
  }, 140);

  /* ---------------------------------------------------------------- selection */

  function selectElement(symbol) {
    const element = ELEMENTS.find((item) => item.symbol === symbol);
    if (!element || element === current) return;
    current = element;

    page.style.setProperty("--accent", element.accent);
    page.style.setProperty("--accent-rgb", element.accentRgb.join(", "));

    cards.forEach((card) => {
      const active = card.dataset.symbol === element.symbol;
      card.classList.toggle("active", active);
      card.setAttribute("aria-pressed", String(active));
    });

    visible = element.clouds.map(() => true);
    updateProperties(element);
    buildLegend();
    buildClouds({ refit: true });
  }

  /* ---------------------------------------------------------------- controls */

  const pointsControl = createSlider({
    label: "Sample points",
    min: SETTINGS.points.min,
    max: SETTINGS.points.max,
    step: SETTINGS.points.step,
    value: settings.points,
    format: (value) => `${Math.round(value / 1000)}k`,
    note: "per orbital",
    onInput: (value) => {
      settings.points = value;
      copy.innerHTML = `Showing <strong>${current.clouds.length}</strong> occupied orbital${
        current.clouds.length > 1 ? "s" : ""
      } · ${current.config} · ${Math.round(value / 1000)}k samples per cloud.`;
      refreshClouds();
    },
  });

  const zControl = createSlider({
    label: "Screening Z_eff",
    min: SETTINGS.zScale.min,
    max: SETTINGS.zScale.max,
    step: SETTINGS.zScale.step,
    value: settings.zScale,
    unit: "×",
    format: (value) => value.toFixed(2),
    note: "size",
    onInput: (value) => {
      settings.zScale = value;
      refreshClouds();
    },
  });

  const glowControl = createSlider({
    label: "Cloud brightness",
    min: SETTINGS.glow.min,
    max: SETTINGS.glow.max,
    step: SETTINGS.glow.step,
    value: settings.glow,
    format: (value) => value.toFixed(2),
    onInput: (value) => {
      settings.glow = value;
      updateGlow();
    },
  });

  const rotateControl = createSwitch({
    label: "Auto-orbit",
    checked: true,
    onChange: (checked) => {
      stage.controls.autoRotate = checked;
    },
  });

  controlsHost.append(
    pointsControl.root,
    zControl.root,
    glowControl.root,
    rotateControl.root
  );

  /* ---------------------------------------------------------------- render loop */

  stage.start(() => {
    const age = (performance.now() - popStarted) / 520;
    const scale = age >= 1 ? 1 : 0.88 + easeOutCubic(age) * 0.12;
    cloudsGroup.scale.setScalar(scale);
    nucleusGroup.scale.setScalar(scale);
  });

  /* ---------------------------------------------------------------- boot */

  page.style.setProperty("--accent", current.accent);
  page.style.setProperty("--accent-rgb", current.accentRgb.join(", "));
  cards[0].classList.add("active");
  cards[0].setAttribute("aria-pressed", "true");
  visible = current.clouds.map(() => true);
  updateProperties(current);
  buildLegend();
  buildClouds({ refit: true });

  return () => {
    refreshClouds.cancel();
    stage.dispose();
    glowTexture.dispose();
  };
}
