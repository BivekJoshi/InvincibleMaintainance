import { useLayoutEffect, useRef, useState } from 'react';

/**
 * The rendered width of an element, kept current as it resizes — an SVG chart
 * draws in real pixels so its hairlines stay one pixel wide. Falls back to
 * `fallback` where ResizeObserver does not exist (tests, very old browsers).
 */
export function useElementWidth(fallback = 600) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (el.clientWidth) setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
