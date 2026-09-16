/** Exercise the real interactions and screenshot each state. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3117";
const OUT = new URL("../shots/", import.meta.url).pathname.replace(/^\//, "");
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const problems = [];
const note = (m) => problems.push(m);

/* ——— desktop: search, fold, branch, print ——— */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => note(`desk pageerror: ${e}`));
  await page.goto(`${BASE}/ar`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  // masthead crop, to judge the wordmark at 2x
  await page.screenshot({ path: `${OUT}x-masthead.png`, clip: { x: 1000, y: 0, width: 440, height: 130 } });

  // search: type a name that repeats a lot
  await page.fill(".search__input", "محمد");
  await page.waitForTimeout(350);
  const hitCount = await page.locator(".search__hit").count();
  if (hitCount < 5) note(`search "محمد" returned ${hitCount} hits`);
  await page.screenshot({ path: `${OUT}x-search.png` });

  // arrow to the third hit — the chain should preview on the sheet without committing
  await page.press(".search__input", "ArrowDown");
  await page.press(".search__input", "ArrowDown");
  await page.waitForTimeout(500);
  const previewLit = await page.locator(".card--lit, .stack__row--lit").count();
  if (previewLit < 2) note(`arrowing search results lit ${previewLit} nodes (expected the chain)`);
  await page.press(".search__input", "Enter");
  await page.waitForTimeout(900);
  const opened = await page.locator(".register__name").textContent();
  if (!opened) note("Enter on a search hit did not open the register");
  await page.screenshot({ path: `${OUT}x-search-commit.png` });

  // fold a big branch by clicking its bead
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const before = await page.locator("[role=treeitem]").count();
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("[role=treeitem]")];
    const big = nodes.find((n) => n.querySelector(".chip-issue__text")?.textContent === "١٠٢");
    big?.querySelector(".chip-issue")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForTimeout(400);
  const after = await page.locator("[role=treeitem]").count();
  if (after >= before) note(`folding a 102-person branch left ${after} nodes (was ${before})`);
  await page.screenshot({ path: `${OUT}x-folded.png` });

  // generation collapse via the heads
  await page.keyboard.press("0");
  await page.waitForTimeout(200);
  await page.keyboard.press("4");
  await page.waitForTimeout(400);
  const atGen4 = await page.locator("[role=treeitem]").count();
  if (atGen4 !== 51) note(`generation key 4 shows ${atGen4} people (expected 51 = generations 1-4)`);
  await page.screenshot({ path: `${OUT}x-gen4.png` });

  // open a branch from the register
  await page.keyboard.press("0");
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("[role=treeitem]")];
    const b = nodes.find((n) => n.getAttribute("data-id") === "4");
    b?.querySelector(".card__paper, .stack__hit")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForTimeout(700);
  const branchBtn = page.locator(".chip--solid");
  if (await branchBtn.count()) {
    await branchBtn.click();
    await page.waitForTimeout(600);
  } else note("no open-branch chip for a person with children");
  const crumb = await page.locator(".crumb").count();
  if (!crumb) note("opening a branch showed no breadcrumb");
  await page.screenshot({ path: `${OUT}x-branch.png` });

  // the List view: switch, select someone, screenshot
  await page.click(".views button:nth-child(2)");
  await page.waitForTimeout(500);
  const listNodes = await page.locator(".tree-svg .node").count();
  if (listNodes < 5) note(`List view rendered ${listNodes} nodes`);
  await page.keyboard.press("0");
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const n = [...document.querySelectorAll(".tree-svg .node")].find((x) => x.getAttribute("data-id") === "143");
    n?.querySelector(".node__hit")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForTimeout(900);
  const listLit = await page.locator(".tree-svg .node--lit").count();
  if (listLit < 3) note(`List view lit ${listLit} nodes for a gen-6 person`);
  await page.screenshot({ path: `${OUT}x-list.png` });
  await page.click(".views button:nth-child(1)");
  await page.waitForTimeout(400);

  // print
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(300);
  await page.pdf({ path: `${OUT}x-print.pdf`, format: "A3", printBackground: true, landscape: true });
  await page.emulateMedia({ media: "screen" });
  await ctx.close();
}

/* ——— phone: the register as a bottom sheet ——— */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => note(`phone pageerror: ${e}`));
  await page.goto(`${BASE}/ar`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const n = [...document.querySelectorAll("[role=treeitem]")].find((x) => x.getAttribute("data-id") === "4");
    n?.querySelector(".card__paper, .stack__hit")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForTimeout(900);
  const sheet = await page.locator(".register--sheet").count();
  if (!sheet) note("phone register did not render as a bottom sheet");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) note(`phone page overflows by ${overflow}px with the sheet open`);
  await page.screenshot({ path: `${OUT}x-phone-sheet.png` });

  // tap a bead to unfold
  await page.evaluate(() => {
    const n = [...document.querySelectorAll(".card--folded")][0];
    n?.querySelector(".chip-issue")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}x-phone-unfold.png` });
  await ctx.close();
}

await browser.close();
console.log(problems.length ? "PROBLEMS:\n" + problems.map((p) => " - " + p).join("\n") : "all interactions behaved");
