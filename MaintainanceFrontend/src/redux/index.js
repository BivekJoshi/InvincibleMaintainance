import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { apiSlice } from '@/api/apiSlice';
import { IS_DEV } from '@/config/env';
import authReducer from '@/redux/slices/authSlice';
import uiReducer from '@/redux/slices/uiSlice';

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
    ui: uiReducer,
  },
  middleware: (getDefault) => getDefault().concat(apiSlice.middleware),
  devTools: IS_DEV,
});

// Enables refetchOnReconnect / refetchOnFocus.
setupListeners(store.dispatch);
