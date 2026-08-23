/**
 * generate-icon.mjs — regenerates `mini-apps/imposter/icon.png`.
 *
 * Invocation, from `mini-apps/imposter/`:
 *
 *     node scripts/generate-icon.mjs
 *
 * Design: on a deep-indigo rounded square, a tidy 2x2 grid of four identical flat
 * avatar busts — three in bone white and the fourth, bottom-right, in coral: one
 * hidden identity sitting among the crew.
 *
 * Zero npm dependencies. The RGBA raster is composed by hand from three geometric
 * primitives (rect / circle / rounded rect), then serialised as IHDR + IDAT + IEND
 * chunks using `node:zlib` deflate and an inline CRC-32. Curved edges are
 * antialiased by supersampled coverage, so the output is byte-for-byte
 * deterministic: no timestamps, no randomness, no floating clock.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Canvas + palette
// ---------------------------------------------------------------------------

const WIDTH = 256;
const HEIGHT = 256;

/** Sub-samples per axis when rasterising curved edges (SS x SS per pixel). */
const SUPERSAMPLE = 8;

const BACKGROUND = [0x24, 0x20, 0x3e]; // deep indigo
const CREW = [0xf2, 0xec, 0xe0]; // bone white
const IMPOSTER = [0xe8, 0x52, 0x4c]; // coral

const CORNER_RADIUS = 56; // matches the sibling mini-app icons

// One avatar bust: head circle above a rounded shoulder block.
const AVATAR_WIDTH = 62;
const AVATAR_HEIGHT = 80;
const HEAD_RADIUS = 20;
const SHOULDER_TOP = 46; // offset from the avatar's top edge
const SHOULDER_HEIGHT = AVATAR_HEIGHT - SHOULDER_TOP;

// Grid geometry: two columns 88px apart, two rows 102px apart, both centred.
const COLUMN_GAP = 88;
const ROW_GAP = 102;
const IMPOSTER_CELL = { row: 1, column: 1 };

// ---------------------------------------------------------------------------
// Raster: non-premultiplied RGBA, fully transparent to start
// ---------------------------------------------------------------------------

const raster = Buffer.alloc(WIDTH * HEIGHT * 4);

/** Source-over composite of `color` at `alpha` onto a single pixel. */
function blendPixel(x, y, color, alpha) {
  if (alpha <= 0 || x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 4;
  const dstAlpha = raster[i + 3] / 255;
  const outAlpha = alpha + dstAlpha * (1 - alpha);
  if (outAlpha <= 0) return;
  for (let c = 0; c < 3; c += 1) {
    const src = color[c] * alpha;
    const dst = raster[i + c] * dstAlpha * (1 - alpha);
    raster[i + c] = Math.round((src + dst) / outAlpha);
  }
  raster[i + 3] = Math.round(outAlpha * 255);
}

/** Overlap of the unit interval starting at `p` with the span [a, b). */
function overlap1d(p, a, b) {
  return Math.max(0, Math.min(p + 1, b) - Math.max(p, a));
}

/**
 * Rasterise an arbitrary shape by supersampling an inside-test over a bounding
 * box. Deterministic: sample points are fixed offsets on a regular lattice.
 */
function fillShape(bx, by, bw, bh, isInside, color) {
  const x0 = Math.max(0, Math.floor(bx));
  const y0 = Math.max(0, Math.floor(by));
  const x1 = Math.min(WIDTH, Math.ceil(bx + bw));
  const y1 = Math.min(HEIGHT, Math.ceil(by + bh));
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  const step = 1 / SUPERSAMPLE;
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      let hits = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        const y = py + (sy + 0.5) * step;
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          if (isInside(px + (sx + 0.5) * step, y)) hits += 1;
        }
      }
      if (hits > 0) blendPixel(px, py, color, hits / samples);
    }
  }
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Axis-aligned rectangle with exact analytic edge coverage. */
function fillRect(x, y, w, h, color) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(WIDTH, Math.ceil(x + w));
  const y1 = Math.min(HEIGHT, Math.ceil(y + h));
  for (let py = y0; py < y1; py += 1) {
    const covY = overlap1d(py, y, y + h);
    if (covY <= 0) continue;
    for (let px = x0; px < x1; px += 1) {
      blendPixel(px, py, color, overlap1d(px, x, x + w) * covY);
    }
  }
}

function fillCircle(cx, cy, r, color) {
  const rr = r * r;
  fillShape(
    cx - r,
    cy - r,
    2 * r,
    2 * r,
    (x, y) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= rr,
    color,
  );
}

/**
 * Rounded rectangle. `radii` is a single number or `{ tl, tr, br, bl }`
 * (omitted corners default to square).
 */
function fillRoundedRect(x, y, w, h, radii, color) {
  const r =
    typeof radii === "number" ? { tl: radii, tr: radii, br: radii, bl: radii } : radii;
  const corners = [
    { r: r.tl ?? 0, cx: x + (r.tl ?? 0), cy: y + (r.tl ?? 0), sx: -1, sy: -1 },
    { r: r.tr ?? 0, cx: x + w - (r.tr ?? 0), cy: y + (r.tr ?? 0), sx: 1, sy: -1 },
    { r: r.br ?? 0, cx: x + w - (r.br ?? 0), cy: y + h - (r.br ?? 0), sx: 1, sy: 1 },
    { r: r.bl ?? 0, cx: x + (r.bl ?? 0), cy: y + h - (r.bl ?? 0), sx: -1, sy: 1 },
  ].filter((corner) => corner.r > 0);

  const isInside = (px, py) => {
    if (px < x || px > x + w || py < y || py > y + h) return false;
    for (const corner of corners) {
      const dx = (px - corner.cx) * corner.sx;
      const dy = (py - corner.cy) * corner.sy;
      // Outside this corner's quadrant, so the corner cannot clip the point.
      if (dx <= 0 || dy <= 0) continue;
      if (dx * dx + dy * dy > corner.r * corner.r) return false;
    }
    return true;
  };

  fillShape(x, y, w, h, isInside, color);
}

// ---------------------------------------------------------------------------
// The mark
// ---------------------------------------------------------------------------

/** One avatar bust, positioned by its top-left corner. */
function drawAvatar(x, y, color) {
  fillCircle(x + AVATAR_WIDTH / 2, y + HEAD_RADIUS, HEAD_RADIUS, color);
  fillRoundedRect(
    x,
    y + SHOULDER_TOP,
    AVATAR_WIDTH,
    SHOULDER_HEIGHT,
    { tl: SHOULDER_HEIGHT / 2, tr: SHOULDER_HEIGHT / 2, br: 6, bl: 6 },
    color,
  );
}

function drawIcon() {
  // Flat plate: the solid core goes down as a plain rect, then the rounded pass
  // only has to resolve the four corners.
  fillRect(CORNER_RADIUS, 0, WIDTH - 2 * CORNER_RADIUS, HEIGHT, BACKGROUND);
  fillRoundedRect(0, 0, WIDTH, HEIGHT, CORNER_RADIUS, BACKGROUND);

  const columnX = [
    (WIDTH - COLUMN_GAP) / 2 - AVATAR_WIDTH / 2,
    (WIDTH + COLUMN_GAP) / 2 - AVATAR_WIDTH / 2,
  ];
  const rowY = [
    (HEIGHT - ROW_GAP) / 2 - AVATAR_HEIGHT / 2,
    (HEIGHT + ROW_GAP) / 2 - AVATAR_HEIGHT / 2,
  ];

  for (let row = 0; row < rowY.length; row += 1) {
    for (let column = 0; column < columnX.length; column += 1) {
      const hidden = row === IMPOSTER_CELL.row && column === IMPOSTER_CELL.column;
      drawAvatar(columnX[column], rowY[row], hidden ? IMPOSTER : CREW);
    }
  }
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder (8-bit RGBA, no interlace, filter None)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(rgba, width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter method: adaptive
  ihdr[12] = 0; // interlace: none

  const stride = width * 4;
  const scanlines = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    const at = y * (stride + 1);
    scanlines[at] = 0; // per-scanline filter type: None
    rgba.copy(scanlines, at + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------

drawIcon();
const png = encodePng(raster, WIDTH, HEIGHT);
const target = new URL("../icon.png", import.meta.url);
writeFileSync(target, png);
console.log(`wrote icon.png — ${WIDTH}x${HEIGHT}, ${png.length} bytes`);
