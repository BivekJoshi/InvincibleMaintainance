import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Which trade's work to show. A single select rather than a chip row: the
 * service list is the whole catalogue, and twenty chips above three cards
 * would be a filter that outweighs its results.
 */
export function ProjectFilter({ services, value, onChange }) {
  return (
    <div className="mb-6 flex justify-end">
      <Select value={value || 'all'} onValueChange={onChange}>
        <SelectTrigger className="w-[240px]" aria-label="Filter by service">
          <SelectValue placeholder="All services" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All services</SelectItem>
          {services.map((s) => <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
