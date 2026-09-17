/** The API's `{ code, message, details }` from an RTK Query rejection, if the server sent one. */
export function apiErrorOf(err) {
  return err?.data?.error ?? null;
}

/** The field a detail path belongs to: `bullets.2` → `bullets`, `seo.metaTitle` → itself if registered. */
function fieldFor(path, names) {
  if (!path) return null;
  const parts = String(path).split('.');
  for (let i = parts.length; i > 0; i -= 1) {
    const candidate = parts.slice(0, i).join('.');
    if (names.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Puts a failed save's messages where they belong.
 *
 * The API sends `details` in two shapes: `[{ path, message }]` for a validation
 * failure (400) and `['field', …]` for a unique-constraint clash (409 DUPLICATE).
 * Each detail whose path names a field becomes that field's error. Whatever cannot be
 * placed comes back for a form-level alert, with the first field that was placed:
 * the caller focuses it once the form is enabled again — while a save is in flight
 * every control is disabled, and a disabled control cannot take focus.
 *
 * @param {unknown} err                    what `unwrap()` threw
 * @param {import('react-hook-form').UseFormSetError<object>} setError
 * @param {string[]} fieldNames
 * @param {{ mapPath?: (path: string) => string }} [options] rewrite paths first, e.g. `values.answer.ne` → `answer`
 * @returns {{ message: string, details: string[], firstField: string|null }} the form-level alert
 */
export function applyServerErrors(err, setError, fieldNames, { mapPath = (p) => p } = {}) {
  const apiError = apiErrorOf(err);
  if (!apiError) {
    return {
      message: err?.status === 'FETCH_ERROR'
        ? 'Could not reach the server. Check the connection and try again.'
        : 'Something went wrong while saving. Please try again.',
      details: [],
      firstField: null,
    };
  }

  const names = new Set(fieldNames);
  const unplaced = [];
  let firstField = null;

  for (const detail of Array.isArray(apiError.details) ? apiError.details : []) {
    const rawPath = typeof detail === 'string' ? detail : detail?.path;
    const message = typeof detail === 'string'
      ? (apiError.code === 'DUPLICATE' ? 'This is already in use.' : apiError.message)
      : detail?.message ?? apiError.message;
    const name = fieldFor(rawPath ? mapPath(rawPath) : rawPath, names);
    if (name) {
      setError(name, { type: 'server', message });
      firstField ??= name;
    } else if (message) {
      unplaced.push(rawPath ? `${rawPath}: ${message}` : message);
    }
  }

  return {
    message: firstField ? 'Some fields need attention before this can be saved.' : apiError.message,
    details: unplaced,
    firstField,
  };
}
