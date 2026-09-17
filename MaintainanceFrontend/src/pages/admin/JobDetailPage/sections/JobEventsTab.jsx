import { ArrowRight, MapPin } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/ui/badge';
import { Stagger } from '@/three/motion/motionKit';
import { JOB_STATUS_LABELS } from '@/config/constants';
import { formatDateTime } from '@/helpers/format';

const mapAt = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/**
 * The job's own status timeline (JobStatusEvent), newest first: each move, who made it, the note,
 * and where the technician was when the field app sent a location. History (the audit trail) is
 * the tab beside it.
 */
export function JobEventsTab({ job }) {
  const events = job.events ?? [];
  if (!events.length) return <EmptyState title="Nothing has happened yet" />;
  return (
    <Stagger as="ol" className="space-y-3">
      {events.map((e) => (
        <Stagger.Item key={e.id} as="li" className="flex gap-3 rounded-md border p-3 text-sm">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex flex-wrap items-center gap-1.5">
              {e.from && e.from !== e.to ? (
                <>
                  <StatusBadge status={e.from} label={JOB_STATUS_LABELS[e.from]} />
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-label="to" />
                </>
              ) : null}
              <StatusBadge status={e.to} label={JOB_STATUS_LABELS[e.to]} />
            </p>
            {e.note ? <p className="whitespace-pre-wrap break-words">{e.note}</p> : null}
            <p className="text-xs text-muted-foreground">
              {formatDateTime(e.createdAt)} · {e.actor?.name ?? 'System'}
            </p>
          </div>
          {e.lat != null && e.lng != null ? (
            <a
              href={mapAt(e.lat, e.lng)} target="_blank" rel="noopener noreferrer"
              className="inline-flex shrink-0 items-start gap-1 text-xs text-primary hover:underline"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {e.lat.toFixed(4)}, {e.lng.toFixed(4)}
            </a>
          ) : null}
        </Stagger.Item>
      ))}
    </Stagger>
  );
}
