/** Probe real behaviour in the browser: selection → scroll → lit chain. */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3117";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR", String(e)));
await page.goto(`${BASE}/ar`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

const before = await page.evaluate(() => {
  const s = document.querySelector(".scroller");
  return { top: s.scrollTop, left: s.scrollLeft, h: s.clientHeight, w: s.clientWidth, sh: s.scrollHeight, sw: s.scrollWidth };
});
console.log("before", before);

// click a deep person by data-id
const target = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll("[role=treeitem]")];
  const deep = nodes[Math.floor(nodes.length * 0.72)];
  const id = deep.getAttribute("data-id");
  const box = deep.getBoundingClientRect();
  deep.querySelector(".card__paper, .stack__hit").dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return { id, y: box.y, x: box.x };
});
console.log("clicked", target);

for (const wait of [200, 600, 1200, 2400]) {
  await page.waitForTimeout(wait === 200 ? 200 : 400);
  const st = await page.evaluate(() => {
    const s = document.querySelector(".scroller");
    const lit = [...document.querySelectorAll(".card--lit, .stack__row--lit")].map((n) => n.getAttribute("data-id"));
    const sel = document.querySelector('.node[aria-selected="true"]');
    return {
      top: Math.round(s.scrollTop),
      left: Math.round(s.scrollLeft),
      lit: lit.length,
      selInView: sel ? Math.round(sel.getBoundingClientRect().y) : null,
      selX: sel ? Math.round(sel.getBoundingClientRect().x) : null,
    };
  });
  console.log(`t=${wait}`, st);
}

await browser.close();
