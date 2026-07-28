import { defineConfig } from 'vite';

export default defineConfig({
  root: 'miniapp',
  publicDir: 'public',
  build: {
    outDir: '../dist/miniapp',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'miniapp/index.html',
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});