/** Reading a caught render error: what kind it is, and where it came from. Used by `ErrorFallback`. */

/**
 * A lazy route whose chunk is gone — the usual cause is a deploy while the tab was
 * open, which renamed every hashed file. Trying again cannot help; a reload can.
 */
export const isChunkLoadError = (error) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i
    .test(`${error?.name} ${error?.message}`);

/**
 * The first stack frame from our own source, as `{ file, line, column }` for Vite's
 * open-in-editor endpoint. Frames from `node_modules` and Vite's dep cache are skipped:
 * the component that threw is what a developer wants to open, not React.
 */
export function sourceFrame(stack = '') {
  for (const [, url, line, column] of stack.matchAll(/([^\s()@]+?)(?:\?[^\s:()]*)?:(\d+):(\d+)/g)) {
    if (url.includes('/node_modules/')) continue;
    const at = url.indexOf('/src/');
    if (at !== -1) return { file: url.slice(at), line: Number(line), column: Number(column) };
  }
  return null;
}
