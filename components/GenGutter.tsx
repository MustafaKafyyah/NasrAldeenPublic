"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/lib/family";
import { num, t } from "@/lib/i18n";

/**
 * Generation labels for the house chart, pinned to the reading edge of the
 * viewport and following the sheet's vertical scroll. The chart is wide and
 * short, so the labels must survive horizontal scrolling — hence an overlay
 * outside the scroller, synced by one passive scroll listener, rather than a
 * sticky element inside it.
 *
 * Clicking a label folds everything below that generation; clicking the
 * frontier label opens the next generation.
 */
export function GenGutter({
  lang,
  scrollRef,
  count,
  firstGen,
  perDepth,
  frontier,
  zoom,
  top0,
  pitchY,
  onFold,
  onOpen,
}: {
  lang: Lang;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  count: number;
  firstGen: number;
  perDepth: number[];
  /** the deepest generation on the sheet that still has folded fathers, or -1 */
  frontier: number;
  zoom: number;
  /** sheet-space y of the first generation's card centre */
  top0: number;
  pitchY: number;
  onFold: (depth: number) => void;
  onOpen: (depth: number) => void;
}) {
  const d = t(lang);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setScrollTop(el.scrollTop);
    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, [scrollRef]);

  return (
    <div className="gutter">
      {Array.from({ length: count }, (_, i) => {
        const gen = firstGen + i;
        const isFrontier = i === frontier;
        const isLast = i === count - 1;
        const y = (top0 + i * pitchY) * zoom - scrollTop;
        return (
          <button
            key={gen}
            className={`gutter__label font-display${isFrontier ? " gutter__label--frontier" : ""}`}
            style={{ top: y - 12 }}
            onClick={() => (isLast ? onOpen(i) : onFold(i))}
            title={
              isLast
                ? lang === "ar"
                  ? "افتح الجيل التالي"
                  : "Open the next generation"
                : lang === "ar"
                  ? `اطوِ ما بعد ${d.genLabel(gen)}`
                  : `Fold below ${d.genLabel(gen)}`
            }
          >
            {d.genLabel(gen)}
            <span className="gutter__count">{num(perDepth[i] ?? 0, lang)}</span>
            {isLast && isFrontier && <span className="gutter__more">+</span>}
          </button>
        );
      })}
    </div>
  );
}
