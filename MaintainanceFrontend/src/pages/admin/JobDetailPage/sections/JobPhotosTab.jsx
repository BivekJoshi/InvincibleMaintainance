import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useAddJobPhotoMutation, useDeleteJobPhotoMutation } from '@/api/jobsApi';
import { MediaPicker } from '@/components/common/MediaPicker/MediaPicker';
import { EmptyState } from '@/components/common/EmptyState';
import { MediaCell } from '@/components/media/MediaCell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/hooks/useConfirm';
import { JOB_PHOTO_KINDS, JOB_PHOTO_KIND_LABELS } from '@/config/constants';
import { formatDateTime } from '@/helpers/format';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';

/** The kinds the office files photos under; a signature is taken at completion. */
const UPLOAD_KINDS = JOB_PHOTO_KINDS.filter((k) => k !== 'SIGNATURE');

/**
 * Photos grouped by kind — before, during, after, issues found (and the signature, when there is
 * one). The office adds from the library or uploads (alt text required), filed under the kind
 * chosen first. The case study takes its pictures from Before and After.
 */
export function JobPhotosTab({ job, canWrite }) {
  const dispatch = useDispatch();
  const [kind, setKind] = useState('BEFORE');
  const [picking, setPicking] = useState(false);
  const [addPhoto] = useAddJobPhotoMutation();
  const [deletePhoto] = useDeleteJobPhotoMutation();
  const [confirm, confirmDialog] = useConfirm();
  const photos = job.photos ?? [];
  const editable = canWrite && job.status !== 'CANCELLED';

  const add = async (ids) => {
    setPicking(false);
    const results = await Promise.allSettled(ids.map((mediaId) => addPhoto({ id: job.id, mediaId, kind }).unwrap()));
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) dispatch(toastError(`${failed.length} photo(s) were not added`, failed[0].reason?.data?.error?.message));
    const added = results.length - failed.length;
    if (added) dispatch(toastSuccess(`${added} photo${added === 1 ? '' : 's'} added under ${JOB_PHOTO_KIND_LABELS[kind]}`));
  };

  const remove = async (photo) => {
    const ok = await confirm({
      title: 'Take this photo off the job?',
      description: 'The picture stays in the media library.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePhoto({ id: job.id, photoId: photo.id }).unwrap();
      dispatch(toastSuccess('Photo removed'));
    } catch (err) {
      dispatch(toastError('Could not remove the photo', err?.data?.error?.message));
    }
  };

  return (
    <div className="space-y-5">
      {editable ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="photo-kind">File new photos under</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger id="photo-kind" className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UPLOAD_KINDS.map((k) => <SelectItem key={k} value={k}>{JOB_PHOTO_KIND_LABELS[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setPicking(true)}><ImagePlus /> Add photos</Button>
        </div>
      ) : null}

      {photos.length ? JOB_PHOTO_KINDS.map((k) => {
        const group = photos.filter((p) => p.kind === k);
        if (!group.length) return null;
        return (
          <section key={k} aria-labelledby={`photos-${k}`} className="space-y-2">
            <h3 id={`photos-${k}`} className="text-sm font-semibold">{JOB_PHOTO_KIND_LABELS[k]} <span className="font-normal text-muted-foreground">({group.length})</span></h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.map((p) => (
                <li key={p.id} className="space-y-1">
                  <MediaCell id={p.mediaId} className="aspect-[4/3] w-full" />
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-xs text-muted-foreground">
                      {p.caption ? <span className="block truncate text-foreground">{p.caption}</span> : null}
                      {formatDateTime(p.createdAt)}
                    </p>
                    {editable ? (
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => remove(p)} aria-label={`Remove ${JOB_PHOTO_KIND_LABELS[k].toLowerCase()} photo`}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      }) : (
        <EmptyState title="No photos yet" description="The technician adds them from the field app; the office can add them here too." />
      )}

      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        multiple
        title={`Add photos — ${JOB_PHOTO_KIND_LABELS[kind]}`}
        onSelect={(ids) => add(ids)}
      />
      {confirmDialog}
    </div>
  );
}
