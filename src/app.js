import { mountElementsPage } from "./views/elements.js";
import { mountConfigurationsPage } from "./views/configurations.js";

const ROUTES = {
  elements: {
    mount: mountElementsPage,
    title: "Chemical Elements — QuantumSim",
  },
  configurations: {
    mount: mountConfigurationsPage,
    title: "Quantum Configurations — QuantumSim",
  },
};

const app = document.querySelector("#app");
const navLinks = [...document.querySelectorAll(".nav-link")];
let cleanup = null;
let activeRoute = "";

function currentRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  return ROUTES[hash] ? hash : "elements";
}

function setActiveNav(route) {
  navLinks.forEach((link) => {
    const isActive = link.dataset.route === route;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function showError(error) {
  console.error(error);
  app.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "fatal-error";
  wrapper.innerHTML = `
    <div class="kicker">Rendering error</div>
    <h1>This view could not start</h1>
    <p>${String(error?.message || error)}</p>
    <p class="fatal-hint">Try a browser with WebGL2 enabled, then reload the page.</p>
  `;
  app.appendChild(wrapper);
}

function render() {
  const route = currentRoute();
  if (route === activeRoute && app.childElementCount) return;
  activeRoute = route;

  cleanup?.();
  cleanup = null;
  app.innerHTML = "";

  document.body.dataset.page = route;
  document.title = ROUTES[route].title;
  setActiveNav(route);

  try {
    cleanup = ROUTES[route].mount(app) ?? null;
  } catch (error) {
    showError(error);
  }
}

window.addEventListener("hashchange", () => {
  activeRoute = "";
  render();
});

window.addEventListener("pagehide", () => cleanup?.());

if (!window.location.hash) {
  window.history.replaceState(null, "", "#/elements");
}

render();
