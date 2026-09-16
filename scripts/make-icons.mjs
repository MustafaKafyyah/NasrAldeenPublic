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

const PAPER = [0xf3, 0xed, 0xe1];
const INK = [0x2a, 0x21, 0x1a];
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
 * Must match app/icon.svg exactly. Every coordinate is EVEN: a favicon is drawn
 * at 16px, half this grid, so an odd edge lands mid-pixel and smears to grey
 * instead of rendering as a clean stroke.
 */
const inInk = (x, y) =>
  inCircle(x, y, 8, 10, 5) || // the two heads
  inCircle(x, y, 24, 10, 5) ||
  inRect(x, y, 6, 14, 4, 6) || // risers
  inRect(x, y, 22, 14, 4, 6) ||
  inRect(x, y, 6, 16, 20, 4) || // bracket
  inRect(x, y, 14, 20, 4, 6) || // trunk
  inRect(x, y, 10, 26, 12, 2); // ground

/** RGBA pixels for the glyph at `size` px */
function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const step = 32 / size / SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let paper = 0;
      let ink = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const dx = ((x * SS + sx + 0.5) * 32) / (size * SS);
          const dy = ((y * SS + sy + 0.5) * 32) / (size * SS);
          if (inPaper(dx, dy)) {
            paper++;
            if (inInk(dx, dy)) ink++;
          }
        }
      }
      const n = SS * SS;
      const a = paper / n;
      const i = ink / n;
      const o = (y * size + x) * 4;
      if (a > 0) {
        // ink over paper, both weighted by how much of the pixel they cover
        for (let c = 0; c < 3; c++) px[o + c] = Math.round((INK[c] * i + PAPER[c] * (a - i)) / a);
      }
      px[o + 3] = Math.round(a * 255);
    }
  }
  void step;
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
