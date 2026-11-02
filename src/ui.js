/** Small DOM helpers used by both pages. */

let idCounter = 0;

export function debounce(fn, wait = 120) {
  let timer = 0;
  const debounced = (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
  debounced.flush = (...args) => {
    window.clearTimeout(timer);
    fn(...args);
  };
  debounced.cancel = () => window.clearTimeout(timer);
  return debounced;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createSlider({
  label,
  unit = "",
  min,
  max,
  step,
  value,
  format = (v) => v.toFixed(1),
  onInput,
  note = "",
}) {
  const id = `slider-${++idCounter}`;
  const root = document.createElement("div");
  root.className = "control";

  const top = document.createElement("div");
  top.className = "control-top";

  const labelEl = document.createElement("label");
  labelEl.htmlFor = id;
  labelEl.textContent = label;
  if (note) {
    const noteEl = document.createElement("span");
    noteEl.textContent = ` ${note}`;
    labelEl.appendChild(noteEl);
  }

  const valueEl = document.createElement("span");
  valueEl.className = "control-val";

  top.append(labelEl, valueEl);

  const input = document.createElement("input");
  input.type = "range";
  input.id = id;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.setAttribute("aria-label", label);

  const scale = document.createElement("div");
  scale.className = "control-scale";
  const minEl = document.createElement("span");
  const maxEl = document.createElement("span");
  minEl.textContent = format(min, true);
  maxEl.textContent = format(max, true);
  scale.append(minEl, maxEl);

  const paint = () => {
    const current = Number(input.value);
    const ratio = (current - min) / (max - min || 1);
    input.style.setProperty("--fill", `${(ratio * 100).toFixed(2)}%`);
    valueEl.textContent = "";
    valueEl.append(document.createTextNode(format(current)));
    if (unit) {
      const small = document.createElement("small");
      small.textContent = unit;
      valueEl.appendChild(small);
    }
  };

  input.addEventListener("input", () => {
    const current = clamp(Number(input.value), min, max);
    paint();
    onInput?.(current);
  });

  paint();
  root.append(top, input, scale);

  return {
    root,
    input,
    get value() {
      return Number(input.value);
    },
    set(next, emit = false) {
      input.value = String(clamp(Number(next), min, max));
      paint();
      if (emit) onInput?.(Number(input.value));
    },
  };
}

export function createSwitch({ label, checked = false, onChange }) {
  const root = document.createElement("div");
  root.className = "switch-row";

  const text = document.createElement("span");
  text.textContent = label;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "switch";
  button.setAttribute("role", "switch");
  button.setAttribute("aria-checked", String(checked));
  button.setAttribute("aria-label", label);

  button.addEventListener("click", () => {
    const next = button.getAttribute("aria-checked") !== "true";
    button.setAttribute("aria-checked", String(next));
    onChange?.(next);
  });

  root.append(text, button);

  return {
    root,
    get checked() {
      return button.getAttribute("aria-checked") === "true";
    },
    set(next) {
      button.setAttribute("aria-checked", String(Boolean(next)));
    },
  };
}

export function percent(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export function rgbString([r, g, b], alpha = 1) {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
