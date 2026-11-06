# QuantumSim — From light to the atom

An illustrated learning guide and interactive atomic orbital lab by **Jahaan Bhavsar**.

The site follows one connected path:

1. **The history:** Newton and Huygens → Young → Maxwell → Planck → Einstein → Bohr → de Broglie → Schrödinger.
2. **The equation:** wave parameters, energy and momentum, complex phase, kinetic and energy operators, and the Schrödinger equation.
3. **The atom:** rotate and inspect the stationary orbital solutions. Explore s, p, d, and f shapes, radial and angular nodes, and the effect of nuclear charge.

The standalone density, particle-in-a-box, and tunnelling demonstrations have been removed. The orbital cloud still samples |ψ|², as required for interpreting an atomic orbital.

## Run locally

No dependencies or installation are needed. Serve the root directory over HTTP (ES modules do not work correctly under `file://`):

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000` in a modern browser. Three.js supplies the WebGL view; the same three-dimensional samples have an interactive Canvas 2D projection fallback if WebGL is unavailable. Fonts and JavaScript libraries are local, so the site makes no external asset requests.

## Check and build

Node.js 18 or later:

```sh
npm test
npm run build
```

Deploy `dist/` to any static host. The build includes only the site, fonts, vendor files, and license notices. There are no API keys, accounts, or server dependencies.

## Lab controls

- H, He⁺, and Li²⁺ each have exactly one electron.
- Choose shell `n = 1…4`, subshell `ℓ = 0…n−1`, and a real orbital orientation.
- Drag to rotate; scroll to zoom. Focus the viewer and use arrow keys and `+` / `−` for keyboard controls.
- Pause rotation, reset the view, or cut away `x > 0` to inspect internal nodes.
- Guided experiments compare 1s/2s nodes, same-shell shapes, and contraction with increasing nuclear charge.
- Reduced-motion preferences disable automatic rotation. Rendering pauses when the lab is offscreen or the tab is hidden.

The frame changes for different shells and subshells. Nuclear-charge changes keep the frame constant so contraction remains visible. The reported 95% radius is a physical distance enclosing 95% of the position probability, in Bohr radii.

## Scientific scope

These are analytic nonrelativistic Coulomb solutions for a single electron bound to a fixed, pointlike nucleus. The model uses normalized radial functions with associated Laguerre polynomials and real spherical harmonic angular shapes. It samples the position distribution by inverse radial-CDF sampling and angular rejection sampling, with a deterministic seed.

- Energy: `Eₙ ≈ −13.605693 Z²/n² eV`.
- Radial nodes: `n − ℓ − 1`; angular nodes: `ℓ`.
- Colours: the positive and negative signs of the real wavefunction, not electric charges.
- Dots: possible detections of one electron, not an ensemble of moving electrons or a trajectory.
- Real orbitals with nonzero orientation indices combine the complex `m = ±|m|` basis states. The UI labels them by real orbital shape, rather than implying each has one definite magnetic quantum number.

Spin, electron interactions, relativistic corrections, finite nuclear mass, and external fields are omitted. This is an orbital explorer, not a time-dependent Schrödinger solver. See [docs/EXPLAINER.md](docs/EXPLAINER.md) for the mathematical bridge and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for dependencies.

## Original articles

- [Part I: Historical Overview](https://medium.com/@jeyubhavsar/schr%C3%B6dingers-equation-for-dummies-part-i-historical-overview-92250056f33b)
- [Part II: Decoding the Equation](https://medium.com/@jeyubhavsar/schr%C3%B6dingers-equation-for-dummies-part-ii-decoding-the-equation-0e9dad3f9f3b)

Additional physics references are linked in the site and explainer. The guide preserves the articles’ learning sequence while correcting intermediate algebra and distinguishing historical stepping-stone models from modern orbitals.

## Source map

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Responsive editorial guide and lab structure |
| `src/lessons.js` | History lessons, explanatory diagrams, and equation lessons |
| `src/app.js` | Accessible lesson tabs, chapter navigation, and hero orbital |
| `src/lab.js` | Atomic controls, metrics, and renderer integration |
| `src/physics/orbitals.js` | Coulomb functions and seeded sampling |
| `src/stage.js` | Three.js stage, axes, resources, and disposal |
| `src/canvas-view.js` | Software 3D projection, drag, zoom, cutaway, keyboard controls |
| `tests/orbitals.test.js` | Physics normalization, nodes, sampling, and scaling checks |

MIT licensed. Copyright © 2026 Jahaan.
