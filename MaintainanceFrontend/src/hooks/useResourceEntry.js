import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getResourceEntry } from '@/config/admin/resourceRegistry';

/**
 * The registry entry behind `/admin/content/:resource`, and whether this user may see it.
 * The route is already guarded by `cms:read`; the entry's own capability is checked here,
 * because the route table cannot import the registry without pulling it into the main bundle.
 *
 * @returns {{ status: 'ok'|'unknown'|'forbidden', entry?: import('@/config/admin/resourceRegistry').ResourceEntry, canWrite: boolean }}
 */
export function useResourceEntry() {
  const { resource } = useParams();
  const { can } = useAuth();
  const entry = getResourceEntry(resource);

  if (!entry) return { status: 'unknown', canWrite: false };
  if (!can(entry.capability)) return { status: 'forbidden', entry, canWrite: false };
  return { status: 'ok', entry, canWrite: can(entry.writeCapability ?? 'cms:write') };
}
