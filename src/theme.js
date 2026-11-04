/**
 * Theme control: a strict two-value monochrome palette.
 *
 * Dark is the default. The choice is kept in localStorage and applied before
 * the first paint by the inline boot script in index.html, so a stored light
 * theme never flashes dark on reload.
 */

const STORAGE_KEY = "quantumsim-theme";
const THEME_COLOR = {
  dark: "#111111",
  light: "#f2f2f2",
};

const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

export function currentTheme() {
  return root.dataset.theme === "light" ? "light" : "dark";
}

function paint(theme) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[theme]);

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    const dark = theme === "dark";
    button.setAttribute("aria-checked", String(dark));
    button.setAttribute(
      "aria-label",
      dark ? "Switch to light theme" : "Switch to dark theme"
    );
    const label = button.querySelector("[data-theme-label]");
    if (label) label.textContent = dark ? "Dark" : "Light";
  });
}

function remember(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private modes can refuse storage; the in-memory theme still applies.
  }
}

export function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  const commit = () => {
    paint(next);
    remember(next);
  };

  if (!reduceMotion.matches && typeof document.startViewTransition === "function") {
    document.documentElement.classList.add("theme-switching");
    const transition = document.startViewTransition(commit);
    transition.finished.finally(() => {
      document.documentElement.classList.remove("theme-switching");
    });
    return;
  }

  commit();
}

export function initTheme() {
  paint(currentTheme());
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", toggleTheme);
  });
}
