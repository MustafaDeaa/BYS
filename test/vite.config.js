import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function llmProxy(env) {
  const key = env.GROQ_API_KEY || ''
  return {
    '/api/llm': {
      target: 'https://api.groq.com',
      changeOrigin: true,
      rewrite: () => '/openai/v1/chat/completions',
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          if (key) proxyReq.setHeader('Authorization', `Bearer ${key}`)
        })
      },
    },
  }
}

function sunoProxy(env) {
  const key = env.SUNO_API_KEY || ''
  return {
    '/api/suno': {
      target: 'https://api.sunoapi.org',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/suno/, '/api/v1'),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          if (key) proxyReq.setHeader('Authorization', `Bearer ${key}`)
        })
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = { ...llmProxy(env), ...sunoProxy(env) }
  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  }
})
