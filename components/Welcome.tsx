"use client";

import { useEffect, useRef } from "react";
import type { Lang } from "@/lib/family";
import { t } from "@/lib/i18n";

/** the number, as it is dialled locally and as WhatsApp wants it */
export const CONTACT_PHONE = "0567016429";
const WHATSAPP = "https://wa.me/966567016429";

/**
 * The card a visitor meets first: how to move around the tree, where it reads
 * best, whom to message with a correction, who helped, who built it. The
 * masthead's "About" brings it back at any time.
 */
export function Welcome({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const d = t(lang);
  const startRef = useRef<HTMLButtonElement>(null);

  const cardRef = useRef<HTMLElement>(null);

  /* the card owns the keyboard while it is up: Escape closes, focus starts on
     the button — without scrolling to it, or a phone would open the card with
     its title already pushed out of sight above the fold */
  useEffect(() => {
    startRef.current?.focus({ preventScroll: true });
    if (cardRef.current) cardRef.current.scrollTop = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="welcome" role="presentation" onClick={onClose}>
      <section
        ref={cardRef}
        className="welcome__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="welcome__close" onClick={onClose} aria-label={d.close}>
          ×
        </button>
        <h2 id="welcome-title" className="welcome__title font-display">
          {d.welcomeTitle}
        </h2>

        <h3 className="welcome__h font-display">{d.welcomeHow}</h3>
        <ul className="welcome__steps font-text">
          {d.welcomeSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>

        <p className="welcome__note font-text">{d.welcomeDesktop}</p>

        <p className="welcome__contact font-text">
          {d.welcomeContact}{" "}
          <a className="welcome__phone" href={WHATSAPP} target="_blank" rel="noopener" dir="ltr">
            {CONTACT_PHONE}
          </a>
        </p>

        <h3 className="welcome__h font-display">{d.welcomeThanksTitle}</h3>
        <ul className="welcome__names font-text">
          {d.welcomeThanksNames.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="welcome__for font-text">{d.welcomeThanksFor}</p>

        <h3 className="welcome__h font-display">{d.welcomeBuiltTitle}</h3>
        <ul className="welcome__names font-text">
          {d.welcomeBuiltNames.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>

        <div className="welcome__actions">
          <button ref={startRef} className="chip chip--solid welcome__start" onClick={onClose}>
            {d.welcomeStart}
          </button>
        </div>
      </section>
    </div>
  );
}
