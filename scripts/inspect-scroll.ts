/* Dev-only: measure the tashjīr scroll with real type metrics + audit contrast. */
import { scrollLayout, radialLayout, FOUNDER_ID } from "../lib/layout";
import { geometry, contrast, TOKENS, maxNameWidth } from "../lib/geometry";
import { family } from "../lib/family";

for (const lang of ["ar", "en"] as const) {
  for (const compact of [false, true]) {
    const g = geometry(lang, 1, compact);
    const L = scrollLayout({ rootId: FOUNDER_ID, colPitch: g.colPitch, rowPitch: g.rowPitch });
    const w = Math.round(L.bounds.maxX + g.labelZone + g.marginLead + g.marginTrail);
    const h = Math.round(L.bounds.maxY + g.rowPitch);
    console.log(
      `${lang} ${compact ? "phone" : "desk "} colPitch ${g.colPitch} rowPitch ${g.rowPitch} name ${g.nameSize}px ` +
        `widest ${maxNameWidth(lang, 1)}px labelZone ${g.labelZone} → scroll ${w}×${h}px`,
    );
    for (const limit of [2, 3, 4, 5]) {
      const S = scrollLayout({ rootId: FOUNDER_ID, colPitch: g.colPitch, rowPitch: g.rowPitch, depthLimit: limit });
      console.log(
        `    depthLimit ${limit}: ${S.nodes.length} people, ${Math.round(S.bounds.maxY + g.rowPitch)}px tall, ` +
          `${Math.round(S.bounds.maxX + g.labelZone + g.marginLead + g.marginTrail)}px wide`,
      );
    }
  }
}

const g = geometry("ar", 1, false);
const R = radialLayout({ rootId: FOUNDER_ID, ringRadii: [0, 220, 470, 760, 1090, 1470, 1900], arcFor: (d) => [0, 150, 130, 120, 110, 100, 92][d] ?? 92 });
console.log("radial diameter", Math.round(R.bounds.maxX - R.bounds.minX), "×", Math.round(R.bounds.maxY - R.bounds.minY));
void g;

const pairs: [string, string, string][] = [
  ["ink on paper", TOKENS.ink, TOKENS.paper],
  ["rubric on paper", TOKENS.rubric, TOKENS.paper],
  ["rubric on paper2", TOKENS.rubric, TOKENS.paper2],
  ["paper on rubric", TOKENS.paper, TOKENS.rubric],
];
for (const [label, a, b] of pairs) console.log(`contrast ${label}: ${contrast(a, b).toFixed(2)}:1`);
console.log("people", family.people.length);
