import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PhotoCapture } from '@/components/tech/PhotoCapture';
import { FIELD_PHOTO_KINDS, defaultPhotoKind } from '@/helpers/fieldJob';

/** Before, during, after and problems found — taken with the camera, queued, uploaded when there is signal. */
export function PhotosSection({ job, copy, readOnly }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{copy.photos.title}</CardTitle></CardHeader>
      <CardContent className="pb-4">
        <PhotoCapture
          target="job"
          targetId={job.id}
          kinds={FIELD_PHOTO_KINDS}
          defaultKind={defaultPhotoKind(job.status)}
          photos={job.photos ?? []}
          media={job.media}
          readOnly={readOnly}
          copy={copy}
        />
      </CardContent>
    </Card>
  );
}
