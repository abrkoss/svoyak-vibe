import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue()],
  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://127.0.0.1:3000',
        ws: true
      },
      '/games': {
        target: 'http://127.0.0.1:3000'
      }
    }
  }
});
