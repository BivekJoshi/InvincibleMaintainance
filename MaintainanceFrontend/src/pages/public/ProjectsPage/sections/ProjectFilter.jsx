import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';

/**
 * Which trade's work to show. A single select rather than a chip row: the
 * service list is the whole catalogue, and twenty chips above three cards
 * would be a filter that outweighs its results.
 */
export function ProjectFilter({ services, value, onChange }) {
  const t = useT(SITE);
  return (
    <div className="mb-6 flex justify-end">
      <Select value={value || 'all'} onValueChange={onChange}>
        <SelectTrigger className="w-full max-w-[240px]" aria-label={t('projects.filter')}>
          <SelectValue placeholder={t('projects.all')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('projects.all')}</SelectItem>
          {services.map((s) => <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
