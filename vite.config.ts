import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import handler from './api/github-archive.ts'

/**
 * Vite plugin that uses the exact same secure serverless handler locally
 * in dev and preview as Vercel uses in production.
 */
function githubArchiveProxyPlugin(): Plugin {
  return {
    name: 'github-archive-proxy',
    configureServer(server) {
      server.middlewares.use('/api/github-archive', (req, res) => {
        void handler(req, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/github-archive', (req, res) => {
        void handler(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), githubArchiveProxyPlugin()],
})
