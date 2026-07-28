import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'miniapp'),
  publicDir: 'public',
  build: {
    outDir: path.resolve(__dirname, 'dist/miniapp'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'miniapp/index.html'),
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});