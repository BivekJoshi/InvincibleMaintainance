/** ⌘ on Apple keyboards, Ctrl everywhere else — only what the key cap says, never behaviour. */
export const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '') ? '⌘' : 'Ctrl';

/** Whether a key press is the command palette's chord: Ctrl+K, or ⌘K on a Mac. */
export const isPaletteChord = (e) => (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key?.toLowerCase() === 'k';
