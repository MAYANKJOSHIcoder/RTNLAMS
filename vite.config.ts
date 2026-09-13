import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import geminiHandler from './api/gemini.ts'

// Dev-only: mount the real api/gemini.ts inside Vite so `npm run dev` serves
// /api/gemini exactly like Vercel does in prod (same code, same JWT gate).
// apply:'serve' → never runs in build, never touches the client bundle.
function devApi(): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '')
      for (const k of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
        if (env[k]) process.env[k] ??= env[k]
      }
      server.middlewares.use('/api/gemini', (req, res) => {
        const chunks: Buffer[] = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          let body: unknown
          try { body = raw ? JSON.parse(raw) : undefined } catch { body = undefined }
          const headers: Record<string, string | undefined> = {}
          for (const [k, v] of Object.entries(req.headers)) headers[k] = Array.isArray(v) ? v[0] : v
          let code = 200
          const apiRes = {
            status(c: number) { code = c; return this },
            json(b: unknown) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b ?? null)) },
            setHeader(k: string, v: string) { res.setHeader(k, v); return this },
          }
          void geminiHandler(
            { method: req.method, headers, body } as never,
            apiRes as never,
          ).catch((e: unknown) => {
            res.writeHead(500, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: (e as Error).message }))
          })
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  server: { allowedHosts: ['.ngrok-free.dev'] },
  optimizeDeps: {
    include: [
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'lucide-react',
      'maplibre-gl',
      'react',
      'react-dom',
      'react-router-dom',
      'recharts',
    ],
  },
})
