/**
 * Shared Three.js stage: renderer, camera, orbit controls, resize handling,
 * render loop and disposal. Each page owns one stage.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createStage(container, options = {}) {
  const {
    fov = 40,
    cameraPosition = [0, 0, 100],
    target = [0, 0, 0],
    minDistance = 30,
    maxDistance = 240,
    minPolarAngle = 0.15,
    maxPolarAngle = Math.PI - 0.15,
    autoRotate = false,
    autoRotateSpeed = 0.5,
    enablePan = false,
  } = options;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);

  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 3000);
  camera.position.set(...cameraPosition);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.9;
  controls.enablePan = enablePan;
  controls.minDistance = minDistance;
  controls.maxDistance = maxDistance;
  controls.minPolarAngle = minPolarAngle;
  controls.maxPolarAngle = maxPolarAngle;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = autoRotateSpeed;
  controls.update();

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width < 2 || height < 2) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  window.addEventListener("resize", resize);
  resize();

  let frameCallback = null;
  let rafId = 0;
  let running = false;
  let disposed = false;
  const clock = new THREE.Clock();

  const loop = () => {
    if (!running || disposed) return;
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    controls.update(dt);
    if (frameCallback) frameCallback(dt);
    renderer.render(scene, camera);
  };

  const start = (callback) => {
    frameCallback = callback ?? frameCallback;
    if (running || disposed) return;
    running = true;
    clock.start();
    rafId = requestAnimationFrame(loop);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(rafId);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stop();
    observer.disconnect();
    window.removeEventListener("resize", resize);
    controls.dispose();
    disposeObject(scene);
    renderer.dispose();
    canvas.remove();
  };

  return {
    scene,
    camera,
    renderer,
    controls,
    start,
    stop,
    dispose,
    resize,
    get canvas() {
      return canvas;
    },
  };
}

export function disposeObject(root) {
  const materials = new Set();
  const geometries = new Set();
  const textures = new Set();

  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) {
      const list = Array.isArray(object.material)
        ? object.material
        : [object.material];
      list.forEach((material) => materials.add(material));
    }
  });

  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value && value.isTexture) textures.add(value);
    });
    material.dispose();
  });
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
}

/**
 * Tight, hard-edged sprite for point clouds. Kept deliberately small so the
 * clouds read as stippled data rather than neon glow.
 */
export function makeGlowTexture() {
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, "rgba(255, 255, 255,1)");
  gradient.addColorStop(0.34, "rgba(255, 255, 255,0.98)");
  gradient.addColorStop(0.5, "rgba(255, 255, 255,0.5)");
  gradient.addColorStop(0.72, "rgba(255, 255, 255,0.08)");
  gradient.addColorStop(1, "rgba(255, 255, 255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Canvas-drawn sprite label that always faces the camera. */
export function makeTextSprite(
  text,
  {
    color = "#929292",
    fontSize = 52,
    weight = 400,
    height = 5,
    opacity = 1,
    align = "center",
  } = {}
) {
  const dpr = 2;
  const fontFamily =
    '"IBM Plex Mono", "SF Mono", ui-monospace, Menlo, monospace';
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  const font = `${weight} ${fontSize}px ${fontFamily}`;
  measureCtx.font = font;
  const textWidth = Math.ceil(measureCtx.measureText(text).width);
  const width = Math.max(32, textWidth + 24);

  const canvas = document.createElement("canvas");
  canvas.width = width * dpr;
  canvas.height = fontSize * 1.5 * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, (fontSize * 1.5) / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity,
  });
  const sprite = new THREE.Sprite(material);
  const aspect = width / (fontSize * 1.5);
  sprite.scale.set(height * aspect, height, 1);
  sprite.renderOrder = 20;
  if (align === "left") {
    sprite.center.set(0, 0.5);
  } else if (align === "right") {
    sprite.center.set(1, 0.5);
  }
  return sprite;
}

/** Linear interpolation through a list of [position, css-color] stops. */
export function makeGradient(stops) {
  const colors = stops.map(([position, color]) => ({
    position,
    color: new THREE.Color(color),
  }));
  const out = new THREE.Color();

  return (t, target = out) => {
    const value = Math.min(1, Math.max(0, t));
    let index = 0;
    while (index < colors.length - 2 && value > colors[index + 1].position) {
      index++;
    }
    const a = colors[index];
    const b = colors[index + 1] ?? a;
    const span = Math.max(1e-6, b.position - a.position);
    const local = Math.min(1, Math.max(0, (value - a.position) / span));
    target.copy(a.color).lerp(b.color, local);
    return target;
  };
}
