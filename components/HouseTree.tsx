"use client";

import { memo, useMemo } from "react";
import type { HouseLayout, CardNode, StackNode } from "@/lib/houseLayout";
import type { HouseGeometry } from "@/lib/geometry";
import { houseFor, type House } from "@/lib/houses";
import { hasDetails, nameOf, nasab, type Lang, type Person } from "@/lib/family";
import { num } from "@/lib/i18n";

/** Milliseconds the rubric ink takes to cross one generation. */
export const CHAIN_STEP_MS = 90;

export interface HouseTreeProps {
  layout: HouseLayout;
  geo: HouseGeometry;
  lang: Lang;
  /** the lit lineage, nearest-first (selected person → layout root) */
  chain: readonly string[];
  selectedId: string | null;
  focusId: string | null;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  width: number;
  height: number;
  reduced: boolean;
}

/** In Arabic the chart is mirrored: the first son sits at the right. */
function mx(x: number, width: number, rtl: boolean, margin: number) {
  return rtl ? width - margin - x : margin + x;
}

function snap(v: number) {
  return Math.round(v) + 0.5;
}

/* ---------- the house mark: one simple geometric figure per house ---------- */

export function HouseMark({ house, r = 5, className }: { house: House; r?: number; className?: string }) {
  const c = className ?? "house-mark";
  switch (house.mark) {
    case "star": {
      // eight-point star from two squares
      return (
        <g className={c}>
          <rect x={-r} y={-r} width={r * 2} height={r * 2} />
          <rect x={-r} y={-r} width={r * 2} height={r * 2} transform="rotate(45)" />
        </g>
      );
    }
    case "hexagon": {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
      }).join(" ");
      return <polygon className={c} points={pts} />;
    }
    case "lozenge":
      return <rect className={c} x={-r} y={-r} width={r * 2} height={r * 2} transform="rotate(45)" />;
    case "ring":
      return (
        <g className={c}>
          <circle r={r} fill="none" strokeWidth={1.5} />
          <circle r={r * 0.35} />
        </g>
      );
    case "seal":
    default:
      return (
        <g className={c}>
          <circle r={r} />
          <circle r={r + 3} fill="none" strokeWidth={1} />
        </g>
      );
  }
}

function SexMark({ p, r = 3.2 }: { p: Person; r?: number }) {
  if (p.isFemale) {
    return <rect className="sex-mark" x={-r} y={-r} width={r * 2} height={r * 2} transform="rotate(45)" fill="none" strokeWidth={1.2} />;
  }
  return <circle className="sex-mark" r={r} fill={p.children.length ? "currentColor" : "none"} strokeWidth={1.2} />;
}

function ariaLabel(p: Person, lang: Lang): string {
  const gen = lang === "ar" ? `الجيل ${p.generation}` : `generation ${p.generation}`;
  return `${nasab(p, lang, { depth: 2 })} — ${gen}`;
}

/* ------------------------------ a card ------------------------------ */

function Card({
  n,
  geo,
  lang,
  rtl,
  width,
  lit,
  chainIndex,
  selected,
  focused,
  isHead,
  onSelect,
  onToggle,
  reduced,
}: {
  n: CardNode;
  geo: HouseGeometry;
  lang: Lang;
  rtl: boolean;
  width: number;
  lit: boolean;
  chainIndex: number;
  selected: boolean;
  focused: boolean;
  isHead: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  reduced: boolean;
}) {
  const p = n.person;
  const house = houseFor(p.id);
  const cx = mx(n.x, width, rtl, geo.lead);
  const x = cx - n.w / 2;
  const y = n.y + geo.margin;
  const other: Lang = lang === "ar" ? "en" : "ar";
  const hasIssue = p.children.length > 0;
  const delay = reduced ? 0 : Math.max(0, chainIndex) * CHAIN_STEP_MS;
  const noted = hasDetails(p);

  return (
    <g
      className={`card${lit ? " card--lit" : ""}${selected ? " card--selected" : ""}${focused ? " card--focused" : ""}${n.folded ? " card--folded" : ""}${isHead ? " card--head" : ""}`}
      style={{ ["--house" as string]: house.ink, ["--lit-delay" as string]: `${delay}ms` }}
      id={`n-${p.id}`}
      data-id={p.id}
      role="treeitem"
      aria-level={p.generation}
      aria-selected={selected}
      aria-expanded={hasIssue ? !n.folded : undefined}
      aria-label={ariaLabel(p, lang)}
      /* the whole card is the target — the name text sits above the paper, so
         a handler on the paper alone misses a click on the letters. One click
         opens the record and the next generation, and a second click folds it,
         so there is nothing left for a double click to do. */
      onClick={() => onSelect(p.id)}
    >
      <rect className="card__paper" x={snap(x)} y={snap(y)} width={n.w} height={n.h} rx={7} />
      {/* the house bar along the top edge */}
      <rect className="card__bar" x={x + 7} y={y} width={n.w - 14} height={3} rx={1.5} />

      {/* marks: the house at the start, sex at the end */}
      <g transform={`translate(${rtl ? x + n.w - 13 : x + 13}, ${y + 15})`}>
        <HouseMark house={house} r={isHead ? 5.5 : 4.5} />
      </g>
      <g transform={`translate(${rtl ? x + 13 : x + n.w - 13}, ${y + 15})`}>
        <SexMark p={p} />
      </g>

      <text
        className="card__name"
        x={cx}
        y={y + 14 + geo.nameSize * 0.95}
        textAnchor="middle"
        fontSize={isHead ? Math.round(geo.nameSize * 1.15) : geo.nameSize}
      >
        {nameOf(p, lang)}
      </text>
      <text className="card__sub" x={cx} y={y + n.h - 9} textAnchor="middle" fontSize={geo.subSize}>
        {nameOf(p, other)}
      </text>

      {noted && <circle className="card__note" cx={rtl ? x + 26 : x + n.w - 26} cy={y + 15} r={2} />}

      {/* the issue chip: how many descend from this person; click to fold or open */}
      {hasIssue && (
        <g
          className="chip-issue"
          transform={`translate(${cx}, ${y + n.h + geo.chipH / 2 + 2})`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(p.id);
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          role="button"
          aria-label={n.folded ? (lang === "ar" ? "افتح" : "open") : lang === "ar" ? "اطوِ" : "fold"}
        >
          {/* a phone gets a finger-sized invisible target round the chip, kept
              below the card's bottom edge so it never steals a tap meant for
              the card; the drawn chip itself keeps its size in both places */}
          {geo.compact && <rect x={-30} y={-(geo.chipH / 2 + 2)} width={60} height={geo.chipH / 2 + 2 + 24} fill="transparent" />}
          <rect className="chip-issue__bg" x={-22} y={-geo.chipH / 2} width={44} height={geo.chipH} rx={geo.chipH / 2} />
          <text className="chip-issue__text" y={0.5} textAnchor="middle" dominantBaseline="central" fontSize={11}>
            {n.folded ? `+${num(p.descendantCount, lang)}` : num(p.descendantCount, lang)}
          </text>
        </g>
      )}
    </g>
  );
}

/* --------------------------- a leaf stack --------------------------- */

function Stack({
  n,
  geo,
  lang,
  rtl,
  width,
  chainSet,
  selectedId,
  focusId,
  onSelect,
}: {
  n: StackNode;
  geo: HouseGeometry;
  lang: Lang;
  rtl: boolean;
  width: number;
  chainSet: ReadonlySet<string>;
  selectedId: string | null;
  focusId: string | null;
  onSelect: (id: string) => void;
}) {
  const house = houseFor(n.parentId);
  const cx = mx(n.x, width, rtl, geo.lead);
  const x = cx - n.w / 2;
  const y = n.y + geo.margin;
  const pad = 12;
  return (
    <g className="stack" style={{ ["--house" as string]: house.ink }} role="group">
      <rect className="stack__paper" x={snap(x)} y={snap(y)} width={n.w} height={n.h} rx={7} />
      {n.members.map((m, i) => {
        const ry = y + geo.stackPad + i * geo.stackRowH + geo.stackRowH / 2;
        const lit = chainSet.has(m.id);
        return (
          <g
            key={m.id}
            className={`stack__row${lit ? " stack__row--lit" : ""}${selectedId === m.id ? " stack__row--selected" : ""}${focusId === m.id ? " stack__row--focused" : ""}`}
            id={`n-${m.id}`}
            data-id={m.id}
            role="treeitem"
            aria-level={m.generation}
            aria-selected={selectedId === m.id}
            aria-label={ariaLabel(m, lang)}
            onClick={() => onSelect(m.id)}
          >
            <rect className="stack__hit" x={x + 2} y={ry - geo.stackRowH / 2} width={n.w - 4} height={geo.stackRowH} rx={4} />
            <g transform={`translate(${rtl ? x + n.w - pad - 2 : x + pad + 2}, ${ry})`}>
              <SexMark p={m} r={3} />
            </g>
            <text
              className="stack__name"
              x={rtl ? x + n.w - pad - 12 : x + pad + 12}
              y={ry}
              dominantBaseline="central"
              textAnchor={rtl ? "end" : "start"}
              fontSize={Math.round(geo.nameSize * 0.92)}
            >
              {nameOf(m, lang)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------------ the chart ------------------------------ */

function HouseTreeImpl({
  layout,
  geo,
  lang,
  chain,
  selectedId,
  focusId,
  onSelect,
  onToggleCollapse,
  width,
  height,
  reduced,
}: HouseTreeProps) {
  const rtl = lang === "ar";
  const chainSet = useMemo(() => new Set(chain), [chain]);
  const chainIndexOf = useMemo(() => {
    const m = new Map<string, number>();
    chain.forEach((id, i) => m.set(id, chain.length - 1 - i));
    return m;
  }, [chain]);

  /** bracket from a father's card down to a child card or a stack */
  const links = useMemo(() => {
    const out: { id: string; d: string; house: House; lit: boolean; idx: number }[] = [];
    for (const n of layout.nodes) {
      const parentId = n.kind === "card" ? n.parentId : n.parentId;
      if (!parentId) continue;
      const father = layout.cards.get(parentId);
      if (!father) continue;
      const fx = snap(mx(father.x, width, rtl, geo.lead));
      const fy = snap(geo.margin + father.y + father.h + geo.chipH + 4);
      const cx = snap(mx(n.x, width, rtl, geo.lead));
      const cy = snap(geo.margin + n.y);
      const mid = snap(fy + (cy - fy) * 0.5);
      const lit = n.kind === "card" ? chainSet.has(n.id) && chainSet.has(parentId) : n.members.some((m) => chainSet.has(m.id));
      const idx = n.kind === "card" ? (chainIndexOf.get(n.id) ?? 0) : 0;
      out.push({ id: n.id, d: `M ${fx} ${fy} V ${mid} H ${cx} V ${cy}`, house: houseFor(parentId), lit, idx });
    }
    return out;
  }, [layout, width, rtl, geo.lead, geo.margin, geo.chipH, chainSet, chainIndexOf]);

  return (
    <svg
      className={`house-svg${selectedId ? " house-svg--lineage" : ""}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="tree"
      tabIndex={0}
      aria-label={lang === "ar" ? "شجرة آل نصر الدين" : "the Nasr Aldeen family tree"}
      aria-activedescendant={focusId ? `n-${focusId}` : undefined}
    >
      {/* family blocks: a father's immediate family as one faint wash */}
      <g className="blocks" aria-hidden>
        {layout.blocks.map((b) => {
          const house = houseFor(b.id);
          const x0 = rtl ? width - geo.lead - (b.x0 + b.w) : geo.lead + b.x0;
          // the strip of children only: from just under the father's chip to the
          // bottom of the tallest child, so nested families never overlap
          const top = geo.margin + b.y0 + geo.cardH + geo.chipH + 6;
          const bottom = geo.margin + b.y0 + b.h + 6;
          return (
            <rect
              key={b.id}
              className="block"
              style={{ fill: house.wash }}
              x={x0}
              y={top}
              width={b.w}
              height={Math.max(0, bottom - top)}
              rx={10}
            />
          );
        })}
      </g>

      <g className="links" aria-hidden>
        {links.map((l) => (
          <path
            key={l.id}
            className={`hlink${l.lit ? " hlink--lit" : ""}`}
            style={{ ["--house" as string]: l.house.ink, ["--lit-delay" as string]: `${reduced ? 0 : l.idx * CHAIN_STEP_MS}ms` }}
            d={l.d}
            pathLength={1}
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      <g className="nodes">
        {layout.nodes.map((n) =>
          n.kind === "card" ? (
            <Card
              key={n.id}
              n={n}
              geo={geo}
              lang={lang}
              rtl={rtl}
              width={width}
              lit={chainSet.has(n.id)}
              chainIndex={chainIndexOf.get(n.id) ?? -1}
              selected={selectedId === n.id}
              focused={focusId === n.id}
              isHead={n.person.fatherId === null}
              onSelect={onSelect}
              onToggle={onToggleCollapse}
              reduced={reduced}
            />
          ) : (
            <Stack
              key={n.id}
              n={n}
              geo={geo}
              lang={lang}
              rtl={rtl}
              width={width}
              chainSet={chainSet}
              selectedId={selectedId}
              focusId={focusId}
              onSelect={onSelect}
            />
          ),
        )}
      </g>
    </svg>
  );
}

export const HouseTree = memo(HouseTreeImpl);
