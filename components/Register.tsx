"use client";

import { Fragment, useMemo, useState } from "react";
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
      className={`register${compact ? " register--sheet" : ""}`}
      aria-label={lang === "ar" ? "سجل الشخص" : "person register"}
    >
      <div className="register__scroll">
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
                  <button className="register__link" onClick={() => onSelect(aid)}>
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
                <PersonRow key={cid} p={person(cid)} lang={lang} onSelect={onSelect} />
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
                  <PersonRow key={sid} p={person(sid)} lang={lang} onSelect={onSelect} />
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
