/* Recompute every documented contrast ratio from the tokens themselves. */
import { contrast, TOKENS } from "../lib/geometry";

function blend(fg: string, bg: string, alpha: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.replace("#", "").slice(i - 1, i + 1), 16));
  const [r1, g1, b1] = p(fg);
  const [r2, g2, b2] = p(bg);
  const mix = (a: number, b: number) => Math.round(a * alpha + b * (1 - alpha));
  return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

console.log("— alpha sweep: ink on paper —");
for (let a = 30; a <= 100; a += 5) {
  const hex = blend(TOKENS.ink, TOKENS.paper, a / 100);
  const c2 = contrast(hex, TOKENS.paper);
  const c3 = contrast(hex, TOKENS.paper2);
  console.log(`  ${a}% → ${hex}  paper ${c2.toFixed(2)}:1  paper2 ${c3.toFixed(2)}:1 ${c2 >= 4.5 ? "AA" : c2 >= 3 ? "AA-large" : ""}`);
}
console.log("— alpha sweep: rubric on paper —");
for (let a = 60; a <= 100; a += 10) {
  const hex = blend(TOKENS.rubric, TOKENS.paper, a / 100);
  console.log(`  ${a}% → ${hex}  ${contrast(hex, TOKENS.paper).toFixed(2)}:1`);
}
console.log("— fixed pairs —");
const pairs: [string, string, string][] = [
  ["ink on paper", TOKENS.ink, TOKENS.paper],
  ["ink on paper2", TOKENS.ink, TOKENS.paper2],
  ["rubric on paper", TOKENS.rubric, TOKENS.paper],
  ["rubric on paper2", TOKENS.rubric, TOKENS.paper2],
  ["paper on rubric (inverted chip)", TOKENS.paper, TOKENS.rubric],
  ["rule on paper (hairlines only, non-text)", TOKENS.rule, TOKENS.paper],
  ["paper2 on paper (plane separation)", TOKENS.paper2, TOKENS.paper],
];
for (const [label, a, b] of pairs) console.log(`  ${label}: ${contrast(a, b).toFixed(2)}:1`);
