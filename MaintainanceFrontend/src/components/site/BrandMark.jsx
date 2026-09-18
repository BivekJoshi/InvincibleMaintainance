import { useState } from 'react';
import { cn } from '@/helpers/utils';

/**
 * The company's mark: the uploaded logo (Settings → Brand and home page → Logo) when there
 * is one, otherwise the company's initial on a tile. Every place that shows the brand —
 * the site header and footer, the login page, the back-office sidebar — draws it through
 * here, so a new logo appears everywhere at once.
 *
 * The caller sizes and colours the tile (`className`); with a logo the tile turns into a
 * plain frame so a transparent PNG or SVG sits on the page's own background. A logo that
 * fails to load falls back to the initial.
 *
 * @param {{ logoUrl?: string|null, initial: string, className?: string,
 *   children?: import('react').ReactNode }} props  `children` are extra layers (a sheen) drawn over the initial only
 */
export function BrandMark({ logoUrl, initial, className, children }) {
  const [failed, setFailed] = useState(null);
  const showLogo = logoUrl && failed !== logoUrl;

  if (showLogo) {
    return (
      <span className={cn(className, 'grid shrink-0 place-items-center overflow-hidden bg-transparent p-0 shadow-none')}>
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setFailed(logoUrl)}
        />
      </span>
    );
  }

  return (
    <span className={cn('grid shrink-0 place-items-center', className)} aria-hidden>
      {children}
      <span className="relative">{initial}</span>
    </span>
  );
}
