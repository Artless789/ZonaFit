import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@shared": path.resolve(import.meta.dirname, "./src/shared"),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
  },
  build: {
    rollupOptions: {
      input: {
        web: path.resolve(import.meta.dirname, 'index.html'),
        app: path.resolve(import.meta.dirname, 'app/index.html'),
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react/') || id.includes('react-dom/') || id.includes('react-router-dom/')) {
              return 'vendor-react';
            }
            if (id.includes('@tanstack/')) {
              return 'vendor-query';
            }
            if (id.includes('lucide-react') || id.includes('framer-motion')) {
              return 'vendor-ui';
            }
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'vendor-pdf';
            }
            return 'vendor';
          }
        }
      }
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'app-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && req.url.startsWith('/app') && !req.url.includes('.')) {
            req.url = '/app/';
          }
          next();
        });
      }
    },
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      scope: '/app/',
      manifest: {
        name: 'ZonaFit',
        short_name: 'ZonaFit',
        description: 'Sistema de gestión y operación para gimnasios.',
        theme_color: '#111214',
        background_color: '#111214',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/app/dashboard',
        id: '/app/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        navigateFallback: '/app/index.html',
        navigateFallbackAllowlist: [/^\/app\//],
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,json}'],
      }
    }),
    {
      name: 'remove-manifest-from-web',
      enforce: 'post',
      transformIndexHtml(html, ctx) {
        if (ctx.path === '/index.html' || ctx.filename.endsWith('index.html') && !ctx.filename.includes('app')) {
          return html.replace(/<link rel="manifest" href="[^"]*">/, '');
        }
        return html;
      }
    }
  ],
});