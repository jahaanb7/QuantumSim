# The bridge from the articles to the atomic lab

The site is a learning journey ending in one atomic demo. It is not a collection of unrelated quantum experiments.

## 1. What the historical sequence contributes

Young’s interference pattern establishes why relative phase and wave addition matter. Maxwell places light within electromagnetism. Planck introduces quantized exchange with `E = hf`; Einstein applies light quanta to photoelectric emission. Bohr uses discrete atomic energies to explain hydrogen spectra. De Broglie proposes `λ = h/p` for matter. Schrödinger supplies a law for nonrelativistic matter waves.

The development was not a single inevitable deduction. Classical and quantum models have different domains. In particular, de Broglie’s standing wave around a circle is a useful historical stepping stone, not a drawing of a modern orbital.

For photons, `E = pc = hf` and `c = fλ` imply `p = h/λ`. Extending the wavelength relation to massive particles was a hypothesis, supported by later diffraction experiments. The site avoids the inverted intermediate momentum formulas in the source articles.

## 2. Wave mechanics

A travelling sinusoid has phase `kx − ωt + φ`. Its amplitude is A, wave number is `k = 2π/λ`, and angular frequency is `ω = 2πf`. A snapshot of a sinusoid is not automatically a standing wave.

Using reduced Planck’s constant `ℏ = h/(2π)` gives `p = ℏk` and `E = ℏω`. Euler’s formula represents phase with a complex exponential:

`ψ = A exp[i(kx − ωt)]`.

Its derivatives obey:

- `∂ₓψ = ikψ`;
- `∂ₓ²ψ = −k²ψ`;
- `∂ₜψ = −iωψ`.

The operators `−iℏ∇` and `iℏ∂ₜ` therefore return momentum and energy times a plane wave. Putting the kinetic and potential energy structure into operator form motivates

`iℏ ∂ₜψ = [−ℏ²∇²/(2mₑ) + V]ψ`.

This is a physical postulate supported by experiments, not a rigorous deduction of quantum mechanics from classical physics. Linearity allows superpositions. The complex plane encodes phase; its imaginary axis is not an extra physical coordinate.

## 3. Specialize to an atom

For a nucleus with charge `+Ze`, use the Coulomb potential:

`V(r) = −Ze²/(4πε₀r)`.

Here r is distance, e is elementary charge, and ε₀ is the vacuum permittivity. For a time-independent potential, stationary states separate as

`ψ(r,t) = φ(r) exp(−iEt/ℏ)`, with `Ĥφ = Eφ`.

Normalizability, regularity, and boundary conditions restrict the allowed bound energies. Spherical symmetry allows separation of radial and angular factors:

`φₙℓm(r,θ,φ) = Rₙℓ(r)Yℓm(θ,φ)`.

In Bohr radii, `ρ = 2Zr/n` and

`Rₙℓ = sqrt[(2Z/n)³ (n−ℓ−1)! / (2n(n+ℓ)!)] exp(−ρ/2) ρ^ℓ L_(n−ℓ−1)^(2ℓ+1)(ρ)`.

The code evaluates the associated Laguerre polynomial by recurrence. Real angular harmonics yield the familiar s, p, d, and f shapes. These functions are sampled independently in radius and angle: the radial distribution is proportional to `r²R²`, and the angular density to `Y²` with respect to solid angle.

The algorithm tabulates and normalizes a radial cumulative distribution, inverts it using binary search, and rejection-samples directions drawn uniformly on the sphere. Conservative analytic angular envelopes and uncapped rejection avoid biased fallback directions. A seed makes comparisons reproducible.

The real harmonics need only relative amplitude for this sampler: normalizing each angular probability distribution cancels any overall multiplicative factor. Phase signs come from the product of radial and angular signs.

## 4. Reading the lab

- `n` labels the shell; the UI supports 1 through 4.
- `ℓ` labels shape: 0 = s, 1 = p, 2 = d, 3 = f, with `ℓ < n`.
- A complex spherical harmonic has a magnetic label `m = −ℓ…ℓ`. Familiar real nonzero-orientation orbitals combine the `+m` and `−m` states; the UI presents shape labels instead of treating these as single m eigenstates.
- Radial nodes number `n−ℓ−1`, excluding the origin. Angular nodes number ℓ; these may be planes or cones.
- Stationary clouds do not orbit or change shape in time. The global time phase cancels in `|ψ|²`.
- The cloud samples one electron’s possible detection locations. Colour records a relative sign of its real wavefunction, not charge or spin.

H, He⁺, and Li²⁺ all have one electron and fit this model. Raising Z contracts every length by `1/Z` and multiplies the magnitude of binding energy by `Z²`. The lab preserves the same viewport scale when only Z changes so this contraction can be seen.

## 5. Boundaries and verification

The nucleus is fixed and pointlike. Electron interactions, spin, relativity, fine structure, and external fields are omitted. This yields the fixed-nucleus approximation `Eₙ ≈ −13.605693 Z²/n² eV`. Real hydrogen has a small reduced-mass correction.

The tests verify radial normalization and analytic mean radius for every UI shell/subshell, node counts and the 2s node location, deterministic `1/Z` scaling, s and p angular moments, signs, finite samples across all UI orientations, and invalid input rejection. The interface has both a WebGL renderer and a software canvas projection of the same coordinates.

## References

- [Jahaan Bhavsar, Part I](https://medium.com/@jeyubhavsar/schr%C3%B6dingers-equation-for-dummies-part-i-historical-overview-92250056f33b)
- [Jahaan Bhavsar, Part II](https://medium.com/@jeyubhavsar/schr%C3%B6dingers-equation-for-dummies-part-ii-decoding-the-equation-0e9dad3f9f3b)
- [Nobel Prize: From classical to quantum physics](https://www.nobelprize.org/prizes/themes/the-nobel-prize-in-physics-1901-2000/)
- [MIT 8.04, Hydrogen atom lecture notes](https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2016/e34ceed6a6ec944a3c761fcbbf48be5f_MIT8_04S16_LecNotes22.pdf)
- [École Polytechnique: Hydrogen orbitals](https://www.quantum-physics.polytechnique.fr/hydrogenOrbitals.php)
