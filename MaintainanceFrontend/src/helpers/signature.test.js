import { afterEach, describe, expect, it } from 'vitest';
import {
  EMPTY_SIGNATURE, MIN_INK, hasSignature, inkLength, isSignatureLongEnough, signatureToPng,
} from '@/helpers/signature';

const line = (x0, y0, x1, y1, steps = 10) =>
  Array.from({ length: steps + 1 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }));

describe('signature — the minimum stroke check', () => {
  it('measures the ink in every stroke', () => {
    expect(inkLength([line(0, 0, 30, 40)])).toBeCloseTo(50);
    expect(inkLength([line(0, 0, 30, 0), line(0, 10, 0, 50)])).toBeCloseTo(70);
  });

  it('treats a tap or a short flick as no signature', () => {
    expect(hasSignature(EMPTY_SIGNATURE)).toBe(false);
    expect(isSignatureLongEnough({ strokes: [[{ x: 10, y: 10 }]] })).toBe(false);
    expect(isSignatureLongEnough({ strokes: [line(10, 10, 40, 10)] })).toBe(false); // 30 px
  });

  it('accepts a real scrawl', () => {
    const scrawl = { strokes: [line(10, 80, 120, 40), line(120, 40, 200, 90)], width: 320, height: 180 };
    expect(inkLength(scrawl.strokes)).toBeGreaterThan(MIN_INK);
    expect(isSignatureLongEnough(scrawl)).toBe(true);
  });
});

describe('signatureToPng', () => {
  const original = { getContext: HTMLCanvasElement.prototype.getContext, toBlob: HTMLCanvasElement.prototype.toBlob };
  afterEach(() => Object.assign(HTMLCanvasElement.prototype, original));

  it('draws black ink on white at twice the pad’s size, as signature.png', async () => {
    const calls = [];
    let size;
    HTMLCanvasElement.prototype.getContext = function getContext() {
      return new Proxy({}, {
        get: (_t, key) => (typeof key === 'string' && ['fillRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'arc', 'fill'].includes(key)
          ? (...args) => calls.push([key, ...args])
          : undefined),
        set: (_t, key, value) => { calls.push([key, value]); return true; },
      });
    };
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type) {
      size = [this.width, this.height];
      callback(new Blob(['png'], { type }));
    };

    const file = await signatureToPng({ strokes: [line(10, 10, 100, 60)], width: 320, height: 180 });

    expect(size).toEqual([640, 360]);
    expect(file.type).toBe('image/png');
    expect(file.name).toBe('signature.png');
    expect(calls).toContainEqual(['fillStyle', 'white']);
    expect(calls).toContainEqual(['strokeStyle', 'black']);
    expect(calls).toContainEqual(['moveTo', 20, 20]);
  });
});
