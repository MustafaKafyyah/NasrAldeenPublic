/* Dev-only: measure the house chart at the default and full expansions; audit house pigments. */
import { houseLayout } from "../lib/houseLayout";
import { HOUSES, FOUNDER_HOUSE } from "../lib/houses";
import { contrast, TOKENS } from "../lib/geometry";
import { FOUNDER_ID } from "../lib/layout";
import { family } from "../lib/family";

const base = { rootId: FOUNDER_ID, cardW: 148, cardH: 62, gapX: 14, pitchY: 118, stackRowH: 26, stackPad: 8, stackFrom: 2 };
for (const limit of [1, 2, 3, 4, Infinity]) {
  const expanded = new Set(family.people.filter((p) => p.children.length > 0 && p.generation - 1 < limit).map((p) => p.id));
  const L = houseLayout({ ...base, expanded });
  const cards = L.nodes.filter((n) => n.kind === "card").length;
  const stacks = L.nodes.filter((n) => n.kind === "stack").length;
  console.log(`depthLimit ${limit}: ${L.width}×${L.height}px, ${cards} cards, ${stacks} stacks, ${L.blocks.length} blocks, ${L.positions.size} people placed`);
}
for (const h of [FOUNDER_HOUSE, ...HOUSES]) {
  console.log(`${h.head.nameEn.padEnd(10)} ${h.ink} on paper ${contrast(h.ink, TOKENS.paper).toFixed(2)}:1  on paper2 ${contrast(h.ink, TOKENS.paper2).toFixed(2)}:1  vs rubric ${contrast(h.ink, TOKENS.rubric).toFixed(2)}:1`);
}
