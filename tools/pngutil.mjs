// pngutil.mjs — Codificador PNG mínimo (sin deps externas, usa node:zlib).
// Permite a las herramientas de QA exportar buffers RGBA a PNG real que se
// revisa con la vista. Cumple "prueba cada cosa con captura" sin Puppeteer
// para assets puramente procedurales.

import zlib from 'node:zlib';

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** @param {{w,h,data:Uint8ClampedArray}} img */
export function encodePNG(img) {
  const { w, h, data } = img;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  // raw con byte de filtro 0 por scanline
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    for (let x = 0; x < w * 4; x++) raw[y * (1 + w * 4) + 1 + x] = data[y * w * 4 + x];
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/** Lienzo RGBA con helpers de blit y escalado nearest (pixel-perfect). */
export function makeCanvas(w, h, bg = [0, 0, 0, 0]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i*4]=bg[0]; data[i*4+1]=bg[1]; data[i*4+2]=bg[2]; data[i*4+3]=bg[3] ?? 255; }
  return {
    w, h, data,
    blit(src, dx, dy) {
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
        const a = src.data[(y * src.w + x) * 4 + 3];
        if (a === 0) continue;
        const ox = dx + x, oy = dy + y;
        if (ox < 0 || oy < 0 || ox >= w || oy >= h) continue;
        const di = (oy * w + ox) * 4, si = (y * src.w + x) * 4;
        const af = a / 255;
        for (let k = 0; k < 3; k++) data[di+k] = data[di+k]*(1-af) + src.data[si+k]*af;
        data[di+3] = 255;
      }
    },
    scaled(s) {
      const out = new Uint8ClampedArray(w * s * h * s * 4);
      for (let y = 0; y < h * s; y++) for (let x = 0; x < w * s; x++) {
        const si = (Math.floor(y/s) * w + Math.floor(x/s)) * 4, di = (y * w * s + x) * 4;
        out[di]=data[si]; out[di+1]=data[si+1]; out[di+2]=data[si+2]; out[di+3]=data[si+3];
      }
      return { w: w * s, h: h * s, data: out };
    },
  };
}
