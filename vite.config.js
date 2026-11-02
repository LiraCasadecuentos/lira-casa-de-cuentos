import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base: './' hace que la app funcione en cualquier carpeta (por ejemplo en GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icono.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Lira. Casa de cuentos',
        short_name: 'Lira',
        description: 'Stock y ventas de Lira. Casa de cuentos',
        lang: 'es-AR',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#FBF5EA',
        theme_color: '#5B3A29',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Guarda todo lo necesario para que la app abra sin internet.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,xlsx}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
