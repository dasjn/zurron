/// <reference types="vitest/config" />
import preact from '@preact/preset-vite'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Política de seguridad (solo en el build: el servidor de desarrollo necesita
// scripts en línea). Todo sale de la propia app; las imágenes pueden ser
// incrustadas (retratos) y nada se conecta fuera. Una copia importada con una
// dirección escondida no puede hacer que el móvil la pida.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function csp(): Plugin {
  return {
    name: 'zurron-csp',
    apply: 'build',
    // Justo tras el charset: antes de cualquier script o estilo, que si no se cargarían sin la política
    transformIndexHtml: (html) => html.replace(/(<meta charset[^>]*>)/i, `$1\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  }
}

// base './' + rutas con # para que funcione igual en GitHub Pages, en una
// subcarpeta o abriendo dist/ con cualquier servidor estático.
export default defineConfig({
  base: './',
  // iPhone con iOS 15 y Android con Chrome 100 en adelante: la sintaxis nueva se traduce
  build: {
    target: ['safari15', 'chrome100'],
    cssTarget: ['safari15', 'chrome100'],
  },
  plugins: [
    preact(),
    csp(),
    VitePWA({
      // La versión nueva no se pone sola: main.tsx ofrece «Actualizar» y solo la
      // pone sin preguntar cuando es seguro (app en segundo plano, nada abierto).
      registerType: 'prompt',
      // Los iconos ya entran por globPatterns: así no salen dos veces en la caché
      includeManifestIcons: false,
      manifest: {
        name: 'Zurrón',
        short_name: 'Zurrón',
        description: 'Fichas de personaje guiadas para la quinta edición (reglas de 2024, SRD 5.2.1).',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        // En tableta, también en horizontal: la ficha se adapta
        orientation: 'any',
        background_color: '#14100C',
        theme_color: '#14100C',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Todo precacheado: la app tiene que funcionar en la mesa sin cobertura.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        // La primera vez que se abre, la página aún no depende de la caché: así la versión
        // nueva también la toma (y «Actualizar» funciona ya en esa primera sesión)
        clientsClaim: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
