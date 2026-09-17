import { cn } from '@/helpers/utils';

/**
 * The categories that have a published post, as a row of toggles. A handful at most,
 * so chips rather than a select; "All" is always first.
 */
export function PostCategoryFilter({ categories, value, onChange }) {
  if (!categories.length) return null;
  const options = [{ slug: '', name: 'All' }, ...categories];

  return (
    <div role="group" aria-label="Filter by category" className="mb-8 flex flex-wrap gap-2">
      {options.map((c) => {
        const active = (value || '') === c.slug;
        return (
          <button
            key={c.slug || 'all'}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(c.slug)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
              active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/40',
            )}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
