/**
 * Element data for the orbital atlas.
 *
 * Clouds are one-electron hydrogen-like orbitals with Slater effective
 * charges. That model gives the correct shell ordering, node structure and
 * relative scale without pretending to be a many-body calculation.
 */

const CORE = "#2f6fce";
const S2 = "#a9d3ff";
const P2 = "#3f7fd9";
const S3 = "#8fc0f5";
const P3 = "#dcecff";

const cloud = (n, l, m, occ, zEff, color, opacity) => ({
  n,
  l,
  m,
  occ,
  zEff,
  color,
  opacity,
});

const pTriplet = (n, zEff, colors = [P2, P2, P2], opacities = [0.72, 0.55, 0.68]) => [
  cloud(n, 1, 0, 1, zEff, colors[0], opacities[0]),
  cloud(n, 1, 1, 1, zEff, colors[1], opacities[1]),
  cloud(n, 1, -1, 1, zEff, colors[2], opacities[2]),
];

export const ELEMENTS = [
  {
    symbol: "H",
    name: "Hydrogen",
    z: 1,
    config: "1s¹",
    shells: 1,
    valence: 1,
    ionization: 13.598,
    electronegativity: 2.2,
    radius: 53,
    phase: "gas",
    clouds: [cloud(1, 0, 0, 1, 1.0, S2, 0.95)],
  },
  {
    symbol: "He",
    name: "Helium",
    z: 2,
    config: "1s²",
    shells: 1,
    valence: 2,
    ionization: 24.587,
    electronegativity: null,
    radius: 31,
    phase: "gas",
    clouds: [cloud(1, 0, 0, 2, 1.7, S2, 0.95)],
  },
  {
    symbol: "Li",
    name: "Lithium",
    z: 3,
    config: "[He] 2s¹",
    shells: 2,
    valence: 1,
    ionization: 5.392,
    electronegativity: 0.98,
    radius: 145,
    phase: "solid",
    clouds: [
      cloud(1, 0, 0, 2, 2.7, CORE, 0.24),
      cloud(2, 0, 0, 1, 1.3, S2, 0.9),
    ],
  },
  {
    symbol: "C",
    name: "Carbon",
    z: 6,
    config: "[He] 2s² 2p²",
    shells: 2,
    valence: 4,
    ionization: 11.26,
    electronegativity: 2.55,
    radius: 70,
    phase: "solid",
    clouds: [
      cloud(1, 0, 0, 2, 5.7, CORE, 0.16),
      cloud(2, 0, 0, 2, 3.25, S2, 0.42),
      cloud(2, 1, 1, 1, 3.25, P2, 0.88),
      cloud(2, 1, -1, 1, 3.25, P2, 0.68),
    ],
  },
  {
    symbol: "N",
    name: "Nitrogen",
    z: 7,
    config: "[He] 2s² 2p³",
    shells: 2,
    valence: 5,
    ionization: 14.534,
    electronegativity: 3.04,
    radius: 65,
    phase: "gas",
    clouds: [
      cloud(1, 0, 0, 2, 6.7, CORE, 0.16),
      cloud(2, 0, 0, 2, 3.9, S2, 0.38),
      ...pTriplet(2, 3.9, [P2, P2, P2], [0.78, 0.56, 0.68]),
    ],
  },
  {
    symbol: "O",
    name: "Oxygen",
    z: 8,
    config: "[He] 2s² 2p⁴",
    shells: 2,
    valence: 6,
    ionization: 13.618,
    electronegativity: 3.44,
    radius: 60,
    phase: "gas",
    clouds: [
      cloud(1, 0, 0, 2, 7.7, CORE, 0.14),
      cloud(2, 0, 0, 2, 4.55, S2, 0.34),
      ...pTriplet(2, 4.55, [P2, P2, P2], [0.74, 0.52, 0.64]),
    ],
  },
  {
    symbol: "Ne",
    name: "Neon",
    z: 10,
    config: "[He] 2s² 2p⁶",
    shells: 2,
    valence: 8,
    ionization: 21.565,
    electronegativity: null,
    radius: 38,
    phase: "gas",
    clouds: [
      cloud(1, 0, 0, 2, 9.7, CORE, 0.12),
      cloud(2, 0, 0, 2, 5.85, S2, 0.26),
      ...pTriplet(2, 5.85, [P2, P2, P2], [0.56, 0.4, 0.48]),
    ],
  },
  {
    symbol: "Na",
    name: "Sodium",
    z: 11,
    config: "[Ne] 3s¹",
    shells: 3,
    valence: 1,
    ionization: 5.139,
    electronegativity: 0.93,
    radius: 186,
    phase: "solid",
    clouds: [
      cloud(1, 0, 0, 2, 10.7, CORE, 0.1),
      cloud(2, 0, 0, 2, 6.85, S2, 0.18),
      ...pTriplet(2, 6.85, [P2, P2, P2], [0.26, 0.18, 0.22]),
      cloud(3, 0, 0, 1, 2.2, S3, 0.92),
    ],
  },
  {
    symbol: "Si",
    name: "Silicon",
    z: 14,
    config: "[Ne] 3s² 3p²",
    shells: 3,
    valence: 4,
    ionization: 8.152,
    electronegativity: 1.9,
    radius: 111,
    phase: "solid",
    clouds: [
      cloud(1, 0, 0, 2, 13.7, CORE, 0.09),
      cloud(2, 0, 0, 2, 9.15, S2, 0.15),
      ...pTriplet(2, 9.15, [P2, P2, P2], [0.22, 0.15, 0.18]),
      cloud(3, 0, 0, 2, 4.3, S3, 0.48),
      cloud(3, 1, 1, 1, 4.3, P3, 0.88),
      cloud(3, 1, -1, 1, 4.3, P3, 0.68),
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
