import { family, person, type Person } from "./family";

/**
 * البيوت — the houses. The founder's sons each head a house; every descendant
 * carries their house's pigment so a card anywhere on the chart tells you
 * which line it belongs to before you read a single name.
 *
 * Pigments are natural inks on bone paper, chosen so that all four sit
 * clearly apart from each other AND from the rubric red that is reserved for
 * the lit lineage. Contrast on paper is recomputed by scripts/contrast-audit.ts.
 */
export interface House {
  id: string;
  head: Person;
  /** the pigment: bars, brackets, marks, and the house name (≥ 4.5:1 on paper) */
  ink: string;
  /** the same pigment as a faint wash for family blocks */
  wash: string;
  /** a simple geometric mark, drawn in SVG — no emoji, no heraldry kitsch */
  mark: "star" | "hexagon" | "lozenge" | "ring" | "seal";
}

const PIGMENTS: { ink: string; wash: string; mark: House["mark"] }[] = [
  { ink: "#75561A", wash: "rgba(117, 86, 26, 0.07)", mark: "star" }, // ochre
  { ink: "#3D5A80", wash: "rgba(61, 90, 128, 0.07)", mark: "hexagon" }, // indigo
  { ink: "#4F5E26", wash: "rgba(79, 94, 38, 0.07)", mark: "lozenge" }, // olive
  { ink: "#6B4C7A", wash: "rgba(107, 76, 122, 0.07)", mark: "ring" }, // plum
  { ink: "#7A4A3A", wash: "rgba(122, 74, 58, 0.07)", mark: "ring" }, // umber (5th+ son, if ever)
];

/** The founder's own house: iron-gall ink, the seal mark. */
export const FOUNDER_HOUSE: House = {
  id: family.root.id,
  head: family.root,
  ink: "#2A211A",
  wash: "rgba(42, 33, 26, 0.045)",
  mark: "seal",
};

export const HOUSES: House[] = family.root.children.map((id, i) => {
  const pig = PIGMENTS[Math.min(i, PIGMENTS.length - 1)];
  return { id, head: person(id), ...pig };
});

const houseOf = new Map<string, House>();
for (const h of HOUSES) {
  houseOf.set(h.id, h);
  const stack = [...h.head.children];
  while (stack.length) {
    const cur = stack.pop()!;
    houseOf.set(cur, h);
    stack.push(...person(cur).children);
  }
}

/** The house a person belongs to; the founder belongs to his own. */
export function houseFor(id: string): House {
  return houseOf.get(id) ?? FOUNDER_HOUSE;
}
