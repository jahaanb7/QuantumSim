/**
 * Element data for the atomic-density page.
 *
 * Clouds are one-electron hydrogen-like orbitals evaluated with Slater
 * effective nuclear charges. That model is intentionally simple: it gives the
 * correct shell structure and relative sizes without pretending to be a
 * many-body calculation.
 */

export const ELEMENTS = [
  {
    symbol: "H",
    name: "Hydrogen",
    z: 1,
    mass: 1.008,
    config: "1s¹",
    shellCount: "1 shell",
    ionization: 13.598,
    electronegativity: 2.2,
    radius: 53,
    phase: "Gas",
    melting: 13.99,
    boiling: 20.27,
    density: "0.0899 g/L",
    discovered: "1766 · Cavendish",
    accent: "#5fe8ff",
    accentRgb: [95, 232, 255],
    blurb:
      "One proton, one electron. Its 1s cloud is the exact analytic solution of the Schrödinger equation — the benchmark the other atoms are drawn against.",
    clouds: [
      {
        n: 1,
        l: 0,
        occ: 1,
        zEff: 1.0,
        color: "#5fe8ff",
        label: "1s",
        axis: "z",
        opacity: 0.95,
      },
    ],
  },
  {
    symbol: "He",
    name: "Helium",
    z: 2,
    mass: 4.0026,
    config: "1s²",
    shellCount: "1 shell",
    ionization: 24.587,
    electronegativity: null,
    radius: 31,
    phase: "Gas",
    melting: 0.95,
    boiling: 4.222,
    density: "0.1786 g/L",
    discovered: "1868 · Janssen & Lockyer",
    accent: "#6ef0c7",
    accentRgb: [110, 240, 199],
    blurb:
      "Two electrons fill the 1s shell, screening the nucleus to Z_eff ≈ 1.70. The closed shell is why helium barely reacts — and why its cloud is so compact.",
    clouds: [
      {
        n: 1,
        l: 0,
        occ: 2,
        zEff: 1.7,
        color: "#6ef0c7",
        label: "1s",
        axis: "z",
        opacity: 0.95,
      },
    ],
  },
  {
    symbol: "Li",
    name: "Lithium",
    z: 3,
    mass: 6.94,
    config: "[He] 2s¹",
    shellCount: "2 shells",
    ionization: 5.392,
    electronegativity: 0.98,
    radius: 145,
    phase: "Solid",
    melting: 453.65,
    boiling: 1615,
    density: "0.534 g/cm³",
    discovered: "1817 · Arfwedson",
    accent: "#ff79cf",
    accentRgb: [255, 121, 207],
    blurb:
      "A tight 1s core wrapped in a single diffuse 2s electron. That lone valence electron is what chemistry sees — the 2s cloud is roughly five times wider than the core.",
    clouds: [
      {
        n: 1,
        l: 0,
        occ: 2,
        zEff: 2.7,
        color: "#5fe8ff",
        label: "1s",
        axis: "z",
        opacity: 0.3,
      },
      {
        n: 2,
        l: 0,
        occ: 1,
        zEff: 1.3,
        color: "#ff79cf",
        label: "2s",
        axis: "z",
        opacity: 0.8,
      },
    ],
  },
  {
    symbol: "C",
    name: "Carbon",
    z: 6,
    mass: 12.011,
    config: "[He] 2s² 2p²",
    shellCount: "2 shells",
    ionization: 11.26,
    electronegativity: 2.55,
    radius: 70,
    phase: "Solid",
    melting: 3823,
    boiling: 4098,
    density: "2.267 g/cm³",
    discovered: "Ancient",
    accent: "#ffc46b",
    accentRgb: [255, 196, 107],
    blurb:
      "Four valence electrons occupy 2s and 2p. The two orthogonal p clouds shown here are the building blocks of carbon's directional bonds and its tetrahedral chemistry.",
    clouds: [
      {
        n: 1,
        l: 0,
        occ: 2,
        zEff: 5.7,
        color: "#5fe8ff",
        label: "1s",
        axis: "z",
        opacity: 0.28,
      },
      {
        n: 2,
        l: 0,
        occ: 2,
        zEff: 3.25,
        color: "#ff79cf",
        label: "2s",
        axis: "z",
        opacity: 0.55,
      },
      {
        n: 2,
        l: 1,
        occ: 1,
        zEff: 3.25,
        color: "#ffc46b",
        label: "2p_x",
        axis: "x",
        opacity: 0.8,
      },
      {
        n: 2,
        l: 1,
        occ: 1,
        zEff: 3.25,
        color: "#ff9a72",
        label: "2p_z",
        axis: "z",
        opacity: 0.8,
      },
    ],
  },
];

export const ELEMENT_BY_SYMBOL = Object.fromEntries(
  ELEMENTS.map((element) => [element.symbol, element])
);

export function formatElementNumber(value, digits = 3) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}
