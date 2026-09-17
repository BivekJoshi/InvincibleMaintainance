import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Pin, PinOff, Search, StickyNote, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useCreateNoteMutation, useDeleteNoteMutation, useGetNotesQuery, useUpdateNoteMutation,
} from '@/api/meApi';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ErrorState } from '@/components/common/ErrorState';
import { Kbd } from '@/components/common/Kbd';
import { MOD_KEY } from '@/helpers/keys';
import { useConfirm } from '@/hooks/useConfirm';
import { NOTE_STYLES, noteStyle } from '@/config/admin/shortcuts';
import { NOTE_COLORS, noteSchema } from '@/form/schemas/me.schema';
import { selectNotesOpen, setNotesOpen, toastError } from '@/redux/slices/uiSlice';
import { relativeTime } from '@/helpers/format';
import { cn } from '@/helpers/utils';

const EASE = [0.16, 1, 0.3, 1];
const apiMessage = (err) => err?.data?.error?.message ?? 'Please try again.';

function ColorSwatches({ value, onChange, label = 'Note colour' }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1.5">
      {NOTE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={NOTE_STYLES[color].label}
          onClick={() => onChange(color)}
          className={cn(
            'h-5 w-5 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110',
            NOTE_STYLES[color].swatch,
            value === color && 'ring-2 ring-foreground',
          )}
        />
      ))}
    </div>
  );
}

/** One sticky note. Click the text to edit it; it saves when you leave the box. */
function NoteCard({ note, onDelete }) {
  const dispatch = useDispatch();
  const [update] = useUpdateNoteMutation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const style = noteStyle(note.color);

  useEffect(() => { if (!editing) setDraft(note.body); }, [note.body, editing]);

  const patch = (changes, what) => update({ id: note.id, ...changes }).unwrap()
    .catch((err) => dispatch(toastError(what, apiMessage(err))));

  const finish = () => {
    setEditing(false);
    const body = draft.trim();
    if (!body) { setDraft(note.body); return; }
    if (body !== note.body) patch({ body }, 'Could not save the note');
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.22, ease: EASE }}
      className={cn('group relative rounded-lg border-l-4 p-3 shadow-card', style.paper)}
    >
      {editing ? (
        <Textarea
          autoFocus
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={finish}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.stopPropagation(); setDraft(note.body); setEditing(false); }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.blur();
          }}
          aria-label="Edit note"
          className="min-h-24 border-none bg-background/60"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="block w-full whitespace-pre-wrap break-words text-left text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Edit note: ${note.body.slice(0, 60)}`}
        >
          {note.body}
        </button>
      )}
      <div className="mt-2 flex items-center gap-1">
        <span className="text-[11px] text-muted-foreground" title={new Date(note.updatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })}>
          {relativeTime(note.updatedAt)}
        </span>
        <div className="ml-auto flex items-center gap-1 opacity-100 transition-opacity focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          <ColorSwatches value={note.color} onChange={(color) => patch({ color }, 'Could not recolour the note')} label="Change colour" />
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            aria-label={note.isPinned ? 'Unpin note' : 'Pin note to the top'}
            onClick={() => patch({ isPinned: !note.isPinned }, 'Could not pin the note')}
          >
            {note.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive"
            aria-label="Delete note"
            onClick={() => onDelete(note)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {note.isPinned ? (
        <Pin className="absolute -right-1.5 -top-1.5 h-4 w-4 rotate-45 fill-destructive text-destructive" aria-label="Pinned" />
      ) : null}
    </motion.li>
  );
}

/**
 * The notes drawer: quick, private sticky notes for the signed-in user — a phone number to
 * call back, a reminder for tomorrow's dispatch. Pinned notes stay on top.
 */
export function NotesSheet() {
  const dispatch = useDispatch();
  const open = useSelector(selectNotesOpen);
  const { data, isLoading, error, refetch } = useGetNotesQuery();
  const [create, { isLoading: saving }] = useCreateNoteMutation();
  const [remove] = useDeleteNoteMutation();
  const [confirm, confirmDialog] = useConfirm();
  const [body, setBody] = useState('');
  const [color, setColor] = useState('yellow');
  const [formError, setFormError] = useState(null);
  const [query, setQuery] = useState('');
  const composer = useRef(null);

  const notes = useMemo(() => data?.items ?? [], [data]);
  const max = data?.max ?? 100;
  const needle = query.trim().toLowerCase();
  const shown = useMemo(
    () => (needle ? notes.filter((n) => n.body.toLowerCase().includes(needle)) : notes),
    [notes, needle],
  );

  const add = async (e) => {
    e?.preventDefault();
    const parsed = noteSchema.safeParse({ body, color });
    if (!parsed.success) { setFormError(parsed.error.issues[0].message); return; }
    try {
      await create(parsed.data).unwrap();
      setBody('');
      setFormError(null);
      composer.current?.focus();
    } catch (err) {
      setFormError(apiMessage(err));
    }
  };

  const onDelete = async (note) => {
    if (await confirm({ title: 'Delete this note?', description: note.body.slice(0, 120), confirmLabel: 'Delete', destructive: true })) {
      remove(note.id).unwrap().catch((err) => dispatch(toastError('Could not delete the note', apiMessage(err))));
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => dispatch(setNotesOpen(next))}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        onOpenAutoFocus={(e) => { e.preventDefault(); composer.current?.focus(); }}
      >
        <SheetHeader className="border-b p-5 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/15 text-gold"><StickyNote className="h-4 w-4" /></span>
            My notes
          </SheetTitle>
          <SheetDescription>Only you can see these. They follow you to any device you sign in on.</SheetDescription>
        </SheetHeader>

        <form onSubmit={add} className="space-y-2 border-b p-5" noValidate>
          <div className={cn('rounded-lg border-l-4 p-1 transition-colors', noteStyle(color).paper)}>
            <Textarea
              ref={composer}
              value={body}
              maxLength={2000}
              onChange={(e) => { setBody(e.target.value); setFormError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(e); }}
              placeholder="Jot something down… (नेपालीमा पनि लेख्न सकिन्छ)"
              aria-label="New note"
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? 'note-error' : undefined}
              className="min-h-20 resize-none border-none bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
          {formError ? <p id="note-error" className="text-xs font-medium text-destructive">{formError}</p> : null}
          <div className="flex items-center gap-3">
            <ColorSwatches value={color} onChange={setColor} />
            <span className="ml-auto hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
              <Kbd>{MOD_KEY}</Kbd><Kbd>↵</Kbd>
            </span>
            <Button type="submit" size="sm" disabled={saving || notes.length >= max}>Add note</Button>
          </div>
        </form>

        <div className="flex min-h-0 flex-1 flex-col">
          {notes.length > 4 ? (
            <label className="mx-5 mt-4 flex items-center gap-2 rounded-lg border px-2.5 focus-within:ring-2 focus-within:ring-ring">
              <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <input
                type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes" aria-label="Search notes"
                className="h-8 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
          ) : null}
          <div className="flex-1 overflow-y-auto p-5">
            {isLoading ? (
              <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : error ? (
              <ErrorState error={error} onRetry={refetch} />
            ) : shown.length ? (
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {shown.map((note) => <NoteCard key={note.id} note={note} onDelete={onDelete} />)}
                </AnimatePresence>
              </ul>
            ) : (
              <div className="grid place-items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <StickyNote className="h-8 w-8 text-gold/60" aria-hidden />
                {needle ? `No note mentions “${query.trim()}”.` : 'No notes yet. Write your first one above.'}
              </div>
            )}
          </div>
          {notes.length ? (
            <p className="border-t px-5 py-2 text-[11px] text-muted-foreground">{notes.length} of {max} notes</p>
          ) : null}
        </div>
        {confirmDialog}
      </SheetContent>
    </Sheet>
  );
}
