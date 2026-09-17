import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Search, Upload, X } from 'lucide-react';
import {
  useCreateMediaFolderMutation, useDeleteMediaFolderMutation, useDeleteMediaMutation,
  useGetMediaFoldersQuery, useGetMediaListQuery, useUpdateMediaMutation,
} from '@/api/mediaApi';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/common/PageHeader';
import { MediaGrid, MediaPager } from '@/components/common/MediaPicker/MediaGrid';
import { MediaUpload } from '@/components/common/MediaPicker/MediaUpload';
import { MediaFolderTree } from '@/components/media/MediaFolderTree';
import { MediaDetailsSheet } from '@/components/media/MediaDetailsSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageTransition } from '@/three/motion/motionKit';
import { toastError, toastSuccess } from '@/redux/slices/uiSlice';
import { cn } from '@/helpers/utils';

const PAGE_SIZE = 30;
const messageOf = (err) => err?.data?.error?.message;

/**
 * `/admin/content/media` — the media library. A bespoke page rather than a registry entry:
 * media is a grid of files with folders and uploads, not a list of rows with a form.
 * The grid and the upload panel are the ones `MediaPicker` uses.
 *
 * Folder, search and page live in the URL. Dropping images anywhere on the page opens
 * the upload panel with them; each still needs its alt text before it is sent.
 */
export default function MediaLibraryPage() {
  const { can } = useAuth();
  const canWrite = can('media:write');
  const canPurge = can('cms:purge');
  const dispatch = useDispatch();
  const [confirm, confirmDialog] = useConfirm();
  const [params, setParams] = useListParams({ page: 1 });
  const [search, setSearch] = useState(params.q ?? '');
  const q = useDebouncedValue(search);
  const [openId, setOpenId] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [incoming, setIncoming] = useState(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const folderId = params.folder;
  const page = params.page ?? 1;
  const setParam = (patch) => setParams({ ...params, page: 1, ...patch });

  // The debounced search writes the URL once it settles.
  const urlQ = params.q;
  const paramsRef = useRef(params);
  paramsRef.current = params;
  useEffect(() => {
    if ((q || undefined) === urlQ) return;
    setParams({ ...paramsRef.current, page: 1, q: q || undefined });
  }, [q, urlQ, setParams]);

  const list = useGetMediaListQuery({
    page, limit: PAGE_SIZE, sort: '-createdAt',
    ...(params.q ? { q: params.q } : {}),
    ...(folderId ? { folderId } : {}),
  });
  const { data: folders = [] } = useGetMediaFoldersQuery();
  const [updateMedia] = useUpdateMediaMutation();
  const [deleteMedia] = useDeleteMediaMutation();
  const [createFolder] = useCreateMediaFolderMutation();
  const [deleteFolder] = useDeleteMediaFolderMutation();

  const items = list.data?.items ?? [];
  const open = items.find((m) => m.id === openId) ?? null;
  const currentFolder = folders.find((f) => f.id === folderId);

  const onDrop = (e) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!canWrite) return;
    const files = Array.from(e.dataTransfer.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    setIncoming({ id: Date.now(), files });
    setUploadOpen(true);
  };

  const dragProps = canWrite ? {
    onDragEnter: (e) => { if (e.dataTransfer.types?.includes('Files')) { dragDepth.current += 1; setDragging(true); } },
    onDragLeave: () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); },
    onDragOver: (e) => e.preventDefault(),
    onDrop,
  } : {};

  const onSave = async (body) => {
    await updateMedia({ id: open.id, ...body }).unwrap();
    dispatch(toastSuccess('Image saved'));
  };

  const onDeleteMedia = async ({ hard }) => {
    const ok = await confirm(hard ? {
      title: 'Delete this image for good?',
      description: 'The file and its resized versions are removed from the server. Pages still using it will show a gap. This cannot be undone.',
      confirmLabel: 'Delete forever',
      destructive: true,
    } : {
      title: 'Delete this image?',
      description: 'It leaves the library. Pages already using it keep showing it until you change them.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const id = open.id;
    setOpenId(null);
    try {
      await deleteMedia({ id, hard }).unwrap();
      dispatch(toastSuccess(hard ? 'Image deleted for good' : 'Image deleted'));
    } catch (err) {
      dispatch(toastError('Could not delete this image', messageOf(err)));
    }
  };

  const onCreateFolder = async (body) => {
    const folder = await createFolder(body).unwrap();
    dispatch(toastSuccess(`Folder “${folder.name}” created`));
    setParam({ folder: folder.id });
  };

  const onDeleteFolder = async (folder) => {
    const ok = await confirm({
      title: `Delete the folder “${folder.name}”?`,
      description: 'Only an empty folder can be deleted — move or delete its files and folders first.',
      confirmLabel: 'Delete folder',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteFolder(folder.id).unwrap();
      dispatch(toastSuccess('Folder deleted'));
      setParam({ folder: folder.parentId ?? undefined });
    } catch (err) {
      dispatch(toastError('The folder was not deleted', messageOf(err)));
    }
  };

  return (
    <PageTransition>
      <div {...dragProps} className="relative">
        <PageHeader
          title="Media library"
          description="Every image the site and the back office use. Resized WebP versions are made on upload."
          actions={canWrite ? (
            <Button type="button" variant={uploadOpen ? 'outline' : 'default'} onClick={() => setUploadOpen((v) => !v)}>
              {uploadOpen ? <><X aria-hidden /> Close upload</> : <><Upload aria-hidden /> Upload</>}
            </Button>
          ) : null}
        />

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="rounded-xl border bg-background p-3 lg:self-start">
            <MediaFolderTree
              folders={folders}
              selectedId={folderId}
              onSelect={(id) => setParam({ folder: id })}
              canWrite={canWrite}
              onCreate={onCreateFolder}
              onDelete={onDeleteFolder}
            />
          </aside>

          <section className="min-w-0 space-y-4" aria-label="Files">
            {uploadOpen ? (
              <div className="rounded-xl border bg-background p-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  Uploading to <span className="font-medium text-foreground">{currentFolder?.name ?? 'no folder'}</span>.
                </p>
                <MediaUpload folderId={folderId} incoming={incoming} doneLabel="Uploaded" onUploaded={() => {}} />
              </div>
            ) : null}

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search alt text, caption or file name…"
                className="pl-9"
                aria-label="Search the media library"
              />
            </div>

            <MediaGrid
              items={items}
              isLoading={list.isLoading}
              isFetching={list.isFetching}
              error={list.error}
              refetch={list.refetch}
              onSelect={(media) => setOpenId(media.id)}
              emptyTitle={params.q || folderId ? 'No images here' : 'The library is empty'}
              emptyDescription={canWrite ? 'Drop images on this page, or use Upload.' : undefined}
              className="md:grid-cols-5 xl:grid-cols-6"
            />
            <MediaPager page={page} pages={list.data?.meta?.pages ?? 1} onPageChange={(next) => setParams({ ...params, page: next })} />
          </section>
        </div>

        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-primary/5 text-sm font-medium text-primary transition-opacity',
            dragging ? 'opacity-100' : 'opacity-0',
          )}
        >
          Drop images to upload them{currentFolder ? ` to “${currentFolder.name}”` : ''}
        </div>
      </div>

      <MediaDetailsSheet
        media={open}
        folders={folders}
        canWrite={canWrite}
        canPurge={canPurge}
        onClose={() => setOpenId(null)}
        onSave={onSave}
        onDelete={onDeleteMedia}
      />
      {confirmDialog}
    </PageTransition>
  );
}
