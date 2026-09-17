import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/** Where the dev server proxies `/api` and `/uploads`. Build-time config, not app code — see src/config/env.js for that. */
const API_TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(process.cwd(), './src') },
  },
  server: {
    port: 5400,
    strictPort: true,
    proxy: {
      // Keeps the browser same-origin in dev, so the httpOnly refresh cookie just works.
      // The end-to-end run points it at its own API (playwright.config.js).
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Every entry file is now named for what it is (`HomePage.jsx`, not
        // `index.jsx`), so the default `[name]` already yields a legible chunk.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
