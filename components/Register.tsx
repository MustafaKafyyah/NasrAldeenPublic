"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  descendantsByDepth,
  nameOf,
  nasab,
  person,
  type Lang,
  type Person,
} from "@/lib/family";
import { num, t } from "@/lib/i18n";
import { houseFor } from "@/lib/houses";
import { HouseMark } from "./HouseTree";

/* ————— the phone sheet ————— */

/** where the sheet rests: a third of the glass, or all of it but a strip of the chart */
type Snap = "rest" | "full";
/** must agree with `.register--sheet` / `.register--full` in chrome.css */
export const SHEET_REST = 1 / 3;
const SHEET_FULL_GAP = 48;
/** px/ms above which a release counts as a fling, whatever the position */
const FLING = 0.45;

function sheetHeights() {
  const vh = window.innerHeight;
  return { rest: vh * SHEET_REST, full: vh - SHEET_FULL_GAP };
}

/** السجل — the register entry for one person. */
export function Register({
  id,
  lang,
  compact,
  onSelect,
  onOpenBranch,
  onClose,
  isBranchRoot,
}: {
  id: string;
  lang: Lang;
  compact: boolean;
  onSelect: (id: string) => void;
  onOpenBranch: (id: string) => void;
  onClose: () => void;
  isBranchRoot: boolean;
}) {
  const d = t(lang);
  const p = person(id);
  const [copied, setCopied] = useState<null | "nasab" | "link">(null);
  const byDepth = useMemo(() => descendantsByDepth(id), [id]);

  /* On a phone the register is a bottom sheet: it opens on a third of the glass so
     the lit lineage stays in view above it, the handle pulls it up to read a
     long list, and a pull down past half of that dismisses it. The state
     lives here rather than in FamilyTree so it survives moving from person to
     person, and picking a name inside the sheet drops it back to a third: the
     point of picking is to see that person on the chart. */
  const [snap, setSnap] = useState<Snap>("rest");
  /** live height while a finger holds the sheet, else null */
  const [dragH, setDragH] = useState<number | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; h0: number; y: number; t: number; v: number } | null>(null);

  const pick = (pid: string) => {
    if (compact) setSnap("rest");
    onSelect(pid);
  };

  function dragStart(y: number) {
    const el = asideRef.current;
    if (!el) return;
    drag.current = { y0: y, h0: el.getBoundingClientRect().height, y, t: performance.now(), v: 0 };
  }
  function dragMove(y: number) {
    const g = drag.current;
    if (!g) return;
    const now = performance.now();
    const dt = now - g.t;
    // a smoothed velocity, so one jittery sample cannot decide the release
    if (dt > 0) g.v = g.v * 0.6 + ((y - g.y) / dt) * 0.4;
    g.y = y;
    g.t = now;
    const { full } = sheetHeights();
    setDragH(Math.max(0, Math.min(full, g.h0 - (y - g.y0))));
  }
  function dragEnd() {
    const g = drag.current;
    drag.current = null;
    setDragH(null);
    if (!g) return;
    const { rest, full } = sheetHeights();
    const h = Math.max(0, Math.min(full, g.h0 - (g.y - g.y0)));
    // a flick goes one stop in its direction; a slow release settles nearest
    if (g.v > FLING) {
      if (snap === "full" && h > rest * 0.6) setSnap("rest");
      else onClose();
      return;
    }
    if (g.v < -FLING) {
      setSnap("full");
      return;
    }
    if (h < rest * 0.5) onClose();
    else setSnap(Math.abs(h - rest) <= Math.abs(h - full) ? "rest" : "full");
  }

  /* the handle: pointer events, since it takes mouse and finger alike */
  const onHandleDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart(e.clientY);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (drag.current) dragMove(e.clientY);
  };
  const onHandleUp = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    // a tap on the handle, with no travel, toggles the two resting heights
    if (Math.abs(e.clientY - g.y0) < 4) {
      drag.current = null;
      setDragH(null);
      setSnap((s) => (s === "rest" ? "full" : "rest"));
      return;
    }
    dragEnd();
  };

  /* the content: a pull down from its very top takes the sheet with it. Touch
     events, bound non-passive, because the browser must be told before its
     own scroll starts that this move is ours. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!compact || !el) return;
    let y0 = 0;
    let atTop = false;
    let taken = false;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      y0 = e.touches[0].clientY;
      atTop = el.scrollTop <= 0;
      taken = false;
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      if (!taken) {
        if (!atTop || y - y0 <= 6) return;
        taken = true;
        dragStart(y0);
      }
      if (e.cancelable) e.preventDefault();
      dragMove(y);
    };
    const onEnd = () => {
      if (taken) dragEnd();
      taken = false;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
    // dragStart/dragMove/dragEnd read live refs and state setters only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, snap, onClose]);
  const house = houseFor(p.id);
  const rel = lang === "ar" ? (p.isFemale ? "بنت" : "ابن") : p.isFemale ? "daughter of" : "son of";
  /* only what is recorded, in a fixed order; nothing is invented */
  const facts = useMemo(() => {
    const x = p.details ?? {};
    const out: [string, React.ReactNode][] = [];
    if (x.born) out.push([d.born, x.born]);
    if (x.age) out.push([d.age, x.age]);
    if (x.died) out.push([d.died, x.died]);
    if (x.city) out.push([d.city, x.city]);
    if (x.wives?.length) out.push([x.wives.length > 1 ? d.wivesMany : d.wives, x.wives.join(lang === "ar" ? "، " : ", ")]);
    if (x.phone) out.push([d.phone, <a key="tel" className="register__link" href={`tel:${x.phone}`} dir="ltr">{x.phone}</a>]);
    if (x.email) out.push([d.email, <a key="mail" className="register__link" href={`mailto:${x.email}`} dir="ltr">{x.email}</a>]);
    return out;
  }, [p.details, d, lang]);

  const copy = async (what: "nasab" | "link") => {
    const text =
      what === "nasab"
        ? nasab(p, lang)
        : `${window.location.origin}/${lang}?p=${p.id}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked — the nasab is on screen either way */
    }
  };

  return (
    <aside
      ref={asideRef}
      className={`register${compact ? ` register--sheet register--${snap}` : ""}${dragH !== null ? " register--dragging" : ""}`}
      style={dragH !== null ? { height: dragH } : undefined}
      aria-label={lang === "ar" ? "سجل الشخص" : "person register"}
    >
      {compact && (
        <button
          className="register__handle"
          aria-label={d.sheetHandle}
          aria-expanded={snap === "full"}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={dragEnd}
        >
          <span className="register__grip" aria-hidden />
        </button>
      )}
      <div className="register__scroll" ref={scrollRef}>
        <button className="register__close" onClick={onClose} aria-label={d.close}>
          ×
        </button>

        <h2 className="register__name font-display">{nameOf(p, lang)}</h2>

        {/* the nasab sentence: the real identity of a person in this family */}
        <p className="register__nasab font-text">
          {p.ancestors.length === 0 ? (
            <span className="register__founder">{d.founder}</span>
          ) : (
            <>
              <span className="register__rel">{rel}</span>{" "}
              {p.ancestors.map((aid, i) => (
                <span key={aid}>
                  {i > 0 && <span className="register__rel">{lang === "ar" ? " بن " : " bin "}</span>}
                  <button className="register__link" onClick={() => pick(aid)}>
                    {nameOf(person(aid), lang)}
                  </button>
                </span>
              ))}
            </>
          )}
        </p>

        {p.details?.title && <p className="register__title font-text">{p.details.title}</p>}

        <p className="register__meta">
          {d.genLabel(p.generation)}
          {p.generation > 1 && (
            <>
              <span className="register__dot">·</span>
              <span className="register__house" style={{ ["--house" as string]: house.ink }}>
                <svg viewBox="-7 -7 14 14" aria-hidden>
                  <HouseMark house={house} r={5} />
                </svg>
                {d.house} {nameOf(house.head, lang)}
              </span>
            </>
          )}
        </p>

        {p.details?.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="register__portrait" src={p.details.photo} alt={nameOf(p, lang)} />
        )}

        {facts.length > 0 && (
          <dl className="register__facts font-text">
            {facts.map(([label, value]) => (
              <Fragment key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </Fragment>
            ))}
          </dl>
        )}

        {p.details?.note && <p className="register__note font-text">{p.details.note}</p>}

        <Section title={d.children} count={p.children.length} lang={lang}>
          {p.children.length === 0 ? (
            <p className="register__empty font-text">{lang === "ar" ? "لا عقب" : "No issue recorded"}</p>
          ) : (
            <ul className="register__list">
              {p.children.map((cid) => (
                <PersonRow key={cid} p={person(cid)} lang={lang} onSelect={pick} />
              ))}
            </ul>
          )}
        </Section>

        <Section title={d.siblings} count={p.siblings.length} lang={lang}>
          {p.siblings.length === 0 ? (
            <p className="register__empty font-text">{d.siblingsNone}</p>
          ) : (
            <>
              <ul className="register__list">
                {p.siblings.map((sid) => (
                  <PersonRow key={sid} p={person(sid)} lang={lang} onSelect={pick} />
                ))}
              </ul>
              <p className="register__note">{lang === "ar" ? "بترتيب السجل" : "in record order"}</p>
            </>
          )}
        </Section>

        <Section title={d.descendants} count={p.descendantCount} lang={lang}>
          {p.descendantCount === 0 ? (
            <p className="register__empty font-text">{d.countDescendants(0)}</p>
          ) : (
            <p className="register__descline font-text">
              {d.countDescendants(p.descendantCount)}
              <span className="register__dot">·</span>
              <span className="register__byGen">
                {byDepth.map((n, i) => (
                  <span key={i}>
                    {i > 0 && <span className="register__tick">·</span>}
                    {num(n, lang)}
                  </span>
                ))}
              </span>
            </p>
          )}
        </Section>

        <div className="register__actions">
          {p.children.length > 0 && !isBranchRoot && (
            <button className="chip chip--solid" onClick={() => onOpenBranch(p.id)}>
              {d.openBranch}
            </button>
          )}
          <button className="chip" onClick={() => copy("nasab")}>
            {copied === "nasab" ? d.copied : lang === "ar" ? "انسخ النسب" : "Copy lineage"}
          </button>
          <button className="chip" onClick={() => copy("link")}>
            {copied === "link" ? d.copied : d.share}
          </button>
        </div>
      </div>
    </aside>
  );
}

function Section({
  title,
  count,
  lang,
  children,
}: {
  title: string;
  count: number;
  lang: Lang;
  children: React.ReactNode;
}) {
  return (
    <section className="register__section">
      <h3 className="register__h font-display">
        {title}
        <span className="register__count">{num(count, lang)}</span>
      </h3>
      {children}
    </section>
  );
}

function PersonRow({ p, lang, onSelect }: { p: Person; lang: Lang; onSelect: (id: string) => void }) {
  return (
    <li>
      <button className="register__row" onClick={() => onSelect(p.id)}>
        <span className={`mark${p.isFemale ? " mark--daughter" : p.children.length ? " mark--father" : " mark--leaf"}`} aria-hidden />
        <span className="register__rowname font-text">{nameOf(p, lang)}</span>
        {p.descendantCount > 0 && <span className="register__rowcount">{num(p.descendantCount, lang)}</span>}
      </button>
    </li>
  );
}
