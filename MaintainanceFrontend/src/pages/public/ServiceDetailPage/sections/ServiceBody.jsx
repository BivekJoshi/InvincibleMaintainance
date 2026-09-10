import { cn } from '@/helpers/utils';

/**
 * The editor's prose. Stored as plain text with blank lines between
 * paragraphs, so it is split on those rather than rendered as HTML — nothing
 * from the CMS reaches the DOM as markup.
 */
export function ServiceBody({ body }) {
  if (!body) return null;

  return (
    <div className="max-w-2xl">
      {body.split('\n\n').map((para, i) => (
        <p key={i} className={cn('leading-relaxed text-muted-foreground', i && 'mt-5')}>{para}</p>
      ))}
    </div>
  );
}
