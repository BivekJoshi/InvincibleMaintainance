import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { render } from '@testing-library/react';
import { apiSlice } from '@/api/apiSlice';
import authReducer from '@/redux/slices/authSlice';
import uiReducer from '@/redux/slices/uiSlice';

/** A fresh store per test, built from the same reducers as `redux/store.js`. */
export function makeStore(preloadedState) {
  return configureStore({
    reducer: { [apiSlice.reducerPath]: apiSlice.reducer, auth: authReducer, ui: uiReducer },
    middleware: (getDefault) => getDefault().concat(apiSlice.middleware),
    preloadedState,
  });
}

/** Auth state for a signed-in user of `role`, for components that check capabilities. */
export const signedInAs = (role) => ({
  auth: { user: { id: 'user-test', name: 'Test User', role }, accessToken: 'test-token', status: 'authenticated' },
});

/**
 * Renders `ui` inside a fresh store and a memory **data** router — the kind the app
 * uses, and the only kind `useBlocker` works in.
 *
 * @param {import('react').ReactElement} ui
 * @param {{ path?: string, routes?: object[], preloadedState?: object }} [options]
 *   `routes` adds sibling routes to navigate to, e.g. `{ path: '/elsewhere', element: <p>Elsewhere</p> }`
 */
export function renderWithProviders(ui, { path = '/', routes = [], preloadedState } = {}) {
  const store = makeStore(preloadedState);
  const router = createMemoryRouter([{ path, element: ui }, ...routes], { initialEntries: [path] });
  const result = render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  );
  return { store, router, ...result };
}
