"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Scroll } from "./Scroll";
import { HouseTree } from "./HouseTree";
import { Register } from "./Register";
import { SearchField } from "./SearchField";
import { Minimap } from "./Minimap";
import { BranchBar } from "./BranchBar";
import { GenGutter } from "./GenGutter";
import { Welcome } from "./Welcome";
import { useDragPan, useMediaQuery, usePinchZoom, useReducedMotion } from "./hooks";
import { SHEET_REST } from "./Register";
import { scrollLayout, pathToRoot, FOUNDER_ID } from "@/lib/layout";
import { houseLayout } from "@/lib/houseLayout";
import { geometry, houseGeometry, type SizeStep } from "@/lib/geometry";
import { branchOf, family, nameOf, nasab, person, subtreeIds, type Lang, type Person } from "@/lib/family";
import { num, t } from "@/lib/i18n";

const EMPTY = new Set<string>();
type View = "houses" | "scroll";

/** how far the sheet may be taken in and out by the wheel */
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
/** one wheel notch */
const ZOOM_STEP = 1.1;

/** every father in the family */
const FATHERS: Person[] = family.people.filter((p) => p.children.length > 0);

/** fathers whose depth relative to `root` is below `depth` — i.e. "open to generation depth+1" */
function fathersAbove(root: Person, depth: number): Set<string> {
  const out = new Set<string>();
  for (const f of FATHERS) {
    const inTree = f.id === root.id || f.ancestors.includes(root.id);
    if (inTree && f.generation - root.generation < depth) out.add(f.id);
  }
  return out;
}

/** what a branch shows when it is opened: the way down to it, itself, and its sons who are fathers */
function branchOpening(id: string): Set<string> {
  const p = person(id);
  const next = new Set<string>(p.ancestors);
  next.add(id);
  for (const c of p.children) if (person(c).children.length) next.add(c);
  return next;
}

export function FamilyTree({ lang }: { lang: Lang }) {
  const d = t(lang);
  const rtl = lang === "ar";
  const compact = useMediaQuery("(max-width: 767px)");
  const reduced = useReducedMotion();

  const [view, setView] = useState<View>("houses");
  const [rootId, setRootId] = useState(FOUNDER_ID);
  /** fathers whose children are on the sheet. The chart opens on the founder,
      his sons and their children: the shape of the family in one screen. */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => fathersAbove(family.root, 2));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [step, setStep] = useState<SizeStep>(1);
  /** CSS zoom on the sheet: 1 = natural size; "fit" shrinks the chart to the viewport width */
  const [zoom, setZoom] = useState(1);
  /** the zoom the last fit() landed on, so the button knows whether it is at fit */
  const [fitted, setFitted] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const didPhoneCollapse = useRef(false);
  /** the person the page opened on, if any: a phone must not fold their card away */
  const openedOn = useRef<string | null>(null);
  const setPendingTop = useRef(false);
  /** where the view should go next. The counter lets the same person be asked
      for twice in a row — tapping the selected card again brings it back. */
  const [aim, setAim] = useState<{ id: string; n: number } | null>(null);
  const aimAt = (id: string) => setAim((a) => ({ id, n: (a?.n ?? 0) + 1 }));
  /** stable, so the register's gesture listeners are not rebound on every render */
  const closeRegister = useCallback(() => {
    setSelectedId(null);
    setFocusId(null);
  }, []);

  /* The welcome card: up on every load, and back on demand from the masthead */
  const [welcome, setWelcome] = useState(true);
  const closeWelcome = useCallback(() => setWelcome(false), []);

  /* the mouse takes the sheet directly: drag to pan in both axes */
  useDragPan(scrollRef);
  /** the zoom the wheel last read, so the handler stays a pure function of the event */
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  });
  /** zoom lands on fractions, so "at fit" is a neighbourhood rather than a value */
  const atFit = fitted !== null && Math.abs(zoom - fitted) < 0.01;

  /* Zooming about a point. Whatever asks for a new zoom — two fingers, the
     wheel, the on-screen buttons — names the screen point that must stay put,
     and the sheet point under it is remembered. Once React has committed the
     new zoom, the layout effect below forces layout (so the browser's own
     RTL re-pinning of a grown sheet has already happened), reads where that
     sheet point landed, and scrolls by the difference. `scrollLeft +=` moves
     the sheet the same way in both writing directions. */
  const zoomAnchor = useRef<{ cx: number; cy: number; sx: number; sy: number } | null>(null);
  function zoomAbout(next: number, cx: number, cy: number) {
    const z = zoomRef.current;
    next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (Math.abs(next - z) < 1e-6) return;
    const sh = sheetRef.current;
    if (sh) {
      // measure against the zoom the sheet is actually drawn at: a pinch can
      // ask again before React has painted the previous answer
      const drawn = parseFloat(sh.style.zoom) || z;
      const r = sh.getBoundingClientRect();
      zoomAnchor.current = { cx, cy, sx: (cx - r.left) / drawn, sy: (cy - r.top) / drawn };
    }
    zoomRef.current = next;
    setZoom(next);
  }
  /* The tail under the chart. A scroll container cannot scroll past its
     content, and the chart is often shorter than the glass, so an anchored
     zoom would drift the moment it asked for a scrollTop the content cannot
     give. The tail grows by exactly what the anchor needs and shrinks back
     when it no longer does; on a phone it is never less than the height of
     the open sheet, so the last row can always rise above it. */
  const tailRef = useRef<HTMLDivElement>(null);
  const zoomSlack = useRef(0);
  const sheetOpen = useRef(false);
  const layTail = () => {
    const tail = tailRef.current;
    if (!tail) return;
    const base = sheetOpen.current ? window.innerHeight * SHEET_REST : 0;
    tail.style.height = `${Math.max(base, zoomSlack.current)}px`;
  };
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    if (!a) return;
    zoomAnchor.current = null;
    const el = scrollRef.current;
    const sh = sheetRef.current;
    if (!el || !sh) return;
    void el.scrollWidth; // settle layout at the new zoom before measuring
    const r = sh.getBoundingClientRect();
    const wantTop = el.scrollTop + (r.top + a.sy * zoom - a.cy);
    zoomSlack.current = Math.max(0, wantTop + el.clientHeight - r.height);
    layTail();
    el.scrollLeft += r.left + a.sx * zoom - a.cx;
    el.scrollTop = wantTop;
  }, [zoom]);

  /* two fingers take the sheet in and out about the point between them */
  usePinchZoom(scrollRef, {
    min: MIN_ZOOM,
    max: MAX_ZOOM,
    get: () => zoomRef.current,
    set: (z, mid) => zoomAbout(z, mid.x, mid.y),
  });
  /** one notch of the on-screen buttons, about the middle of the glass: two wheel notches, so a tap is felt */
  const zoomBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const z = zoomRef.current;
    zoomAbout(dir > 0 ? z * ZOOM_STEP * ZOOM_STEP : z / (ZOOM_STEP * ZOOM_STEP), r.left + r.width / 2, r.top + r.height / 2);
  };

  /* a phone folds the masthead's title away once the chart is being read,
     giving the line back to the chart; the search and the tools stay */
  const [scrolled, setScrolled] = useState(false);
  const mastheadRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    const head = mastheadRef.current;
    if (!el || !head || !compact) {
      setScrolled(false);
      return;
    }
    let on = false;
    const update = () => {
      // hysteresis: the title must not flicker at the threshold
      const next = on ? el.scrollTop > 24 : el.scrollTop > 72;
      if (next !== on) {
        on = next;
        setScrolled(next);
      }
    };
    el.addEventListener("scroll", update, { passive: true });
    // The title folding moves the chart's top edge up (and back down) by its
    // own height. Scroll by the same amount, so the chart stays where it is on
    // the glass — under two fingers or a thumb — and only the title moves.
    let lastH = head.getBoundingClientRect().height;
    const ro = new ResizeObserver(() => {
      const h = head.getBoundingClientRect().height;
      const dh = h - lastH;
      lastH = h;
      if (dh) el.scrollTop += dh;
    });
    ro.observe(head);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [compact]);

  const geo = useMemo(() => geometry(lang, step, compact), [lang, step, compact]);
  const hgeo = useMemo(() => houseGeometry(lang, step, compact), [lang, step, compact]);

  /* a phone opens one level shallower: the founder and his four sons — unless
     the page already opened on somebody (a shared link, read either on the
     server or in the browser), whose card the fold would hide again */
  useEffect(() => {
    if (compact && !didPhoneCollapse.current && !openedOn.current) {
      didPhoneCollapse.current = true;
      setExpanded(fathersAbove(family.root, 1));
    }
  }, [compact]);

  /* the scroll view folds whoever is not expanded */
  const collapsed = useMemo(() => {
    const out = new Set<string>();
    for (const f of FATHERS) if (!expanded.has(f.id)) out.add(f.id);
    return out;
  }, [expanded]);

  const layout = useMemo(
    () => scrollLayout({ rootId, collapsed, colPitch: geo.colPitch, rowPitch: geo.rowPitch }),
    [rootId, collapsed, geo.colPitch, geo.rowPitch],
  );
  const hlayout = useMemo(
    () =>
      houseLayout({
        rootId,
        expanded,
        cardW: hgeo.cardW,
        cardH: hgeo.cardH,
        gapX: hgeo.gapX,
        pitchY: hgeo.pitchY,
        stackRowH: hgeo.stackRowH,
        stackPad: hgeo.stackPad,
        stackFrom: hgeo.stackFrom,
      }),
    [rootId, expanded, hgeo],
  );

  const scrollW = Math.ceil(layout.bounds.maxX + geo.labelZone + geo.marginLead + geo.marginTrail);
  const scrollH = Math.ceil(layout.bounds.maxY + geo.rowPitch * 1.5);
  const houseW = Math.ceil(hlayout.width + hgeo.lead + hgeo.margin);
  const houseH = Math.ceil(hlayout.height + hgeo.margin * 2 + hgeo.chipH);
  const width = view === "houses" ? houseW : scrollW;
  const height = view === "houses" ? houseH : scrollH;

  /** the render's values as the effects below see them, refreshed before any
      of them runs, so an effect can depend on its trigger alone */
  const latest = useRef({ view, layout, hlayout, geo, hgeo, width, rtl, reduced, compact, rootId, selectedId, zoom });
  useEffect(() => {
    latest.current = { view, layout, hlayout, geo, hgeo, width, rtl, reduced, compact, rootId, selectedId, zoom };
  });

  const shownId = previewId ?? selectedId;
  /* the lit chain is whatever part of the lineage is on the sheet: a previewed
     search hit inside a folded house still lights the house it belongs to */
  const chain = useMemo(() => {
    if (!shownId) return [];
    const onSheet = (id: string) => (view === "houses" ? hlayout.positions.has(id) : layout.byId.has(id));
    const inTree = shownId === rootId || person(shownId).ancestors.includes(rootId);
    return inTree ? pathToRoot(shownId, rootId).filter(onSheet) : [];
  }, [shownId, rootId, view, hlayout, layout]);
  const subtree = useMemo(() => (shownId ? subtreeIds(shownId) : EMPTY), [shownId]);

  /** Make a person visible: open every one of their ancestors, nothing more. */
  function reveal(id: string) {
    const p = person(id);
    const inTree = id === rootId || p.ancestors.includes(rootId);
    if (!inTree) setRootId(FOUNDER_ID);
    setExpanded((cur) => {
      if (p.ancestors.every((a) => cur.has(a))) return cur;
      const next = new Set(cur);
      for (const a of p.ancestors) next.add(a);
      return next;
    });
  }

  function select(id: string) {
    reveal(id);
    setSelectedId(id);
    setFocusId(id);
    setPreviewId(null);
    aimAt(id);
  }

  /** the phone's list view: a tap on a name opens its record AND its next
      column; a tap on the name already open closes that column again */
  function selectAndOpen(id: string) {
    const hasIssue = person(id).children.length > 0;
    if (hasIssue && selectedId === id && expanded.has(id)) {
      toggleCollapse(id);
      return;
    }
    select(id);
    if (hasIssue && !expanded.has(id)) {
      setExpanded((cur) => {
        const next = new Set(cur);
        next.add(id);
        return next;
      });
    }
  }

  function toggleCollapse(id: string) {
    const folding = expanded.has(id);
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // folding away the selected person's card hands the selection to the
    // father whose branch just closed, so the register never shows someone
    // who is no longer on the sheet
    if (folding && selectedId && selectedId !== id && person(selectedId).ancestors.includes(id)) {
      setSelectedId(id);
      setFocusId(id);
    }
    // the father you touched stays where you can see him: opening a wide
    // branch would otherwise push him off the edge as the sheet grows
    aimAt(id);
  }

  /** fold every father at or below this depth (relative to the root) */
  function foldBelow(depth: number) {
    const root = person(rootId);
    setExpanded((cur) => {
      const next = new Set<string>();
      for (const id of cur) if (person(id).generation - root.generation < depth) next.add(id);
      return next;
    });
  }

  /** open every father at this depth whose card is on the sheet */
  function openDepth(depth: number) {
    const root = person(rootId);
    setExpanded((cur) => {
      const next = new Set(cur);
      for (const f of FATHERS) {
        const rel = f.generation - root.generation;
        const onSheet = rel === 0 || (rel > 0 && f.ancestors.slice(0, rel).every((a) => next.has(a) || a === rootId));
        if (rel === depth && onSheet && (f.id === root.id || f.ancestors.includes(root.id))) next.add(f.id);
      }
      return next;
    });
  }

  function openAll() {
    const root = person(rootId);
    setExpanded(fathersAbove(root, Infinity));
  }

  /** make this person the root of the sheet, without selecting anyone */
  function enterBranch(id: string) {
    setRootId(id);
    setExpanded(branchOpening(id));
  }

  function openBranch(id: string) {
    enterBranch(id);
    setSelectedId(id);
    setFocusId(id);
    setPendingTop.current = true;
    aimAt(id);
  }

  /** shrink the sheet so the whole chart fits the viewport width */
  function fit(floor = 0.3) {
    const el = scrollRef.current;
    if (!el) return;
    const avail = el.clientWidth - 8;
    // A phone is allowed to scale UP to fill the glass. The list view is often
    // far narrower than the screen — a register of five names is 244px of a
    // 375px phone — and leaving it at 1:1 strands a third of the width empty.
    // A desktop never grows past 1:1: there the sheet is meant to read as paper
    // at its natural size.
    const ceiling = compact ? 2 : 1;
    const z = Math.max(floor, Math.min(ceiling, avail / width));
    zoomRef.current = z;
    zoomSlack.current = 0; // a fit starts the sheet clean, with no room left over from a zoom
    layTail();
    setZoom(z);
    setFitted(z);
  }
  /** the Fit / 1:1 button: fit first; only once the chart fits does it offer natural size */
  const fitOrNatural = () => (atFit ? setZoom(1) : fit());

  /* The wheel takes the sheet in and out about the pointer — the chart is a
     map, not a document, so the wheel zooms and the hand does the moving.
     Bound by hand because it must be non-passive: preventDefault is what stops
     the page scrolling underneath, and what stops ctrl+wheel zooming the
     browser itself. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      const from = zoomRef.current;
      zoomAbout(from * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* A double tap on a card also folds it, the way a double click does, but on a
     phone two quick taps happen by accident far more often than on purpose:
     the browser's dblclick is dropped when the last press was a finger. The
     stop happens in the capture phase on the scroller, before it can reach the
     card's handler. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let touch = false;
    const onDown = (e: PointerEvent) => {
      touch = e.pointerType === "touch";
    };
    const onDbl = (e: MouseEvent) => {
      if (touch) e.stopPropagation();
    };
    el.addEventListener("pointerdown", onDown, true);
    el.addEventListener("dblclick", onDbl, true);
    return () => {
      el.removeEventListener("pointerdown", onDown, true);
      el.removeEventListener("dblclick", onDbl, true);
    };
  }, []);

  /* The first paint fits when it can: a chart you must scroll to even see is
     not a first impression — but never below 0.6, where names stop reading.

     Fitted once per layout, not once per page. `compact` is false until the
     media query resolves after mount, so a phone's first pass still measures the
     wide two-generation chart and shrinks to fit it; the fold just below then
     replaces that chart with a much smaller one. Fitting only once leaves the
     sheet at 0.6 on a screen it now fits comfortably. */
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current) return;
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    // Deliberately deferred. Each change of width restarts this timer, so the
    // fit lands on the layout that settles rather than the one that flashes
    // first: a phone only learns it is a phone once the media query resolves
    // after mount, and the fold above then rebuilds the chart smaller. Fitting
    // immediately would measure the wide chart and leave the sheet shrunk to
    // 0.6 on a screen the new chart fits comfortably.
    const t = setTimeout(() => {
      didFit.current = true;
      // Always through fit(): it clamps in both directions, so a sheet wider
      // than the glass shrinks to it and a narrow one grows to fill it.
      //
      // A phone is allowed below the 0.6 floor. English names are wide enough
      // that the chart needs about 0.51 to fit a 375px screen, and stopping at
      // 0.6 leaves the founder card clipped off the edge — worse to read than
      // slightly smaller type.
      fit(compact ? 0.45 : 0.6);
      // a page that opened on someone (a shared link) aimed at them before this
      // fit resized the sheet: aim again at the size that will stay
      const sel = latest.current.selectedId;
      if (sel) aimAt(sel);
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, compact]);

  /* A shared link opens on its person, and inside its branch if it names one.
     The link is read here in the browser rather than on the server: every page
     is prerendered with nobody selected (the public site is a plain static
     export), so choosing someone while rendering would disagree with the
     served HTML and break hydration. That is exactly the one-off "read the
     browser, then tell React" case the rule below cannot express, so it is
     turned off for this one call. */
  const didOpenLink = useRef(false);
  function openLink(branch: string | null, who: string) {
    if (branch) enterBranch(branch);
    select(who);
  }
  useEffect(() => {
    if (didOpenLink.current) return;
    didOpenLink.current = true;
    const q = new URLSearchParams(window.location.search);
    const b = q.get("b");
    const p = q.get("p");
    const branch = b && family.byId.has(b) && person(b).children.length > 0 ? b : null;
    const who = p && family.byId.has(p) ? p : branch;
    if (!who) return;
    openedOn.current = who; // so the phone's opening fold leaves this card alone
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openLink(branch, who);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* keep the URL shareable without paying for a router round-trip */
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("p", selectedId);
    else url.searchParams.delete("p");
    if (rootId !== FOUNDER_ID) url.searchParams.set("b", rootId);
    else url.searchParams.delete("b");
    window.history.replaceState(null, "", url);
  }, [selectedId, rootId]);

  /* Bring the aimed-at person into view. Only an explicit aim moves the view —
     selecting, opening or folding a branch, tapping the selected card again —
     never a zoom or a relayout on its own, so the fingers and the wheel keep
     what they put under themselves. Everything else is read through `latest`,
     refreshed before this runs, so the effect depends on the aim alone. */
  /* the phone sheet opening or closing changes how much tail the chart needs;
     laid before the aim below so the scroll it asks for is reachable */
  useEffect(() => {
    sheetOpen.current = compact && !!selectedId;
    layTail();
  }, [compact, selectedId]);
  useEffect(() => {
    if (!aim) return;
    const { view, layout, hlayout, geo, hgeo, width, rtl, reduced, compact, rootId, selectedId, zoom } = latest.current;
    const el = scrollRef.current;
    if (setPendingTop.current) {
      setPendingTop.current = false;
      el?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    if (!el) return;

    const id = aim.id;
    // the lineage to frame: from the person up to the root, as far as it is on the sheet
    const onSheet = (pid: string) => (view === "houses" ? hlayout.positions.has(pid) : layout.byId.has(pid));
    const inTree = id === rootId || person(id).ancestors.includes(rootId);
    const chain = inTree ? pathToRoot(id, rootId).filter(onSheet) : [];

    // where is the person on the current sheet? (layout units, before zoom)
    let px: number, py: number, spanTop: number, spanBottom: number;
    if (view === "houses") {
      const pos = hlayout.positions.get(id);
      if (!pos) return;
      px = hgeo.lead + pos.x;
      py = hgeo.margin + pos.y;
      const ys = chain.map((cid) => hlayout.positions.get(cid)?.y).filter((v): v is number => v !== undefined);
      spanTop = hgeo.margin + Math.min(...ys, pos.y);
      spanBottom = hgeo.margin + Math.max(...ys, pos.y) + hgeo.cardH;
    } else {
      const n = layout.byId.get(id);
      if (!n) return;
      px = n.x + geo.labelZone / 2;
      py = n.y;
      const ys = chain.map((cid) => layout.byId.get(cid)?.y).filter((v): v is number => v !== undefined);
      spanTop = Math.min(...ys, n.y);
      spanBottom = Math.max(...ys, n.y) + geo.rowPitch;
    }
    // with the phone sheet open only what lies above it is visible — aim into
    // that, not into the middle of the element
    const visibleH =
      compact && selectedId
        ? Math.max(120, window.innerHeight * (1 - SHEET_REST) - el.getBoundingClientRect().top)
        : el.clientHeight;
    // frame the WHOLE lineage when it fits: seeing the chain from the founder
    // down to the person is the point, not seeing the person alone
    const fits = (spanBottom - spanTop) * zoom <= visibleH * 0.86;
    const targetTop = fits ? ((spanTop + spanBottom) / 2) * zoom - visibleH / 2 : py * zoom - visibleH * 0.42;
    const screenX = (rtl ? width - px : px) * zoom;
    const maxLeft = Math.max(0, width * zoom - el.clientWidth);
    const wantLeft = Math.max(0, Math.min(maxLeft, screenX - el.clientWidth / 2));
    // an RTL scroll container counts scrollLeft from its right edge, downward
    // into negative numbers: 0 is the start of reading, -maxLeft the far end
    const left = rtl ? wantLeft - maxLeft : wantLeft;
    const top = Math.max(0, targetTop);
    const far = Math.abs(top - el.scrollTop) > el.clientHeight * 2 || Math.abs(left - el.scrollLeft) > el.clientWidth * 2;
    el.scrollTo({
      top,
      left,
      // gliding across six screens is disorienting and slow: snap the long jumps
      behavior: reduced || far ? "auto" : "smooth",
    });
  }, [aim]);

  /* keyboard: walk the tree the way the eye does */
  const onKey = (e: KeyboardEvent) => {
    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (welcome) return; // the welcome card owns the keyboard
    const cur = focusId ?? selectedId ?? rootId;
    const p = person(cur);
    const up = view === "houses" ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft"; // toward the root
    const down = view === "houses" ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
    const prev = view === "houses" ? (rtl ? "ArrowRight" : "ArrowLeft") : "ArrowUp";
    const next = view === "houses" ? (rtl ? "ArrowLeft" : "ArrowRight") : "ArrowDown";
    if (e.key === "Escape") {
      setSelectedId(null);
      setFocusId(null);
    } else if (e.key === up && p.fatherId && cur !== rootId) {
      e.preventDefault();
      select(p.fatherId);
    } else if (e.key === down && p.children.length) {
      e.preventDefault();
      if (!expanded.has(cur)) toggleCollapse(cur);
      select(p.children[0]);
    } else if (e.key === prev || e.key === next) {
      const father = p.fatherId ? person(p.fatherId) : null;
      if (!father) return;
      e.preventDefault();
      const sibs = father.children;
      const i = sibs.indexOf(cur);
      const j = e.key === next ? Math.min(sibs.length - 1, i + 1) : Math.max(0, i - 1);
      select(sibs[j]);
    } else if (e.key === " " && p.children.length) {
      e.preventDefault();
      toggleCollapse(cur);
    } else if (e.key >= "1" && e.key <= "7") {
      const g = Number(e.key);
      setExpanded(fathersAbove(person(rootId), g - 1));
    } else if (e.key === "0") {
      openAll();
    } else if (e.key === "+" || e.key === "=") {
      setStep((s) => Math.min(2, s + 1) as SizeStep);
    } else if (e.key === "-") {
      setStep((s) => Math.max(0, s - 1) as SizeStep);
    } else if (e.key === "f") {
      fitOrNatural();
    }
  };

  /* the listener is bound once; the handler it calls is always the latest */
  const keyRef = useRef(onKey);
  useEffect(() => {
    keyRef.current = onKey;
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const root = person(rootId);
  const isBranch = rootId !== FOUNDER_ID;
  const visibleGens = (view === "houses" ? hlayout.maxDepth : layout.maxDepth) + 1;
  /* what is actually on the sheet, not what the whole family holds */
  const perDepth = useMemo(() => {
    const counts = new Array<number>(visibleGens).fill(0);
    if (view === "houses") {
      for (const n of hlayout.nodes) counts[n.depth] += n.kind === "card" ? 1 : n.members.length;
    } else {
      for (const n of layout.nodes) counts[n.depth] += 1;
    }
    return counts;
  }, [view, layout, hlayout, visibleGens]);
  /** the deepest generation on the sheet that still has a folded father */
  const frontier = useMemo(() => {
    let f = -1;
    if (view === "houses") {
      for (const n of hlayout.nodes) if (n.kind === "card" && n.folded && n.depth > f) f = n.depth;
    } else {
      for (const n of layout.nodes) if (n.collapsed && n.depth > f) f = n.depth;
    }
    return f;
  }, [view, hlayout, layout]);

  return (
    <main className={`page grain${scrolled ? " page--scrolled" : ""}${compact && selectedId ? " page--sheet" : ""}`} lang={lang} dir={rtl ? "rtl" : "ltr"}>
      {/* ————— masthead ————— */}
      <header className="masthead" ref={mastheadRef}>
        <div className="masthead__id">
          <h1 className="masthead__word font-display">{lang === "ar" ? "آل نصر الدين" : "Nasr Aldeen"}</h1>
          <p className="masthead__sub font-text">
            {d.countPeople(family.people.length)}
            <span className="dot">·</span>
            {num(family.generations, lang)} {d.generations}
          </p>
        </div>

        <SearchField lang={lang} compact={compact} onPreview={setPreviewId} onCommit={select} />

        <div className="masthead__tools">
          <div className="views" role="group" aria-label={lang === "ar" ? "طريقة العرض" : "view"}>
            <button
              onClick={() => {
                setView("houses");
                didFit.current = false; // the new view has its own width: fit it
              }}
              aria-pressed={view === "houses"}
            >
              {d.viewHouses}
            </button>
            <button
              onClick={() => {
                setView("scroll");
                didFit.current = false; // the new view has its own width: fit it
              }}
              aria-pressed={view === "scroll"}
            >
              {d.viewScroll}
            </button>
          </div>
          <div className="stepper" role="group" aria-label={lang === "ar" ? "حجم الخط" : "text size"}>
            <button onClick={() => setStep((s) => Math.max(0, s - 1) as SizeStep)} disabled={step === 0} aria-label={d.zoomOut}>
              −
            </button>
            <button onClick={() => setStep((s) => Math.min(2, s + 1) as SizeStep)} disabled={step === 2} aria-label={d.zoomIn}>
              +
            </button>
            <button className="stepper__fit" onClick={fitOrNatural} aria-pressed={atFit} title={d.fit}>
              {atFit ? "1:1" : d.fit}
            </button>
          </div>
          <button className="chip chip--about" onClick={() => setWelcome(true)}>
            {d.about}
          </button>
          <Link
            className="chip chip--lang"
            /* switching language keeps the person you were reading */
            href={`/${lang === "ar" ? "en" : "ar"}${(() => {
              const q = new URLSearchParams();
              if (selectedId) q.set("p", selectedId);
              if (rootId !== FOUNDER_ID) q.set("b", rootId);
              const s = q.toString();
              return s ? `?${s}` : "";
            })()}`}
            prefetch={false}
          >
            {d.switchLang}
          </Link>
        </div>
      </header>

      <BranchBar
        lang={lang}
        activeBranchId={isBranch ? branchOf(root).id : selectedId ? branchOf(person(selectedId)).id : null}
        onOpen={openBranch}
      />

      {/* ————— breadcrumb: in a branch the nasab is the way back up ————— */}
      {isBranch && (
        <nav className="crumb" aria-label={lang === "ar" ? "المسار" : "breadcrumb"}>
          <button
            className="crumb__link"
            onClick={() => {
              setRootId(FOUNDER_ID);
              setExpanded(fathersAbove(family.root, 2));
            }}
          >
            {d.wholeFamily}
          </button>
          {[...root.ancestors].reverse().slice(1).map((aid) => (
            <button key={aid} className="crumb__link" onClick={() => openBranch(aid)}>
              {nameOf(person(aid), lang)}
            </button>
          ))}
          <span className="crumb__here font-text">{nameOf(root, lang)}</span>
          <span className="crumb__count">{d.countDescendants(root.descendantCount)}</span>
          <button className="crumb__all" onClick={openAll}>
            {lang === "ar" ? "افتح الكل" : "Open all"}
          </button>
        </nav>
      )}

      <div className="body">
        <div className="scrollwrap">
          <div className="scroller" ref={scrollRef} dir={rtl ? "rtl" : "ltr"}>
            <div
              ref={sheetRef}
              className="sheet"
              /* --print-zoom shrinks the sheet to the printable width of an A3
                 sheet in landscape, so the chart prints whole rather than
                 spilling off the right edge of every page */
              style={{
                width,
                minHeight: height,
                zoom,
                ["--print-zoom" as string]: String(Math.min(1, 1040 / width)),
              }}
              dir="ltr"
            >
              {view === "scroll" ? (
                <>
                  {/* generation heads sit inside the sheet so they track horizontal scroll
                      and stick vertically with no JS */}
                  <div className="gens" style={{ height: geo.headerH }} dir={rtl ? "rtl" : "ltr"}>
                    {Array.from({ length: visibleGens }, (_, i) => {
                      const gen = root.generation + i;
                      const x = i * geo.colPitch + geo.marginLead;
                      const isLast = i === visibleGens - 1;
                      return (
                        <button
                          key={gen}
                          className={`gens__head${i === frontier ? " gens__head--limit" : ""}`}
                          style={rtl ? { right: x } : { left: x }}
                          onClick={() => (isLast ? openDepth(i) : foldBelow(i))}
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
                          <span className="gens__label font-display">{d.genLabel(gen)}</span>
                          <span className="gens__count">{num(perDepth[i] ?? 0, lang)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="sheet__tree" style={{ marginTop: 4 }}>
                    <Scroll
                      layout={layout}
                      geo={geo}
                      lang={lang}
                      chain={chain}
                      selectedId={shownId}
                      focusId={focusId}
                      subtree={subtree}
                      onSelect={compact ? selectAndOpen : select}
                      /* on a phone the bead does what the name does: a finger
                         near a short name lands on the bead as often as not */
                      onToggleCollapse={compact ? selectAndOpen : toggleCollapse}
                      width={width}
                      height={height}
                      reduced={reduced}
                    />
                  </div>
                </>
              ) : (
                <div className="sheet__tree">
                  <HouseTree
                    layout={hlayout}
                    geo={hgeo}
                    lang={lang}
                    chain={chain}
                    selectedId={shownId}
                    focusId={focusId}
                    onSelect={select}
                    onToggleCollapse={toggleCollapse}
                    width={width}
                    height={height}
                    reduced={reduced}
                  />
                </div>
              )}

              {/* colophon — the chart signs itself and states its own count */}
              <p className="colophon font-text" dir={rtl ? "rtl" : "ltr"}>
                {lang === "ar"
                  ? `تمّت مشجرة آل نصر الدين · ${num(family.people.length, "ar")} اسمًا في ${num(family.generations, "ar")} أجيال`
                  : `The Nasr Aldeen family tree · ${family.people.length} names across ${family.generations} generations`}
              </p>
            </div>
            {/* the room under the chart: for the phone sheet, and for whatever an anchored zoom needs */}
            <div className="scroller__tail" ref={tailRef} aria-hidden />
          </div>

          {/* a phone has no wheel: the sheet is taken in and out by two fingers
              or by these, sat in the far top corner where neither chart draws */}
          {compact && (
            <div className="fabs" role="group" aria-label={lang === "ar" ? "تقريب الورقة" : "sheet zoom"}>
              <button onClick={() => zoomBy(1)} disabled={zoom >= MAX_ZOOM} aria-label={d.zoomSheetIn}>
                +
              </button>
              <button onClick={() => zoomBy(-1)} disabled={zoom <= MIN_ZOOM} aria-label={d.zoomSheetOut}>
                −
              </button>
              <button className="fabs__fit" onClick={fitOrNatural} aria-pressed={atFit}>
                {atFit ? "1:1" : d.fit}
              </button>
            </div>
          )}

          {!compact && view === "scroll" && (
            <Minimap layout={layout} geo={geo} lang={lang} scrollRef={scrollRef} contentHeight={height + geo.headerH} chain={chain} />
          )}
          {!compact && view === "houses" && (
            <GenGutter
              lang={lang}
              scrollRef={scrollRef}
              count={visibleGens}
              firstGen={root.generation}
              perDepth={perDepth}
              frontier={frontier}
              zoom={zoom}
              top0={hgeo.margin + hgeo.cardH / 2}
              pitchY={hgeo.pitchY}
              onFold={foldBelow}
              onOpen={openDepth}
            />
          )}
        </div>

        {selectedId && (
          <Register
            id={selectedId}
            lang={lang}
            compact={compact}
            onSelect={select}
            onOpenBranch={openBranch}
            onClose={closeRegister}
            isBranchRoot={selectedId === rootId}
          />
        )}
      </div>

      {welcome && <Welcome lang={lang} onClose={closeWelcome} />}

      {/* the lit nasab, always readable even when the register is dismissed */}
      {shownId && !selectedId && (
        <p className="ribbon font-text" aria-live="polite">
          {nasab(person(shownId), lang)}
        </p>
      )}

      {/* the two views fold on different things: the tree on the issue chip
          under a card, the list on the bead beside the name — and the list
          shows no chip at all on a phone, so one wording cannot serve both */}
      <p className="hint" aria-hidden>
        {view === "scroll"
          ? compact
            ? d.hintMobileList
            : d.hintDesktopList
          : compact
            ? d.hintMobile
            : d.hintDesktop}
      </p>
    </main>
  );
}
