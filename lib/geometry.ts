import metrics from "@/data/type-metrics.json";
import type { Lang } from "./family";

/**
 * All geometry is derived from MEASURED text widths (data/type-metrics.json,
 * produced by scripts/measure-type.mjs against the real font binaries), never
 * from guessed values. Re-run that script whenever a face or a size changes.
 */

export interface Metric {
  p50: number;
  p90: number;
  p99: number;
  max: number;
  widest: string;
}

/** Size steps the reader can choose. Index 1 is the default. */
export type SizeStep = 0 | 1 | 2;
export const SIZE_STEPS: SizeStep[] = [0, 1, 2];

interface FaceSpec {
  /** name font-size in px per size step */
  nameSize: [number, number, number];
  /** measured widths of all 291 names, at `measuredAt` px */
  measured: Metric;
  measuredAt: number;
}

const FACES: Record<Lang, FaceSpec> = {
  ar: { nameSize: [17, 19, 22], measured: metrics.arAmiri19 as Metric, measuredAt: 19 },
  en: { nameSize: [15, 17, 19], measured: metrics.enGaramond18 as Metric, measuredAt: 18 },
};

/** Widest of the 291 names at a given size, scaled linearly from the measured size. */
export function maxNameWidth(lang: Lang, step: SizeStep): number {
  const f = FACES[lang];
  return Math.ceil((f.measured.max / f.measuredAt) * f.nameSize[step]);
}

export function nameSize(lang: Lang, step: SizeStep): number {
  return FACES[lang].nameSize[step];
}

/* ------------------------------------------------------------------ */

export interface Geometry {
  lang: Lang;
  step: SizeStep;
  compact: boolean;
  /** distance between two generation columns (px) */
  colPitch: number;
  /** distance between two rows (px) */
  rowPitch: number;
  nameSize: number;
  /** bead radius for an ordinary person */
  beadR: number;
  /** bead radius for a father whose line is large */
  beadRBig: number;
  /** gap between the bead and the first letter of the name */
  beadGap: number;
  /** width reserved for bead + name (+ folio when shown): no rule ever crosses it */
  labelZone: number;
  /** where a father's bracket run starts, measured from his bead */
  runStart: number;
  /** distance from a child's bead back to the bracket spine */
  stub: number;
  /** font-size of the folio (line-size) number */
  folioSize: number;
  /** width reserved for the folio number, 0 when it is not shown */
  folioZone: number;
  showFolio: boolean;
  /** page margin on the reading edge, where the root sits */
  marginLead: number;
  /** margin on the far edge */
  marginTrail: number;
  headerH: number;
  /** click/touch target height for a row */
  hitH: number;
}

export function geometry(lang: Lang, step: SizeStep, compact: boolean): Geometry {
  const size = nameSize(lang, step);
  const widest = maxNameWidth(lang, step);
  const beadR = 3.5;
  const beadGap = compact ? 7 : 9;
  const stub = compact ? 15 : 20;
  const folioSize = Math.max(10, Math.round(size * 0.6));
  // three Eastern digits at folioSize is the widest count in this family (١٨٢)
  const showFolio = !compact;
  const folioZone = showFolio ? Math.ceil(folioSize * 2.1) + 6 : 0;
  const labelZone = Math.ceil(beadR + beadGap + widest + folioZone);
  const runStart = labelZone + (compact ? 4 : 8);
  const colPitch = Math.ceil(runStart + stub * 2 + (compact ? 6 : 12));
  const rowPitch = compact ? Math.max(32, Math.round(size * 1.75)) : Math.max(26, Math.round(size * 1.6));
  return {
    lang,
    step,
    compact,
    colPitch,
    rowPitch,
    nameSize: size,
    beadR,
    beadRBig: 5.5,
    beadGap,
    labelZone,
    runStart,
    stub,
    folioSize,
    folioZone,
    showFolio,
    marginLead: compact ? 26 : 52,
    marginTrail: compact ? 16 : 52,
    headerH: compact ? 34 : 40,
    hitH: compact ? 42 : Math.max(24, rowPitch),
  };
}

/** Fathers whose line reaches this size get the heavier bead. */
export const BIG_LINE = 50;

/* ---------------- contrast (recomputed, never carried forward) --------------- */

function srgbToLin(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  return (
    0.2126 * srgbToLin(parseInt(h.slice(0, 2), 16)) +
    0.7152 * srgbToLin(parseInt(h.slice(2, 4), 16)) +
    0.0722 * srgbToLin(parseInt(h.slice(4, 6), 16))
  );
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const TOKENS = {
  paper: "#F3EDE1",
  paper2: "#E8E0CF",
  ink: "#2A211A",
  rubric: "#9E2A1C",
  rule: "#C9BDA6",
} as const;

/* ---------------- per-name measured widths ---------------- */

const PER = metrics.perName as { ar: number[]; arAt: number; en: number[]; enAt: number };

/**
 * Rendered width of one person's name at the given size, from the real font
 * binary. Index order matches data/people.json, so `index` is the person's
 * position in that file.
 */
export function nameWidth(index: number, lang: Lang, step: SizeStep): number {
  const raw = lang === "ar" ? PER.ar[index] : PER.en[index];
  const at = lang === "ar" ? PER.arAt : PER.enAt;
  if (raw === undefined) return maxNameWidth(lang, step);
  return (raw / at) * nameSize(lang, step);
}

/* ---------------- البيوت — the house chart ---------------- */

export interface HouseGeometry {
  lang: Lang;
  step: SizeStep;
  compact: boolean;
  cardW: number;
  cardH: number;
  gapX: number;
  pitchY: number;
  stackRowH: number;
  stackPad: number;
  stackFrom: number;
  nameSize: number;
  /** the other language's name, set small under the main one */
  subSize: number;
  chipH: number;
  margin: number;
  /** width of the generation gutter's lane on the reading edge */
  gutterW: number;
  /** margin on the reading edge = margin + gutterW */
  lead: number;
}

export function houseGeometry(lang: Lang, step: SizeStep, compact: boolean): HouseGeometry {
  const size = nameSize(lang, step);
  const other: Lang = lang === "ar" ? "en" : "ar";
  const subSize = Math.max(10, Math.round(size * 0.62));
  // a card must hold the widest name in EITHER language: the main name at
  // `size` and the other language's at `subSize`
  const widestMain = maxNameWidth(lang, step);
  const widestSub = (maxNameWidth(other, 1) / nameSize(other, 1)) * subSize;
  const pad = compact ? 12 : 16;
  const cardW = Math.ceil(Math.max(widestMain, widestSub) + pad * 2 + 6);
  const cardH = Math.round(size * 1.35 + subSize * 1.3 + 18);
  const chipH = compact ? 22 : 20;
  return {
    lang,
    step,
    compact,
    cardW,
    cardH,
    gapX: compact ? 10 : 14,
    pitchY: cardH + chipH + (compact ? 34 : 44),
    stackRowH: Math.round(size * 1.5),
    stackPad: 8,
    // never stack: every child keeps its own column so the row reads in birth
    // order, oldest to youngest — a stack would pull the childless out of it
    stackFrom: Infinity,
    nameSize: size,
    subSize,
    chipH,
    margin: compact ? 16 : 40,
    gutterW: compact ? 0 : 150,
    lead: (compact ? 16 : 40) + (compact ? 0 : 150),
  };
}
