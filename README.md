# QuantumSim

Interactive 3D quantum-physics visualisations: atomic probability clouds and a
wave-packet tunneling lab, rendered with Three.js.

![QuantumSim](https://img.shields.io/badge/three.js-r180-59e6ff) ![No build step](https://img.shields.io/badge/build-none-6ef0b8)

## Run

No install or build step — Three.js is vendored in `vendor/`.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Any static file server works; the app needs HTTP rather than `file://` because
it uses ES modules.

## Pages

### Chemical elements (`#/elements`)

3D probability-density clouds for **hydrogen, helium, lithium and carbon**.
Every dot is one Monte-Carlo sample of a hydrogen-like orbital `|ψ_nlm|²` with a
Slater effective nuclear charge; dot density therefore reads directly as
probability density.

- Click an element to refit the camera and load its atomic properties
  (mass, configuration, ionisation energy, electronegativity, radius, phase,
  melting/boiling point, density, discovery).
- Toggle individual orbitals (1s, 2s, 2p) from the legend.
- **Sample points** (8k–80k per orbital), **screening Z_eff** (0.7–1.5× the
  tabulated Slater charge) and **cloud brightness** are bounded so the cloud
  always stays visible and numerically sound. Auto-orbit can be switched off.

Because the model is hydrogen-like, orbital *shapes* are exact solutions of the
Schrödinger equation while many-body energies are approximate. The page says so
in the interface.

### Quantum configurations (`#/configurations`)

A 1D wave packet scattering off a rectangular barrier, solved live with the
split-step Fourier method:

```
i ∂ψ/∂t = [ −½ ∂²/∂x² + V(x) ] ψ        (ħ = m = 1)
```

The density `|ψ(x,t)|²` is sampled into a 3D cloud whose colour encodes the
phase of ψ; the amber slab is the potential barrier. Orbit, zoom and scrub
through the encounter.

Six presets cover deep tunneling, the threshold regime, over-barrier
transmission, a wide barrier, a razor-thin barrier and a Fabry–Pérot resonance.
Each preset thumbnail is a real x–t density map computed by the same solver, and
its label shows that run's measured transmission.

Controls are clamped to ranges where the 1024-point solver is stable and
normalised:

| Parameter | Range |
| --- | --- |
| Particle energy `E` | 1.0 – 5.0 |
| Barrier height `V₀` | 0.5 – 8.0 |
| Barrier width `a` | 0.5 – 4.0 |
| Packet width `σ` | 1.0 – 4.0 |
| Start position `x₀` | −45 – −25 |

The right rail reads out the live left/inside/right probability split, the
plane-wave transmission `T` for comparison, the packet's measured final `T`, the
norm, and the current regime. Absorbing layers at `|x| = 78` prevent wrap-around;
the norm stays at 1.0000 in every run.

## Layout

```
index.html               shell, navigation, import map
styles.css               full visual system and responsive layout
src/app.js               hash router + page lifecycle
src/stage.js             shared Three.js renderer / camera / orbit controls
src/ui.js                sliders, switches and DOM helpers
src/views/elements.js    chemical-elements page
src/views/configurations.js  tunneling page, playback and stats
src/data/elements.js     element data and orbital definitions
src/physics/orbitals.js  orbital radial CDF and point-cloud sampling
src/physics/tdse.js      split-step TDSE solver, presets' physics, limits
src/physics/fft.js       radix-2 FFT used by the solver
vendor/                  Three.js r180 (MIT), vendored for offline use
```

`src/main.py` is the original standalone 2D matplotlib tunneling script and is
kept for reference; it is not used by the web app.
