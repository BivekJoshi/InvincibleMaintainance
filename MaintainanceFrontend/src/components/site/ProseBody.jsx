import { splitParagraphs } from '@/helpers/prose';
import { cn } from '@/helpers/utils';

/**
 * The editor's prose, as the public site shows it. Stored as plain text with blank
 * lines between paragraphs, so it is split on those rather than rendered as HTML —
 * nothing from the CMS reaches the DOM as markup.
 *
 * The service page renders body copy with this, and so does the prose field's
 * preview in the admin, which is what keeps the preview honest.
 */
export function ProseBody({ body, className }) {
  const paragraphs = splitParagraphs(body);
  if (!paragraphs.length) return null;

  return (
    <div className={cn('max-w-2xl', className)}>
      {paragraphs.map((para, i) => (
        <p key={i} className={cn('whitespace-pre-line leading-relaxed text-muted-foreground', i && 'mt-5')}>{para}</p>
      ))}
    </div>
  );
}
