/**
 * generate-icon.mjs — regenerates `mini-apps/technews/icon.png`.
 *
 * Invocation, from `mini-apps/technews/`:
 *
 *     node scripts/generate-icon.mjs
 *
 * Design: on a near-black rounded square, four thin off-white horizontal rules
 * of descending length, left-aligned with wide gaps: a feed reduced to bars.
 * The rules are 8px tall so they still read as lines at the ~60px the home
 * grid renders them.
 *
 * Zero npm dependencies. The RGBA raster is composed from two primitives
 * (rect / rounded rect), then serialised as IHDR + IDAT + IEND chunks using
 * `node:zlib` deflate and an inline CRC-32. Curved corners are antialiased by
 * supersampled coverage, so the output is byte-for-byte deterministic: no
 * timestamps, no randomness, no floating clock.
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

const BACKGROUND = [0x08, 0x09, 0x0a]; // the app's dark ground
const RULE = [0xf2, 0xf2, 0xf2]; // the app's dark-theme foreground

const CORNER_RADIUS = 56; // matches the sibling mini-app icons

// Four rules, left-aligned, each shorter than the one above.
const RULE_X = 48;
const RULE_HEIGHT = 8;
const RULE_LENGTHS = [160, 128, 96, 64];
const RULE_TOP = 48;
const RULE_PITCH = 50; // top-to-top distance between rules

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

/** Rounded rectangle with one radius on all four corners. */
function fillRoundedRect(x, y, w, h, radius, color) {
  const corners = [
    { cx: x + radius, cy: y + radius, sx: -1, sy: -1 },
    { cx: x + w - radius, cy: y + radius, sx: 1, sy: -1 },
    { cx: x + w - radius, cy: y + h - radius, sx: 1, sy: 1 },
    { cx: x + radius, cy: y + h - radius, sx: -1, sy: 1 },
  ];

  const isInside = (px, py) => {
    if (px < x || px > x + w || py < y || py > y + h) return false;
    for (const corner of corners) {
      const dx = (px - corner.cx) * corner.sx;
      const dy = (py - corner.cy) * corner.sy;
      // Outside this corner's quadrant, so the corner cannot clip the point.
      if (dx <= 0 || dy <= 0) continue;
      if (dx * dx + dy * dy > radius * radius) return false;
    }
    return true;
  };

  fillShape(x, y, w, h, isInside, color);
}

// ---------------------------------------------------------------------------
// The mark
// ---------------------------------------------------------------------------

function drawIcon() {
  // Flat plate: the solid core goes down as a plain rect, then the rounded pass
  // only has to resolve the four corners.
  fillRect(CORNER_RADIUS, 0, WIDTH - 2 * CORNER_RADIUS, HEIGHT, BACKGROUND);
  fillRoundedRect(0, 0, WIDTH, HEIGHT, CORNER_RADIUS, BACKGROUND);

  RULE_LENGTHS.forEach((length, index) => {
    fillRect(RULE_X, RULE_TOP + index * RULE_PITCH, length, RULE_HEIGHT, RULE);
  });
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
