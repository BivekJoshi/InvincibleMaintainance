import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, UploadCloud, X } from 'lucide-react';
import { useUploadMediaMutation } from '@/api/mediaApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/helpers/utils';

/**
 * Upload tab of the media picker. Every picture needs alt text before it is sent —
 * a screen reader, a slow connection and a search engine all read it — so a file
 * waits here until it has one. Files go one per request, each with its own alt.
 *
 * @param {object} props
 * @param {string} [props.folderId]                   folder new uploads go into
 * @param {(media: object) => void} props.onUploaded  called with each stored media row
 */
export function MediaUpload({ folderId, onUploaded }) {
  const [items, setItems] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [upload] = useUploadMediaMutation();
  const inputRef = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Object URLs hold the file in memory until revoked.
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  const add = (files) => {
    const images = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
    setItems((prev) => [...prev, ...images.map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
      alt: '',
      status: 'ready',
      error: null,
    }))]);
  };

  const patch = (key, next) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...next } : i)));

  const remove = (item) => {
    URL.revokeObjectURL(item.preview);
    setItems((prev) => prev.filter((i) => i.key !== item.key));
  };

  const send = async (key) => {
    const item = itemsRef.current.find((i) => i.key === key);
    if (!item || item.status !== 'ready') return;
    if (!item.alt.trim()) {
      patch(key, { error: 'Describe the picture before uploading it.' });
      return;
    }
    patch(key, { status: 'uploading', error: null });
    try {
      const [media] = await upload({ file: item.file, alt: item.alt.trim(), folderId }).unwrap();
      patch(key, { status: 'done', media });
      onUploaded(media);
    } catch (err) {
      patch(key, { status: 'ready', error: err?.data?.error?.message ?? 'The upload failed. Please try again.' });
    }
  };

  const waiting = items.filter((i) => i.status === 'ready');
  const allDescribed = waiting.length > 0 && waiting.every((i) => i.alt.trim());

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
        )}
      >
        <UploadCloud className="h-6 w-6 text-muted-foreground" aria-hidden />
        <span className="text-sm font-medium">Drop images here, or choose files</span>
        <span className="text-xs text-muted-foreground">JPEG, PNG, WebP or AVIF. Resized versions are made automatically.</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => { add(e.target.files); e.target.value = ''; }}
        />
      </label>

      {items.length ? (
        <ul className="space-y-3">
          {items.map((item) => {
            const altId = `alt-${item.key}`;
            return (
              <li key={item.key} className="flex gap-3 rounded-lg border p-3">
                <img src={item.preview} alt="" className="h-16 w-20 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="truncate text-xs text-muted-foreground">{item.file.name}</p>
                  {item.status === 'done' ? (
                    <p className="flex items-center gap-1.5 text-sm text-success">
                      <CheckCircle2 className="h-4 w-4" aria-hidden /> Uploaded and selected
                    </p>
                  ) : (
                    <>
                      <Label htmlFor={altId} required>Alt text</Label>
                      <div className="flex gap-2">
                        <Input
                          id={altId}
                          value={item.alt}
                          maxLength={300}
                          placeholder="What does the picture show?"
                          disabled={item.status === 'uploading'}
                          aria-invalid={item.error ? true : undefined}
                          aria-describedby={item.error ? `${altId}-error` : undefined}
                          onChange={(e) => patch(item.key, { alt: e.target.value, error: null })}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(item.key); } }}
                        />
                        <Button type="button" size="sm" className="h-9" loading={item.status === 'uploading'} disabled={!item.alt.trim()} onClick={() => send(item.key)}>
                          Upload
                        </Button>
                      </div>
                      {item.error ? <p id={`${altId}-error`} className="text-xs font-medium text-destructive">{item.error}</p> : null}
                    </>
                  )}
                </div>
                {item.status !== 'uploading' ? (
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(item)} aria-label={`Remove ${item.file.name}`}>
                    <X aria-hidden />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {waiting.length > 1 ? (
        <div className="flex justify-end">
          <Button type="button" disabled={!allDescribed} onClick={async () => { for (const i of waiting) await send(i.key); }}>
            Upload all {waiting.length}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
