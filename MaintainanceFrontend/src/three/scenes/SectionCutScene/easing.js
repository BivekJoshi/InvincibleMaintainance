/** The four curves the timeline is written with, and the beat that uses them. */

export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
// Guarded at zero: the raw overshoot curve returns 0.1 at t = 0, so anything
// scaled by it appears at a tenth of its size before it has started moving.
export const easeOutBack = (t) => (t <= 0 ? 0 : 1 + 2.2 * (t - 1) ** 3 + 1.3 * (t - 1) ** 2);
/** 0 before `at`, eased to 1 over `dur`. The whole timeline is written with it. */
export const beat = (t, at, dur, ease = easeOutCubic) => ease(clamp01((t - at) / dur));
