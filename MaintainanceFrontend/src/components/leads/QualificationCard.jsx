import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { ClipboardList, Pencil } from 'lucide-react';
import { useUpdateLeadMutation } from '@/api/leadsApi';
import { FormDialog } from '@/components/common/FormDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { qualificationSchema } from '@/form/schemas/lead.schema';
import { qualificationFields } from '@/config/admin/crmForms';
import { qualificationSummary } from '@/helpers/leadFollowUp';
import { toastSuccess } from '@/redux/slices/uiSlice';

/**
 * The lead's qualification (Phase L1): property, floors, building age, budget band and who decides
 * (an owner abroad decides remotely) — what sales learns on the first call, before anyone drives out.
 * Shows what is known and "Missing: budget, decision maker"; **Edit** is a `FormDialog` saving through
 * `PUT /admin/leads/:id` (`qualification`, or null when everything is cleared).
 *
 * @param {{ lead: object, canWrite?: boolean }} props
 */
export function QualificationCard({ lead, canWrite = false }) {
  const dispatch = useDispatch();
  const [updateLead] = useUpdateLeadMutation();
  const [editing, setEditing] = useState(false);
  const q = lead.qualification ?? null;
  const { filled, missing } = qualificationSummary(q);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4 text-primary" aria-hidden /> Qualification
        </CardTitle>
        {canWrite ? (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label="Edit qualification">
            <Pencil /> Edit
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {filled.length ? (
          <dl className="space-y-1.5">
            {filled.map((f) => (
              <div key={f.key} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="min-w-0 break-words font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="text-muted-foreground">Nothing asked yet.</p>}
        {q?.note ? <p className="whitespace-pre-wrap break-words rounded-md bg-muted/50 px-3 py-2">{q.note}</p> : null}
        {missing.length ? (
          <p className="rounded-md border border-dashed border-warning-border px-3 py-2 text-xs text-warning-foreground">
            <span className="font-semibold">Missing:</span> {missing.join(', ')}
          </p>
        ) : null}
      </CardContent>

      <FormDialog
        open={editing}
        onOpenChange={setEditing}
        title={`Qualify ${lead.name}`}
        description="Ask on the first call — before anyone drives out. Budget is the customer’s own words, not an amount."
        schema={qualificationSchema}
        fields={qualificationFields}
        defaultValues={{ ...(q ?? {}), note: q?.note ?? '' }}
        submitLabel="Save"
        onSubmit={async (body) => {
          const parts = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined && v !== null && v !== ''));
          await updateLead({ id: lead.id, qualification: Object.keys(parts).length ? parts : null }).unwrap();
          dispatch(toastSuccess('Qualification saved'));
        }}
      />
    </Card>
  );
}
