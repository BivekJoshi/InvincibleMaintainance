import { createSlice } from '@reduxjs/toolkit';

/**
 * The field app's view of its two on-device queues (`helpers/offlineQueue.js`, `helpers/uploadQueue.js`):
 * what is waiting, whether a sync is running, and what the office refused.
 *
 * IndexedDB is the record; this is a mirror, reloaded after every change by the sync engine
 * (`hooks/useOfflineQueue.js`), so every screen reads the same list. It holds no server data, and no
 * picture — an upload is mirrored without its bytes.
 */

const NOTES_KEPT = 10;

const initialState = {
  loaded: false,
  /** queue entries, oldest first */
  mutations: [],
  /** upload entries without `file`, oldest first */
  uploads: [],
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  syncing: false,
  lastSyncedAt: null,
  /**
   * Changes and uploads the server refused for good and that left the queue — shown until dismissed.
   * `{ id, source: 'mutation'|'upload', kind, status?, jobId?, surveyId?, code, message, at }`
   */
  notes: [],
};

const fieldSyncSlice = createSlice({
  name: 'fieldSync',
  initialState,
  reducers: {
    fieldQueueLoaded(state, { payload }) {
      state.loaded = true;
      state.mutations = payload.mutations ?? [];
      state.uploads = payload.uploads ?? [];
    },
    fieldOnlineChanged(state, { payload }) {
      state.online = Boolean(payload);
    },
    fieldSyncStarted(state) {
      state.syncing = true;
    },
    fieldSyncFinished(state, { payload }) {
      state.syncing = false;
      if (payload?.at) state.lastSyncedAt = payload.at;
    },
    fieldNotesAdded(state, { payload }) {
      state.notes = [...payload, ...state.notes].slice(0, NOTES_KEPT);
    },
    fieldNoteDismissed(state, { payload }) {
      state.notes = state.notes.filter((n) => n.id !== payload);
    },
  },
});

export const {
  fieldQueueLoaded, fieldOnlineChanged, fieldSyncStarted, fieldSyncFinished, fieldNotesAdded, fieldNoteDismissed,
} = fieldSyncSlice.actions;

export default fieldSyncSlice.reducer;

export const selectFieldSync = (s) => s.fieldSync;
export const selectFieldMutations = (s) => s.fieldSync.mutations;
export const selectFieldUploads = (s) => s.fieldSync.uploads;
/** Changes plus pictures waiting — the number the field app's header shows. */
export const selectFieldPendingCount = (s) => s.fieldSync.mutations.length + s.fieldSync.uploads.length;
