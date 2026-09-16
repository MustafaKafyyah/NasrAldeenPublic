/**
 * Raster icons from the same geometry as app/icon.svg:
 *   node scripts/make-icons.mjs
 *
 * Writes app/favicon.ico (16 + 32) and app/apple-icon.png (180).
 * SVG favicons are not honoured everywhere — Safari and older browsers still
 * want the .ico, and iOS wants a PNG for the home screen.
 *
 * No dependencies: the shapes are drawn by coverage sampling and the PNG is
 * encoded straight from zlib, so this keeps working without a canvas library.
 */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const PAPER = [0xf2, 0xe8, 0xd5];
const BARK = [0x6b, 0x4a, 0x2a];
const LEAF = [0x5a, 0x8a, 0x3c];
const FIGURE = [0x5c, 0x33, 0x20];
/** samples per axis inside each pixel — the only anti-aliasing there is */
const SS = 4;

/* ---------- the glyph, in the 32x32 design space of app/icon.svg ---------- */

const inRect = (x, y, rx, ry, w, h) => x >= rx && x < rx + w && y >= ry && y < ry + h;
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

/** rounded square: a plain rect minus the four corner quadrants */
function inRoundRect(x, y, w, h, r) {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  const cx = x < r ? r : x > w - r ? w - r : x;
  const cy = y < r ? r : y > h - r ? h - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= r && x <= w - r) || (y >= r && y <= h - r);
}

const inPaper = (x, y) => inRoundRect(x, y, 32, 32, 7);

/**
 * Back to front, exactly as app/icon.svg stacks them: a later layer paints over
 * an earlier one. Keep the two files in step when editing either.
 */
const LAYERS = [
  { color: BARK, hit: (x, y) => inRect(x, y, 14, 12, 4, 8) }, // trunk
  {
    color: LEAF, // canopy
    hit: (x, y) => inCircle(x, y, 16, 8, 6) || inCircle(x, y, 10.5, 11, 4.4) || inCircle(x, y, 21.5, 11, 4.4),
  },
  {
    color: FIGURE, // two figures: a narrow head over a dome of shoulders
    hit: (x, y) =>
      inCircle(x, y, 9.6, 21.4, 2.4) ||
      inCircle(x, y, 9.6, 26, 3.6) ||
      inRect(x, y, 6, 26, 7.2, 3.5) ||
      inCircle(x, y, 22.4, 21.4, 2.4) ||
      inCircle(x, y, 22.4, 26, 3.6) ||
      inRect(x, y, 18.8, 26, 7.2, 3.5),
  },
];

/** RGBA pixels for the glyph at `size` px */
function render(size) {
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const dx = ((x * SS + sx + 0.5) * 32) / (size * SS);
          const dy = ((y * SS + sy + 0.5) * 32) / (size * SS);
          if (!inPaper(dx, dy)) continue; // outside the tile: stays transparent
          let c = PAPER;
          for (const layer of LAYERS) if (layer.hit(dx, dy)) c = layer.color;
          r += c[0];
          g += c[1];
          b += c[2];
          hits++;
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      if (hits > 0) {
        px[o] = Math.round(r / hits);
        px[o + 1] = Math.round(g / hits);
        px[o + 2] = Math.round(b / hits);
      }
      px[o + 3] = Math.round((hits / n) * 255);
    }
  }
  return px;
}

/* ---------------------------- PNG ---------------------------- */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // each scanline is prefixed with filter type 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------------------------- ICO ---------------------------- */

/** an .ico holding PNG images — every browser that still wants .ico reads these */
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e[2] = 0;
    e[3] = 0;
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([head, ...entries, ...images.map((i) => i.data)]);
}

/* ---------------------------- write ---------------------------- */

const icoSizes = [16, 32];
const images = icoSizes.map((size) => ({ size, data: png(size, render(size)) }));
writeFileSync(new URL("../app/favicon.ico", import.meta.url), ico(images));
writeFileSync(new URL("../app/apple-icon.png", import.meta.url), png(180, render(180)));

console.log(`app/favicon.ico   ${icoSizes.join(" + ")}px`);
console.log("app/apple-icon.png 180px");
