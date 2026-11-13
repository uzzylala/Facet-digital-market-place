import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The Express API runs on :4000; proxying keeps everything same-origin in dev.
    proxy: { '/api': 'http://localhost:4000' },
  },
})
