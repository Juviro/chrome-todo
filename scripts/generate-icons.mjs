import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(SCRIPT_DIR, "../public/icons");

let crcTable;

const crc32 = (buf) => {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
};

// The icon mirrors public/favicon.svg, drawn on a 64-unit canvas: a dark base,
// a 2×2 tile grid and a checked indigo tile top-left. Shapes are signed
// distance functions, sampled SS×SS times per pixel for anti-aliasing.
const SS = 4;

const roundedRect = (x, y, w, h, r) => (px, py) => {
  const qx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const qy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    r
  );
};

const segment =
  ([ax, ay], [bx, by], width) =>
  (px, py) => {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(
      0,
      Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)),
    );
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) - width / 2;
  };

const union =
  (...shapes) =>
  (px, py) =>
    Math.min(...shapes.map((shape) => shape(px, py)));

const lerp = (a, b, t) => a + (b - a) * t;

// Diagonal gradient from (2,2) to (32,32), matching the favicon.
const tileGradient = (px, py) => {
  const t = Math.max(0, Math.min(1, (px + py - 4) / 60));
  return [lerp(129, 79, t), lerp(140, 70, t), lerp(248, 229, t)];
};

const CHECK = [
  [12.5, 18.5],
  [16.3, 22.3],
  [23.5, 14.7],
];

const LAYERS = [
  { shape: roundedRect(0, 0, 64, 64, 14), color: () => [26, 26, 26] },
  { shape: roundedRect(7, 7, 23, 23, 6), color: tileGradient },
  {
    shape: union(
      segment(CHECK[0], CHECK[1], 3.6),
      segment(CHECK[1], CHECK[2], 3.6),
    ),
    color: () => [255, 255, 255],
  },
  { shape: roundedRect(34, 7, 23, 23, 6), color: () => [58, 58, 58] },
  { shape: roundedRect(7, 34, 23, 23, 6), color: () => [58, 58, 58] },
  { shape: roundedRect(34, 34, 23, 23, 6), color: () => [58, 58, 58] },
];

// All layers are opaque, so the topmost layer covering a sample wins.
const samplePixel = (px, py) => {
  for (let i = LAYERS.length - 1; i >= 0; i--) {
    const { shape, color } = LAYERS[i];
    if (shape(px, py) <= 0) return [...color(px, py), 1];
  }
  return [0, 0, 0, 0];
};

const renderIcon = (size) => {
  const scale = 64 / size;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [sr, sg, sb, sa] = samplePixel(
            (x + (sx + 0.5) / SS) * scale,
            (y + (sy + 0.5) / SS) * scale,
          );
          r += sr;
          g += sg;
          b += sb;
          a += sa;
        }
      }
      const i = (y * size + x) * 4;
      pixels[i] = a ? Math.round(r / a) : 0;
      pixels[i + 1] = a ? Math.round(g / a) : 0;
      pixels[i + 2] = a ? Math.round(b / a) : 0;
      pixels[i + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return pixels;
};

const createPng = (size) => {
  const pixels = renderIcon(size);
  const rowLength = 1 + size * 4;
  const raw = Buffer.alloc(size * rowLength);
  for (let y = 0; y < size; y++) {
    pixels.copy(raw, y * rowLength + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
};

mkdirSync(ICONS_DIR, { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(join(ICONS_DIR, `icon${size}.png`), createPng(size));
}
