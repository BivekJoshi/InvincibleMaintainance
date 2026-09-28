import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_EDGE, compressImage, fitWithin } from '@/helpers/compressImage';

/**
 * jsdom has no image decoder and no canvas, so both are stood in for: `createImageBitmap` reads the
 * picture's size from the test file, and the canvas "encodes" a blob whose size follows its pixels and the
 * quality — enough to check the dimensions drawn and which of original and re-encoding comes back.
 */

const original = {
  getContext: HTMLCanvasElement.prototype.getContext,
  toBlob: HTMLCanvasElement.prototype.toBlob,
};

let drawn;
let encoded;

/** A camera file of `bytes` bytes that "decodes" to width × height. */
function photo({ width, height, bytes, type = 'image/jpeg', name = 'IMG_2041.jpg' }) {
  const file = new File([new Uint8Array(bytes)], name, { type });
  return Object.assign(file, { testWidth: width, testHeight: height });
}

beforeEach(() => {
  drawn = [];
  encoded = [];
  vi.stubGlobal('createImageBitmap', vi.fn(async (file) => ({ width: file.testWidth, height: file.testHeight, close: vi.fn() })));
  HTMLCanvasElement.prototype.getContext = function getContext() {
    return {
      fillStyle: '',
      fillRect: () => {},
      drawImage: (_source, x, y, w, h) => drawn.push({ x, y, w, h }),
    };
  };
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type, quality) {
    encoded.push({ type, quality, width: this.width, height: this.height });
    // ~0.25 byte a pixel at quality 1 — a plausible JPEG.
    callback(new Blob([new Uint8Array(Math.round(this.width * this.height * 0.25 * quality))], { type }));
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  HTMLCanvasElement.prototype.getContext = original.getContext;
  HTMLCanvasElement.prototype.toBlob = original.toBlob;
});

describe('fitWithin', () => {
  it('caps the longest edge at 1600 px and keeps the proportions', () => {
    expect(MAX_EDGE).toBe(1600);
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200, scaled: true });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600, scaled: true });
    expect(fitWithin(4032, 1816)).toEqual({ width: 1600, height: 721, scaled: true });
  });

  it('never upscales', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600, scaled: false });
    expect(fitWithin(1600, 900)).toEqual({ width: 1600, height: 900, scaled: false });
  });
});

describe('compressImage', () => {
  it('draws a 12-megapixel photo at 1600 × 1200, as a JPEG at 0.8, much smaller than it was', async () => {
    const file = photo({ width: 4000, height: 3000, bytes: 6_000_000 });
    const out = await compressImage(file);

    expect(drawn).toEqual([{ x: 0, y: 0, w: 1600, h: 1200 }]);
    expect(encoded[0]).toMatchObject({ type: 'image/jpeg', quality: 0.8, width: 1600, height: 1200 });
    expect(out).not.toBe(file);
    expect(out.type).toBe('image/jpeg');
    expect(out.name).toBe('IMG_2041.jpg');
    expect(out.size).toBeLessThan(file.size);
    expect(out.size).toBeLessThan(500_000);
  });

  it('turns a portrait photo the same way — the long edge is the height', async () => {
    await compressImage(photo({ width: 3024, height: 4032, bytes: 4_000_000 }));
    expect(drawn[0]).toMatchObject({ w: 1200, h: 1600 });
  });

  it('keeps a small photo that is already smaller than its re-encoding, and never draws it bigger', async () => {
    const file = photo({ width: 800, height: 600, bytes: 20_000 });
    const out = await compressImage(file);
    expect(drawn[0]).toMatchObject({ w: 800, h: 600 });
    expect(out).toBe(file);
  });

  it('re-encodes a small photo when that makes it smaller', async () => {
    const file = photo({ width: 800, height: 600, bytes: 2_000_000 });
    const out = await compressImage(file);
    expect(out).not.toBe(file);
    expect(out.size).toBeLessThan(file.size);
    expect(encoded[0]).toMatchObject({ width: 800, height: 600 });
  });

  it('always re-encodes a type the API does not take as it is (HEIC), even when that is bigger', async () => {
    const file = photo({ width: 800, height: 600, bytes: 10_000, type: 'image/heic', name: 'IMG_1.HEIC' });
    const out = await compressImage(file);
    expect(out.type).toBe('image/jpeg');
    expect(out.name).toBe('IMG_1.jpg');
  });

  it('falls back to JPEG when the browser cannot encode WebP', async () => {
    const encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type, quality) {
      // Safari: asked for WebP, hands back a PNG.
      return encode.call(this, callback, type === 'image/webp' ? 'image/png' : type, quality);
    };
    const out = await compressImage(photo({ width: 4000, height: 3000, bytes: 6_000_000 }), { type: 'image/webp' });
    expect(encoded.map((e) => e.type)).toEqual(['image/png', 'image/jpeg']);
    expect(out.type).toBe('image/jpeg');
  });

  it('hands back the original when the picture cannot be decoded here', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('bad image'); }));
    const file = photo({ width: 4000, height: 3000, bytes: 1000 });
    expect(await compressImage(file)).toBe(file);
    expect(drawn).toEqual([]);
  });
});
