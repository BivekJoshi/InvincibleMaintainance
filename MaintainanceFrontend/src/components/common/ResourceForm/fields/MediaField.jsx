import { useState } from 'react';
import { useController } from 'react-hook-form';
import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaPicker } from '@/components/common/MediaPicker/MediaPicker';
import { MediaThumb } from '@/components/common/MediaPicker/MediaThumb';
import { useGetMediaQuery } from '@/api/mediaApi';
import { FormField } from '../FormField';

/** `{ type: 'media' }` — one image, by media id, chosen or uploaded through `MediaPicker`. */
export function MediaField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const [open, setOpen] = useState(false);
  const { data: media } = useGetMediaQuery(input.value, { skip: !input.value });

  return (
    <FormField id={id} field={field} error={fieldState.error} as="fieldset">
      {() => (
        <div className="flex items-center gap-4">
          <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md border">
            {input.value ? <MediaThumb media={media} /> : (
              <div className="grid h-full w-full place-items-center bg-muted text-muted-foreground">
                <ImagePlus className="h-5 w-5" aria-hidden />
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button ref={input.ref} type="button" variant="outline" size="sm" disabled={field.disabled} onClick={() => setOpen(true)}>
                {input.value ? 'Replace' : 'Choose image'}
              </Button>
              {input.value && !field.disabled ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => { input.onChange(undefined); input.onBlur(); }}>Remove</Button>
              ) : null}
            </div>
            {media?.alt ? <p className="truncate text-xs text-muted-foreground">Alt text: {media.alt}</p> : null}
          </div>
          <MediaPicker
            open={open}
            onOpenChange={setOpen}
            selected={input.value ? [input.value] : []}
            onSelect={(ids) => { input.onChange(ids[0]); input.onBlur(); }}
          />
        </div>
      )}
    </FormField>
  );
}
