/**
 * Measure real rendered widths of every name in the real faces.
 * Geometry (column pitch, label zones, hit areas) is derived from these
 * numbers, never guessed.  Run: node scripts/measure-type.mjs
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const people = JSON.parse(readFileSync(new URL("../data/people.json", import.meta.url), "utf8"));
const ar = people.map((p) => p.nameAr);
const en = people.map((p) => p.nameEn);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Reem+Kufi:wght@400..700&family=EB+Garamond:wght@400;500;600&family=Scheherazade+New:wght@400;500;600&display=block" rel="stylesheet">
<style>body{margin:0}</style></head><body><canvas id="c"></canvas></body></html>`);
await page.waitForFunction(() => document.fonts.ready.then(() => true));
await page.evaluate(() => document.fonts.ready);
// force-load each face at the sizes we care about
await page.evaluate(async () => {
  const faces = ['17px Amiri', '700 17px Amiri', '19px Amiri', '22px Amiri', '17px "Reem Kufi"', '700 40px "Reem Kufi"', '16px "EB Garamond"', '18px "EB Garamond"', '19px "Scheherazade New"'];
  await Promise.all(faces.map((f) => document.fonts.load(f, "محمد عبدالرحمن Abdulrahman")));
});

const result = await page.evaluate(
  ({ ar, en }) => {
    const c = document.getElementById("c");
    const ctx = c.getContext("2d");
    const measure = (list, font) => {
      ctx.font = font;
      const widths = list.map((s) => ctx.measureText(s).width);
      const sorted = [...widths].sort((a, b) => a - b);
      const q = (p) => sorted[Math.min(sorted.length - 1, Math.round((sorted.length - 1) * p))];
      const maxIdx = widths.indexOf(Math.max(...widths));
      return {
        font,
        min: +sorted[0].toFixed(1),
        p50: +q(0.5).toFixed(1),
        p90: +q(0.9).toFixed(1),
        p99: +q(0.99).toFixed(1),
        max: +sorted[sorted.length - 1].toFixed(1),
        widest: list[maxIdx],
        over: (t) => widths.filter((w) => w > t).length,
      };
    };
    const pack = (r, thresholds) => ({ ...r, over: Object.fromEntries(thresholds.map((t) => [t, r.over(t)])) });
    const T = [80, 90, 100, 110, 120, 130, 150];
    // per-name widths, keyed by index, so index leaders and hit areas are exact
    ctx.font = '19px Amiri';
    const perAr = ar.map((s) => +ctx.measureText(s).width.toFixed(2));
    ctx.font = '18px "EB Garamond"';
    const perEn = en.map((s) => +ctx.measureText(s).width.toFixed(2));
    return {
      perName: { ar: perAr, arAt: 19, en: perEn, enAt: 18 },
      arAmiri17: pack(measure(ar, '17px Amiri'), T),
      arAmiri19: pack(measure(ar, '19px Amiri'), T),
      arAmiri22: pack(measure(ar, '22px Amiri'), T),
      arScheherazade19: pack(measure(ar, '19px "Scheherazade New"'), T),
      arKufi17: pack(measure(ar, '17px "Reem Kufi"'), T),
      enGaramond16: pack(measure(en, '16px "EB Garamond"'), T),
      enGaramond18: pack(measure(en, '18px "EB Garamond"'), T),
      fontsLoaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight} ${f.style}`),
    };
  },
  { ar, en },
);

console.log(JSON.stringify(result, null, 1));
writeFileSync(new URL("../data/type-metrics.json", import.meta.url), JSON.stringify(result, null, 1));
await browser.close();
