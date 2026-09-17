import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { arrayMove } from '@dnd-kit/sortable';
import { ExternalLink, Undo2 } from 'lucide-react';
import { useGetHomeSectionsQuery, useUpdateHomeSectionsMutation } from '@/api/cmsApi';
import { useGetHomeQuery } from '@/api/publicApi';
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { HomeSectionList } from '@/components/homeComposer/HomeSectionList';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { homeSectionInfo, toSectionItems } from '@/config/admin/homeSections';

const snapshot = (sections) => JSON.stringify(toSectionItems(sections));

/** The first per-section setting the API would refuse, as a message. */
function invalidLimit(sections) {
  for (const s of sections) {
    const limit = s.settings?.limit;
    const max = homeSectionInfo(s.key).limit?.max ?? 50;
    if (limit != null && (!Number.isInteger(limit) || limit < 1 || limit > max)) {
      return `${homeSectionInfo(s.key).label}: show between 1 and ${max} items.`;
    }
  }
  return null;
}

/**
 * `/admin/content/home` — the home page composer. A bespoke page rather than a registry
 * entry: the sections are a fixed set with no create or delete, saved together in one
 * `PUT /admin/home-sections`, so a reorder is a draft until Save.
 *
 * Next to each section it says what it shows and where its content is edited, and flags
 * a visible section the site currently skips because it has nothing in it.
 */
export default function HomeComposerPage() {
  const { can } = useAuth();
  const canWrite = can('cms:write');
  const dispatch = useDispatch();
  const { data, isLoading, error, refetch } = useGetHomeSectionsQuery();
  const { data: home } = useGetHomeQuery('en');
  const [save, { isLoading: saving }] = useUpdateHomeSectionsMutation();
  const [draft, setDraft] = useState(null);

  const saved = useMemo(() => (data ? [...data].sort((a, b) => a.sortOrder - b.sortOrder) : null), [data]);
  // A fresh server copy replaces the draft only while nobody is editing.
  const dirty = Boolean(draft && saved && snapshot(draft) !== snapshot(saved));
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (saved && !dirtyRef.current) setDraft(saved);
  }, [saved]);

  const { blocker, setBypass } = useUnsavedChangesGuard(dirty);

  const emptyKeys = useMemo(() => {
    if (!home?.sections || !draft) return new Set();
    const rendered = new Set(home.sections.filter((s) => s.data && (Array.isArray(s.data) ? s.data.length : Object.keys(s.data).length)).map((s) => s.key));
    const shownNow = new Set((saved ?? []).filter((s) => s.isVisible).map((s) => s.key));
    // Only a section the site was asked to show can be known to be empty.
    return new Set(draft.filter((s) => shownNow.has(s.key) && !rendered.has(s.key)).map((s) => s.key));
  }, [home, draft, saved]);

  const problem = draft ? invalidLimit(draft) : null;

  const onMove = (from, to) => setDraft((prev) => arrayMove(prev, from, to));
  const onChange = (key, patch) => setDraft((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const onSave = async () => {
    if (problem) return;
    setBypass(true);
    try {
      const next = await save(toSectionItems(draft)).unwrap();
      setDraft([...next].sort((a, b) => a.sortOrder - b.sortOrder));
      dispatch(toastSuccess('Home page saved', 'Visitors see the new order on their next visit.'));
    } catch (err) {
      dispatch(toastError('The home page was not saved', err?.data?.error?.details?.[0]?.message ?? err?.data?.error?.message));
    } finally {
      setBypass(false);
    }
  };

  let body;
  if (error) body = <ErrorState error={error} onRetry={refetch} />;
  else if (isLoading || !draft) {
    body = <div className="space-y-2" aria-hidden>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  } else {
    body = (
      <HomeSectionList sections={draft} emptyKeys={emptyKeys} disabled={!canWrite || saving} onMove={onMove} onChange={onChange} />
    );
  }

  return (
    <PageTransition>
      <PageHeader
        title="Home page"
        description="The order of the home page, top to bottom, and which sections it shows."
        actions={(
          <Button asChild variant="outline">
            <a href="/" target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> Preview home</a>
          </Button>
        )}
      />

      <div className="max-w-4xl space-y-4">
        {body}

        {canWrite && draft ? (
          <div className="sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-background/95 p-3 backdrop-blur">
            <p role="status" className="mr-auto text-sm text-muted-foreground">
              {problem ? <span className="font-medium text-destructive">{problem}</span> : dirty ? 'Unsaved changes' : 'All changes saved'}
            </p>
            <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => setDraft(saved)}>
              <Undo2 aria-hidden /> Discard
            </Button>
            <Button type="button" disabled={!dirty || Boolean(problem)} loading={saving} onClick={onSave}>Save home page</Button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        title="Leave without saving?"
        description="Your changes to the home page have not been saved. If you leave now, they are lost."
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        destructive
        open={blocker.state === 'blocked'}
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </PageTransition>
  );
}
