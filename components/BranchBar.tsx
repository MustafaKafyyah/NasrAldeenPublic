"use client";

import { nameOf, type Lang } from "@/lib/family";
import { HOUSES } from "@/lib/houses";
import { HouseMark } from "./HouseTree";
import { num } from "@/lib/i18n";

/**
 * The four houses, drawn to scale. Before reading a single name you can see
 * that one line carries most of the family, another a third of it, and two
 * ended almost at once — and each segment opens that house.
 *
 * Segments grow in proportion to their line, but never below a legible floor:
 * a house that ended is a fact, not a rendering error, so it keeps its name.
 */
export function BranchBar({
  lang,
  activeBranchId,
  onOpen,
}: {
  lang: Lang;
  activeBranchId: string | null;
  onOpen: (id: string) => void;
}) {
  const total = HOUSES.reduce((acc, h) => acc + h.head.descendantCount + 1, 0);

  return (
    <nav className="branches" aria-label={lang === "ar" ? "بيوت العائلة" : "the houses"}>
      {HOUSES.map((h) => {
        const b = h.head;
        const share = (b.descendantCount + 1) / total;
        const active = b.id === activeBranchId;
        return (
          <button
            key={b.id}
            className={`branches__seg${active ? " branches__seg--on" : ""}`}
            style={{ flexGrow: Math.max(0.12, share), ["--house" as string]: h.ink }}
            onClick={() => onOpen(b.id)}
            aria-pressed={active}
            title={
              lang === "ar"
                ? `بيت ${b.nameAr} — ${num(b.descendantCount + 1, "ar")}`
                : `House of ${b.nameEn} — ${b.descendantCount + 1}`
            }
          >
            <svg className="branches__mark" viewBox="-7 -7 14 14" aria-hidden>
              <HouseMark house={h} r={5} />
            </svg>
            <span className="branches__name font-text">{nameOf(b, lang)}</span>
            <span className="branches__n">{num(b.descendantCount + 1, lang)}</span>
          </button>
        );
      })}
    </nav>
  );
}
