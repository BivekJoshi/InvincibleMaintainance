import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { drawStrokes, hasSignature, isSignatureLongEnough } from '@/helpers/signature';
import { cn } from '@/helpers/utils';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';

/**
 * A box the customer signs in with a finger — or a stylus, or a mouse: pointer events cover all three, and
 * `touch-action: none` stops the page scrolling under the finger. The ink is the theme's foreground on
 * screen; the PNG that is uploaded is black on white (`helpers/signature.js#signatureToPng`).
 *
 * Controlled: `value` is `{ strokes, width, height }` (points in the pad's CSS pixels); `onChange` gets the
 * next value when a stroke ends, on Undo and on Clear. A stroke in progress is drawn straight onto the
 * canvas, so a signature does not re-render the page for every point.
 *
 * Its words are `FIELD.signature`, in the technician's language.
 *
 * @param {{ value: import('@/helpers/signature').Signature, onChange: (next: object) => void, disabled?: boolean,
 *   height?: number, className?: string }} props
 */
export function SignaturePad({ value, onChange, disabled = false, height = 180, className }) {
  const t = useT(FIELD);
  const canvasRef = useRef(null);
  const stroke = useRef(null);
  const [width, setWidth] = useState(0);
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const measure = () => setWidth(canvas.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const context = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    return ctx ? { canvas, ctx, ratio: window.devicePixelRatio || 1, ink: getComputedStyle(canvas).color } : null;
  }, []);

  /** Repaints every committed stroke, scaled if the box changed width since they were drawn. */
  useEffect(() => {
    const target = context();
    if (!target || !width) return;
    const { canvas, ctx, ratio, ink } = target;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fit = value.width ? width / value.width : 1;
    drawStrokes(ctx, value.strokes, { ink, scale: ratio * fit });
  }, [value, width, height, context]);

  const pointOf = (event) => {
    const box = canvasRef.current.getBoundingClientRect();
    return { x: Math.round((event.clientX - box.left) * 10) / 10, y: Math.round((event.clientY - box.top) * 10) / 10 };
  };

  const onPointerDown = (event) => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    canvasRef.current.setPointerCapture?.(event.pointerId);
    stroke.current = [pointOf(event)];
    const target = context();
    if (target) drawStrokes(target.ctx, [stroke.current], { ink: target.ink, scale: target.ratio });
  };

  const onPointerMove = (event) => {
    if (!stroke.current) return;
    event.preventDefault();
    const events = event.nativeEvent?.getCoalescedEvents?.() ?? [];
    const points = (events.length ? events : [event]).map(pointOf);
    const from = stroke.current[stroke.current.length - 1];
    stroke.current.push(...points);
    const target = context();
    if (target) drawStrokes(target.ctx, [[from, ...points]], { ink: target.ink, scale: target.ratio });
  };

  const onPointerEnd = () => {
    if (!stroke.current) return;
    const done = stroke.current;
    stroke.current = null;
    setLifted(true);
    const fit = value.width && width ? value.width / width : 1;
    const scaled = fit === 1 ? done : done.map((p) => ({ x: p.x * fit, y: p.y * fit }));
    onChange({ strokes: [...value.strokes, scaled], width: value.width || width, height: value.height || height });
  };

  const empty = !hasSignature(value);
  const tooShort = lifted && !empty && !isSignatureLongEnough(value);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={t('signature.label')}
          className={cn(
            'block w-full touch-none select-none rounded-lg border-2 border-dashed bg-card text-foreground',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair',
            tooShort ? 'border-destructive' : 'border-input',
          )}
          style={{ height }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={onPointerEnd}
        />
        {empty ? (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm text-muted-foreground" aria-hidden>
            {t('signature.label')}
          </p>
        ) : null}
      </div>
      {tooShort ? <p className="text-sm text-destructive" role="alert">{t('signature.tooShort')}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button" variant="outline" size="lg" className="px-3"
          disabled={disabled || empty}
          onClick={() => onChange({ ...value, strokes: value.strokes.slice(0, -1) })}
        >
          <Undo2 /> {t('signature.undo')}
        </Button>
        <Button
          type="button" variant="outline" size="lg" className="px-3"
          disabled={disabled || empty}
          onClick={() => { setLifted(false); onChange({ strokes: [], width: 0, height: 0 }); }}
        >
          <Eraser /> {t('signature.clear')}
        </Button>
      </div>
    </div>
  );
}
