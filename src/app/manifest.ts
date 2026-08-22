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
    // Daylight's light canvas. iOS ignores these; Android uses background_color
    // for the splash and theme_color for the system bars.
    background_color: '#f7f4ef',
    theme_color: '#f7f4ef',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
