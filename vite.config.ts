import { defineConfig, PluginOption } from 'vite';
import path from 'path';

const useElectron = process.env.ELECTRON === 'true';

// Lazy-load electron plugins only when needed
async function electronPlugins(): Promise<PluginOption[]> {
  if (!useElectron) return [];
  const electron = (await import('vite-plugin-electron')).default;
  const renderer = (await import('vite-plugin-electron-renderer')).default;
  return [
    electron([
      {
        entry: path.resolve(__dirname, 'electron/main.ts'),
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { external: ['electron'] },
          },
        },
      },
    ]),
    renderer(),
  ];
}

export default defineConfig(async () => ({
  root: 'client',
  publicDir: '../assets',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: 3000,
    open: !useElectron,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  plugins: await electronPlugins(),
}));
