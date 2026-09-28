import { useState } from 'react';
import { CloudUpload, Hourglass, NotebookPen, PackageOpen, TriangleAlert, Users } from 'lucide-react';
import { useGetJobDiaryQuery } from '@/api/jobsApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';
import { ErrorState } from '@/components/common/ErrorState';
import { StateBadge } from '@/components/common/StateBadge';
import { CardSkeleton } from '@/components/ui/skeleton';
import { LOST_TIME_REASON_LABELS, WEATHER_LABELS } from '@/config/constants';
import { diaryDayIso, diaryHeadcount, qtyWithUnit } from '@/helpers/execution';
import { formatDate, formatDateBs, formatDateTime, imageUrl } from '@/helpers/format';

const onePage = (rows) => ({ page: 1, pages: 1, total: rows.length, limit: rows.length || 1 });

const COLUMNS = [
  {
    key: 'day', header: 'Day',
    cell: (r) => (
      <div className="whitespace-nowrap">
        <p className="font-medium">{formatDate(diaryDayIso(r.day), { weekday: 'short' })}</p>
        <p className="text-[11px] text-muted-foreground">{formatDateBs(diaryDayIso(r.day))} BS</p>
      </div>
    ),
    exportValue: (r) => r.day,
  },
  { key: 'weather', header: 'Weather', cell: (r) => (r.weather ? WEATHER_LABELS[r.weather] ?? r.weather : <span className="text-muted-foreground">—</span>), exportValue: (r) => WEATHER_LABELS[r.weather] ?? '' },
  {
    key: 'headcount', header: 'On site', className: 'text-right',
    cell: (r) => <span className="tabular-nums" data-testid={`diary-crew-${r.day}`}>{diaryHeadcount(r)}</span>,
    exportValue: (r) => String(diaryHeadcount(r)),
  },
  {
    key: 'lostHours', header: 'Time lost',
    cell: (r) => (Number(r.lostHours) > 0 ? (
      <StateBadge tone="warning">{r.lostHours} h · {LOST_TIME_REASON_LABELS[r.lostReason] ?? r.lostReason ?? '—'}</StateBadge>
    ) : <span className="text-muted-foreground">—</span>),
    exportValue: (r) => (Number(r.lostHours) > 0 ? `${r.lostHours} h ${LOST_TIME_REASON_LABELS[r.lostReason] ?? ''}` : ''),
  },
  {
    key: 'progress', header: 'Progress marked',
    cell: (r) => (r.progress?.length ? (
      <span className="block max-w-xs truncate text-xs">
        {r.progress.map((p) => `${p.number ?? '—'} ${p.progressPct}%`).join(' · ')}
      </span>
    ) : <span className="text-muted-foreground">—</span>),
    exportValue: (r) => (r.progress ?? []).map((p) => `${p.number ?? ''} ${p.progressPct}%`).join('; '),
  },
  { key: 'photos', header: 'Photos', className: 'text-right', cell: (r) => <span className="tabular-nums">{r.photoMediaIds?.length ?? 0}</span> },
  {
    key: 'createdBy', header: 'Filed by',
    cell: (r) => (
      <div className="text-xs">
        <p>{r.createdBy?.name ?? '—'}</p>
        <p className="text-muted-foreground">{formatDateTime(r.updatedAt)}</p>
      </div>
    ),
    exportValue: (r) => r.createdBy?.name ?? '',
  },
];

function Block({ icon: Icon, title, children }) {
  return (
    <section className="space-y-1.5">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {title}
      </h4>
      {children}
    </section>
  );
}

/** One day opened: who was on site by trade, the progress it marked, deliveries, problems, the note and the photos. */
function DayDetails({ day, media }) {
  return (
    <div className="grid gap-4 p-3 text-sm md:grid-cols-2" data-testid={`diary-details-${day.day}`}>
      <Block icon={Users} title="On site">
        {day.headcount?.length ? (
          <ul className="space-y-0.5">{day.headcount.map((h) => <li key={h.tradeId}>{h.tradeName ?? 'A trade'} × <span className="tabular-nums">{h.count}</span></li>)}</ul>
        ) : <p className="text-muted-foreground">Nobody counted.</p>}
      </Block>
      <Block icon={NotebookPen} title="Progress marked">
        {day.progress?.length ? (
          <ul className="space-y-0.5">
            {day.progress.map((p) => (
              <li key={p.jobLineId}><span className="font-mono text-xs">{p.number ?? '—'}</span> {p.description ?? ''} — <strong className="tabular-nums">{p.progressPct}%</strong></li>
            ))}
          </ul>
        ) : <p className="text-muted-foreground">No line marked this day.</p>}
      </Block>
      <Block icon={PackageOpen} title="Materials received">
        {day.received?.length ? (
          <ul className="space-y-0.5">
            {day.received.map((r, i) => (
              <li key={`${r.description}-${i}`}>
                {r.description} — <span className="tabular-nums">{qtyWithUnit(r.qty, r.unit)}</span>
                {r.challanNo ? <span className="text-muted-foreground"> · challan {r.challanNo}</span> : null}
              </li>
            ))}
          </ul>
        ) : <p className="text-muted-foreground">Nothing received.</p>}
      </Block>
      <Block icon={TriangleAlert} title="Problems and note">
        {day.issues ? <p className="whitespace-pre-wrap" lang="ne">{day.issues}</p> : <p className="text-muted-foreground">No problems written.</p>}
        {day.note ? <p className="whitespace-pre-wrap text-muted-foreground" lang="ne">{day.note}</p> : null}
        {Number(day.lostHours) > 0 ? (
          <p className="flex items-center gap-1.5 text-warning"><Hourglass className="h-3.5 w-3.5" aria-hidden /> {day.lostHours} h lost — {LOST_TIME_REASON_LABELS[day.lostReason] ?? day.lostReason}</p>
        ) : null}
      </Block>
      {day.photoMediaIds?.length ? (
        <div className="md:col-span-2">
          <Block icon={CloudUpload} title="Photos">
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {day.photoMediaIds.map((id, i) => {
                const m = media?.[id];
                const src = imageUrl(m, 400) ?? m?.url;
                return (
                  <li key={id} className="aspect-square overflow-hidden rounded-md border bg-muted">
                    {src ? (
                      <a href={m?.url ?? src} target="_blank" rel="noreferrer">
                        <img src={src} alt={`Site diary ${day.day}, photo ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Block>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The **Site diary** tab (Phase L7) — `GET /admin/jobs/:id/diary` (`jobs:read`): every day the foreman filed, newest
 * first — the weather, how many were on site, time lost and why, the progress marked, the photos and who filed it. A
 * row opens onto the day: headcount by trade, the lines marked, deliveries with the challan, problems, the note and the
 * pictures. Quantities and words only.
 */
export function JobDiaryTab({ job }) {
  const { data, isLoading, error, refetch } = useGetJobDiaryQuery(job.id);
  const [params, setParams] = useState({});
  if (isLoading) return <CardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const days = data?.days ?? [];

  return (
    <CustomTable
      columns={COLUMNS}
      data={days}
      meta={onePage(days)}
      params={params}
      onParamsChange={setParams}
      searchable={false}
      pageSizes={[]}
      exportable
      exportName={`${job.number}-site-diary`}
      getRowId={(r) => r.id ?? r.day}
      rowLabel={(r) => `Site diary ${r.day}`}
      expandable={{ render: (r) => <DayDetails day={r} media={data?.media ?? r.media} /> }}
      emptyTitle="No site diary yet"
      emptyDescription="The foreman files a page a day from the field app: weather, crew, progress, deliveries and lost time."
    />
  );
}
