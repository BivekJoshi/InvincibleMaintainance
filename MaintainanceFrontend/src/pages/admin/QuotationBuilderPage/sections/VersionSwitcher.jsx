import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QUOTATION_STATUS_LABELS } from '@/config/constants';

/**
 * Every version of a quotation, oldest first (`versions` from the API); picking one opens it.
 * Hidden while there is only one.
 */
export function VersionSwitcher({ quotation }) {
  const navigate = useNavigate();
  const versions = quotation.versions ?? [];
  if (versions.length < 2) return null;
  return (
    <Select value={quotation.id} onValueChange={(id) => navigate(`/admin/quotations/${id}`)}>
      <SelectTrigger className="h-8 w-auto min-w-[220px]" aria-label="Version">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {versions.map((v) => (
          <SelectItem key={v.id} value={v.id}>
            v{v.version} · {v.number} · {QUOTATION_STATUS_LABELS[v.status] ?? v.status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
