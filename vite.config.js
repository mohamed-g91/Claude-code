/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
                name: 'MRCP Cardio Revision',
                short_name: 'MRCP Cardio',
                description: 'Offline MRCP Part 1 cardiology revision with spaced repetition and game modes',
                theme_color: '#0f172a',
                background_color: '#f8fafc',
                display: 'standalone',
                start_url: '/',
                scope: '/',
                icons: [
                    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,json}'],
                navigateFallback: '/index.html',
                runtimeCaching: [
                    {
                        urlPattern: /\/content\/.*\.json$/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'content-cache',
                            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }
                        }
                    }
                ]
            },
            devOptions: {
                enabled: false
            }
        })
    ],
    server: {
        port: 5173
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts']
    }
});
