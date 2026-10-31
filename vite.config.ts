import { execFileSync } from 'node:child_process'

import yaml from '@rollup/plugin-yaml'
import react from '@vitejs/plugin-react'
import { defineConfig, type UserConfig } from 'vite'
import type { UserConfig as VitestUserConfig } from 'vitest/config'

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

const config: UserConfig & Pick<VitestUserConfig, 'test'> = {
    base,
    build: {
        rolldownOptions: {
            output: { comments: { legal: true } },
        },
    },
    define: {
        __BUILD_COMMIT__: JSON.stringify(getBuildCommit()),
    },
    plugins: [react(), (yaml as any)()],
    test: {
        environment: 'node',
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
}

export default defineConfig(config)
