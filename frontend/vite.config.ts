/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // 生产构建标签由环境变量注入（Docker/CI 无 .git）；本地可用 Makefile 注入
  const VITE_BUILD_LABEL =
    mode === 'production'
      ? (process.env.VITE_BUILD_LABEL?.trim() || 'v0.0.0-unknown')
      : 'dev'

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
