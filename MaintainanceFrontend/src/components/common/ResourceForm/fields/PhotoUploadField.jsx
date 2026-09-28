import { useRef, useState } from 'react';
import { useController, useWatch } from 'react-hook-form';
import { Camera, ImageOff, Loader2 } from 'lucide-react';
import { useUploadPhotoToMutation } from '@/api/mediaApi';
import { Button } from '@/components/ui/button';
import { compressImage } from '@/helpers/compressImage';
import { FormField } from '../FormField';
import { useFormMode } from '../formMode';

/** What a phone or a laptop may hand over; a HEIC is re-encoded to JPEG by `compressImage` before it is sent. */
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/*';

/**
 * `{ type: 'photoUpload', upload, savedFrom?, addLabel? }` — **one photo, uploaded straight to an endpoint of the
 * form's own** (Phase I: an expense's bill, `upload: '/admin/expenses/bill'`), for a role that may not browse the media
 * library — so no MediaPicker. The value is the media id the endpoint answers (`POST`, multipart `files`, 201 with the
 * media object); send it `nullable` so Remove clears it.
 *
 * Choose or take a photo (a phone offers its camera), it is shrunk on the device (`helpers/compressImage` — 1600 px,
 * JPEG) and uploaded at once, and its thumbnail shows; Replace and Remove follow. A saved record's picture is read
 * from the record's `savedFrom` key (an expense's `bill: { url, thumb }`), so an edit form shows it without a lookup.
 * A failed upload says why under the field and leaves the value as it was.
 */
export function PhotoUploadField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const saved = useWatch({ name: field.savedFrom ?? '__none' });
  const { readOnly: formReadOnly } = useFormMode();
  const [upload, { isLoading: uploading }] = useUploadPhotoToMutation();
  const [uploaded, setUploaded] = useState(null); // the media object this form uploaded
  const [failure, setFailure] = useState(null);
  const fileRef = useRef(null);
  const disabled = Boolean(field.disabled || formReadOnly);
  const value = input.value || null;
  const picture = value ? (uploaded?.id === value ? uploaded : saved) : null;
  const src = picture?.thumb ?? picture?.variants?.['400'] ?? picture?.url ?? null;

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFailure(null);
    let small = file;
    try {
      small = await compressImage(file);
    } catch {
      small = file;
    }
    try {
      const media = await upload({ path: field.upload, file: small }).unwrap();
      if (!media?.id) throw new Error('The server did not return the photo.');
      setUploaded(media);
      input.onChange(media.id);
      input.onBlur();
    } catch (err) {
      setFailure(err?.data?.error?.message ?? err?.message ?? 'The photo did not upload. Try again.');
    }
  };

  const remove = () => {
    setUploaded(null);
    setFailure(null);
    input.onChange(null);
    input.onBlur();
  };

  return (
    <FormField id={id} field={field} error={fieldState.error ?? (failure ? { message: failure } : undefined)} as="fieldset">
      {(control) => (
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted" data-testid={`${field.name}-preview`}>
            {uploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Uploading" /> : src ? (
              <a href={picture.url ?? src} target="_blank" rel="noreferrer" className="h-full w-full" aria-label={`Open the ${field.label?.toLowerCase() ?? 'photo'}`}>
                <img src={src} alt="" className="h-full w-full object-cover" />
              </a>
            ) : value ? <ImageOff className="h-5 w-5 text-muted-foreground" aria-label="Saved photo" /> : (
              <Camera className="h-5 w-5 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-label={`${field.label ?? 'Photo'}: choose or take a photo`}
              onChange={onFile}
              disabled={disabled || uploading}
            />
            {disabled ? null : (
              <div className="flex flex-wrap gap-2">
                <Button
                  ref={input.ref}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-describedby={control['aria-describedby']}
                  loading={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera aria-hidden /> {value ? 'Replace photo' : field.addLabel ?? 'Choose or take a photo'}
                </Button>
                {value ? <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={uploading}>Remove</Button> : null}
              </div>
            )}
            {uploading ? <p className="text-xs text-muted-foreground" role="status">Uploading…</p> : null}
          </div>
        </div>
      )}
    </FormField>
  );
}
