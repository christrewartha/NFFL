import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // In dev, /league talks to a locally running league server (node server/index.mjs).
  server: { proxy: { '/api': 'http://localhost:8787' } },
});
