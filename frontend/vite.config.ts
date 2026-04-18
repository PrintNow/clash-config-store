/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { computeProductionBuildLabel } from './scripts/git-build-info'

export default defineConfig(({ mode }) => {
  // 仅 production build 读 git；dev / vitest 等使用 dev
  const VITE_BUILD_LABEL =
    mode === 'production' ? computeProductionBuildLabel() : 'dev'

  return {
    define: {
      'import.meta.env.VITE_BUILD_LABEL': JSON.stringify(VITE_BUILD_LABEL),
    },
    plugins: [react()],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      proxy: {
        '/api/': 'http://localhost:26406',
        '/sub/': 'http://localhost:26406',
        '/ruleset/': 'http://localhost:26406',
      },
    },
  }
})
