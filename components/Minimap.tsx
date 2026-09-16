"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Layout } from "@/lib/layout";
import type { Geometry } from "@/lib/geometry";
import type { Lang } from "@/lib/family";

/**
 * اللوحة — the plate: the whole sheet reduced to one ink shape. Every person
 * is a tick at their column and row, so the family's proportions read before a
 * single name does: a heavy block for the largest branch, a lighter one beside
 * it, hairlines for the two that ended. The rubric mark is the viewport and
 * dragging it moves the sheet.
 *
 * Drawn in ROW units with preserveAspectRatio="none", so the plate always
 * fills its column however tall the family is — no pixel maths, no rescaling.
 */
export function Minimap({
  layout,
  geo,
  lang,
  scrollRef,
  contentHeight,
  chain,
}: {
  layout: Layout;
  geo: Geometry;
  lang: Lang;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  contentHeight: number;
  chain: readonly string[];
}) {
  const [view, setView] = useState({ top: 0, height: 0.15 });
  const ref = useRef<SVGSVGElement>(null);
  const rtl = lang === "ar";
  const cols = layout.maxDepth + 1;
  const rows = Math.max(1, layout.bounds.maxY / geo.rowPitch + 1);
  const chainSet = useMemo(() => new Set(chain), [chain]);

  /** row bands owned by each generation-2 branch, for the alternating grounds */
  const bands = useMemo(() => {
    const out: { from: number; to: number }[] = [];
    for (const n of layout.nodes) {
      if (n.depth !== 1) continue;
      const kin = layout.nodes.filter((m) => m.id === n.id || m.person.ancestors.includes(n.id));
      const ys = kin.map((m) => m.y / geo.rowPitch);
      out.push({ from: Math.min(...ys), to: Math.max(...ys) + 1 });
    }
    return out;
  }, [layout, geo.rowPitch]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () =>
      setView({
        top: (el.scrollTop / Math.max(1, contentHeight)) * rows,
        height: Math.max(0.6, (el.clientHeight / Math.max(1, contentHeight)) * rows),
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [scrollRef, contentHeight, rows]);

  const jump = (clientY: number) => {
    const el = scrollRef.current;
    const svg = ref.current;
    if (!el || !svg) return;
    const box = svg.getBoundingClientRect();
    const ratio = (clientY - box.top) / box.height;
    el.scrollTo({ top: ratio * contentHeight - el.clientHeight / 2, behavior: "auto" });
  };

  return (
    <svg
      ref={ref}
      className="minimap"
      viewBox={`0 0 ${cols} ${rows}`}
      preserveAspectRatio="none"
      aria-hidden
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        jump(e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) jump(e.clientY);
      }}
    >
      {bands.map((b, i) =>
        i % 2 === 1 ? <rect key={i} className="minimap__band" x={0} y={b.from} width={cols} height={b.to - b.from} /> : null,
      )}
      {layout.nodes.map((n) => {
        const col = rtl ? cols - 1 - n.depth : n.depth;
        return (
          <rect
            key={n.id}
            className={chainSet.has(n.id) ? "minimap__tick minimap__tick--lit" : "minimap__tick"}
            x={col + 0.12}
            y={n.y / geo.rowPitch}
            width={0.76}
            height={0.62}
          />
        );
      })}
      <rect className="minimap__view" x={0.02} y={view.top} width={cols - 0.04} height={view.height} />
    </svg>
  );
}
