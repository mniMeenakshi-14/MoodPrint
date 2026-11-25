import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev` proxies /api to the Python server (run `python app.py` too).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { proxy: { '/api': 'http://localhost:8000' } }
});
