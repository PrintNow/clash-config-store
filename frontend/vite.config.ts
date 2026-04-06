import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      // 订阅拉取与页面同域，本地复制链接为 localhost:5173/sub/... 即可用
      '/sub': 'http://localhost:8080',
    },
  },
})
