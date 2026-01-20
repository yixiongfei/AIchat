import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: '../../CubismSdkForWeb-5-r.4',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://172.26.36.106:3000',
        changeOrigin: true,
      },
    },
  },
})
