import { defineConfig } from 'vite';

export default defineConfig({
  root: 'miniapp',
  publicDir: 'public',
  build: {
    outDir: '../dist/miniapp',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    host: true,
  },
});