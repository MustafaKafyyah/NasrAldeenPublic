# آل نصر الدين — the public site

The published build: the family tree with **no editing features**. This is the
folder that becomes the live website.

It is a **static export** — `next build` writes plain HTML, CSS and JS into
`out/`. There is no server, no database and no API: nothing on the live site
can change the data. To publish new names, edit them in `NasrAlDeen-editor`,
copy its `data/people.json` here, and rebuild.

## Deploying to Cloudflare Pages

```bash
pnpm install     # first time only
pnpm build       # writes out/
```

Then upload **the `out/` folder** (not the project folder):

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Upload assets**.
2. Give the project a name, drag the whole `out/` folder in, and **Deploy**.
3. It goes live on `<project>.pages.dev`. A custom domain is added afterwards
   under the project's **Custom domains** tab.

To publish an update later, run `pnpm build` again and upload the new `out/`
to the same project as a new deployment.

`out/_redirects` sends the bare root `/` to `/ar`, which is what makes the site
Arabic-led; Cloudflare Pages reads that file automatically. `out/index.html` is
a plain meta-refresh doing the same thing, in case the redirect rule is ever
lost.

### If you would rather connect a Git repository

Push this folder, then point Cloudflare Pages at it with **build command**
`pnpm build` and **output directory** `out`.

---

# آل نصر الدين — the Nasr Aldeen family tree

372 people, 7 generations, one root. Bilingual: Arabic (default, RTL) and
English. Two views of the same family, switched like the language:

| | |
|---|---|
| **شجرة / Tree** — *البيوت, the Houses* | A top-down chart of family blocks. Every person is a card; a father's children sit in a row beneath him; the four sons of the founder head four **houses**, each with its own pigment and mark, so any card anywhere tells you its line before you read the name. This is the default. |
| **قائمة / List** — *الطومار, the Scroll* | A manuscript register in the classical Arabic تشجير form: generations as columns, the family unrolling downward, names on ruled lines with beads. Denser, printable, the whole family on one sheet. |

Run locally: `pnpm dev` → http://localhost:3000 (redirects to `/ar`).

---

## The houses

The founder's four sons are the four houses. Pigments are natural inks on
bone paper, chosen to sit apart from each other and from the rubric red that
is reserved for the lit lineage; every one clears AA on paper (recomputed by
`scripts/inspect-houses.ts`, never carried forward).

| House | Pigment | Mark | Line |
|---|---|---|---|
| أبوبكر Abu Bakr | ochre `#75561A` | eight-point star | 3 |
| بلال Bilal | indigo `#3D5A80` | hexagon | 103 |
| مسرعلي Misr Ali | olive `#4F5E26` | lozenge | 183 |
| نور Nour | plum `#6B4C7A` | ring | 1 |
| نصرالدين (founder) | iron-gall ink | seal | 291 |

The **branch bar** under the masthead draws the four houses to scale, so the
family's proportions read before a single name does. Each segment opens that
house.

## The chart

- **A card** carries the name in the current language, the other language's
  name beneath it, a house bar along the top edge, the house mark at the
  start, a sex mark at the end (filled disc = has issue, hollow = son without
  issue, lozenge = daughter), and a rubric dot when the person has details.
- **The issue chip** under a father says how many descend from him. Filled =
  folded (`+140`); click to open or fold. Everything opens progressively: the
  chart starts with the founder, his sons and their children, and you open
  the house you care about.
- **Family blocks**: a faint wash of the house pigment behind a father's
  children, so each family reads as one unit. Nested families never overlap.
- **Leaf stacks**: siblings with no issue of their own are stacked in one
  column instead of each taking a column — this is what keeps the whole
  family at 10,354 px wide fully open instead of 35,000.
- **Generation gutter** on the reading edge, following vertical scroll:
  click a label to fold everything below that generation; click the last one
  to open the next. Keys `1`–`7` open to that generation; `0` opens all.
- **Fit**: shrinks the sheet to the viewport (CSS zoom, so scrolling and
  sticky elements keep working). The first paint fits automatically, never
  below 0.6 where names stop reading. `f` toggles it.

## The lineage

Identity in this family lives in the chain, not the box: twelve people are
called محمد and eight عبدالله. So selecting anyone draws the rubric ink from
the founder down to them, one generation at a time, and the register reads
the nasab as one sentence with every ancestor clickable. Nothing else fades —
all 291 names stay at full ink; the rubric carries the attention.

Search works in both languages at once with Arabic orthography folded; every
hit carries its nasab so the twelve محمدs are told apart, and arrowing through
hits previews the visible part of each lineage on the chart before Enter
commits.

## Expandable details

Every record carries `sex` ("m" / "f", recorded by hand — the name heuristic
only fills it in when it is missing) and accepts an optional `details` object;
the register renders whatever is present:

```json
{ "id": "143", "nameAr": "…", "nameEn": "…", "sex": "m", "fatherId": "…",
  "children": [],
  "details": { "photo": "/portraits/143.jpg", "title": "طبيب",
               "born": "١٤٠٥هـ", "age": "٤٠", "died": "", "city": "جدة",
               "wives": ["…"], "phone": "+966…", "email": "…",
               "note": "…" } }
```

A card shows a small rubric dot when details exist. The register shows the
portrait, title, dates, city, wives, phone, email and note. Nothing is
invented for people without details: the sections simply do not appear.
`children` is in birth order, oldest first — the chart never re-sorts it.

## Decisions worth knowing

**Geometry is measured, never guessed.** `scripts/measure-type.mjs` renders
all 291 names in the real font binaries and writes `data/type-metrics.json`;
`lib/geometry.ts` derives card widths, column pitch, label zones and hit
targets from those numbers. Re-run it whenever a face or size changes.

**Contrast is recomputed.** `scripts/contrast-audit.ts` and
`scripts/inspect-houses.ts` derive every ratio from the tokens. Secondary ink
sits at 72% because 62% measured 4.25:1 and failed AA; two house pigments were
darkened for the same reason.

**No pan-and-zoom library.** Native scroll in both axes plus CSS `zoom` for
fit. This is what lets the List view's generation heads stick with no JS and
removes a class of iOS touch bugs.

**Sex is inferred from Arabic given names only** (`lib/family.ts`): a curated
list plus taa-marbuta and hamza rules with a masculine exception list. Latin
transliterations are too irregular. **This needs a human pass before the site
is public** — a wrong بن/بنت in a nasab chain is the most visible error a
nasab site can make.

## Layout

```
app/[lang]/          root layout (per-locale <html lang dir>) + page
app/globals.css      tokens + the List view
app/houses.css       the Tree view (cards, blocks, chips, gutter)
app/chrome.css       masthead, branch bar, register, plate, print
components/          FamilyTree (state, both views) · HouseTree · Scroll
                     · Register · SearchField · BranchBar · GenGutter · Minimap
lib/family.ts        index, nasab, search, sex heuristic, details schema
lib/houses.ts        the four houses: pigments, marks, membership
lib/houseLayout.ts   family-block layout with leaf stacks
lib/layout.ts        the scroll layout (and an unused radial one)
lib/geometry.ts      all measured geometry + contrast maths
data/                people.json · type-metrics.json
scripts/             measure-type · contrast-audit · inspect-houses
                     · inspect-scroll · shoot · interact · probe
```

## Scripts

```bash
pnpm dev                          # http://localhost:3000
pnpm build && pnpm start
node scripts/measure-type.mjs     # re-measure type → data/type-metrics.json
npx tsx scripts/inspect-houses.ts # chart size at each depth + house contrast
npx tsx scripts/inspect-scroll.ts # list-view dimensions
node scripts/shoot.mjs   [url]    # screenshots: 3 viewports × 2 languages × 3 states
node scripts/interact.mjs [url]   # search, fold, branch, list view, print, phone sheet
```

`shoot.mjs` and `interact.mjs` fail loudly on console errors, page-level
horizontal overflow, and lineages that do not light. Run them against a
running dev server before shipping a visual change.

## Not built yet

- The sex list needs a human pass (see above).
- No editing: the data file is the source of truth.
- Portraits: the schema and register are ready; no images exist yet.
- Mothers and spouses have nowhere to go in the schema.
- Not yet pushed to GitHub or deployed.
