import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import yaml from '@rollup/plugin-yaml'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), (yaml as any)()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
