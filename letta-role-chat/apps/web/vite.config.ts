
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const target = process.env.VITE_PROXY_TARGET ?? 'http://localhost:3001'
// https://vitejs.dev/config/
export default defineConfig({

  plugins: [react()],
  publicDir: '../../CubismSdkForWeb-5-r.4',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        // 后端服务运行在 3001 端口，这里之前写错了
        target,
        changeOrigin: true,
      },
    },
  },
})
