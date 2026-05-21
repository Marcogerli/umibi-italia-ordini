import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { buildFirebaseTokenResponse } from './server/firebase-token'

function firebaseTokenDevPlugin() {
  return {
    name: 'firebase-token-dev',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/firebase-token', async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        const response = await buildFirebaseTokenResponse({
          authorization: req.headers.authorization,
          origin: req.headers.origin
        })

        res.statusCode = response.statusCode

        Object.entries(response.headers).forEach(([key, value]) => {
          res.setHeader(key, value)
        })

        res.end(response.body)
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  process.env.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || env.CLERK_SECRET_KEY
  process.env.CLERK_AUTHORIZED_PARTIES = process.env.CLERK_AUTHORIZED_PARTIES || env.CLERK_AUTHORIZED_PARTIES
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT_JSON

  return {
    plugins: [
      firebaseTokenDevPlugin(),
      react(),
      VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-logo.png', 'pwa-maskable.svg'],
      manifest: {
        name: 'Umibi Italia',
        short_name: 'Umibi Italia',
        description: 'Portale ordini Umibi Italia',
        theme_color: '#091925',
        background_color: '#091925',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/pwa-logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webp,avif}']
      }
      })
    ],
    server: {
      port: 5173,
      open: true
    }
  }
})
