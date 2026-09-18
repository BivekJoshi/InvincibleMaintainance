import { useCallback, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarDays, Lock, Palette, Phone, Receipt, Search, Settings2, Share2, ShieldCheck, Timer, X,
} from 'lucide-react';
import { useGetSettingsQuery, useUpdateSettingsMutation } from '@/api/settingsApi';
import { useAuth } from '@/hooks/useAuth';
import { buildSettingsForm } from '@/config/admin/settingsForm';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { flattenFields, toFormValues } from '@/components/common/ResourceForm/formValues';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import { toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

const GROUP_ICONS = {
  contact: Phone,
  branding: Palette,
  social: Share2,
  seo: Search,
  booking: CalendarDays,
  sla: Timer,
  finance: Receipt,
  warranty: ShieldCheck,
};

/** Empty text, null and undefined are the same "nothing" to the change counter. */
const comparable = (v) => (v === undefined || v === null || v === '' ? '' : JSON.stringify(v));

/**
 * `/admin/platform/settings` — the company's settings, one section at a time: a section list
 * on the left (a row of chips on a phone), the chosen section's fields on the right, and one
 * Save bar for all of them. Every section stays mounted, so the form still saves the whole
 * set together and only the keys that changed are sent (`config/admin/settingsForm.js`).
 * The section list marks sections with unsaved edits and sections a refused save points at;
 * the open section is kept in `?section=` so a link can point straight at it.
 *
 * It is a page of its own rather than a registry entry because settings are a fixed set of
 * keys saved together, not a list of records. Anyone with `settings:read` sees the values;
 * only ADMIN (`settings:write`, the API's rule) can change them.
 */
export default function SettingsPage() {
  const dispatch = useDispatch();
  const { can } = useAuth();
  const canWrite = can('settings:write');
  const { data, isLoading, error, refetch } = useGetSettingsQuery();
  const [update] = useUpdateSettingsMutation();
  const form = useMemo(() => (data ? buildSettingsForm(data) : null), [data]);

  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [values, setValues] = useState(null);
  const [errorGroups, setErrorGroups] = useState([]);
  // Discard remounts the form from the saved values.
  const [formKey, setFormKey] = useState(0);

  /** `[{ key, label, description, Icon, names }]`, in the order the form lays them out. */
  const groups = useMemo(() => (form?.fields ?? []).map((g) => ({
    key: g.key,
    label: g.label,
    description: g.description,
    Icon: GROUP_ICONS[g.key] ?? Settings2,
    fields: flattenFields(g.fields),
  })), [form]);

  const active = groups.some((g) => g.key === params.get('section')) ? params.get('section') : groups[0]?.key;
  const select = useCallback((key) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('section', key);
      return next;
    }, { replace: true });
  }, [setParams]);

  const fields = useMemo(
    () => (form?.fields ?? []).map((g) => ({ ...g, hidden: g.key !== active })),
    [form, active],
  );

  // What each field held when loaded, as ResourceForm sees it — the baseline for "changed".
  const initial = useMemo(() => (form ? toFormValues(form.fields, form.values) : {}), [form]);
  const changedByGroup = useMemo(() => {
    if (!values) return {};
    return Object.fromEntries(groups.map((g) => [
      g.key,
      g.fields.filter((f) => comparable(values[f.name]) !== comparable(initial[f.name])).length,
    ]));
  }, [values, initial, groups]);
  const changedCount = Object.values(changedByGroup).reduce((a, b) => a + b, 0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return groups.flatMap((g) => g.fields
      .filter((f) => `${f.label} ${f.description ?? ''} ${g.label}`.toLowerCase().includes(q))
      .map((f) => ({ group: g, field: f })));
  }, [query, groups]);

  const jumpTo = (groupKey, name) => {
    select(groupKey);
    setQuery('');
    if (name) {
      requestAnimationFrame(() => {
        const el = document.querySelector(`[name="${name}"]`);
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el?.focus?.({ preventScroll: true });
      });
    }
  };

  const onInvalid = (errors, { form: rhf }) => {
    const bad = groups.filter((g) => g.fields.some((f) => errors[f.name]));
    setErrorGroups(bad.map((g) => g.key));
    const first = bad.find((g) => g.key === active) ?? bad[0];
    if (!first) return;
    select(first.key);
    const name = first.fields.find((f) => errors[f.name])?.name;
    requestAnimationFrame(() => { try { rhf.setFocus(name); } catch { /* not focusable */ } });
  };

  const onSubmit = async (body) => {
    setErrorGroups([]);
    const changed = form.changes(body);
    const keys = Object.keys(changed);
    if (!keys.length) {
      dispatch(toastSuccess('Nothing to save', 'Every value is as it was.'));
      return;
    }
    await update(changed).unwrap();
    dispatch(toastSuccess('Settings saved', `${keys.length} setting${keys.length === 1 ? '' : 's'} changed. The website shows them now.`));
  };

  const discard = () => {
    setErrorGroups([]);
    setValues(null);
    setFormKey((k) => k + 1);
  };

  if (error) {
    return (
      <PageTransition>
        <PageHeader title="Settings" />
        <ErrorState error={error} onRetry={refetch} />
      </PageTransition>
    );
  }

  const loading = isLoading || !form;

  const saveBarExtras = (
    <>
      <span className="mr-auto text-xs text-muted-foreground" aria-live="polite">
        {changedCount ? (
          <>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary align-middle" aria-hidden />
            {changedCount} unsaved change{changedCount === 1 ? '' : 's'}
          </>
        ) : 'All changes saved'}
      </span>
      {changedCount ? <Button type="button" variant="ghost" size="sm" onClick={discard}>Discard</Button> : null}
    </>
  );

  return (
    <PageTransition>
      <PageHeader
        title="Settings"
        description="Company details, brand, booking rules and document defaults — what the website and the office run on."
        className="mb-4"
      >
        {!canWrite ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            Only an administrator can change settings. You can read them here.
          </p>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6">
        {/* Section list: a sticky column on a wide screen, a scrolling chip row on a phone. */}
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a setting"
              aria-label="Find a setting"
              className="h-9 pl-8 pr-8"
              disabled={loading}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="flex gap-2 lg:flex-col" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-28 rounded-md lg:w-full" />)}
            </div>
          ) : matches ? (
            <ul className="max-h-80 space-y-0.5 overflow-y-auto rounded-lg border bg-card p-1 lg:max-h-[60vh]">
              {matches.length ? matches.map(({ group, field }) => (
                <li key={field.name}>
                  <button
                    type="button"
                    onClick={() => jumpTo(group.key, field.name)}
                    className="flex w-full flex-col rounded-md px-2.5 py-1.5 text-left hover:bg-muted"
                  >
                    <span className="truncate text-sm">{field.label}</span>
                    <span className="truncate text-xs text-muted-foreground">{group.label}</span>
                  </button>
                </li>
              )) : <li className="px-2.5 py-2 text-sm text-muted-foreground">No setting matches.</li>}
            </ul>
          ) : (
            <nav aria-label="Settings sections">
              <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
                {groups.map(({ key, label, Icon }) => {
                  const current = key === active;
                  const changed = changedByGroup[key] ?? 0;
                  const invalid = errorGroups.includes(key);
                  return (
                    <li key={key} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => select(key)}
                        aria-current={current ? 'page' : undefined}
                        className={cn(
                          'flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          current
                            ? 'bg-primary/10 font-medium text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          'max-lg:border',
                          current && 'max-lg:border-primary/30',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="truncate">{label}</span>
                        {invalid ? (
                          <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-destructive" title="Needs fixing">
                            <span className="sr-only">(needs fixing)</span>
                          </span>
                        ) : changed ? (
                          <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
                            {changed}
                            <span className="sr-only"> unsaved</span>
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </aside>

        <div className="">
          {loading ? (
            <Skeleton className="h-72 rounded-xl" aria-hidden />
          ) : (
            <ResourceForm
              key={formKey}
              schema={form.schema}
              fields={fields}
              defaultValues={form.values}
              onSubmit={onSubmit}
              onInvalid={onInvalid}
              onValuesChange={setValues}
              submitLabel="Save settings"
              readOnly={!canWrite}
              extraActions={canWrite ? saveBarExtras : null}
              stickyActions
              className="space-y-4"
            />
          )}
        </div>
      </div>
    </PageTransition>
  );
}
