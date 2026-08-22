import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Crossword Puzzles',
    short_name: 'Crosswords',
    description: 'Create and solve custom crossword puzzles',
    start_url: '/',
    // Keeps in-app navigation (including the Admin link) inside the standalone
    // window instead of kicking out to Safari.
    scope: '/',
    display: 'standalone',
    // Honoured by Android. iOS ignores orientation locks entirely — the landscape
    // fallback in globals.css is what actually handles rotation on iPhone.
    orientation: 'portrait',
    background_color: '#b8c8e0',
    theme_color: '#b8c8e0',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
