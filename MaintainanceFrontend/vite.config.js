import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(process.cwd(), './src') },
  },
  server: {
    port: 5173,
    proxy: {
      // Keeps the browser same-origin in dev, so the httpOnly refresh cookie just works.
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // A page split into a folder is entered through its `index.jsx`, which
        // would otherwise land in the build as a second, anonymous `index-*.js`.
        // Name that chunk after the folder, so the bundle report still says
        // which page it is.
        chunkFileNames(chunk) {
          const folder = chunk.facadeModuleId?.match(/\/([^/]+)\/index\.jsx?$/)?.[1];
          return `assets/${folder ?? '[name]'}-[hash].js`;
        },
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
