
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: '../../CubismSdkForWeb-5-r.4',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        // 后端服务运行在 3001 端口，这里之前写错了
        target: 'http://localhost:3001',
        changeOrigin: true,
        // 移除复杂的 agent 配置，避免 ENOBUFS 错误
        // ENOBUFS 通常是因为本地连接数过多或配置不当导致的
      },
    },
  },
})
