import { execFileSync } from 'node:child_process'

import yaml from '@rollup/plugin-yaml'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
const pagesBase = process.env.PAGES_BASE_PATH
const base =
    pagesBase && pagesBase.length > 0
        ? pagesBase.endsWith('/')
            ? pagesBase
            : `${pagesBase}/`
        : '/'

function getBuildCommit(): string {
    const explicitCommit = process.env.BUILD_COMMIT?.trim()
    if (explicitCommit) return explicitCommit

    try {
        return (
            execFileSync('git', ['rev-parse', 'HEAD'], {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim() || 'HEAD'
        )
    } catch {
        return 'HEAD'
    }
}

export default defineConfig({
    base,
    define: {
        __BUILD_COMMIT__: JSON.stringify(getBuildCommit()),
    },
    plugins: [react(), (yaml as any)()],
    test: {
        environment: 'node',
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
})
