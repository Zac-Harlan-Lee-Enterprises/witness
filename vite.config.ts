/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Static-host friendly build.
 *
 * VITE_BASE_PATH lets the game deploy under a sub-path (e.g. GitHub Pages
 * project sites: "/witness/"). Everything that references a URL — assets,
 * the service worker scope, the manifest start_url — derives from `base`,
 * so nothing else needs to change. See docs/deployment.md.
 */
function normalizeBase(raw: string | undefined): string {
  if (!raw || raw === '/') return '/';
  const trimmed = raw.replace(/^\/+|\/+$/g, '');
  return `/${trimmed}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const base = normalizeBase(env.VITE_BASE_PATH);
  const title = env.VITE_GAME_TITLE || 'Witness: A Journey Through Scripture';
  const shortTitle = env.VITE_GAME_SHORT_TITLE || 'Witness';

  // Project-specific ports (override with WITNESS_DEV_PORT / WITNESS_PREVIEW_PORT)
  // so this game never collides with other local apps on Vite's default 5173.
  const devPort = Number(process.env.WITNESS_DEV_PORT ?? 5391);
  const previewPort = Number(process.env.WITNESS_PREVIEW_PORT ?? 4391);

  return {
    base,
    server: { port: devPort, strictPort: true },
    preview: { port: previewPort, strictPort: true },
    plugins: [
      react(),
      VitePWA({
        // 'prompt' — never swap the running app out from under a player
        // mid-chapter. The UI offers "Update available — reload" and
        // autosaves first. See ADR-0006.
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          id: base,
          name: title,
          short_name: shortTitle,
          description:
            'A story-driven adventure through the world of the Bible. Explore, investigate, make choices, and learn.',
          lang: 'en',
          theme_color: '#6b3f22',
          background_color: '#f3e7cf',
          display: 'standalone',
          orientation: 'any',
          start_url: base,
          scope: base,
          categories: ['education', 'games'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Pre-rendered art (art/**: WebP layers and sheets with JSON manifests)
          // is precached with everything else, so every place works offline —
          // except the later-day variants, which the story never shows in the
          // morning market: they are cached the first time they are used.
          globPatterns: ['**/*.{js,css,html,svg,png,webp,json,woff2,webmanifest}'],
          globIgnores: ['**/art/**/*-late*.webp'],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.includes('/art/'),
              handler: 'CacheFirst',
              options: { cacheName: 'witness-art', expiration: { maxEntries: 200 } },
            },
          ],
          // The Phaser chunk is ~1.2 MB and the largest art layer is under 2 MB.
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          clientsClaim: false,
          skipWaiting: false,
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
    build: {
      target: 'es2022',
      sourcemap: true,
      // Phaser is intentionally isolated in its own lazily-loaded chunk.
      chunkSizeWarningLimit: 1600,
    },
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'node',
            include: [
              'tests/unit/**/*.test.ts',
              'tests/integration/**/*.test.ts',
              'tests/content/**/*.test.ts',
              'tests/architecture/**/*.test.ts',
            ],
            setupFiles: ['tests/setup/unit.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'ui',
            environment: 'jsdom',
            include: ['tests/ui/**/*.test.tsx'],
            setupFiles: ['tests/setup/ui.ts'],
          },
        },
      ],
    },
  };
});
