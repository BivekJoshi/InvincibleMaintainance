import { apiSlice } from '@/api/apiSlice';

/**
 * The signed-in user's own shell furniture: pinned shortcuts and sticky notes. The shell
 * loads this file, so it stays small. Reorder and pin changes land in the cache first and
 * roll back if the API refuses them.
 */
export const meApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getShortcuts: build.query({
      query: () => '/admin/me/shortcuts',
      transformResponse: (r) => ({ items: r.data, max: r.meta?.max ?? 12 }),
      providesTags: ['Shortcut'],
    }),
    createShortcut: build.mutation({
      query: (body) => ({ url: '/admin/me/shortcuts', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['Shortcut'],
    }),
    updateShortcut: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/me/shortcuts/${id}`, method: 'PATCH', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['Shortcut'],
    }),
    reorderShortcuts: build.mutation({
      query: (ids) => ({ url: '/admin/me/shortcuts/order', method: 'PUT', body: { ids } }),
      async onQueryStarted(ids, { dispatch, queryFulfilled }) {
        const patch = dispatch(meApi.util.updateQueryData('getShortcuts', undefined, (draft) => {
          const byId = new Map(draft.items.map((s) => [s.id, s]));
          draft.items = ids.map((id) => byId.get(id)).filter(Boolean);
        }));
        try { await queryFulfilled; } catch { patch.undo(); }
      },
      invalidatesTags: (result, error) => (error ? ['Shortcut'] : []),
    }),
    deleteShortcut: build.mutation({
      query: (id) => ({ url: `/admin/me/shortcuts/${id}`, method: 'DELETE' }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patch = dispatch(meApi.util.updateQueryData('getShortcuts', undefined, (draft) => {
          draft.items = draft.items.filter((s) => s.id !== id);
        }));
        try { await queryFulfilled; } catch { patch.undo(); }
      },
      invalidatesTags: ['Shortcut'],
    }),

    getNotes: build.query({
      query: () => '/admin/me/notes',
      transformResponse: (r) => ({ items: r.data, max: r.meta?.max ?? 100 }),
      providesTags: ['Note'],
    }),
    createNote: build.mutation({
      query: (body) => ({ url: '/admin/me/notes', method: 'POST', body }),
      transformResponse: (r) => r.data,
      invalidatesTags: ['Note'],
    }),
    updateNote: build.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/me/notes/${id}`, method: 'PATCH', body }),
      async onQueryStarted({ id, ...changes }, { dispatch, queryFulfilled }) {
        const patch = dispatch(meApi.util.updateQueryData('getNotes', undefined, (draft) => {
          const note = draft.items.find((n) => n.id === id);
          if (note) Object.assign(note, changes);
        }));
        try { await queryFulfilled; } catch { patch.undo(); }
      },
      transformResponse: (r) => r.data,
      invalidatesTags: ['Note'],
    }),
    deleteNote: build.mutation({
      query: (id) => ({ url: `/admin/me/notes/${id}`, method: 'DELETE' }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patch = dispatch(meApi.util.updateQueryData('getNotes', undefined, (draft) => {
          draft.items = draft.items.filter((n) => n.id !== id);
        }));
        try { await queryFulfilled; } catch { patch.undo(); }
      },
      invalidatesTags: ['Note'],
    }),
  }),
});

export const {
  useGetShortcutsQuery, useCreateShortcutMutation, useUpdateShortcutMutation,
  useReorderShortcutsMutation, useDeleteShortcutMutation,
  useGetNotesQuery, useCreateNoteMutation, useUpdateNoteMutation, useDeleteNoteMutation,
} = meApi;
