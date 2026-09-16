import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getResourceEntry, screenPathOf } from '@/config/admin/resourceRegistry';

/**
 * The registry entry behind a generic resource screen, and whether this user may see it.
 *
 * Most entries live at `/admin/content/:resource`, where the resource comes from the URL. An
 * entry with its own `basePath` (the rate card, under Sales) is mounted on a fixed route that
 * passes `resource` in, and is unknown at `/admin/content/:resource` — one screen, one address.
 *
 * The route is already guarded by a capability; the entry's own is checked here, because the
 * route table cannot import the registry without pulling it into the main bundle.
 *
 * @param {string} [fixedResource] set by a fixed route; otherwise read from `:resource`
 * @returns {{ status: 'ok'|'unknown'|'forbidden', entry?: import('@/config/admin/resourceRegistry').ResourceEntry, canWrite: boolean }}
 */
export function useResourceEntry(fixedResource) {
  const params = useParams();
  const { can } = useAuth();
  const resource = fixedResource ?? params.resource;
  const entry = getResourceEntry(resource);

  if (!entry) return { status: 'unknown', canWrite: false };
  const expected = `/admin/content/${resource}`;
  if (!fixedResource && screenPathOf(entry) !== expected) return { status: 'unknown', canWrite: false };
  if (!can(entry.capability)) return { status: 'forbidden', entry, canWrite: false };
  return { status: 'ok', entry, canWrite: can(entry.writeCapability ?? 'cms:write') };
}
