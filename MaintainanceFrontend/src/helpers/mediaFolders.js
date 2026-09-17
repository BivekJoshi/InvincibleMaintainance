/**
 * Folders as a tree, from the flat `{ id, name, parentId }` rows the API lists. A folder
 * whose parent is missing is shown at the top level rather than lost.
 *
 * @param {object[]} folders
 * @returns {{ folder: object, depth: number }[]} in display order
 */
export function flattenFolderTree(folders) {
  const ids = new Set(folders.map((f) => f.id));
  const byParent = new Map();
  for (const f of folders) {
    const parent = f.parentId && ids.has(f.parentId) ? f.parentId : null;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(f);
  }
  const out = [];
  const walk = (parent, depth, seen) => {
    const children = (byParent.get(parent) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const folder of children) {
      if (seen.has(folder.id)) continue;
      out.push({ folder, depth });
      walk(folder.id, depth + 1, new Set([...seen, folder.id]));
    }
  };
  walk(null, 0, new Set());
  return out;
}
