# QuantumSim

An interactive, browser-based quantum physics lab. QuantumSim visualises two
different sides of the Schrödinger equation in 3D:

1. **Atomic probability clouds** — Monte-Carlo samples of hydrogen-like
   orbitals for hydrogen, helium, lithium and carbon, alongside their atomic
   properties.
2. **Quantum tunneling** — a live, time-dependent wave-packet scattering
   simulation against a rectangular potential barrier, with presets, playback
   and quantitative readouts.

Everything runs client-side. There is no build step, no server-side code and no
runtime dependency other than a local copy of [Three.js](https://threejs.org/).

> **Deep dive:** [The QuantumSim Field Guide](docs/EXPLAINER.md) derives the
> physics, explains the numerical methods, and walks through the code with
> worked examples and generated figures.

## Contents

- [Quick start](#quick-start)
- [Tour](#tour)
- [Physics and mathematics](#physics-and-mathematics)
  - [Atomic probability clouds](#1-atomic-probability-clouds)
  - [Quantum tunneling and scattering](#2-quantum-tunneling-and-scattering)
- [Using the app](#using-the-app)
- [Sanity check](#sanity-check)
- [Development verification](#development-verification)
- [Project structure](#project-structure)
- [Limitations](#limitations)
- [References and further reading](#references-and-further-reading)

---

## Quick start

From the project root (the directory containing `index.html`):

```bash
python3 -m http.server 8000
```

Then open **http://localhost:8000** in a modern browser with WebGL2 support.

Any static file server works. The app must be served over HTTP rather than
opened as a `file://` URL, because it uses ES modules and an import map.

| Route | Page |
| --- | --- |
| `#/elements` | Atomic probability clouds and element properties |
| `#/configurations` | Wave-packet tunneling and scattering |

The bare URL is normalised to `#/elements`. Both pages are reachable from the
top navigation bar. Drag to orbit the scene, scroll or pinch to zoom.

There is nothing to install and nothing to compile. Three.js r180 is vendored
in `vendor/` so the lab also works offline.

---

## Tour

### Chemical elements

The left rail selects one of four atoms. The 3D stage shows its occupied
orbitals as glowing point clouds; the right rail shows atomic properties and
rendering controls.

- Click an element to refit the camera and load its properties.
- Toggle individual orbitals (1s, 2s, 2p_x, 2p_z) from the stage legend.
- Adjust **sample points**, **screening Z_eff** and **cloud brightness**.
- Turn auto-orbit on or off.

The colour of each cloud identifies its orbital; the **density of dots** is the
probability density. More sample points produce a smoother estimate, not more
electrons.

### Quantum configurations

A Gaussian wave packet starts on the left and scatters from a rectangular
barrier. The 3D cloud is coloured by the phase of ψ, and the amber slab marks
the barrier. A playback bar scrubs through the encounter.

- Six presets load physically distinct configurations.
- Each preset thumbnail is a real position–time (`x–t`) density map produced by
  the same solver, and its label shows the transmission measured in that run.
- Sliders control energy, barrier height, barrier width, packet width and start
  position.
- The right rail reports the left/inside/right probability split, current and
  final transmission, analytic plane-wave transmission, norm, regime, the
  energy-to-barrier ratio, and packet parameters.
- Play, pause, replay and scrub are supported.

---

## Physics and mathematics

### Units and conventions

Both simulations use **atomic units**:

| Quantity | Unit | Value |
| --- | --- | --- |
| Length | Bohr radius `a₀` | `5.29177 × 10⁻¹¹ m` |
| Energy | Hartree `Eₕ` | `27.2114 eV` |
| Time | `ħ / Eₕ` | `2.41888 × 10⁻¹⁷ s` |
| Mass | electron mass `mₑ` | 1 |
| Action | reduced Planck constant `ħ` | 1 |

Thus `ħ = mₑ = e = 4πε₀ = 1`. In these units the kinetic operator is
`−½ ∂²/∂x²`, and a plane wave with wavenumber `k` has energy `E = k²/2`.

These are atomic-scale numbers, not macroscopic ones: the default tunneling
barrier is about `109 eV` high and `0.64 Å` wide, and the simulated encounter
lasts roughly `0.8 fs`.

---

## 1. Atomic probability clouds

### The Born rule

A one-electron spatial state is described by a wavefunction `ψ(r)`. The Born
rule states that

```text
dP = |ψ(r)|² d³r
```

is the probability of finding the electron in the volume element `d³r` around
`r`. The probability density is `|ψ|²`; the wavefunction itself is complex and
has no direct physical meaning beyond its modulus and relative phase.

For a hydrogen-like orbital with quantum numbers `n`, `l`, `m`,

```text
ψ_nlm(r, θ, φ) = R_nl(r) Y_lm(θ, φ),
```

where `R_nl` is the radial function and `Y_lm` is a spherical harmonic. The
radial probability density — the quantity sampled by the app — is

```text
P_nl(r) = r² |R_nl(r)|².
```

The `r²` factor is essential: a thin spherical shell of radius `r` has volume
`4πr² dr`, so a spherically symmetric cloud is most probable at the radius
where `r²R²` peaks, not at `r = 0`.

### The hydrogen-like model

QuantumSim uses one-electron hydrogen-like orbitals with an effective nuclear
charge `Z_eff`. In Bohr units the radial functions are

```text
R₁₀(r) = 2 Z_eff^(3/2) exp(−Z_eff r)

R₂₀(r) = (1 / (2√2)) Z_eff^(3/2) (2 − Z_eff r) exp(−Z_eff r / 2)

R₂₁(r) = (1 / (2√6)) Z_eff^(3/2) (Z_eff r) exp(−Z_eff r / 2)
```

These are the exact non-relativistic radial solutions for a Coulomb potential
`V(r) = −Z_eff/r`. The angular parts have the familiar forms:

- **s orbitals** (`l = 0`) are isotropic. Their angular density is constant, so
  the cloud is spherically symmetric.
- **p orbitals** (`l = 1`) are shown as real orbitals. For an orbital oriented
  along an axis, the angular density is proportional to `cos²θ`, producing two
  lobes with a nodal plane through the nucleus.

The model therefore captures the essential quantum structure — shell size,
radial nodes, and directional lobes — without solving a many-electron
Schrödinger equation.

#### Effective nuclear charge and screening

For a multi-electron atom, each electron feels the bare nuclear charge `Z`
reduced by the average repulsion of the other electrons. Slater's rules
approximate this with a single effective charge

```text
Z_eff = Z − S
```

where `S` is the screening constant. The app uses the following tabulated
effective charges:

| Atom | Orbital | `Z_eff` | Occupancy shown |
| --- | --- | --- | --- |
| H | 1s | 1.00 | 1 |
| He | 1s | 1.70 | 2 |
| Li | 1s | 2.70 | 2 |
| Li | 2s | 1.30 | 1 |
| C | 1s | 5.70 | 2 |
| C | 2s | 3.25 | 2 |
| C | 2p_x | 3.25 | 1 |
| C | 2p_z | 3.25 | 1 |

The two carbon 2p clouds are an illustrative choice: the real `2p²`
configuration is a many-electron state, and the app shows two orthogonal real
p orbitals with one electron each so that both directional lobes are visible.
The total 2p occupancy is two electrons.

The **Screening Z_eff** slider multiplies these tabulated values by `0.7–1.5`.
It is a visualisation control for exploring how orbital size scales with
screening; it does not re-derive the electronic structure. Because
`r ~ 1/Z_eff`, increasing the charge contracts the cloud and decreasing it
expands the cloud.

### Monte-Carlo sampling

The app does not draw a smooth isosurface. It samples the probability
distribution directly, using `40,000` dots per orbital by default (adjustable
from `8,000` to `80,000`). Each dot is one possible electron position.

**Radial sampling.** The cumulative radial probability

```text
F(r) = ∫₀^r r'² |R_nl(r')|² dr'
```

is computed numerically on 4,096 radial bins, out to `15/Z_eff` for `n = 1` and
`60/Z_eff` for `n = 2`. A uniform random number `u ∈ [0, 1)` is inverted through
this CDF with a binary search, giving a sample whose distribution follows
`P_nl(r)`.

**Angular sampling.** For s orbitals the direction is sampled uniformly on the
sphere. For a p orbital, a rejection step accepts directions with probability
`cos²θ` relative to the chosen axis, which reproduces `|Y|²`.

The 98th-percentile radius is used only for framing and point sizing; samples
themselves are drawn from the full CDF up to `rMax`, which is chosen well into
the tail. The resulting cloud is a true Monte-Carlo estimate of `|ψ|²`, not a
decorative glow.

### What the visualisation shows

- Dot density is `|ψ|²`. The brightest regions are the most probable electron
  positions, not regions of higher charge or temperature.
- The 2s cloud has a spherical radial node at `r = 2/Z_eff`, where `R₂₀ = 0`;
  the 2p cloud has an angular node (the plane between its lobes).
- Each orbital is sampled independently and with the same point count, so
  cloud brightness is not weighted by occupancy. The legend chips show the
  electron counts.
- The nucleus is drawn at the origin as a visual reference, not to scale.
- Orbital colours are labels, not physical quantities.

### Approximations and caveats

The orbital model is deliberately simple:

- It is a **one-electron, hydrogen-like** model. For helium, lithium and carbon
  the true electronic structure is a correlated many-body state.
- Slater screening captures the average effect of electron repulsion but not
  exchange, correlation, or orbital relaxation.
- Relativistic effects, fine structure and spin are absent.
- The listed ionisation energies, electronegativities, radii and bulk
  properties are measured reference values. They are **not** computed from the
  displayed orbitals.
- The shapes of the 1s, 2s and 2p hydrogenic orbitals are exact solutions of the
  non-relativistic Coulomb problem; the many-electron *densities* and *energies*
  are approximate.

---

## 2. Quantum tunneling and scattering

### The time-dependent Schrödinger equation

The scattering simulation solves the one-dimensional time-dependent
Schrödinger equation

```text
i ∂ψ/∂t = [ −½ ∂²/∂x² + V(x) ] ψ
```

in atomic units. The wavefunction is complex; the app stores its real and
imaginary parts separately and integrates them in time.

### Initial state

The particle is prepared as a normalised Gaussian wave packet:

```text
ψ(x, 0) = A exp[−(x − x₀)² / (4σ²)] exp(i k₀ x)
```

where `A = (2πσ²)^(−1/4)`, `σ` is the position-space width, and `k₀` is the
central wavenumber. The central energy is

```text
E = k₀² / 2,        k₀ = √(2E).
```

The packet is normalised numerically on the grid, so `∫|ψ|² dx = 1`. Its
group velocity is `v_g = k₀` in these units. A narrower packet in position
space has a broader momentum distribution; this matters below.

### The barrier

The potential is a rectangular barrier centred at the origin:

```text
V(x) = V₀    for |x| ≤ a/2
V(x) = 0     otherwise
```

`V₀` is the barrier height and `a` its width. The wave packet begins to the
left at `x₀ < 0` and travels toward it.

### Solving it: split-step Fourier

The solver uses the **split-step Fourier method**. The formal solution over a
time step `dt` is approximated by the symmetric (Strang) splitting

```text
ψ(t + dt) = e^(−iV dt/2) · F⁻¹[ e^(−i k² dt/2) · F( e^(−iV dt/2) ψ(t) ) ]
```

where `F` is the discrete Fourier transform. The algorithm is:

1. Multiply by the half potential phase `e^(−iV dt/2)`.
2. Transform to momentum space with an FFT.
3. Multiply by the exact free-particle phase `e^(−i k² dt/2)`.
4. Transform back to position space.
5. Multiply by the half potential phase again.
6. Apply a smooth absorbing mask near the domain edges.

The kinetic operator is diagonal in momentum space, so the free-particle
propagation is exact on the grid. The split-step composition is second-order
accurate in `dt`, and each unitary step conserves the norm exactly before the
absorbing mask is applied.

The discrete grid uses

```text
x_j = −L/2 + (j + ½)Δx,    j = 0 … N−1
k_j = 2π n_j / L,          n_j = j for j < N/2, otherwise j − N
```

with `N = 1024` and `L = 200 a.u.`, giving `Δx = L/N ≈ 0.195 a.u.` and a
Nyquist wavenumber of `π/Δx ≈ 16.1 a.u.` The `FFT` is an in-place radix-2
transform in `src/physics/fft.js`.

#### Absorbing boundaries

The FFT domain is periodic. To prevent a packet that reaches one edge from
re-entering at the other, the solver multiplies ψ by a smooth mask outside
`|x| = 78`:

```text
M(x) = 1                                      for |x| ≤ 78
M(x) = exp[−0.035 ((|x| − 78)/20)²]           for |x| > 78
```

The mask is gentle near its onset and stronger toward the domain edge. The
parameter ranges and simulated end time are chosen so the packets largely
separate before reaching this region. The norm is typically `1.0000` to four
decimals; a few extreme combinations show small residual absorption (the worst
case observed during testing was `0.9996`). The norm readout reports the actual
norm; the region percentages are normalized to sum to `1`.

### What is measured

At every saved frame the solver integrates the density in three regions:

```text
P_left(t)   = ∫_{x < −a/2} |ψ(x,t)|² dx
P_inside(t) = ∫_{−a/2 ≤ x ≤ a/2} |ψ(x,t)|² dx
P_right(t)  = ∫_{x > a/2} |ψ(x,t)|² dx
```

and normalises the three by their instantaneous total. They therefore sum to
`1`. The right-hand value at the end of the run is reported as the **packet
transmission**; after the encounter has separated, it is the transmitted
fraction. The left-hand value is the reflected fraction, and the inside value
is the probability still interacting with the barrier.

The norm

```text
⟨ψ|ψ⟩ = ∫ |ψ(x,t)|² dx
```

is also tracked and displayed.

### Analytic plane-wave transmission

For comparison, the app evaluates the exact steady-state transmission of a
single plane wave of energy `E` through the rectangular barrier:

For `E < V₀` (tunneling):

```text
κ = √(2(V₀ − E))

T(E) = 1 / [ 1 + V₀² sinh²(κa) / (4E(V₀ − E)) ]
```

For `E > V₀` (over-barrier propagation):

```text
q = √(2(E − V₀))

T(E) = 1 / [ 1 + V₀² sin²(qa) / (4E(E − V₀)) ]
```

At the special case `E = V₀`, the limit is

```text
T = 1 / (1 + V₀ a² / 2).
```

For a plane wave, `R = 1 − T`: probability is conserved. The formulas describe
a **monochromatic** plane wave, not the finite-width Gaussian packet.

### Why the packet differs from the analytic curve

A Gaussian wave packet is a superposition of plane waves. For the initial
state above, the momentum-space distribution is also Gaussian, with standard
deviation

```text
σ_k = 1 / (2σ).
```

Since `E = k²/2`, the relative standard deviation in energy is approximately

```text
ΔE / E ≈ 1 / (σ k₀).
```

For the default packet (`σ = 2.4`, `k₀ = 2`) this is about **21%**. The packet
therefore samples a range of transmission probabilities. The measured packet
transmission is not expected to equal `T(E)` at the central energy — it is the
transmitted fraction of a superposition. Differences are especially large near
a sharp threshold or resonance, where `T(E)` varies rapidly.

The packet also spreads as it propagates. For a free Gaussian,

```text
σ(t) = σ₀ √(1 + (t / (2σ₀²))²),
```

so the packet is wider by the time it reaches the barrier and continues to
disperse afterwards. This is quantum dispersion, not numerical diffusion.

### Tunneling, over-barrier reflection and resonances

- **Below the barrier** (`E < V₀`), classical mechanics predicts total
  reflection. The Schrödinger equation gives an exponentially small but
  nonzero transmission. For a thick barrier, `T ~ exp(−2κa)` in the simplest
  approximation.
- **Above the barrier** (`E > V₀`), a classical particle always passes, but the
  wave can partially reflect at the potential steps. The transmission
  oscillates with barrier width because of interference between waves reflected
  from the two edges.
- **Above-barrier resonances** occur when `sin(qa) = 0`, i.e.

  ```text
  q a = nπ,    n = 1, 2, …
  ```

  and then the plane-wave `T = 1`. The **Fabry–Pérot** preset places `E = 4.9`,
  `V₀ = 4.0`, `a = 2.4`, for which `qa ≈ 3.22`, close to `π`. The finite packet
  and its energy spread keep the measured value below the ideal `100%`.
- **Below-barrier resonances** do not occur for a single rectangular barrier of
  fixed height in the same simple way; transmission decreases monotonically with
  width in the deep-tunneling regime. The *near-threshold* preset instead shows
  how sensitive the result is when `E` is close to `V₀`.

### From one dimension to the 3D picture

The physical simulation is strictly one-dimensional. The 3D cloud is a
visualisation of the 1D density:

- Each rendered dot receives an `x` coordinate sampled from `|ψ(x,t)|²` over
  the displayed window.
- Its `y` and `z` offsets come from a fixed transverse Gaussian of width
  `1.7 a.u.` (clamped at four standard deviations). This turns the line density
  into a visible tube.
- Dot colour encodes the **phase** `arg ψ(x,t)`, mapped through a cyclic
  blue → cyan → violet → amber palette. Phase has no meaning where the density
  vanishes, so colour is only meaningful where dots are visible.
- The amber slab has the physical barrier width `a`; its height and depth are
  presentational. The floor grid and the `x` axis are orientation aids, not
  measured quantities.
- `9,000` dots are sampled per saved frame. Each frame's dots are sampled from
  that frame's density using a fixed quantile sequence, so the cloud evolves
  smoothly. They are not particle trajectories.

The camera orbits a 3D scene, but the Schrödinger equation being solved has no
transverse dynamics. The 3D layer is an embedding for perception, not an extra
spatial dimension.

### Numerical settings and accuracy

| Setting | Value |
| --- | --- |
| Grid points `N` | 1024 |
| Domain length `L` | 200 a.u. |
| Grid spacing `Δx` | ≈ 0.1953 a.u. |
| Displayed region | −65 … 65 a.u. |
| Absorbing mask onset | `±78 a.u.` |
| Saved frames | 121 (including `t = 0`) |
| Render samples | 9,000 per frame |
| Time step | automatic, typically ≈ 0.02 a.u. |
| Total simulated time | 28 – 52 a.u. |

The end time is chosen automatically:

```text
t_end = clamp( (|x₀| − a/2) / k₀ + 16, 28, 52 ).
```

The first term is the approximate travel time to the barrier; the additional
`16 a.u.` allows the collision and separation to complete. The step count per
frame is at least four and is increased for longer runs, keeping the time step
near `0.02 a.u.` The splitting error is second order in that step.

Accuracy is limited by three things:

1. **Potential sampling.** The barrier is evaluated at the grid points. A
   `0.5 a.u.` barrier spans only about 2.6 grid cells at `N = 1024`, so the
   "Razor thin" preset is the least well resolved. Wider barriers are better
   represented.
2. **Finite domain and absorbing mask.** The simulated box is finite. The time
   and parameter ranges are chosen so the packets largely separate before
   reaching the mask, but the mask is still an approximation to an open
   boundary. Extreme settings can leave a small amount of probability in the
   mask, which the norm readout exposes.
3. **Single-particle, 1D model.** There is no transverse scattering, no spin,
   no magnetic field, and no emission. It is a pedagogical model, not a
   materials calculation.

The analytic `T(E)` is exact for the ideal rectangular barrier and a plane wave;
it is shown as a reference, not as the "correct" answer for the packet. The
packet result is the physically meaningful fraction for the prepared state.

### Presets

All presets use `x₀ = −35`.

| Preset | `E` | `V₀` | `a` | `σ` | What it shows |
| --- | --- | --- | --- | --- | --- |
| Deep tunneling | 2.0 | 4.0 | 1.2 | 2.4 | Most of the packet reflects; a small tail tunnels through. |
| Near threshold | 3.6 | 4.0 | 1.0 | 2.4 | `E` just below `V₀`; transmission is sensitive to every parameter. |
| Over the top | 5.0 | 2.0 | 1.4 | 2.2 | Classical transmission is allowed; quantum reflection and interference remain. |
| Wide barrier | 2.6 | 2.8 | 3.4 | 2.8 | A broad barrier suppresses tunneling substantially. |
| Razor thin | 1.4 | 6.5 | 0.5 | 2.0 | A tall but very narrow barrier; the grid barely resolves the width. |
| Fabry–Pérot | 4.9 | 4.0 | 2.4 | 3.0 | An above-barrier resonance near `qa = π`; transmission is high. |

Each thumbnail is a real `x–t` density map generated with the same solver, and
its label displays the transmitted fraction measured in that run. Because the
thumbnail uses a finite frame count and the same physical end time, the final
transmission matches the full-resolution run up to solver discretisation.

---

## Using the app

### Tunneling controls

All controls are clamped to safe ranges and snapped to their step, so a
simulation cannot be launched with an invalid or unstable parameter set.

| Control | Range | Step | Default |
| --- | --- | --- | --- |
| Particle energy `E` | 1.0 – 5.0 a.u. | 0.1 | 2.0 |
| Barrier height `V₀` | 0.5 – 8.0 a.u. | 0.1 | 4.0 |
| Barrier width `a` | 0.5 – 4.0 a.u. | 0.1 | 1.2 |
| Packet width `σ` | 1.0 – 4.0 a.u. | 0.1 | 2.4 |
| Start position `x₀` | −45 – −25 a.u. | 1 | −35 |

**Reset** restores the defaults. **Randomize** chooses a valid random set
inside these ranges. The active preset highlight follows the current parameter
set, so moving a slider can select a preset or clear the highlight. Changing a
slider re-solves the TDSE and restarts playback.

### Element controls

| Control | Range | Default |
| --- | --- | --- |
| Sample points | 8,000 – 80,000 per orbital | 40,000 |
| Screening `Z_eff` scale | 0.7 – 1.5 × | 1.0 |
| Cloud brightness | 0.1 – 0.9 | 0.5 |
| Auto-orbit | on / off | on |

### Playback and readouts

The timeline is a frame scrubber over 121 saved states. Play/pause and replay
do not recompute the simulation. The right rail shows:

- the instantaneous left/inside/right probability split;
- the current transmitted percentage;
- the final packet transmission for the run;
- the analytic plane-wave transmission at the central energy;
- the norm;
- the current regime (deep tunneling, threshold, or over the barrier);
- `E/V₀`, `k₀`, de Broglie wavelength, packet width and grid size.

---

## Sanity check

The physics core is a plain ES module and can be tested without a browser.
Requires Node.js 18 or newer:

```bash
node --input-type=module -e "
import { simulate } from './src/physics/tdse.js';
const r = simulate(
  { energy: 2, barrier: 4, width: 1.2, sigma: 2.4, x0: -35 },
  { frames: 120 }
);
console.log({
  norm: r.norm.toFixed(4),
  packetT: r.final.right.toFixed(4),
  planeWaveT: r.analyticT.toFixed(4),
  grid: r.N,
  tEnd: r.tEnd.toFixed(1),
  frames: r.frames.length
});
"
```

A correct default run reports approximately:

```text
norm       1.0000
packetT    0.0404
planeWaveT 0.0324
grid       1024
tEnd       33.2
frames     121
```

For this default run, the packet transmission is higher than the plane-wave
value because the Gaussian packet contains energies above and below the central
energy. This is expected, not a solver error.

For the orbital sampler:

```bash
node --input-type=module -e "
import { sampleCloud } from './src/physics/orbitals.js';
const s = sampleCloud({ n: 2, l: 0, zEff: 1.3, count: 20000, axis: 'z' });
console.log('98% radius (a0):', s.extent.toFixed(2), 'samples:', s.positions.length / 3);
"
```

Expected: a 98% radius of about `9.00 a₀` from 20,000 samples. The radius
scales as `1/Z_eff`, so increasing the effective charge contracts the cloud.

---

## Development verification

The app was checked in Chromium with WebGL2:

- rendered point clouds for H, Li and C, and the tunneling cloud, were pixel-
  verified rather than assumed from a successful render call;
- Carbon at 80,000 points per orbital (320,000 points total) rendered at
  approximately 60 fps on the test machine;
- changing `Z_eff` from 1.5 to 0.7 changed the fraction of lit pixels in a fixed
  central region from 21% to 50%, confirming that the parameter changes the
  cloud geometry;
- changing sample points from 8,000 to 80,000 changed that coverage from 9% to
  44%, confirming that the density estimate changes;
- extreme runs remained normalised to within `4 × 10⁻⁴` (worst observed norm
  `0.9996`), with no console errors;
- orbital toggles, preset switching, playback, scrubbing and randomize were
  exercised in the browser.

There is currently **no automated test suite**; the Node commands above are the
intended physics smoke tests. The browser checks were manual.

---

## Project structure

```text
index.html                    app shell, navigation, import map
styles.css                    visual system and responsive layout
src/app.js                    hash router and page lifecycle
src/stage.js                  shared Three.js renderer, camera, orbit controls
src/ui.js                     sliders, switches and DOM helpers
src/views/elements.js         chemical-elements page
src/views/configurations.js   tunneling page, playback and statistics
src/data/elements.js          element data and orbital definitions
src/physics/orbitals.js       radial CDFs and orbital point-cloud sampling
src/physics/tdse.js           split-step TDSE solver, analytic T, limits
src/physics/fft.js            radix-2 complex FFT
vendor/                       Three.js r180, vendored for offline use
```

`src/main.py` is the original standalone 2D matplotlib tunneling script. It is
kept for reference and is not part of the web app.

### Runtime dependencies

- **Three.js r180** — MIT licence. Included in `vendor/`; no package manager or
  network access is required at runtime.
- No analytics, no tracking, no external API calls, no server-side computation.

---

## Limitations

QuantumSim is a teaching and exploration tool, not a research solver.

- The atomic clouds use a hydrogen-like, one-electron model with Slater
  screening. They reproduce orbital shapes and trends, not quantitative
  many-electron densities or energies.
- The tunneling simulation is one-dimensional and single-particle. It omits
  spin, magnetic fields, inelastic channels, and photon emission.
- The potential is an ideal rectangular barrier. Real barriers are smooth,
  finite, and often time-dependent; those require transfer-matrix, WKB, or
  numerical scattering methods.
- The grid representation of the narrowest barrier is marginal; results for
  `a = 0.5` should be read qualitatively.
- The 3D cloud for tunneling uses a transverse Gaussian as a visual aid. It does
  not imply that the simulated particle moves in three dimensions.
- Atomic data are standard reference values bundled for display; they are not
  computed by the orbital model.

---

## References and further reading

- D. J. Griffiths and D. F. Schroeter, *Introduction to Quantum Mechanics*,
  3rd edition — the Born rule, Gaussian packets, and rectangular-barrier
  transmission.
- J. C. Slater, “Atomic Shielding Constants,” *Physical Review* **36**, 57
  (1930) — the screening rules behind `Z_eff`.
- D. J. Tannor, *Introduction to Quantum Mechanics: A Time-Dependent
  Perspective* — split-operator and split-step Fourier propagation.
- Three.js documentation — renderer, materials, and orbit controls.

---

## Licence

QuantumSim is released under the MIT licence; see [LICENSE](LICENSE).
Three.js is also distributed under the MIT licence.
