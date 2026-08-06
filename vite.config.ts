import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import yaml from '@rollup/plugin-yaml'

// https://vite.dev/config/
const pagesBase = process.env.PAGES_BASE_PATH
const base =
  pagesBase && pagesBase.length > 0
    ? pagesBase.endsWith('/')
      ? pagesBase
      : `${pagesBase}/`
    : '/'

export default defineConfig({
  base,
  plugins: [react(), (yaml as any)()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
