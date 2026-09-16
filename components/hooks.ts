"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * SSR-safe media query: false on the server AND on the first client render,
 * flipping to the real value only after mount, so hydration always matches.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Same contract for prefers-reduced-motion. */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/**
 * Drag anywhere on the sheet to pan it in both axes, the way a map moves under
 * the hand. Pure DOM: it only ever sets scrollLeft/scrollTop, so the native
 * scrollbars, the sticky generation heads and the minimap all keep working —
 * this is still "no pan-and-zoom library", just a hand on the same scroller.
 *
 * Touch is deliberately left alone: native touch already pans both axes, and
 * hijacking it is exactly what brings the iOS bugs back.
 */
export function useDragPan(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /** px of travel before a press counts as a pan rather than a click */
    const THRESHOLD = 4;
    let down = false;
    let panned = false;
    let id = -1;
    let x0 = 0;
    let y0 = 0;
    let left0 = 0;
    let top0 = 0;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      // a press inside a field belongs to that field, never to the sheet
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
      down = true;
      panned = false;
      id = e.pointerId;
      x0 = e.clientX;
      y0 = e.clientY;
      left0 = el.scrollLeft;
      top0 = el.scrollTop;
    };

    const onMove = (e: PointerEvent) => {
      if (!down || e.pointerId !== id) return;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (!panned) {
        if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
        panned = true;
        // capture keeps the pan alive when the pointer leaves the scroller, but
        // it throws if the browser no longer considers this pointer active —
        // losing it is survivable, dropping the whole drag is not
        try {
          el.setPointerCapture(id);
        } catch {
          /* pan without capture */
        }
        el.classList.add("scroller--panning");
      }
      // scroll against the pointer so the sheet follows the hand. No RTL case:
      // scrollLeft counts away from the reading edge either way, so the same
      // subtraction moves the view correctly in both directions.
      el.scrollLeft = left0 - dx;
      el.scrollTop = top0 - dy;
    };

    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== id) return;
      down = false;
      try {
        if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
      } catch {
        /* nothing held it */
      }
      el.classList.remove("scroller--panning");
      id = -1;
      /* `panned` stays set until the click this release produces is swallowed
         below; a drag that ends off-target just has it cleared by the next press */
    };

    /** a drag must never also select a card */
    const onClick = (e: MouseEvent) => {
      if (!panned) return;
      panned = false;
      e.stopPropagation();
      e.preventDefault();
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("click", onClick, true);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("click", onClick, true);
    };
  }, [ref]);
}
