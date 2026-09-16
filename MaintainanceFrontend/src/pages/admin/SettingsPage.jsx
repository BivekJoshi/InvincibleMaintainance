import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { Lock } from 'lucide-react';
import { useGetSettingsQuery, useUpdateSettingsMutation } from '@/api/settingsApi';
import { useAuth } from '@/hooks/useAuth';
import { buildSettingsForm } from '@/config/admin/settingsForm';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/three/motion/motionKit';
import { toastSuccess } from '@/redux/slices/uiSlice';

/**
 * `/admin/platform/settings` — the company's settings, one card per group, each row's
 * input chosen by its type (`config/admin/settingsForm.js`). It is a page of its own rather
 * than a registry entry because settings are a fixed set of keys saved together, not a list
 * of records. Saving sends only the keys that changed. Anyone with `settings:read` sees the
 * values; only ADMIN (`settings:write`, the API's rule) can change them.
 */
export default function SettingsPage() {
  const dispatch = useDispatch();
  const { can } = useAuth();
  const canWrite = can('settings:write');
  const { data, isLoading, error, refetch } = useGetSettingsQuery();
  const [update] = useUpdateSettingsMutation();
  const form = useMemo(() => (data ? buildSettingsForm(data) : null), [data]);

  const onSubmit = async (body) => {
    const values = form.changes(body);
    const keys = Object.keys(values);
    if (!keys.length) {
      dispatch(toastSuccess('Nothing to save', 'Every value is as it was.'));
      return;
    }
    await update(values).unwrap();
    dispatch(toastSuccess('Settings saved', `${keys.length} setting${keys.length === 1 ? '' : 's'} changed. The website shows them now.`));
  };

  let body;
  if (error) {
    body = <ErrorState error={error} onRetry={refetch} />;
  } else if (isLoading || !form) {
    body = (
      <div className="space-y-4" aria-hidden>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  } else {
    body = (
      <ResourceForm
        schema={form.schema}
        fields={form.fields}
        defaultValues={form.values}
        onSubmit={onSubmit}
        submitLabel="Save settings"
        readOnly={!canWrite}
        stickyActions
      />
    );
  }

  return (
    <PageTransition>
      <PageHeader
        title="Settings"
        description="Company details, brand, booking rules and document defaults — what the website and the office run on."
      />
      {!canWrite ? (
        <p className="mb-4 flex max-w-3xl gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>Only an administrator can change settings. You can read them here.</span>
        </p>
      ) : null}
      <div className="max-w-3xl">{body}</div>
    </PageTransition>
  );
}
