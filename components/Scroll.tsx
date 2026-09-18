"use client";

import { memo, useMemo } from "react";
import type { Layout, LaidOutNode } from "@/lib/layout";
import { BIG_LINE, nameWidth, type Geometry } from "@/lib/geometry";
import { nameOf, nasab, type Lang, type Person } from "@/lib/family";
import { num } from "@/lib/i18n";

/** Milliseconds the rubric ink takes to cross one generation. */
export const CHAIN_STEP_MS = 90;

export interface ScrollProps {
  layout: Layout;
  geo: Geometry;
  lang: Lang;
  /** the lit lineage, nearest-first (selected person → layout root) */
  chain: readonly string[];
  selectedId: string | null;
  focusId: string | null;
  /** ids inside the selected person's own subtree — kept at full ink */
  subtree: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  width: number;
  height: number;
  reduced: boolean;
}

/** In Arabic the root sits at the right edge and descent flows leftward. */
function mirror(x: number, width: number, rtl: boolean, lead: number) {
  return rtl ? width - lead - x : lead + x;
}

/** 1px rules land on device pixels instead of blurring across two. */
function snap(v: number): number {
  return Math.round(v) + 0.5;
}

function ariaLabel(p: Person, lang: Lang): string {
  const gen = lang === "ar" ? `الجيل ${p.generation}` : `generation ${p.generation}`;
  const chain = nasab(p, lang, { depth: 2 });
  const issue =
    p.children.length === 0
      ? lang === "ar"
        ? "لا عقب"
        : "no children"
      : lang === "ar"
        ? `${p.children.length} من الأبناء`
        : `${p.children.length} children`;
  return `${chain} — ${gen} — ${issue}`;
}

function NodeMark({ p, geo }: { p: Person; geo: Geometry }) {
  const hasIssue = p.children.length > 0;
  const r = p.descendantCount >= BIG_LINE ? geo.beadRBig : geo.beadR;
  if (p.isFemale) {
    return (
      <rect
        className="node__bead"
        x={-r}
        y={-r}
        width={r * 2}
        height={r * 2}
        transform="rotate(45)"
        fill="none"
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  return (
    <circle
      className="node__bead"
      r={r}
      fill={hasIssue ? "currentColor" : "none"}
      strokeWidth={hasIssue ? 0 : 1.25}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function Node({
  n,
  geo,
  lang,
  rtl,
  width,
  state,
  chainIndex,
  focused,
  isHead,
  isSelected,
  onSelect,
  onToggleCollapse,
  reduced,
}: {
  n: LaidOutNode;
  geo: Geometry;
  lang: Lang;
  rtl: boolean;
  width: number;
  state: "lit" | "normal" | "receded";
  chainIndex: number;
  focused: boolean;
  isHead: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  reduced: boolean;
}) {
  const p = n.person;
  const cx = mirror(n.x, width, rtl, geo.marginLead);
  const cy = n.y + geo.rowPitch / 2;
  const dir = rtl ? -1 : 1;
  const hasIssue = p.children.length > 0;
  const delay = reduced ? 0 : Math.max(0, chainIndex) * CHAIN_STEP_MS;
  const w = nameWidth(p.index, lang, geo.step);
  const nameStart = geo.beadR + geo.beadGap;
  const hitW = Math.max(geo.compact ? 88 : 56, nameStart + w + 16);
  // the leader runs from the end of the name to the folio column, when there is room
  const leaderFrom = nameStart + w + 6;
  const leaderTo = geo.labelZone - geo.folioZone + 2;
  const leader = geo.showFolio && hasIssue && !isHead && leaderTo - leaderFrom > 14 ? { from: leaderFrom, to: leaderTo } : null;

  return (
    <g
      className={`node node--${state}${focused ? " node--focused" : ""}${n.collapsed ? " node--folded" : ""}${isHead ? " node--head" : ""}`}
      style={state === "lit" ? ({ "--lit-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      transform={`translate(${cx},${cy})`}
      id={`n-${p.id}`}
      data-id={p.id}
      role="treeitem"
      aria-level={p.generation}
      aria-selected={isSelected}
      aria-expanded={hasIssue ? !n.collapsed : undefined}
      aria-label={ariaLabel(p, lang)}
      /* the handler lives on the group: the name text is painted over the hit
         rect and would otherwise swallow a click on the letters themselves */
      onClick={() => onSelect(p.id)}
      onDoubleClick={() => hasIssue && onToggleCollapse(p.id)}
    >
      {/* hit target: the real name, never the empty rest of the column */}
      <rect
        className="node__hit"
        x={rtl ? -(hitW - 8) : -8}
        y={-geo.hitH / 2}
        width={hitW}
        height={geo.hitH}
        fill="transparent"
      />

      {/* an index leader carries the eye from the name to its line-size */}
      {leader && (
        <line
          className="node__leader"
          x1={dir * leader.from}
          x2={dir * leader.to}
          y1={0.5}
          y2={0.5}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {isHead && (
        <circle className="node__seal" r={geo.beadRBig + 4} fill="none" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      )}
      <NodeMark p={p} geo={geo} />

      <text
        className="node__name"
        x={dir * (geo.beadR + geo.beadGap)}
        y={0}
        dominantBaseline="central"
        textAnchor={rtl ? "end" : "start"}
        fontSize={isHead ? Math.round(geo.nameSize * 1.3) : geo.nameSize}
      >
        {nameOf(p, lang)}
      </text>

      {geo.showFolio && hasIssue && !isHead && (
        <text
          className="node__folio"
          x={dir * geo.labelZone}
          y={0}
          dominantBaseline="central"
          textAnchor={rtl ? "start" : "end"}
          fontSize={geo.folioSize}
        >
          {num(p.descendantCount, lang)}
        </text>
      )}

      {/* folded subtree: a hollow ring round the bead plus the count it hides */}
      {n.collapsed && (
        <>
          <circle
            className="node__ring"
            r={(p.descendantCount >= BIG_LINE ? geo.beadRBig : geo.beadR) + 3.5}
            fill="none"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {!geo.showFolio && (
            <text
              className="node__folio node__folio--folded"
              x={dir * (nameStart + w + 8)}
              y={0}
              dominantBaseline="central"
              textAnchor={rtl ? "end" : "start"}
              fontSize={geo.folioSize}
            >
              {num(p.descendantCount, lang)}
            </text>
          )}
        </>
      )}

      {/* collapse control on the bead — separate target from the name */}
      {hasIssue && (
        <circle
          className="node__toggle"
          r={geo.compact ? 22 : 12}
          fill="transparent"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(p.id);
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      )}
    </g>
  );
}

/**
 * A scribe's bracket: the run leaves the father AFTER his label zone, gathers
 * at a spine one stub short of the children, and ticks into each child's bead.
 * No rule ever crosses a name.
 */
function bracketPath(father: LaidOutNode, child: LaidOutNode, geo: Geometry, rtl: boolean, width: number): string {
  const fx = mirror(father.x, width, rtl, geo.marginLead);
  const fy = father.y + geo.rowPitch / 2;
  const cx = mirror(child.x, width, rtl, geo.marginLead);
  const cy = child.y + geo.rowPitch / 2;
  const dir = rtl ? -1 : 1;
  const from = snap(fx + dir * geo.runStart);
  const spine = snap(cx - dir * geo.stub);
  const to = snap(cx - dir * (geo.beadR + 3));
  return `M ${from} ${snap(fy)} H ${spine} V ${snap(cy)} H ${to}`;
}

function ScrollImpl({
  layout,
  geo,
  lang,
  chain,
  selectedId,
  focusId,
  subtree,
  onSelect,
  onToggleCollapse,
  width,
  height,
  reduced,
}: ScrollProps) {
  const rtl = lang === "ar";
  const chainSet = useMemo(() => new Set(chain), [chain]);
  /** chain is nearest-first; the ink travels from the root, so invert for the delay */
  const chainIndexOf = useMemo(() => {
    const m = new Map<string, number>();
    chain.forEach((id, i) => m.set(id, chain.length - 1 - i));
    return m;
  }, [chain]);

  const rows = Math.ceil(height / geo.rowPitch);

  return (
    <svg
      className={`tree-svg${selectedId ? " tree-svg--lineage" : ""}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="tree"
      tabIndex={0}
      aria-label={lang === "ar" ? "مشجرة آل نصر الدين" : "the Nasr Aldeen family tree"}
      aria-activedescendant={focusId ? `n-${focusId}` : undefined}
    >
      {/* mistara ruling — the paper's own grid, laid before any ink */}
      <g className="ruling" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <line key={i} x1={0} x2={width} y1={snap(i * geo.rowPitch)} y2={snap(i * geo.rowPitch)} />
        ))}
      </g>

      {/* one hairline per generation, at the spine of that column's brackets */}
      <g className="columns" aria-hidden>
        {Array.from({ length: layout.maxDepth }, (_, i) => {
          const d = i + 1;
          const x = snap(mirror(d * geo.colPitch - geo.stub, width, rtl, geo.marginLead));
          return <line key={d} x1={x} x2={x} y1={0} y2={height} />;
        })}
      </g>

      <g className="links" aria-hidden>
        {layout.links.map((l) => {
          const lit = chainSet.has(l.source.id) && chainSet.has(l.target.id);
          const idx = chainIndexOf.get(l.target.id) ?? 0;
          return (
            <path
              key={l.id}
              className={`link${lit ? " link--lit" : selectedId ? " link--receded" : ""}`}
              style={lit && !reduced ? ({ "--lit-delay": `${idx * CHAIN_STEP_MS}ms` } as React.CSSProperties) : undefined}
              d={bracketPath(l.source, l.target, geo, rtl, width)}
              pathLength={1}
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </g>

      <g className="nodes">
        {layout.nodes.map((n) => {
          const lit = chainSet.has(n.id);
          const state: "lit" | "normal" | "receded" = lit
            ? "lit"
            : !selectedId || subtree.has(n.id)
              ? "normal"
              : "receded";
          return (
            <Node
              key={n.id}
              n={n}
              geo={geo}
              lang={lang}
              rtl={rtl}
              width={width}
              state={state}
              chainIndex={chainIndexOf.get(n.id) ?? -1}
              focused={focusId === n.id}
              isHead={n.depth === 0 && n.person.fatherId === null}
              isSelected={n.id === selectedId}
              onSelect={onSelect}
              onToggleCollapse={onToggleCollapse}
              reduced={reduced}
            />
          );
        })}
      </g>
    </svg>
  );
}

export const Scroll = memo(ScrollImpl);
