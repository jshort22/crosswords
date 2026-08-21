'use client'

import { useSyncExternalStore } from 'react'

// Matches Tailwind's `md` breakpoint, so JS-gated mounting and CSS-gated
// visibility agree on where the boundary is.
const QUERY = '(max-width: 767px)'

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

// Server snapshot: assume desktop. useSyncExternalStore's third argument exists
// for exactly this — React hydrates with it and then re-renders, so there is no
// hydration mismatch, no suppressHydrationWarning, and no useEffect flag dance.
function getServerSnapshot() {
  return false
}

/**
 * Whether the viewport is phone-sized.
 *
 * Use this to gate *mounting* of mobile-only subtrees, so their effects and
 * handlers don't run on desktop. Keep `md:hidden` / `hidden md:flex` on those
 * subtrees as well: CSS covers the first frame before JS resolves, JS covers
 * effects and DOM weight. The two mechanisms guard different failure modes.
 */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
