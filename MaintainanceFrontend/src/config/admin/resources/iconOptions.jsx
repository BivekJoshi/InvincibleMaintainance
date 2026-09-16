import { DataIcon, ICON_NAMES } from '@/components/site/DataIcon';

/**
 * The icon picker's choices: every name `DataIcon` can draw, each shown with its icon.
 * A name outside this list renders as the fallback compass on the site, so the picker
 * offers nothing else.
 */
export const ICON_OPTIONS = ICON_NAMES.map((name) => ({
  value: name,
  label: (
    <span className="flex items-center gap-2">
      <DataIcon name={name} className="h-4 w-4 text-primary" />
      {name}
    </span>
  ),
}));
