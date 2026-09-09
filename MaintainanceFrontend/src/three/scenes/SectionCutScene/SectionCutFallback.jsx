import { ROOMS } from './rooms';
import { cn } from '@/helpers/utils';

/**
 * No WebGL. This panel is the hero's anchor so it cannot render nothing — the
 * same layers in the same colours, stacked flat. It is also the no-JS view.
 */
export function SectionCutFallback({ className, labels }) {
  const BANDS = [
    ['--build-walltile', 'h-6'], ['--trade-live', 'h-2'], ['--build-board', 'h-4'],
    ['--build-tile', 'h-8'], ['--build-adhesive', 'h-2'], ['--build-membrane', 'h-3'],
    ['--build-screed', 'h-6'], ['--build-substrate', 'h-10'],
  ];
  return (
    <figure className={cn('relative m-0', className)}>
      <div className="flex aspect-[7/6] w-full flex-col justify-center gap-1 bg-muted/30 p-6">
        {BANDS.map(([token, h]) => (
          <span key={token} className={cn('block w-full rounded-sm', h)} style={{ background: `hsl(var(${token}))` }} />
        ))}
      </div>
      <ul className="sr-only">{labels.map((l) => <li key={l}>{l}</li>)}</ul>
      <figcaption className="border-t bg-muted/40 px-5 py-2.5 text-[12px] leading-snug text-muted-foreground">
        {ROOMS.map((r) => r.name).join(' · ')} — the rooms we fit out and maintain.
      </figcaption>
    </figure>
  );
}
