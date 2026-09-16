"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Scroll } from "./Scroll";
import { HouseTree } from "./HouseTree";
import { Register } from "./Register";
import { SearchField } from "./SearchField";
import { Minimap } from "./Minimap";
import { BranchBar } from "./BranchBar";
import { GenGutter } from "./GenGutter";
import { useDragPan, useMediaQuery, useReducedMotion } from "./hooks";
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

export function FamilyTree({ lang, initialPersonId }: { lang: Lang; initialPersonId: string | null }) {
  const d = t(lang);
  const rtl = lang === "ar";
  const compact = useMediaQuery("(max-width: 767px)");
  const reduced = useReducedMotion();

  const [view, setView] = useState<View>("houses");
  const [rootId, setRootId] = useState(FOUNDER_ID);
  /** fathers whose children are on the sheet. The chart opens on the founder,
      his sons and their children: the shape of the family in one screen. */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => {
    const base = fathersAbove(family.root, 2);
    if (initialPersonId) for (const a of person(initialPersonId).ancestors) base.add(a);
    return base;
  });
  const [selectedId, setSelectedId] = useState<string | null>(initialPersonId);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [step, setStep] = useState<SizeStep>(1);
  /** CSS zoom on the sheet: 1 = natural size; "fit" shrinks the chart to the viewport width */
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const didPhoneCollapse = useRef(false);
  const setPendingTop = useRef(false);

  /* the mouse takes the sheet directly: drag to pan in both axes */
  useDragPan(scrollRef);
  /** the zoom the wheel last read, so the handler stays a pure function of the event */
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  });
  /** the wheel lands on fractions, so 1:1 is a neighbourhood rather than a value */
  const atNaturalSize = Math.abs(zoom - 1) < 0.01;

  const geo = useMemo(() => geometry(lang, step, compact), [lang, step, compact]);
  const hgeo = useMemo(() => houseGeometry(lang, step, compact), [lang, step, compact]);

  /* a phone opens one level shallower: the founder and his four sons */
  useEffect(() => {
    if (compact && !didPhoneCollapse.current && !initialPersonId) {
      didPhoneCollapse.current = true;
      setExpanded(fathersAbove(family.root, 1));
    }
  }, [compact, initialPersonId]);

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
  }

  function toggleCollapse(id: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  function openBranch(id: string) {
    setRootId(id);
    setExpanded(() => {
      const p = person(id);
      const next = new Set<string>(p.ancestors);
      next.add(id);
      for (const c of p.children) if (person(c).children.length) next.add(c);
      return next;
    });
    setSelectedId(id);
    setPendingTop.current = true;
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
    setZoom(Math.max(floor, Math.min(ceiling, avail / width)));
  }

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
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, from * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)));
      if (next === from) return;
      // Where the view lands afterwards is left to the effect below, which
      // already knows how to bring the selected person back into the middle in
      // either writing direction. Anchoring the zoom on the pointer instead was
      // tried and dropped: it needs the sheet's post-zoom geometry, and a fresh
      // CSS `zoom` stays out of layout long enough that everything measured in
      // between still reads at the old scale.
      setZoom(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
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
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, compact]);

  /* A shared ?p= link opens on that person. The link is read here in the
     browser rather than on the server, because reading it on the server would
     make the page render on demand and this site is a plain static export.
     Declared before the effect below so it reads the link before that one
     rewrites the URL.

     It has to select AFTER mounting, not during the first render: every page is
     prerendered with nobody selected, so choosing someone while rendering would
     disagree with the served HTML and break hydration. That is exactly the
     one-off "read the browser, then tell React" case the rule below cannot
     express, so it is turned off for this line alone. */
  const didOpenLink = useRef(false);
  useEffect(() => {
    if (didOpenLink.current) return;
    didOpenLink.current = true;
    const p = new URLSearchParams(window.location.search).get("p");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (p && family.byId.has(p)) select(p);
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

  /* bring the selected person into view */
  useEffect(() => {
    if (!selectedId) return;
    const el = scrollRef.current;
    if (setPendingTop.current) {
      setPendingTop.current = false;
      el?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    if (!el) return;

    // where is the person on the current sheet? (layout units, before zoom)
    let px: number, py: number, spanTop: number, spanBottom: number;
    if (view === "houses") {
      const pos = hlayout.positions.get(selectedId);
      if (!pos) return;
      px = hgeo.lead + pos.x;
      py = hgeo.margin + pos.y;
      const ys = chain.map((id) => hlayout.positions.get(id)?.y).filter((v): v is number => v !== undefined);
      spanTop = hgeo.margin + Math.min(...ys, pos.y);
      spanBottom = hgeo.margin + Math.max(...ys, pos.y) + hgeo.cardH;
    } else {
      const n = layout.byId.get(selectedId);
      if (!n) return;
      px = n.x + geo.labelZone / 2;
      py = n.y;
      const ys = chain.map((id) => layout.byId.get(id)?.y).filter((v): v is number => v !== undefined);
      spanTop = Math.min(...ys, n.y);
      spanBottom = Math.max(...ys, n.y) + geo.rowPitch;
    }
    // the phone sheet is a fixed overlay, so only the top of the scroller is
    // actually visible — aim into that, not into the middle of the element
    const visibleH = compact ? el.clientHeight * 0.48 : el.clientHeight;
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
  }, [selectedId, view, layout, hlayout, width, rtl, geo, hgeo, reduced, compact, chain, zoom]);

  /* keyboard: walk the tree the way the eye does */
  const onKey = (e: KeyboardEvent) => {
    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
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
      if (atNaturalSize) fit();
      else setZoom(1);
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
    <main className="page grain" lang={lang} dir={rtl ? "rtl" : "ltr"}>
      {/* ————— masthead ————— */}
      <header className="masthead">
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
            <button onClick={() => (atNaturalSize ? fit() : setZoom(1))} aria-pressed={!atNaturalSize} title={d.fit}>
              {atNaturalSize ? d.fit : "1:1"}
            </button>
          </div>
          <Link
            className="chip"
            /* switching language keeps the person you were reading */
            href={`/${lang === "ar" ? "en" : "ar"}${selectedId ? `?p=${selectedId}` : ""}`}
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
                      onSelect={select}
                      onToggleCollapse={toggleCollapse}
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
          </div>

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
            onClose={() => {
              setSelectedId(null);
              setFocusId(null);
            }}
            isBranchRoot={selectedId === rootId}
          />
        )}
      </div>

      {/* the lit nasab, always readable even when the register is dismissed */}
      {shownId && !selectedId && (
        <p className="ribbon font-text" aria-live="polite">
          {nasab(person(shownId), lang)}
        </p>
      )}

      <p className="hint" aria-hidden>
        {compact ? d.hintMobile : d.hintDesktop}
      </p>
    </main>
  );
}
