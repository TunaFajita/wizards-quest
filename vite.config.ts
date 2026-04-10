import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'client',
  publicDir: '../assets',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
