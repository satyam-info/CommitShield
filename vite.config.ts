import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import https from 'node:https'
import http from 'node:http'
import { URL } from 'node:url'

function streamRemoteUrl(targetUrl: string, res: http.ServerResponse, maxRedirects = 3) {
  if (maxRedirects < 0) {
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Too many redirects' }))
    return
  }

  const parsed = new URL(targetUrl)
  const client = parsed.protocol === 'http:' ? http : https

  const req = client.get(
    targetUrl,
    {
      headers: {
        'User-Agent': 'CommitShield-Local-Scanner/1.0',
        Accept: 'application/zip, application/octet-stream, */*',
      },
    },
    (remoteRes) => {
      if (
        remoteRes.statusCode &&
        remoteRes.statusCode >= 300 &&
        remoteRes.statusCode < 400 &&
        remoteRes.headers.location
      ) {
        const nextUrl = new URL(remoteRes.headers.location, targetUrl).toString()
        streamRemoteUrl(nextUrl, res, maxRedirects - 1)
        return
      }

      res.writeHead(remoteRes.statusCode || 200, {
        'Content-Type': remoteRes.headers['content-type'] || 'application/zip',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      })
      remoteRes.pipe(res)
    }
  )

  req.on('error', (err) => {
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err.message }))
  })
}

/**
 * Vite plugin that securely proxies public GitHub zipball downloads locally,
 * avoiding browser CORS restrictions on codeload.github.com without transmitting
 * any code through external servers.
 */
function githubArchiveProxyPlugin(): Plugin {
  const handler = (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      })
      res.end()
      return
    }

    const urlPath = req.url || ''
    const targetUrl = `https://codeload.github.com${urlPath}`
    streamRemoteUrl(targetUrl, res)
  }

  return {
    name: 'github-archive-proxy',
    configureServer(server) {
      server.middlewares.use('/api/github-archive', handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/github-archive', handler)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), githubArchiveProxyPlugin()],
})
