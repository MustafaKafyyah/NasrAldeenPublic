"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { nameOf, nasab, search, type Lang } from "@/lib/family";
import { num, t } from "@/lib/i18n";

/**
 * One field, both languages. Results are never a blind jump: every hit carries
 * the nasab chain that tells the twelve محمدs apart, and arrowing through them
 * previews the lit lineage on the scroll before Enter commits.
 */
export function SearchField({
  lang,
  compact,
  onPreview,
  onCommit,
}: {
  lang: Lang;
  compact: boolean;
  onPreview: (id: string | null) => void;
  onCommit: (id: string) => void;
}) {
  const d = t(lang);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => (q.trim() ? search(q, lang, 12) : []), [q, lang]);

  useEffect(() => {
    if (open && hits[cursor]) onPreview(hits[cursor].person.id);
    else if (!open) onPreview(null);
  }, [open, cursor, hits, onPreview]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commit = (id: string) => {
    onCommit(id);
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
  };

  return (
    <div className={`search${compact ? " search--compact" : ""}`}>
      <input
        ref={inputRef}
        className="search__input font-text"
        type="search"
        value={q}
        placeholder={d.search}
        aria-label={d.search}
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls="search-results"
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value);
          setCursor(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor((c) => Math.min(hits.length - 1, c + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => Math.max(0, c - 1));
          } else if (e.key === "Enter" && hits[cursor]) {
            e.preventDefault();
            commit(hits[cursor].person.id);
          } else if (e.key === "Escape") {
            setOpen(false);
            setQ("");
          }
        }}
      />
      {open && q.trim() !== "" && (
        <ul className="search__results" id="search-results" role="listbox">
          {hits.length === 0 && <li className="search__empty font-text">{d.noResults}</li>}
          {hits.map((h, i) => (
            <li key={h.person.id} role="option" aria-selected={i === cursor}>
              <button
                className={`search__hit${i === cursor ? " search__hit--on" : ""}`}
                onMouseEnter={() => setCursor(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(h.person.id)}
              >
                <span className="search__name font-text">{nameOf(h.person, lang)}</span>
                <span className="search__chain font-text">{nasab(h.person, lang, { depth: 3, self: false })}</span>
                <span className="search__gen">{num(h.person.generation, lang)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
