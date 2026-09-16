/* Dev-only sanity check: pnpm tsx scripts/inspect-data.ts */
import { family, nasab, search, branchOf } from "../lib/family";

const f = family;
console.log("people", f.people.length, "generations", f.generations, "perGen", f.perGeneration);
console.log("root", f.root.nameAr, f.root.nameEn, "desc", f.root.descendantCount);
const females = f.people.filter((p) => p.isFemale);
console.log("female-flagged", females.length, females.map((p) => p.nameAr).join(" | "));
const femalesWithKids = females.filter((p) => p.children.length);
console.log("female-flagged WITH children (suspicious)", femalesWithKids.map((p) => `${p.nameAr}/${p.nameEn}`));
const sample = f.people.find((p) => p.generation === 6 && p.nameAr === "محمد")!;
console.log("nasab ar:", nasab(sample, "ar"));
console.log("nasab en:", nasab(sample, "en"));
console.log("nasab depth2:", nasab(sample, "ar", { depth: 2 }));
console.log("branch:", branchOf(sample).nameAr);
console.log("search 'احمد' →", search("احمد", "ar").map((h) => `${h.rank}:${nasab(h.person, "ar", { depth: 2 })}`));
console.log("search 'Mohammad Nour' →", search("Mohammad Nour", "en").map((h) => `${h.rank}:${h.person.nameEn}`));
console.log("search 'محمد علي' →", search("محمد علي", "ar").map((h) => `${h.rank}:${nasab(h.person, "ar", { depth: 2 })}`));
console.log("search 'saeed' →", search("saeed", "en").map((h) => `${h.rank}:${h.person.nameEn}`));
const g2 = f.root.children.map((id) => f.byId.get(id)!);
console.log("gen2", g2.map((p) => `${p.nameAr} ${p.descendantCount}`));
const widest = [...f.people].sort((a, b) => b.children.length - a.children.length).slice(0, 5);
console.log("widest", widest.map((p) => `${p.nameEn}:${p.children.length}`));
