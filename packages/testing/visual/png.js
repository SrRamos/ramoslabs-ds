/* eslint-disable @typescript-eslint/ban-ts-comment -- untyped harness script */
// @ts-nocheck -- plain-JS harness; behavior is covered by visual.test.js and the browser matrix.
// Minimal PNG decoder and pixel comparison for the visual harness (W1-312). No dependencies:
// Playwright's screenshots are 8-bit, non-interlaced RGB or RGBA, which is all this accepts. Anything
// else throws, so an unexpected encoder change is a loud failure, never a silent pass.
import { inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Decodes a PNG buffer to `{ width, height, data }` where `data` is RGBA, 4 bytes per pixel. */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  let pos = 8;
  let header = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        color: body[9],
        interlace: body[12],
      };
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!header) throw new Error('PNG has no IHDR');
  const { width, height, depth, color, interlace } = header;
  if (depth !== 8 || interlace !== 0 || (color !== 2 && color !== 6)) {
    throw new Error(`unsupported PNG (depth ${depth}, color ${color}, interlace ${interlace})`);
  }
  const bpp = color === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(width * height * 4, 255);
  let prev = Buffer.alloc(stride);
  let cur = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`bad PNG filter ${filter}`);
      cur[i] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = cur[x * bpp];
      out[o + 1] = cur[x * bpp + 1];
      out[o + 2] = cur[x * bpp + 2];
      if (bpp === 4) out[o + 3] = cur[x * bpp + 3];
    }
    [prev, cur] = [cur, prev];
  }
  return { width, height, data: out };
}

/**
 * Compares two PNG buffers pixel by pixel with ZERO tolerance. Returns
 * `{ same, sizeMismatch, diffPixels, firstDiff }`. A size mismatch is a difference.
 */
export function comparePng(expected, actual) {
  if (expected.equals(actual)) return { same: true, sizeMismatch: false, diffPixels: 0 };
  const a = decodePng(expected);
  const b = decodePng(actual);
  if (a.width !== b.width || a.height !== b.height) {
    return {
      same: false,
      sizeMismatch: true,
      diffPixels: Math.max(a.width * a.height, b.width * b.height),
      expectedSize: [a.width, a.height],
      actualSize: [b.width, b.height],
    };
  }
  let diffPixels = 0;
  let firstDiff = null;
  for (let i = 0; i < a.data.length; i += 4) {
    if (
      a.data[i] !== b.data[i] ||
      a.data[i + 1] !== b.data[i + 1] ||
      a.data[i + 2] !== b.data[i + 2] ||
      a.data[i + 3] !== b.data[i + 3]
    ) {
      diffPixels++;
      firstDiff ??= { x: (i / 4) % a.width, y: Math.floor(i / 4 / a.width) };
    }
  }
  return { same: diffPixels === 0, sizeMismatch: false, diffPixels, firstDiff };
}
