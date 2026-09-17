/**
 * The CMS stores long copy (`Service.body`, a project's story) as plain text, with a
 * blank line between paragraphs. It is never rendered as markdown or HTML — nothing
 * an editor types reaches the DOM as markup. The public page and the editor's
 * preview both split it here, so the preview is exactly what the site shows.
 *
 * @param {string|null|undefined} body
 * @returns {string[]} paragraphs, without the blank ones
 */
export function splitParagraphs(body) {
  if (!body) return [];
  return String(body)
    .split(/\r?\n[ \t]*\r?\n/)
    .map((p) => p.replace(/^\s+|\s+$/g, ''))
    .filter(Boolean);
}
