import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'http'

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,      // 限制并发 socket
  maxFreeSockets: 10,
  timeout: 60000,
})


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
        configure(proxy) {
                  proxy.on('proxyReq', (proxyReq) => {
                    // @ts-ignore
                    proxyReq.agent = agent
                  })
                },
      },
    },
  },
})
