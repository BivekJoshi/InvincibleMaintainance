import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StateBadge } from '@/components/common/StateBadge';
import { technicianSchema } from '@/form/schemas/ops.schema';
import { titleCase } from '@/helpers/format';

const FIELD_STAFF = [
  { value: 'TECHNICIAN', label: 'Technicians' },
  { value: 'SURVEYOR', label: 'Surveyors' },
];

/** A list column's first few entries as chips. */
function chips(values) {
  if (!values?.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex max-w-xs flex-wrap gap-1">
      {values.slice(0, 4).map((v) => <Badge key={v} variant="outline" className="text-[10px]">{v}</Badge>)}
      {values.length > 4 ? <span className="text-xs text-muted-foreground">+{values.length - 4}</span> : null}
    </div>
  );
}

const rating = (r) => (r.ratingCount
  ? <span className="inline-flex items-center gap-1 tabular-nums"><Star className="h-3.5 w-3.5 text-sla-warn" aria-hidden />{r.rating.toFixed(1)} <span className="text-xs text-muted-foreground">({r.ratingCount})</span></span>
  : <span className="text-muted-foreground">Not rated</span>);

/**
 * The people dispatch sends out. A TECHNICIAN or SURVEYOR account gets its profile when the account
 * is created (Platform › Users); "New" here is for someone else who also goes out.
 *
 * The switch is **availability**, not `isActive`. The labour rate is shown only to
 * `technicians:write` (the API hides it from everyone else), and so is the History tab, which
 * records rate changes.
 *
 * @type {import('../resourceRegistry').ResourceEntry}
 */
export const technicians = {
  resource: 'technicians',
  path: '/admin/technicians',
  basePath: '/admin/technicians',
  model: 'technician',
  label: 'Technician',
  labelPlural: 'Technicians',
  description: 'Who goes out: skills, areas, how much work a day, and who is available.',
  notice: 'A technician or surveyor gets a profile here when their account is created under Platform › Users. Switch someone off there when they leave; switch availability off here when they are away.',
  capability: 'technicians:read',
  writeCapability: 'technicians:write',
  historyCapability: 'technicians:write',
  activeField: 'isAvailable',
  activeCopy: {
    column: 'Available',
    switchLabel: 'Available for dispatch:',
    turnOn: 'Mark available',
    turnOff: 'Mark unavailable',
    turnedOn: 'is available for dispatch',
    turnedOff: 'is marked unavailable — the board warns before anyone books them',
    deleteOne: 'They leave the dispatch board. Their jobs, time and ratings stay.',
    deleteMany: 'They leave the dispatch board. Their jobs, time and ratings stay.',
  },
  schema: technicianSchema,
  sortable: false,
  defaultSort: 'employeeCode',
  titleOf: (record) => record.user?.name ?? record.employeeCode ?? 'Technician',
  publicHref: () => null,
  searchPlaceholder: 'Search name, code or phone…',
  emptyTitle: 'No technicians yet',
  emptyDescription: 'Create a technician account under Platform › Users — its profile appears here.',

  columns: [
    {
      key: 'name', header: 'Name', sortable: true,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.user?.name}</p>
          <p className="text-xs text-muted-foreground">
            {[r.employeeCode, titleCase(r.user?.role ?? '')].filter(Boolean).join(' · ')}
            {r.user?.phone ? (
              <> · <a href={`tel:${r.user.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary hover:underline">{r.user.phone}</a></>
            ) : null}
          </p>
          {r.user && !r.user.isActive ? <StateBadge tone="warning" className="mt-1">Account switched off</StateBadge> : null}
        </div>
      ),
    },
    { key: 'skills', header: 'Skills', cell: (r) => chips(r.skills) },
    { key: 'serviceAreas', header: 'Areas', cell: (r) => chips(r.serviceAreas) },
    {
      key: 'loadThisWeek', header: 'This week', className: 'text-right',
      cell: (r) => (
        <span className="whitespace-nowrap tabular-nums" title={`${r.dailyCapacity} jobs a day at most`}>
          {r.loadThisWeek ?? 0} job{r.loadThisWeek === 1 ? '' : 's'}
          <span className="block text-xs text-muted-foreground">up to {r.dailyCapacity}/day</span>
        </span>
      ),
    },
    { key: 'rating', header: 'Rating', sortable: true, cell: rating },
  ],

  filters: [
    { key: 'role', label: 'Who', type: 'enum', allLabel: 'Everyone', className: 'w-[150px]', options: FIELD_STAFF },
    { key: 'available', label: 'Availability', type: 'boolean', trueLabel: 'Available', falseLabel: 'Unavailable', className: 'w-[150px]' },
  ],

  intro: (r) => (
    <dl className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-3">
      <div><dt className="text-xs text-muted-foreground">Account</dt><dd className="truncate">{r.user?.email ?? '—'}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Customer rating</dt><dd>{rating(r)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Jobs this week</dt><dd className="tabular-nums">{r.loadThisWeek ?? 0}</dd></div>
    </dl>
  ),

  fields: [
    {
      name: 'userId', type: 'relation', label: 'Person', required: true, lockedOnEdit: true,
      relation: { path: '/admin/technicians/users', labelKey: 'label' },
      description: 'Anyone with an account and no profile yet. Fixed once saved.',
    },
    { name: 'employeeCode', type: 'text', label: 'Employee code', span: 'half', maxLength: 30, placeholder: 'T-007' },
    {
      name: 'dailyCapacity', type: 'number', label: 'Jobs a day, at most', span: 'half', min: 1, max: 20, step: 1,
      description: 'The board warns before a day goes past this.',
    },
    { name: 'skills', type: 'stringList', label: 'Skills', addLabel: 'Add a skill', maxItems: 40, description: 'The board filters by these — write them the same way for everyone.' },
    { name: 'serviceAreas', type: 'stringList', label: 'Service areas', addLabel: 'Add an area', maxItems: 60 },
    { name: 'certifications', type: 'stringList', label: 'Certifications', addLabel: 'Add a certification', maxItems: 40 },
    {
      name: 'hourlyRate', type: 'money', label: 'Labour cost per hour', span: 'half', capability: 'technicians:write',
      description: 'What an hour of their time costs the company. Job costing uses it; nobody outside dispatch sees it.',
    },
    { name: 'isAvailable', type: 'switch', label: 'Available for dispatch', description: 'Off while they are on leave.' },
  ],

  defaultValues: { dailyCapacity: 4, isAvailable: true, skills: [], serviceAreas: [], certifications: [] },
};
