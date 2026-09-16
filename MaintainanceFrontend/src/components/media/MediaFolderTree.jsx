import { useMemo, useState } from 'react';
import { Folder, FolderOpen, FolderPlus, Images, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/helpers/utils';
import { flattenFolderTree } from '@/helpers/mediaFolders';

/**
 * The library's left column: "All files", then every folder, indented. With write
 * access it also creates a folder (inside the selected one) and deletes the selected
 * folder — the API refuses a folder that still holds files or folders.
 *
 * @param {object} props
 * @param {object[]} props.folders
 * @param {string|undefined} props.selectedId
 * @param {(id: string|undefined) => void} props.onSelect
 * @param {boolean} props.canWrite
 * @param {(input: { name: string, parentId: string|null }) => Promise<unknown>} props.onCreate
 * @param {(folder: object) => void} props.onDelete
 */
export function MediaFolderTree({ folders, selectedId, onSelect, canWrite, onCreate, onDelete }) {
  const rows = useMemo(() => flattenFolderTree(folders), [folders]);
  const selected = folders.find((f) => f.id === selectedId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Give the folder a name.'); return; }
    setSaving(true);
    try {
      await onCreate({ name: name.trim(), parentId: selectedId ?? null });
      setName('');
      setAdding(false);
      setError(null);
    } catch (err) {
      setError(err?.data?.error?.details?.[0]?.message ?? err?.data?.error?.message ?? 'The folder was not created.');
    } finally {
      setSaving(false);
    }
  };

  const item = (key, label, icon, active, onClick, depth = 0) => {
    const Icon = icon;
    return (
      <li key={key}>
        <button
          type="button"
          onClick={onClick}
          aria-current={active ? 'true' : undefined}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
            active ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted',
          )}
          style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </button>
      </li>
    );
  };

  return (
    <nav aria-label="Folders" className="space-y-3">
      <ul className="space-y-0.5">
        {item('all', 'All files', Images, !selectedId, () => onSelect(undefined))}
        {rows.map(({ folder, depth }) => item(
          folder.id, folder.name, folder.id === selectedId ? FolderOpen : Folder,
          folder.id === selectedId, () => onSelect(folder.id), depth,
        ))}
      </ul>

      {canWrite ? (
        <div className="space-y-2 border-t pt-3">
          {adding ? (
            <form onSubmit={create} className="space-y-2">
              <Input
                autoFocus
                value={name}
                maxLength={80}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                placeholder={selected ? `New folder in ${selected.name}` : 'New folder'}
                aria-label="Folder name"
                aria-invalid={error ? true : undefined}
              />
              {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={saving}>Create</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setError(null); setName(''); }}>Cancel</Button>
              </div>
            </form>
          ) : (
            <Button type="button" variant="outline" size="sm" className="w-full justify-start" onClick={() => setAdding(true)}>
              <FolderPlus aria-hidden /> New folder
            </Button>
          )}
          {selected ? (
            <Button type="button" variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={() => onDelete(selected)}>
              <Trash2 aria-hidden /> Delete “{selected.name}”
            </Button>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
