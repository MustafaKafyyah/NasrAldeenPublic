import raw from "@/data/people.json";

export type Lang = "ar" | "en";
export type Sex = "m" | "f";

/** A single row of data/people.json — kept faithful to the source. */
export interface PersonRecord {
  id: string;
  nameAr: string;
  nameEn: string;
  /** recorded by hand; when absent the name heuristic below decides */
  sex?: Sex;
  fatherId: string | null;
  /** oldest first — the order of this array IS the birth order */
  children: string[];
  /** Everything below is optional and rendered only when present. */
  details?: PersonDetails;
}

export interface PersonDetails {
  /** URL or /public path of a portrait */
  photo?: string;
  /** honorific or role: "شيخ القبيلة", "طبيب"... */
  title?: string;
  /** date of birth — ISO or free text ("١٤٠٥هـ") */
  born?: string;
  age?: string;
  died?: string;
  city?: string;
  /** wife or wives, one name each */
  wives?: string[];
  phone?: string;
  email?: string;
  /** free text, shown in the register */
  note?: string;
}

/** Every detail key, in the order the register shows them. */
export const DETAIL_KEYS = ["title", "born", "age", "died", "city", "wives", "phone", "email", "note", "photo"] as const satisfies readonly (keyof PersonDetails)[];

/** true when any detail field carries a value */
export function hasDetails(p: PersonRecord): boolean {
  const d = p.details;
  if (!d) return false;
  return DETAIL_KEYS.some((k) => (Array.isArray(d[k]) ? (d[k] as string[]).length > 0 : !!d[k]));
}

/** Enriched person with everything the UI needs precomputed. */
export interface Person extends PersonRecord {
  /** 1 = founder */
  generation: number;
  /** ids from this person up to the founder (excluding self) */
  ancestors: string[];
  /** count of every descendant below this person */
  descendantCount: number;
  /** ids of siblings (same father, excluding self) */
  siblings: string[];
  /** order among siblings as listed in the source (0-based) */
  birthOrder: number;
  /** from the recorded `sex`, else best-effort from the Arabic name */
  isFemale: boolean;
  /** position in data/people.json — the key into the measured type metrics */
  index: number;
}

export interface FamilyIndex {
  byId: Map<string, Person>;
  people: Person[];
  root: Person;
  generations: number;
  perGeneration: number[];
}

/* ---------- gender heuristic (names only — no gender field in source) ---------- */

/**
 * Curated feminine given names (Arabic spelling as it appears in the data).
 * Only the Arabic name decides — Latin transliterations are too irregular
 * ("Abdullah", "Alaa", "Mustafa" all end like feminine names).
 */
const FEMALE_AR = new Set([
  "مها", "يارا", "نور", "هند", "ريم", "لمى", "منال", "منى", "منه", "سارة", "سارا", "دانة", "دانه", "دانيه",
  "لين", "لينا", "ليان", "جود", "رنا", "رزان", "هيا", "شهد", "غادة", "وفاء", "هناء", "سناء", "غنى",
  "أروى", "اروى", "سلمى", "سلوى", "نجوى", "لبنى", "بشرى", "هدى", "ندى", "مي", "مريم", "ماريا", "ريما",
  "رغد", "روان", "لجين", "جوري", "جنى", "جنا", "تالا", "تالة", "ديما", "دينا", "نوف", "أمل", "امل",
  "إيمان", "ايمان", "أسماء", "اسماء", "آلاء", "الاء", "دعاء", "رجاء", "علياء", "شيماء", "نداء",
  "حنان", "إحسان", "احسان", "ابتسام", "ابتهال", "فرح", "رهف", "أفنان", "افنان", "ريناد", "رشا", "رؤى",
  "غلا", "غزل", "الجوهرة", "الجازي", "العنود", "البندري", "موضي", "مضاوي", "حصة", "شيخة", "هبه", "هبة",
  "طرفة", "نورا", "سما", "سمر", "سحر", "سهام", "سعاد", "سميرة", "سميره", "سهى", "زينب", "ضحى",
  "ليلى", "لانا", "لارا", "ديالا", "نايا", "تمارا", "لمارا", "أمنيه", "أمنية", "عفراء", "هيفاء", "رونل",
]);

/** Masculine names that end in taa marbuta or hamza and must not be caught by the suffix rules. */
const MALE_SUFFIX_EXCEPTIONS = new Set([
  "اسامة", "أسامة", "حمزة", "طلحة", "معاوية", "عطية", "عقبة", "عبيدة", "ضياء", "بهاء", "علاء", "زكريا",
]);

export function looksFemale(ar: string): boolean {
  const a = ar.trim();
  if (FEMALE_AR.has(a)) return true;
  if (MALE_SUFFIX_EXCEPTIONS.has(a)) return false;
  // taa marbuta ending is feminine in almost every given name
  if (a.endsWith("ة")) return true;
  // -aa' ending (هيفاء، عفراء، دعاء) is feminine once the masculine handful above is excluded
  if (a.endsWith("اء")) return true;
  return false;
}

/* ---------- index ---------- */

function buildIndex(records: PersonRecord[]): FamilyIndex {
  const byRecord = new Map(records.map((r) => [r.id, r]));
  const byId = new Map<string, Person>();

  const generationOf = (id: string): number => {
    let g = 1;
    let cur = byRecord.get(id);
    while (cur && cur.fatherId) {
      g += 1;
      cur = byRecord.get(cur.fatherId);
    }
    return g;
  };

  const ancestorsOf = (id: string): string[] => {
    const out: string[] = [];
    let cur = byRecord.get(id);
    while (cur && cur.fatherId) {
      out.push(cur.fatherId);
      cur = byRecord.get(cur.fatherId);
    }
    return out;
  };

  const descCache = new Map<string, number>();
  const descendantsOf = (id: string): number => {
    const cached = descCache.get(id);
    if (cached !== undefined) return cached;
    const rec = byRecord.get(id);
    const n = rec ? rec.children.reduce((acc, c) => acc + 1 + descendantsOf(c), 0) : 0;
    descCache.set(id, n);
    return n;
  };

  records.forEach((r, index) => {
    const father = r.fatherId ? byRecord.get(r.fatherId) : undefined;
    const siblings = father ? father.children.filter((c) => c !== r.id) : [];
    const birthOrder = father ? father.children.indexOf(r.id) : 0;
    byId.set(r.id, {
      ...r,
      generation: generationOf(r.id),
      ancestors: ancestorsOf(r.id),
      descendantCount: descendantsOf(r.id),
      siblings,
      birthOrder,
      isFemale: r.sex ? r.sex === "f" : looksFemale(r.nameAr),
      index,
    });
  });

  const people = [...byId.values()];
  const root = people.find((p) => p.fatherId === null);
  if (!root) throw new Error("family data has no root");
  const generations = Math.max(...people.map((p) => p.generation));
  const perGeneration = Array.from({ length: generations }, (_, i) =>
    people.filter((p) => p.generation === i + 1).length,
  );
  return { byId, people, root, generations, perGeneration };
}

export const family: FamilyIndex = buildIndex(raw as PersonRecord[]);

/* ---------- helpers ---------- */

export function person(id: string): Person {
  const p = family.byId.get(id);
  if (!p) throw new Error(`unknown person ${id}`);
  return p;
}

export function nameOf(p: PersonRecord, lang: Lang): string {
  return lang === "ar" ? p.nameAr : p.nameEn;
}

/** "محمد بن علي بن حسن بن نصر الدين" / "Muhammad bin Ali bin Hassan bin NasrAldeen" */
export function nasab(p: Person, lang: Lang, opts?: { depth?: number; self?: boolean }): string {
  const depth = opts?.depth ?? Infinity;
  const includeSelf = opts?.self ?? true;
  const link = lang === "ar" ? (p.isFemale ? " بنت " : " بن ") : p.isFemale ? " bint " : " bin ";
  const later = lang === "ar" ? " بن " : " bin ";
  const chain = p.ancestors.slice(0, depth).map((id) => nameOf(person(id), lang));
  if (!includeSelf) return chain.join(later);
  if (chain.length === 0) return nameOf(p, lang);
  return nameOf(p, lang) + link + chain.join(later);
}

/** All descendant ids (depth-first, source order). */
export function descendants(id: string): string[] {
  const out: string[] = [];
  const walk = (cur: string) => {
    for (const c of person(cur).children) {
      out.push(c);
      walk(c);
    }
  };
  walk(id);
  return out;
}

/** The generation-2 branch this person belongs to (or self if gen ≤ 2). */
export function branchOf(p: Person): Person {
  if (p.generation <= 2) return p;
  const branchId = p.ancestors[p.ancestors.length - 2];
  return person(branchId);
}

/* ---------- search ---------- */

const HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Fold Arabic orthographic variants and Latin case so "احمد" finds "أحمد" and "sa'id" finds "Saeed". */
export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(HARAKAT, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`ʿʾ\-_.?]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const LINK_TOKENS = new Set(["بن", "بنت", "bin", "bint"]);

export interface SearchHit {
  person: Person;
  /** 0 = exact name match, larger = weaker */
  rank: number;
}

export function search(query: string, lang: Lang, limit = 12): SearchHit[] {
  const q = normalize(query);
  if (!q) return [];
  const hits: SearchHit[] = [];
  for (const p of family.people) {
    const ar = normalize(p.nameAr);
    const en = normalize(p.nameEn);
    const primary = lang === "ar" ? ar : en;
    const secondary = lang === "ar" ? en : ar;
    let rank = -1;
    if (primary === q) rank = 0;
    else if (primary.startsWith(q)) rank = 1;
    else if (secondary === q) rank = 2;
    else if (secondary.startsWith(q)) rank = 3;
    else if (primary.includes(q) || secondary.includes(q)) rank = 4;
    else {
      // multi-word: match whole tokens of the short nasab chain ("محمد علي" → محمد بن علي)
      const words = q.split(" ").filter(Boolean);
      if (words.length > 1) {
        const tokens = normalize(nasab(p, lang, { depth: 3 }))
          .split(" ")
          .filter((tok) => tok && !LINK_TOKENS.has(tok));
        const ownTokens = primary.split(" ");
        const hit = (w: string) => tokens.some((tok) => tok === w || tok.startsWith(w));
        if (words.every(hit)) {
          rank = ownTokens.some((tok) => tok === words[0] || tok.startsWith(words[0])) ? 5 : 6;
        }
      }
    }
    if (rank >= 0) hits.push({ person: p, rank });
  }
  hits.sort((a, b) => a.rank - b.rank || a.person.generation - b.person.generation || a.person.birthOrder - b.person.birthOrder);
  return hits.slice(0, limit);
}

/** Descendants of a person grouped by how many generations below them they sit. */
export function descendantsByDepth(id: string): number[] {
  const out: number[] = [];
  let frontier = person(id).children;
  while (frontier.length) {
    out.push(frontier.length);
    frontier = frontier.flatMap((c) => person(c).children);
  }
  return out;
}

/** Every id in this person's subtree, including the person. */
export function subtreeIds(id: string): Set<string> {
  const out = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of person(cur).children) {
      out.add(c);
      stack.push(c);
    }
  }
  return out;
}

/** Generation-2 branch heads, largest line first. */
export function branches(): Person[] {
  return family.root.children.map((id) => person(id));
}
