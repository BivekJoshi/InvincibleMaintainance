import { useEffect, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { useGetMediaFoldersQuery, useGetMediaListQuery } from '@/api/mediaApi';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { MediaGrid, MediaPager } from './MediaGrid';
import { MediaUpload } from './MediaUpload';

const ALL = '__all';
const PAGE_SIZE = 24;

/**
 * Chooses images from the media library, or uploads new ones, and hands back ids.
 *
 * The library tab searches alt text, caption and file path, filters by folder and
 * pages 24 at a time. The upload tab (only for `media:write`) requires alt text per
 * picture; a finished upload is selected automatically.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {boolean} [props.multiple]
 * @param {string[]} [props.selected]  ids already chosen, pre-selected on open
 * @param {(ids: string[], rows: object[]) => void} props.onSelect  in the order they were picked;
 *   a pre-selected row the grid never loaded comes back as `{ id }` only
 * @param {string} [props.title]
 */
export function MediaPicker({ open, onOpenChange, multiple = false, selected = [], onSelect, title }) {
  const { can } = useAuth();
  const [tab, setTab] = useState('library');
  const [q, setQ] = useState('');
  const [folderId, setFolderId] = useState(ALL);
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState([]);
  const debouncedQ = useDebouncedValue(q);
  const selectedKey = selected.join(',');

  useEffect(() => {
    if (!open) return;
    setPicked(selectedKey ? selectedKey.split(',').map((id) => ({ id })) : []);
    setTab('library');
  }, [open, selectedKey]);

  useEffect(() => { setPage(1); }, [debouncedQ, folderId]);

  const { data, isLoading, isFetching, error, refetch } = useGetMediaListQuery({
    page,
    limit: PAGE_SIZE,
    sort: '-createdAt',
    ...(debouncedQ ? { q: debouncedQ } : {}),
    ...(folderId !== ALL ? { folderId } : {}),
  }, { skip: !open });
  const { data: folders = [] } = useGetMediaFoldersQuery(undefined, { skip: !open });

  const items = data?.items ?? [];
  const pages = data?.meta?.pages ?? 1;
  const isPicked = (id) => picked.some((p) => p.id === id);

  const toggle = (media) => setPicked((prev) => {
    if (!multiple) return prev[0]?.id === media.id ? [] : [media];
    return prev.some((p) => p.id === media.id) ? prev.filter((p) => p.id !== media.id) : [...prev, media];
  });

  const onUploaded = (media) => setPicked((prev) => (multiple ? [...prev.filter((p) => p.id !== media.id), media] : [media]));

  const choose = () => {
    onSelect(picked.map((p) => p.id), picked);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-4xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{title ?? (multiple ? 'Choose images' : 'Choose an image')}</DialogTitle>
          <DialogDescription>
            Pick from the library{can('media:write') ? ', or upload something new' : ''}.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="library">Library</TabsTrigger>
            {can('media:write') ? <TabsTrigger value="upload">Upload</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="library" className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search alt text, caption or file name…" className="pl-9" aria-label="Search the media library" />
              </div>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger className="sm:w-[200px]" aria-label="Folder"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All folders</SelectItem>
                  {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <MediaGrid
              items={items}
              isLoading={isLoading}
              isFetching={isFetching}
              error={error}
              refetch={refetch}
              onSelect={toggle}
              onDoubleSelect={multiple ? undefined : (media) => { onSelect([media.id], [media]); onOpenChange(false); }}
              isSelected={(media) => isPicked(media.id)}
              badge={(media) => (isPicked(media.id) ? (
                <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
              ) : null)}
              emptyTitle={debouncedQ || folderId !== ALL ? 'No images match' : 'The library is empty'}
              emptyDescription={can('media:write') ? 'Upload one from the Upload tab.' : undefined}
            />

            <MediaPager page={page} pages={pages} onPageChange={setPage} />
          </TabsContent>

          {can('media:write') ? (
            <TabsContent value="upload" className="min-h-0 flex-1 overflow-y-auto">
              <MediaUpload folderId={folderId !== ALL ? folderId : undefined} onUploaded={onUploaded} />
            </TabsContent>
          ) : null}
        </Tabs>

        <DialogFooter className="items-center border-t pt-4">
          <p className="mr-auto text-sm text-muted-foreground">{picked.length} selected</p>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={!picked.length} onClick={choose}>
            {multiple ? `Use ${picked.length || ''} image${picked.length === 1 ? '' : 's'}`.replace('  ', ' ') : 'Use image'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
