/**
 * Render-and-look: screenshot the real page at real viewports, both languages,
 * at rest and with a lineage lit. Visual correctness is judged from these, not
 * from the source.  node scripts/shoot.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3117";
const OUT = new URL("../shots/", import.meta.url).pathname.replace(/^\//, "");
mkdirSync(OUT, { recursive: true });

const VIEWS = [
  { name: "phone", width: 390, height: 844, dpr: 2 },
  { name: "tablet", width: 834, height: 1112, dpr: 2 },
  { name: "desk", width: 1440, height: 900, dpr: 1 },
];

const browser = await chromium.launch();
const problems = [];

for (const lang of ["ar", "en"]) {
  for (const v of VIEWS) {
    const ctx = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: v.dpr,
      hasTouch: v.name === "phone",
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto(`${BASE}/${lang}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT}${lang}-${v.name}-rest.png` });

    // horizontal overflow of the PAGE (the tree scrolls inside its own box)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 1) problems.push(`${lang}/${v.name}: page overflows horizontally by ${overflow}px`);

    // light a deep lineage
    const clicked = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll("[role=treeitem]")];
      const deep = nodes[Math.min(nodes.length - 1, Math.floor(nodes.length * 0.72))];
      if (!deep) return null;
      const hit = deep.querySelector(".card__paper, .stack__hit");
      hit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return deep.getAttribute("data-id");
    });
    await page.waitForTimeout(1100);
    await page.screenshot({ path: `${OUT}${lang}-${v.name}-lineage.png` });

    const lit = await page.evaluate(() => document.querySelectorAll(".card--lit, .stack__row--lit").length);
    if (clicked && lit < 2) problems.push(`${lang}/${v.name}: clicked node ${clicked} but only ${lit} nodes lit`);

    // a scrolled-in view of the middle of the scroll
    await page.evaluate(() => {
      const s = document.querySelector(".scroller");
      if (s) s.scrollTop = s.scrollHeight * 0.4;
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}${lang}-${v.name}-mid.png` });

    if (errors.length) problems.push(`${lang}/${v.name}: console errors → ${errors.slice(0, 3).join(" | ")}`);
    await ctx.close();
  }
}

await browser.close();
console.log(problems.length ? "PROBLEMS:\n" + problems.map((p) => " - " + p).join("\n") : "no problems detected");
console.log("shots in", OUT);
