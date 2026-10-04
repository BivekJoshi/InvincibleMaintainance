import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PhotoCapture } from '@/components/tech/PhotoCapture';
import { FIELD_PHOTO_KINDS, defaultPhotoKind } from '@/helpers/fieldJob';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';

/** Before, during, after and problems found — taken with the camera, queued, uploaded when there is signal. */
export function PhotosSection({ job, readOnly }) {
  const t = useT(FIELD);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{t('photos.title')}</CardTitle></CardHeader>
      <CardContent className="pb-4">
        <PhotoCapture
          target="job"
          targetId={job.id}
          kinds={FIELD_PHOTO_KINDS}
          defaultKind={defaultPhotoKind(job.status)}
          photos={job.photos ?? []}
          media={job.media}
          readOnly={readOnly}
        />
      </CardContent>
    </Card>
  );
}
