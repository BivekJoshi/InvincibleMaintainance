import { PhotoCapture } from '@/components/tech/PhotoCapture';
import { SURVEY_PHOTO_KINDS } from '@/config/constants';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';

/**
 * Step 5 — photos of what was found, through the field app's upload queue (H2): the kind (a problem found, or
 * a photo of a paper **sketch**), the room it was taken in (suggesting the rooms measured) and a caption. The
 * photos already on the server are shown with their room.
 *
 * @param {{ survey: object, areas: string[], readOnly: boolean }} props
 */
export function PhotosStep({ survey, areas, readOnly }) {
  const t = useT(FIELD);
  const known = new Set(areas);
  for (const p of survey.job?.photos ?? []) if (p.area) known.add(p.area);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('survey.photos.body')}</p>
      <PhotoCapture
        target="survey"
        targetId={survey.id}
        kinds={SURVEY_PHOTO_KINDS}
        areas={[...known]}
        photos={survey.job?.photos}
        media={survey.media}
        readOnly={readOnly}
      />
    </div>
  );
}
