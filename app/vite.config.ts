/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/app/',
  build: {
    chunkSizeWarningLimit: 600,
    emptyOutDir: true,
    outDir: '../website/app',
  },
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
