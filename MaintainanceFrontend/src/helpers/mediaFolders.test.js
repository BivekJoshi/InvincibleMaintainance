import { describe, it, expect } from 'vitest';
import { flattenFolderTree } from '@/helpers/mediaFolders';

const rows = (tree) => tree.map(({ folder, depth }) => `${'-'.repeat(depth)}${folder.name}`);

describe('flattenFolderTree', () => {
  it('nests children under their parent, each level sorted by name', () => {
    const folders = [
      { id: 'b', name: 'Projects', parentId: null },
      { id: 'a', name: 'Home page', parentId: null },
      { id: 'c', name: 'Thamel kitchen', parentId: 'b' },
      { id: 'd', name: 'Bhaktapur roof', parentId: 'b' },
      { id: 'e', name: 'भित्तो', parentId: 'd' },
    ];
    expect(rows(flattenFolderTree(folders))).toEqual([
      'Home page', 'Projects', '-Bhaktapur roof', '--भित्तो', '-Thamel kitchen',
    ]);
  });

  it('shows a folder whose parent is gone at the top level, and survives a loop', () => {
    const folders = [
      { id: 'x', name: 'Orphan', parentId: 'missing' },
      { id: 'p', name: 'Loop A', parentId: 'q' },
      { id: 'q', name: 'Loop B', parentId: 'p' },
    ];
    expect(rows(flattenFolderTree(folders))).toEqual(['Orphan']);
  });
});
