import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // During local development the browser talks only to localhost. Vite forwards
    // /zkas-api to the public explorer backend, which removes cross-origin browser
    // variability and keeps the user's personal node completely out of the path.
    proxy: {
      '/zkas-api': {
        target: 'https://explorer.zkas.info',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/zkas-api/, '/api'),
      },
    },
  },
});
