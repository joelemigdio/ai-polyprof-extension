/**
 * Renders the PolyProf toolbar icons into public/icons.
 *
 * Kept as a script rather than committed-only binaries so the mark can be
 * regenerated if the palette changes. Run: npm run build:icons
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const outputDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public/icons");
const sizes = [16, 32, 48, 128];

const background = [30, 61, 47];
const star = [227, 178, 60];
const samples = 4;

function starPolygon(cx, cy, outer) {
  const inner = outer * 0.4;
  const points = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return points;
}

function isInsidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Signed-distance style corner test, so the tile reads as a rounded square. */
function isInsideRoundedRect(x, y, size, radius) {
  const dx = Math.max(radius - x, 0, x - (size - radius));
  const dy = Math.max(radius - y, 0, y - (size - radius));
  return Math.hypot(dx, dy) <= radius;
}

function renderRgba(size) {
  const polygon = starPolygon(size / 2, size / 2 + size * 0.015, size * 0.34);
  const radius = size * 0.22;
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let tileHits = 0;
      let starHits = 0;

      // Supersample, since these render as small as 16px and hard edges alias badly.
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          if (isInsideRoundedRect(px, py, size, radius)) tileHits += 1;
          if (isInsidePolygon(px, py, polygon)) starHits += 1;
        }
      }

      const total = samples * samples;
      const tileAlpha = tileHits / total;
      const starAlpha = (starHits / total) * tileAlpha;
      const offset = (y * size + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] = Math.round(
          background[channel] * (1 - starAlpha) + star[channel] * starAlpha,
        );
      }
      pixels[offset + 3] = Math.round(255 * tileAlpha);
    }
  }
  return pixels;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed) >>> 0);
  return Buffer.concat([length, typed, crc]);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolour with alpha
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // no per-scanline filter
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(outputDir, { recursive: true });
for (const size of sizes) {
  const file = resolve(outputDir, `icon-${size}.png`);
  writeFileSync(file, encodePng(size, renderRgba(size)));
  console.log(`wrote ${file}`);
}
