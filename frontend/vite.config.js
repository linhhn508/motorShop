import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/images': {
        target: 'http://localhost:9000',
        rewrite: (path) => path.replace(/^\/images/, '/product-image'),
      },
    },
    host: '0.0.0.0'
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.js',
  },
})
