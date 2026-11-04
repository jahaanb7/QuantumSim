/**
 * Field guide — the article-facing layer of QuantumSim.
 *
 * This page contains no simulation. It states the shared physics, defines the
 * terms used by the plates, and separates claims the models support from
 * claims they do not. Equations use the same conventions as the simulations:
 * L = 1, hbar = m = 1 unless stated otherwise.
 */

import { prefersReducedMotion } from "../ui.js";

const PLATES = [
  {
    num: "01",
    href: "#/elements",
    title: "Orbital builder",
    body: "Hydrogen-like orbitals, sampled as Monte-Carlo clouds. Change n, l and m to see shell size, radial nodes and angular lobes.",
    note: "Model: one-electron, hydrogen-like; Z_eff approximates screening.",
  },
  {
    num: "02",
    href: "#/wavefunction",
    title: "Probability density",
    body: "A particle in a 2D infinite well, shown as a signed surface, a |ψ|² density and a synchronous plan map. Superpose the ground state and play the relative phase to see interference.",
    note: "Model: exact 2D box eigenstates, 96 × 96 mesh, display-only phase.",
  },
  {
    num: "03",
    href: "#/configurations",
    title: "Tunneling",
    body: "A 1D wave packet scatters from a rectangular barrier, solved with the split-step Fourier method. The 3D tube encodes the 1D density.",
    note: "Model: 1D, single-particle, ideal barrier, absorbing edges.",
  },
];

export function mountLearnPage(root) {
  const page = document.createElement("div");
  page.className = "page page-guide";
  page.innerHTML = `
    <div class="guide-wrap">
      <header class="guide-hero">
        <p class="eyebrow"><span>04</span> Field guide</p>
        <h1>How to read a<br><em>quantum simulation</em></h1>
        <p class="guide-deck">A compact, source-checked guide to the Born rule, stationary states and the three experiments in this atlas. Use it as the explanatory spine for an article, or as a glossary while you explore.</p>
        <div class="guide-meta">
          <span>5 min read</span>
          <span>3 interactive plates</span>
          <span>references</span>
        </div>
      </header>

      <div class="guide-grid">
        <nav class="guide-toc" aria-label="Guide contents">
          <span class="toc-label">Contents</span>
          <a href="#/learn" data-scroll="rule">01 · The rule</a>
          <a href="#/learn" data-scroll="surfaces">02 · Reading surfaces</a>
          <a href="#/learn" data-scroll="still">03 · Still states</a>
          <a href="#/learn" data-scroll="plates">04 · The plates</a>
          <a href="#/learn" data-scroll="claims">05 · Safe claims</a>
          <a href="#/learn" data-scroll="numbers">06 · Numbers</a>
          <a href="#/learn" data-scroll="limits">07 · Limits</a>
          <a href="#/learn" data-scroll="glossary">08 · Glossary</a>
          <a href="#/learn" data-scroll="references">09 · Sources</a>
        </nav>

        <article class="guide-body">
          <section id="rule">
            <h2><span class="num">01 / The rule</span>The Born rule is the bridge from amplitude to experiment.</h2>
            <p>A quantum state is described by a wavefunction <strong>ψ</strong>. The wavefunction is complex, and it is not itself a probability. The Born rule converts it into a probability density:</p>
            <div class="guide-eq">
              dP = |ψ(r)|² d³r
              <small>For a particle in a two-dimensional box, replace d³r with dA = dx dy.</small>
            </div>
            <p>The density is real and non-negative. For a normalized state, its integral over all space is exactly one:</p>
            <div class="guide-eq">∫ |ψ|² dA = 1</div>
            <p>If a measurement looks for the particle in a region <strong>A</strong>, the probability of finding it there is the integral of the density over that region. That is the whole rule: <strong>P(A) = ∫<sub>A</sub> |ψ|² dA</strong>.</p>
            <div class="guide-callout">
              <span class="kicker">A sentence to keep</span>
              <p>The simulation does not show where the particle is. It shows the odds of where a position measurement could find it.</p>
            </div>
          </section>

          <section id="surfaces">
            <h2><span class="num">02 / Reading surfaces</span>A height map is a display, not an extra dimension.</h2>
            <p>The probability plate is a two-dimensional box drawn as a 3D surface. Each point on the sheet is the value of ψ at a position (x, y). Height is a display choice; the physical model still has only x and y.</p>
            <p>In the signed view, light-blue lobes rise above the plane and deep-blue lobes sink below it. In the density view, the plate squares the wavefunction, so every lobe is positive and the dark lines are the nodes. The plan map shows the same normalized state from above; it is not a separate dataset.</p>
            <div class="guide-eq">
              surface: z = ψ(x, y) or z = |ψ(x, y)|²
              <small>The vertical scale is exaggerated for reading, not a probability axis.</small>
            </div>
            <p>Dots on the orbital and tunneling pages are samples, not trajectories. The probability plate instead evaluates the continuous field directly; its surface and map are two views of one analytic state.</p>
            <blockquote class="guide-quote">Height is how the plate shows a value; |ψ|² is the probability density.</blockquote>
          </section>

          <section id="still">
            <h2><span class="num">03 / Still states</span>An eigenstate can be stationary while its phase keeps moving.</h2>
            <p>An energy eigenstate evolves as</p>
            <div class="guide-eq">ψ<sub>n</sub>(x, y, t) = φ<sub>n</sub>(x, y) e<sup>−iE<sub>n</sub>t/ħ</sup></div>
            <p>The phase factor changes with time, but it has modulus one. When the density is formed, the phase multiplies its own conjugate and cancels:</p>
            <div class="guide-eq">|ψ<sub>n</sub>(t)|² = |φ<sub>n</sub>|²</div>
            <p>That is the precise sense in which an eigenstate is stationary. The wavefunction is still rotating in the complex plane; the probability density is not changing. A global phase is not observable.</p>
            <p>A superposition is different. If two eigenstates with different energies are added, their relative phase changes with time, and the interference term survives:</p>
            <div class="guide-eq">
              Ψ = c₁φ₁e<sup>−iE₁t/ħ</sup> + c₂φ₂e<sup>−iE₂t/ħ</sup>
              <small>|Ψ|² contains a cross term oscillating at (E₂ − E₁)/ħ.</small>
            </div>
            <p>The probability plate starts in ψ₂₁, one eigenstate, so its density does not move. Turn on <strong>Superpose ground state</strong> to add ψ₁₁; the playback then advances a relative phase and the interference pattern changes. That phase is a display coordinate, not a TDSE integration or wall-clock time.</p>
          </section>

          <section id="plates">
            <h2><span class="num">04 / The plates</span>Three different models, one shared rule.</h2>
            <p>Each plate answers a different question. Keep the model boundaries visible when you write about them.</p>
            <div class="guide-plates">
              ${PLATES.map(
                (plate) => `
                <a class="guide-plate" href="${plate.href}">
                  <span class="num">PLATE ${plate.num}</span>
                  <h3>${plate.title}</h3>
                  <p>${plate.body}</p>
                  <span class="go">Open plate →</span>
                  <span class="guide-plate-note">${plate.note}</span>
                </a>`
              ).join("")}
            </div>
          </section>

          <section id="claims">
            <h2><span class="num">05 / Safe claims</span>What an article can say — and what it should not.</h2>
            <table class="guide-table">
              <thead>
                <tr><th>Safe to write</th><th>Why</th></tr>
              </thead>
              <tbody>
                <tr><td>“The cloud is a map of probability density.”</td><td>Dot density estimates |ψ|²; the field is computed from the same state.</td></tr>
                <tr><td>“A single measurement returns one outcome.”</td><td>The Born rule gives probabilities for outcomes; it does not produce a smear in one run.</td></tr>
                <tr><td>“An eigenstate’s density is time-independent.”</td><td>Its phase rotates, but the global phase cancels from |ψ|².</td></tr>
                <tr><td>“The superposition’s changing pattern comes from interference.”</td><td>The plate advances the relative phase between two eigenstates for display; it is not a real-time solution.</td></tr>
                <tr><td>“The simulations are pedagogical models.”</td><td>They are exact or well-controlled in their stated models, but they are not materials calculations.</td></tr>
              </tbody>
            </table>
            <h3>Avoid these claims</h3>
            <ul>
              <li><strong>“The dots are electrons moving along paths.”</strong> On the sampling plates they are independent position samples; no plate draws trajectories.</li>
              <li><strong>“The particle is literally smeared across the whole cloud.”</strong> The wavefunction gives probabilities; a measurement yields one result.</li>
              <li><strong>“The 3D tunneling tube is a three-dimensional simulation.”</strong> The TDSE is one-dimensional. The transverse spread is a visualization choice.</li>
              <li><strong>“The hydrogen-like cloud is the true many-electron density.”</strong> It is a one-electron model with an effective charge.</li>
              <li><strong>“The phase playback is real time.”</strong> It advances a display phase φ to show interference; it is not physical time.</li>
            </ul>
          </section>

          <section id="numbers">
            <h2><span class="num">06 / Numbers</span>The constants and settings worth quoting.</h2>
            <table class="guide-table">
              <thead><tr><th>Quantity</th><th>Value</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td>Box ground energy E₁₁</td><td>π² Ha ≈ 9.8696 Ha ≈ 268.6 eV</td><td>Ground state of the 2D box with L = 1 a₀, m = mₑ.</td></tr>
                <tr><td>Box energy ratio</td><td>E/E₁₁ = (n<sub>x</sub>² + n<sub>y</sub>²)/2</td><td>For ψ₂₁ this is 2.5; for ψ₂₂ it is 4.0.</td></tr>
                <tr><td>Surface mesh</td><td>96 × 96 segments (97 × 97 vertices)</td><td>The signed and density surfaces use the same mesh.</td></tr>
                <tr><td>Plan map</td><td>256 × 256 pixels</td><td>Evaluated from the same state for the contour view.</td></tr>
                <tr><td>Phase coordinate</td><td>φ, display only</td><td>Shown during superposition playback; not physical time.</td></tr>
                <tr><td>Tunneling grid</td><td>N = 1024, L = 200 a.u.</td><td>Split-step Fourier, second-order in dt; absorbing edges.</td></tr>
              </tbody>
            </table>
            <div class="guide-callout">
              <span class="kicker">Unit check</span>
              <p>In atomic units, ħ = mₑ = e = 4πε₀ = 1 and length is in Bohr radii. The box side is one Bohr radius, so its absolute energies are far larger than a laboratory nanostructure. The ratios and shapes are the transferable part.</p>
            </div>
          </section>

          <section id="limits">
            <h2><span class="num">07 / Limits</span>Every plate is a model with edges.</h2>
            <ul>
              <li><strong>The 2D box</strong> has ideal infinite walls. There is no z dynamics; the surface is a height map of a two-dimensional model, not a 3D container.</li>
              <li><strong>The surface</strong> is sampled on a 96 × 96 mesh; the plan map uses 256² pixels. The state is analytic; the phase playback is a display animation, not a TDSE integration.</li>
              <li><strong>The orbital builder</strong> uses one-electron hydrogen-like functions. Screening is an effective charge, not a correlated many-body calculation.</li>
              <li><strong>Tunneling</strong> is a single-particle 1D TDSE. The finite domain uses a gentle absorbing mask; the norm readout exposes residual absorption.</li>
              <li><strong>No measurement back-action</strong> is simulated. The dots on the sampling plates are samples from the state, not collapse events that alter it.</li>
              <li><strong>No relativistic, spin, magnetic or many-body effects</strong> are included unless a plate explicitly says otherwise.</li>
            </ul>
          </section>

          <section id="glossary">
            <h2><span class="num">08 / Glossary</span>Terms used on the plates.</h2>
            <dl class="guide-glossary">
              <dt>Wavefunction ψ</dt><dd>A complex amplitude whose modulus squared gives probability density.</dd>
              <dt>Born rule</dt><dd>The rule P(A) = ∫<sub>A</sub> |ψ|² dA (or d³r in three dimensions).</dd>
              <dt>Normalization</dt><dd>The total probability over all space is one: ∫ |ψ|² = 1.</dd>
              <dt>Eigenstate</dt><dd>A state with a definite energy. Its density is stationary; its phase still rotates.</dd>
              <dt>Superposition</dt><dd>A sum of eigenstates. Relative phases produce interference and time dependence.</dd>
              <dt>Node</dt><dd>A point, line or surface where ψ = 0, so the density vanishes there.</dd>
              <dt>Monte Carlo</dt><dd>Estimating a distribution with random samples. Here each dot is one Born-rule draw.</dd>
              <dt>Atomic units</dt><dd>Units with ħ = mₑ = e = 4πε₀ = 1; length in a₀, energy in hartree.</dd>
            </dl>
          </section>

          <section id="references">
            <h2><span class="num">09 / Sources</span>Where to check the physics.</h2>
            <ol class="guide-refs">
              <li>D. J. Griffiths and D. F. Schroeter, <em>Introduction to Quantum Mechanics</em>, 3rd ed. — the Born rule, infinite wells and superposition.</li>
              <li>R. Shankar, <em>Principles of Quantum Mechanics</em>, 2nd ed. — states, observables and time evolution.</li>
              <li>J. J. Sakurai and J. Napolitano, <em>Modern Quantum Mechanics</em>, 2nd ed. — measurement and the meaning of amplitudes.</li>
              <li>D. J. Tannor, <em>Introduction to Quantum Mechanics: A Time-Dependent Perspective</em> — wave packets and split-step propagation.</li>
              <li>NIST CODATA, atomic units and physical constants. Values quoted here use the standard hartree-to-electronvolt conversion.</li>
            </ol>
            <p class="guide-end">The source code is the final authority for what each plate computes. Start with <span class="mono">src/views/wavefunction.js</span> for the analytic box state and <span class="mono">src/physics/tdse.js</span> for the tunneling solver.</p>
            <a class="guide-back" href="#/wavefunction">← Return to the probability plate</a>
          </section>
        </article>

        <aside class="guide-margin" aria-label="Margin notes">
          <div class="note"><strong>Article note</strong>The strongest visual claim is also the simplest: <em>density is not a particle.</em> Let the cloud be an ensemble of possible answers.</div>
          <div class="note"><strong>Phase</strong>The superposition playback advances a relative phase φ for display. It is not physical time.</div>
          <div class="note"><strong>Surface</strong>Height is a display scale. Read the density view or plan map when you need |ψ|².</div>
          <div class="note"><strong>3D caveat</strong>The tunneling cloud’s transverse spread is presentational. The solved equation is one-dimensional.</div>
          <div class="note"><strong>Source rule</strong>Reference values are labelled as measured; simulation values are computed in the browser. Do not present one as the other.</div>
        </aside>
      </div>
    </div>
  `;
  root.appendChild(page);

  const reduced = prefersReducedMotion();
  page.querySelectorAll("[data-scroll]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = page.querySelector(`#${link.dataset.scroll}`);
      target?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    });
  });

  page.dataset.ready = "true";
  return null;
}
