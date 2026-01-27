
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const target = process.env.VITE_PROXY_TARGET ?? 'http://localhost:3001'
// https://vitejs.dev/config/
export default defineConfig({

  plugins: [react()],
  publicDir: '../../CubismSdkForWeb-5-r.4',
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      '/api': {
        target,
        changeOrigin: true,
      },
    },
  },
})
