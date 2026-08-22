# Crossword Builder — Progress Log

## Session 1 — Initial Build

### What Was Built
Full MVP from scratch in a single session:

- Next.js project scaffolded with TypeScript + Tailwind CSS v4 + App Router
- Supabase client (browser + server), typed Database interface, `puzzles` table schema
- Shared crossword types (`Grid`, `Clue`, `CrosswordPuzzle`, `SolverState`) and utility library (grid numbering, serialization, clue building, navigation helpers)
- Full NYT-style solver (`/puzzles/[id]`): click/keyboard navigation, word highlighting, clue panels, timer
- Gold sunset sweep celebration animation + completion modal (time + difficulty)
- Public landing page (`/`) with puzzle cards
- Admin list page (`/admin`) with draft/published status table
- 5-step admin wizard (`/admin/new`): metadata → upload → grid editor → clues → preview & publish
- Edit page (`/admin/puzzles/[id]/edit`)
- `supabase/schema.sql` with RLS policies

### Scaffolding Issue
`create-next-app` couldn't use the directory name "Crossword Builder" (capital letters + spaces violate npm package naming rules). Workaround: scaffolded into a sibling directory `crossword-app` then `cp -r` into the target. This caused broken symlinks in `node_modules/.bin/` — resolved with a clean `npm install`.

### Supabase Type Compatibility
The Supabase JS SDK v2 uses `RejectExcessProperties` and requires a `Relationships: []` field in the Database type definition. `.insert()` and `.update()` calls were cast via `as any` on the Supabase query builder to work around this — acceptable for MVP admin-only operations.

---

## Session 1 — Fixes & Iterations

### Back Button
- Initial breadcrumb links (small gray text) were hard to find
- Added prominent `← Home` / `← Admin` pill buttons to all three admin page headers
- Upload step was missing a within-wizard Back button — added it with Back / Skip / Next layout
- Per user request, replaced all Back/Next text buttons in the wizard with compact round arrow buttons (← →), keeping "Save as Draft" / "Publish" as text buttons on the final step

### Supabase Connection
- User had copied the REST API URL (`https://...supabase.co/rest/v1/`) instead of the project URL — stripped `/rest/v1/` suffix from `.env.local`
- After running `schema.sql`, RLS insert was blocked — root cause: RLS policies exist but `anon` role lacked `GRANT` permissions. Fixed by adding:
  ```sql
  grant usage on schema public to anon, authenticated;
  grant select, insert, update on puzzles to anon, authenticated;
  ```
- Storage uploads were also blocked — added storage object policies for `puzzle-sources` bucket
- `schema.sql` was not idempotent — re-running it failed with "policy already exists". Fixed by adding `drop policy if exists` before each `create policy`

---

## Session 1 — AI Extraction Feature Added Then Removed

### What Was Built
An API route (`/api/extract-puzzle`) using `claude-opus-4-5` that returned grid dimensions, black cell positions, clue lists, and solution letters from a PDF. The wizard upload step called it and pre-populated everything automatically.

### Why It Was Removed
User decided against paying for the Anthropic API. SDK uninstalled, route deleted, wizard reverted to manual-only.

---

## Session 2 — AI Clue Extraction + UX Improvements

### AI Clue Extraction (Re-added with Anthropic)
User decided to bring back AI assistance — pivoted to clue-text-only extraction using `claude-haiku-4-5`. Grid is built manually. CluesStep had a "Fill from PDF" button that called `/api/extract-puzzle` and pre-populated clue inputs.

### Grid Size Presets
GridEditorStep added **15×15** and **21×21** quick-select buttons. Clicking a preset instantly resizes and clears the grid. Active preset highlighted in amber.

### Drag and Drop on Upload Step
Drop zone handles `dragover`, `dragenter`, `dragleave`, `drop`. Visual feedback: amber border + icon while dragging. `dragLeave` uses `relatedTarget` containment check to avoid flicker on child elements.

---

## Session 3 — Remove Anthropic API + Wizard Restructure + Grid UX

### Remove Anthropic API
User removed their API key and wanted all AI extraction gone. `@anthropic-ai/sdk` uninstalled, `/api/extract-puzzle` route deleted, `ExtractionResult` type and `gridFromExtraction()` utility deleted.

### Wizard Collapsed from 5 Steps to 4
- Removed the standalone Upload step
- Upload (PDF/image reference) moved into the Clues step
- Steps are now: **Metadata → Build Grid → Enter Clues → Preview & Publish**
- PDF displays in the Clues step starting from `#page=2` to skip the grid page if present

### Metadata Simplified
Removed Author and Notes fields. Metadata step now only captures Title and Difficulty.

### Grid Fill Not Required to Advance
Previously blocked Next button if any white cell was empty. Now it's a soft warning. Grid must be fully filled to Publish (Publish button disabled with tooltip), but not to proceed through steps.

### 180° Rotational Symmetry
`GridEditor` now enforces NYT-standard 180° rotational symmetry by default: toggling a cell black also toggles the diametrically opposite cell. A toggle button in the grid editor turns it off when needed. Center cell of odd-sized grids is handled correctly (mirrors to itself).

### Keyboard-Driven Grid Input
`GridEditor` fully refactored from per-cell `<input>` elements to a single keyboard-controlled container:
- Click a cell to select it (amber highlight + amber outline visible on black cells too)
- Type a letter → fills the cell, advances right
- Spacebar → toggles the cell black/white, advances right
- When a row becomes fully filled (all cells have a letter or are black), cursor jumps to the start of the next row automatically
- Backspace → clears letter, un-blacks a black cell, or moves back if already empty
- Arrow keys → free navigation
- Right-click / Ctrl+click → still toggles black without advancing

### PDF Clue Extraction (Without AI)
Added `/api/extract-clues` route using `pdfjs-dist` v5 for server-side PDF text extraction — no API cost, no AI:
- Imports `pdf.mjs` and `pdf.worker.mjs` from the legacy build
- Sets `globalThis.pdfjsWorker = pdfjsWorker` to run the worker in-thread (avoids needing a browser Worker or Node.js worker_threads)
- Groups text items by Y coordinate to reconstruct lines, strips trailing all-caps answer words
- Parses ACROSS / DOWN sections and numbered clue entries
- Automatically called when a PDF is uploaded in the Clues step; clue inputs are pre-populated; user reviews and edits
- `pdfjs-dist` added to `serverExternalPackages` in `next.config.ts` to prevent webpack from bundling it (bundling breaks pdfjs's internal dynamic imports)

---

## Session 4 — Solver UX Polish + Admin Auth

### Solver Back Button + Progress Persistence
- Added "← All puzzles" link in the solver header
- Progress saved to `localStorage` as `{ cells, elapsed }` on every letter change
- Timer resumes correctly on return: `startTime` is reconstructed as `Date.now() - savedElapsed * 1000` so time away from the puzzle is not counted
- Progress is cleared from localStorage when the puzzle is solved

### Timer Toggle
- Toggle switch in solver header controls visibility of the timer display
- Timer always runs in the background; toggle only shows/hides the number (shows `--:--` when hidden)

### Direction-Aware Clue Highlighting
- Clue panels previously highlighted both the across and down clue simultaneously
- Now only the active direction's panel highlights its clue (amber); the other panel is unlit
- Clicking a clue in the Across panel forces direction to `across`; clicking in the Down panel forces direction to `down`
- Added `setDirection` action and export to `useCrosswordSolver`

### Clue Panel Auto-Scroll
- When the active clue changes, the panel scrolls to bring it to the top of the visible list
- Uses `useLayoutEffect` (fires before paint) + manual `scrollTop` via `getBoundingClientRect` so only the `<ol>` scrolls — the page does not move
- Key formula: `list.scrollTop = (item.getBoundingClientRect().top - list.getBoundingClientRect().top) + list.scrollTop - 8`

### Difficulty Labels Renamed
- Changed from `Easy / Medium / Hard / Expert / Diabolical` (1–5) to `Beginner / Easy / Medium / Hard / Expert`
- Updated `difficultyLabel()` in `utils.ts` — single source of truth used everywhere
- Admin difficulty pickers now show the label name instead of the number (1–5)
- Solver header now shows the text label (e.g. "Medium") instead of star glyphs

### Admin Password Gate
- All admin routes moved into `src/app/admin/(protected)/` route group
- `src/app/admin/(protected)/layout.tsx` checks for cookie `admin-auth=authenticated`; redirects to `/admin/login` if missing
- Login page at `src/app/admin/login/page.tsx` — outside the route group, so it is never caught by the redirect
- Server action in the login page validates password (`rebus`), sets `httpOnly` cookie with 30-day `maxAge`, redirects to `/admin`
- Wrong password redirects to `/admin/login?error=1` and shows inline error message
- No logout button yet — session lasts 30 days

---

## Session 5 — Solver Polish + Puzzle Card Redesign

### Puzzle Card Redesign
- Removed the date display from puzzle cards
- Added a **grid thumbnail**: inline SVG generated from the `grid` JSONB, showing the black/white cell pattern. No image storage needed — computed from existing data every render.
- Title is now centered
- Grid size and difficulty shown as **color-coded badges** on the same line: grid size is blue ("15×15 Grid"), difficulty uses existing color scale
- Landing page title changed from "Crossword Builder" + subtitle to just "Crossword Puzzles"

### Solver Layout Fix (Scrollbar Fix)
- Changed outer container from `min-h-screen` to `h-screen overflow-hidden`
- Previously, `min-h-screen` let the page grow past the viewport, breaking both clue panel scroll and causing a page-level scrollbar
- Now the layout is truly viewport-locked: grid column scrolls internally, both clue panels scroll independently, no page scroll

### Active Clue Bar Repositioned
- Moved from a full-width bar above the grid to a pill/box **below the grid**, width sized to the clue text
- Format changed from abbreviated ("53 D") to full ("53 Down" / "7 Across")

### Timer Toggle Redesigned
- Replaced click-on-number UX with an explicit **toggle switch** (amber when on, gray when off)
- Toggle controls visibility only — timer runs regardless. User confirmed this is intentional.

### Word Auto-Advance
- Typing the last letter of a word now jumps the cursor to the **first cell of the next word** in the same direction
- Uses the sorted `cluesAcross` / `cluesDown` arrays already on `puzzle` — no new utility needed
- Wraps around to the first word when the last word is complete
- Implemented in the `ADVANCE` case of the reducer in `useCrosswordSolver.ts`

### Reset Puzzle + Show Incorrect Buttons
- Added a **left sidebar** (desktop only, `w-40`) with two action buttons
- **Reset Puzzle**: clears all entered letters and `isCorrect` state; requires inline orange confirmation
- **Show Incorrect**: marks each filled letter `isCorrect: true/false` by comparing to the solution; wrong letters render red in the grid; blanks are untouched; requires inline confirmation
- Red letter rendering added to `CrosswordGrid.tsx` — `isCorrect === false` → `text-red-600`
- Two new reducer actions: `RESET` and `SHOW_INCORRECT` (solution read directly from `puzzle.grid[r][c].letter`)

---

## Session 6 — Solver Polish, Solved State Persistence, Admin Cleanup

### Completion Flow Improvements
- Completion modal copy changed to "You solved the puzzle! Great work!"
- **Error banner**: when the grid is fully filled but has at least one wrong letter, a red banner appears below the grid ("At least one letter is wrong. Keep trying!"). Disappears on any edit. Implemented via `hasErrors: boolean` in `SolverState`, set by `CHECK_COMPLETE`, cleared by `SET_LETTER`, `CLEAR_LETTER`, and `RESET`.
- Gold sweep animation slowed from 1.2s to 2.2s with `ease-in` curve and a hold at full opacity — feels more deliberate
- **Fill (Test)** button added to the left sidebar: fills all white cells correctly except the last one, moves cursor there — for testing the completion flow without solving the whole puzzle

### Solved State Persistence
- On solve, `crossword-solved-{puzzleId}` is written to `localStorage` with `{ elapsed }` alongside removing the in-progress save
- **Revisiting a solved puzzle**: grid loads fully filled, borders gold, timer shows solve time (frozen). No sweep animation or modal on revisit. Uses new `RESTORE_SOLVED` reducer action + `restoredAsSolvedRef` to suppress the celebration effect.
- **Resetting a solved puzzle**: clears `crossword-solved-{puzzleId}` from localStorage, resets `celebrationPhase` to `'idle'`, restores blank grid
- **Puzzle cards** show a `🏆` trophy and solve time when solved; button changes from "Solve Puzzle" to "View Puzzle". Implemented in `PuzzleCardActions.tsx` (new client component) — `PuzzleCard.tsx` stays a server component.

### Timer Fixes
- Timer now starts immediately when the puzzle page loads — `initState` sets `startTime: Date.now()` instead of null
- Timer resumes correctly on navigation — in-progress save always stores elapsed, restore always reconstructs `adjustedStartTime = Date.now() - saved.elapsed * 1000` (no null case)
- `RESET` now sets `startTime: Date.now()` so timer restarts immediately after reset; `setElapsed(0)` removed from reset handler since the interval naturally starts from 0

### Admin Cleanup
- Author field removed from admin entirely: removed from the admin list table (select query + column + cell), removed from `EditPuzzleClient` (state, field, save payload). Column still exists in the DB; `NewPuzzleWizard` always submitted `author: null` so no change needed there.

### Turbopack / node_modules Fix
- `styled-jsx`, `enhanced-resolve`, `scheduler` were missing — root cause was a corrupted `node_modules` from the original `cp -r` scaffolding workaround. Fixed with a clean `rm -rf node_modules package-lock.json && npm install`.
- Turbopack was misidentifying the workspace root because `/Users/jackshort/Library/Mobile Documents/package.json` exists in a parent iCloud directory. Fixed by setting `turbopack.root: path.resolve(__dirname)` in `next.config.ts`.

---

## Session 7 — UI Polish, Dark Mode, Fonts

### Landing Page Sections
- Puzzles split into **15×15** and **21×21** sections (filtered by `grid_size_rows <= 15`). Within each section, sorted by difficulty ascending (Beginner → Expert). Only the populated section renders if all puzzles are one size.
- Section headings changed from `text-lg font-semibold` to small-caps labels (`text-xs font-semibold tracking-widest uppercase text-gray-400`) with a bottom border rule.

### Puzzle Card Redesign
- Badge format changed: `Grid: 15×15` (left) and `Difficulty: Medium` (right), `justify-between` layout.
- "Solve Puzzle" button is now blue (`bg-blue-600`); flips to gold (`bg-amber-400`) after solving when it reads "View Puzzle".
- Added hover lift: `hover:-translate-y-1 transition-all duration-200`.
- Grid thumbnail container now has `rounded-lg overflow-hidden` to clip corners.

### Grid Editor — Skip Black Squares
- `advance()` in `GridEditor.tsx` rewritten to scan forward in reading order, skipping black cells. Previously stopped at every cell regardless. Now types through black squares seamlessly.

### Solver Header Redesign
- Changed from `grid grid-cols-3` (equal thirds) to `flex` with `w-40` left and `w-64 lg:w-72` right — matching the exact widths of the side panels so the title/difficulty badge is centred over the puzzle grid.
- Back link upgraded from small gray text to a proper bordered pill button.
- Difficulty badge now uses the same colour scale as the cards (`difficultyColors` from `utils.ts`) instead of a generic amber badge.

### Timer Restore Fix
- Restore effect changed from `useEffect` to `useLayoutEffect`. This forces the state update (correct `elapsed` + `cells`) to apply before the first paint and before `useEffect`s run — eliminating the 0:00 flash on revisit and preventing the save effect from writing stale elapsed=0 to localStorage in the same mount cycle.

### Left Panel Buttons
- Panel background changed to `bg-gray-100` to visually distinguish it from the grid area.
- Buttons styled as white cards (`bg-white border border-gray-200 shadow-sm`) against the gray panel so they clearly read as clickable.
- Fill (Test) moved to last in the button list.

### Fonts — Playfair Display
- **Playfair Display** added via `next/font/google` in `layout.tsx`, CSS variable `--font-playfair`.
- `globals.css` maps it to `--font-serif` in `@theme inline`, so `font-serif` Tailwind class uses Playfair Display.
- Applied to: landing page `<h1>`, puzzle card titles, solver header title, completion modal heading + puzzle title.

### Dark Mode
- Tailwind v4.2 `@custom-variant dark (&:where(.dark, .dark *))` added to `globals.css`.
- Inline `<script>` in `<head>` of `layout.tsx` reads `localStorage.getItem('theme')` before React hydrates — prevents flash of wrong theme.
- `ThemeToggle.tsx` — client component with moon/sun SVG icons. Writes `localStorage` key `theme`. Falls back to `prefers-color-scheme` on first visit.
- ThemeToggle placed in both the landing page header (beside Admin link) and the solver header (beside timer toggle).
- Crossword grid cells intentionally not dark-themed — white/black cells stay as-is (traditional appearance).
- All page chrome, cards, panels, modals, and clue lists have `dark:` variants.

### difficultyColors Extracted to utils.ts
- `difficultyColors` Record moved from being defined inside `PuzzleCard.tsx` to an exported constant in `src/lib/crossword/utils.ts`. Includes both light and `dark:` Tailwind classes. Imported by `PuzzleCard`, `SolverClient`, and `CompletionModal`.

### Completion Modal
- Heading uses `font-serif` (Playfair Display).
- Puzzle title displayed in italic serif.
- Difficulty shown as a coloured badge (using `difficultyColors`) instead of plain amber text.

---

## Session 8 — Bug Fixes, Keyboard, UI Polish

### Dark Mode Toggle Fix
- **Bug**: toggle appeared broken — dark mode would not persist across page loads.
- **Root cause**: React hydration was stripping the `dark` class added by the inline script in `<head>`, because the server-rendered `<html>` didn't include it and React reconciled the mismatch.
- **Fix**: added `suppressHydrationWarning` to `<html>` in `layout.tsx` so React ignores the class mismatch during hydration.

### Tab Key Word Navigation
- **Tab** jumps to the first cell of the next word in the current direction (wraps around).
- **Shift+Tab** jumps to the first cell of the previous word.
- Implemented as two new reducer actions (`NEXT_WORD`, `PREV_WORD`) in `useCrosswordSolver.ts`, exposed as `nextWord`/`prevWord` callbacks, and wired to `Tab`/`Shift+Tab` in `handleKeyDown` in `SolverClient.tsx`. `e.preventDefault()` prevents default browser tab-focus behaviour.

### Timer Persistence Fix
- **Bug**: timer reset to 0:00 when navigating away and back.
- **Root cause**: timer was computing elapsed as `Math.floor((Date.now() - state.startTime) / 1000)` every second. The `state.startTime` had to be correctly reconstructed from localStorage on every mount, and any timing gap in that reconstruction could cause the save effect to write `elapsed=0` to localStorage.
- **Fix**: replaced with a simple incrementer (`setElapsed(e => e + 1)` every second). The timer now depends only on `[state.isComplete]`. On mount, `useLayoutEffect` reads `elapsed` from localStorage and sets it before the first paint; the incrementer continues from that value. Reset handler now explicitly calls `setElapsed(0)`. Completion handler uses `elapsed` directly instead of computing from `state.endTime - state.startTime`.

### Background & Visual Polish
- Body background changed from white (`#ffffff`) to slate blue-gray (`#d0d5e0`) — provides clear contrast against white puzzle cards.
- Landing page and solver outer div no longer carry an opaque `bg-gray-50` — they let the body color show through.
- Section headings (`15×15` / `21×21`) made larger (`text-sm`), heavier (`font-black`), and darker (`text-gray-600`). Bottom border removed.

### Active Clue Bar Always Visible
- **Bug**: on large grids (21×21), the active clue bar below the grid was pushed out of view and required scrolling.
- **Fix**: restructured the grid column into two parts — a scrollable inner div (grid + error banner) and the active clue bar outside it, pinned to the bottom of the column. The clue bar is now always in frame regardless of grid size.

---

## Known Restrictions & Decisions

| Topic | Decision |
|---|---|
| Admin auth | Cookie-based password gate (password: `rebus`). `httpOnly`, `sameSite: lax`, 30-day expiry. Not Supabase Auth. |
| Route group for auth | `(protected)` group in admin keeps the login page outside the redirect guard |
| Grid serialization | Compact `{t, l, n}` format in JSONB. `solution` column is redundant (letters are in `grid`) but kept |
| Clue numbering | Auto-assigned on every grid edit using standard crossword rules |
| TypeScript + Supabase | `as any` casts on `.insert()` and `.update()` to avoid SDK v2 type errors |
| Mobile keyboard | Desktop-only — grid captures keypresses via a focused `div` |
| PDF iframe | `#page=2` fragment to skip grid page; Safari may block iframe PDF rendering |
| pdfjs-dist | Must remain in `serverExternalPackages` — webpack bundling breaks it |
| Grid fill | Required to publish, not to advance through wizard steps |
| Clue panel scroll | `useLayoutEffect` + manual `scrollTop` — avoids `scrollIntoView` which scrolls the whole page |
| Solver layout | `h-screen overflow-hidden` — page never scrolls; all scrolling is inside panels |
| Timer toggle | Visibility only — timer always runs in background |
| Word auto-advance | Jumps to next word's first cell at end of word; wraps; uses clue list order |
| Grid thumbnail | Inline SVG in PuzzleCard, no storage, computed from JSONB |

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (no trailing `/rest/v1/`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (not used in MVP but set for future auth work) |

---

## Supabase Project

- Project ref: `qfbvoiotkzwrnnnzazmk`
- Storage bucket: `puzzle-sources` (public)
- All schema + policies in `supabase/schema.sql`

---

## Session 9 — Supabase Pause Outage + Error Surfacing

### The Outage
Production (Vercel) showed "No puzzles yet" with an empty puzzle list.

- **Root cause**: the Supabase project had been **paused**. Free-tier projects are paused after ~a week of inactivity, and the project hostname is torn down entirely — `qfbvoiotkzwrnnnzazmk.supabase.co` returned `NXDOMAIN` from both the local resolver and `1.1.1.1`, while `supabase.com` and `api.supabase.com` resolved normally. Last commit was 2026-05-05; the outage was noticed 2026-08-21.
- **Not a Vercel problem, and not a data problem.** Local `npm run dev` was equally broken.
- **Recovery**: unpausing restored DNS immediately, but the origin took ~170s to boot — during that window Cloudflare returned `521 Web server is down`. All 3 puzzles survived intact, all published, and the `anon` role's SELECT grant survived the pause (no need to re-run `schema.sql`).

### Why It Looked Like an Empty Library
`src/app/page.tsx` and `src/app/admin/(protected)/page.tsx` both destructured only `data` from the Supabase query and discarded `error`. A dead backend, missing env vars, and a genuinely empty table all rendered the identical "No puzzles yet" empty state — there was no way to tell them apart from the UI.

**Fix**: both pages now destructure `error`, log it server-side (`console.error`), and render a distinct error state:
- Landing page: generic "Couldn't load puzzles" panel — reassures the visitor that puzzles aren't lost, no raw error text shown publicly
- Admin page: red panel that names the paused-project case explicitly and shows `error.message` in a `<code>` block

Verified both paths: pointing `NEXT_PUBLIC_SUPABASE_URL` at a dead host renders the error state (and logs `TypeError: fetch failed`); real credentials render all three puzzles.

### Removed Dead `revalidate` on the Landing Page
`export const revalidate = 60` in `src/app/page.tsx` had **no effect** and was removed. `createClient()` calls `cookies()`, a Next.js Dynamic API that opts the route out of static rendering — `npm run build` confirms `/` is `ƒ (Dynamic)`, not ISR, both before and after removal. The landing page hits the database on every request; there is no stale cache to wait out during an outage. The line actively misled diagnosis during this session.

### Solver Page: Outage vs. Missing Puzzle
`src/app/puzzles/[id]/page.tsx` checked `error` but called `notFound()` for it, so a backend outage rendered "puzzle not found" — telling the visitor their puzzle was gone when the database was merely unreachable.

Switched `.single()` to **`.maybeSingle()`**. `.single()` reports zero matching rows as an error (`PGRST116`), which collapses "no such puzzle" and "backend failed" into one indistinguishable case. `.maybeSingle()` returns `data: null` with no error for zero rows, so the two separate cleanly:

```ts
if (error) { /* log + render error panel */ }
if (!data) notFound()
```

Verified all three paths: real puzzle → 200 solver; missing/unpublished id → 404; backend unreachable → 200 with the error panel (was a 404).

### Production Confirmed Healthy
`https://crosswords-gilt.vercel.app/` returns HTTP 200 and serves all three puzzles after the unpause. Vercel's env vars were correctly configured all along — the pause was the entire cause.

### Still Open
- `createClient()` uses non-null assertions (`!`) on both env vars. Missing env vars would throw at client construction rather than surface as a query error — a different failure mode from the one fixed here, and not currently handled.
- The solver's outage state returns HTTP **200**, not 503. Fine for humans; slightly wrong for uptime monitoring or crawlers.
- `npx eslint` is broken in this checkout: `eslint-config-next` is in `package.json` and `node_modules` but resolves to a missing `dist/core-web-vitals.js`. Pre-existing (fails on a clean tree); `npm run lint` needs a reinstall to work.

---

## Session 9b — Completion Flow Audit

Audited the finish-the-puzzle reward path (gold sweep, trophy modal, timer stop, solved record), driving the real solver in headless Chromium against live puzzle data rather than reasoning from the source alone.

### First: There Is No Reveal Feature
`isRevealed` and `isChecked` exist on `SolverCell` and are initialised to `false`, but nothing ever writes them. The left panel has exactly two buttons — **Reset Puzzle** and **Show Incorrect** — and Show Incorrect only marks wrong letters red; it never fills anything in.

### The Worry: Does Checking Answers Spoil the Reward?
No. Verified by filling 20 cells wrong, running Show Incorrect (20 red cells confirmed), then correcting everything: gold 187/187, modal, trophy, zero red remaining, timer stopped, solved record written — byte-for-byte the same outcome as a clean solve.

This holds structurally, not by luck: `CHECK_COMPLETE` compares `userLetter` against the solution and never reads the `isCorrect` flags that Show Incorrect writes, and `SET_LETTER` resets a cell's flag to `null`. There is no cheat-detection or penalty logic anywhere in the reducer.

Also verified working: error banner appears when the grid is full but wrong (without prematurely going gold), clears on fix, then celebrates; mid-solve reload restores letters and timer; revisiting a solved puzzle shows gold with no replayed animation; reset clears everything and re-solving awards gold again.

### Bugs Found and Fixed

**1. A completed grid was still editable.** Nothing blocked keyboard input after solving. Typing changed a letter while the grid stayed gold and the solved record stayed intact, so a "solved" grid could display a wrong letter. `CHECK_COMPLETE` short-circuits on `if (!state.isComplete)`, so it never re-evaluated. Fixed by ignoring letter keys and Backspace when `state.isComplete`; navigation still works. (Confirmed before: `letter_changed=true`; after: `letter_changed=false`.)

**2. Opening a solved puzzle wrote a blank progress record.** Every visit to a solved puzzle wrote a full empty grid with `elapsed: 0` to `crossword-progress-{id}` — roughly 30KB for a 15×15, more for a 21×21.

Root cause: `restoredRef.current = true` was set **synchronously** inside the `useLayoutEffect`, but `restoreSolved()` dispatches asynchronously. The save effect therefore passed its `restoredRef` guard and ran once against the still-empty initial state before `isComplete` landed. On the in-progress path this self-corrected (the next render re-ran the save with real cells), but on the solved path `isComplete` then blocked every subsequent save, so the junk was never overwritten.

Fixed by replacing the ref with `hasRestored` **state**, which batches with the restore dispatches — so the first render where the gate is open already has the restored cells. (Confirmed: `STALE_PROGRESS_WRITTEN` went from a 30KB blob to `null`.)

**3. Modal timeout was never cleared.** The celebration effect returned a cleanup function from *inside* the `setTimeout` callback, where it is discarded. `modalTimer` leaked if the component unmounted during the 600ms gap between gold and modal. Now both timers are cleared in the effect's real cleanup.

**4. Removed dead `FILL_FOR_TEST` code.** The test button was removed from the UI in commit `fc7baf4`, but the action type, reducer case, `fillForTest` callback, hook export, and `SolverClient` destructure all survived. HANDOFF.md still documented it as a live button. All removed.

### Test Harness
Playwright scripts live in the session scratchpad (not committed): `solve.mjs` (clean solve / show-incorrect-then-solve), `revisit.mjs` (restore, revisit, reset, re-solve), `banner.mjs` (error banner path). They drive the real dev server and assert on gold cell count, modal, trophy, timer freeze, and localStorage keys. Worth rebuilding as committed tests if this area changes again.

### Still Open
- `isRevealed` / `isChecked` remain on the `SolverCell` type and in every persisted progress record. Removing them would change the localStorage shape, so they were left alone.

---

## Session 10 — Mobile Solver + PWA

The solver was **unusable on a phone**: keystrokes were captured on a focused `<div>`, which cannot raise a soft keyboard, and there was no `<input>`, `inputMode` or `contentEditable` anywhere in the solver. You could look at a grid but not enter a letter. NYT's mobile app was the UX reference.

Scope decided up front: admin stays desktop-only, only the existing Reset + Show Incorrect aids, offline/service-worker deferred, save data stays in localStorage.

### PWA shell
Separate `viewport` export (Next 16 deprecates `metadata.viewport`) with `viewport-fit=cover`, dual light/dark `themeColor`, `appleWebApp`, and `formatDetection: { telephone: false }` — without the last one iOS turns clue numbers into `tel:` links. `manifest.ts` with `display: 'standalone'` and `scope: '/'`. Icons: `apple-icon.tsx` via `next/og` for the 180×180 iOS icon, plus 192/512/maskable PNGs rasterized with `sharp` (both already installed). Manifest icons need stable paths, so they can't point at Next's hashed icon route.

Deliberately **omitted** `maximumScale`/`userScalable` (ignored by iOS since 10, an a11y regression on Android — `touch-action: manipulation` is the correct way to kill double-tap zoom), `interactiveWidget` (only governs the native keyboard), and `colorScheme` (the app manages `.dark` itself).

### Grid sizing rewritten in CSS
`cellSize` read `window.innerWidth` **during render** — a real hydration mismatch (server 40px vs client 23px for 15 cols at 390px) that never recomputed, since there was no resize or orientation listener anywhere in `src/`.

Replaced with `aspect-ratio` + `1fr` tracks + `cqw` fonts. Net JS deleted: no `ResizeObserver`, no listeners, and the mismatch is impossible by construction rather than patched.

**Fitting both axes took a second pass** (anticipated as risk #1 in the plan). `width: 100%` + `max-height: 100%` clamps the height *without recomputing the width*, so a 21×21 on a short viewport came out with 42.9×33.9 cells. Fixed by resolving the width against the parent's height: `min(100cqw, calc(100cqh * cols/rows), cols*44px)`, with the parent given `container-type: size`. Verified square and fitting at 15×15 and 21×21, desktop and iPhone, including a deliberately short viewport.

Cell borders became `gap-px` over the container background — `1fr` tracks land on fractional pixels (21 cols at 374px ≈ 17.8px) where per-cell borders render hairline-uneven. The gold celebration now recolours that container background.

### Custom on-screen keyboard
Rather than a hidden `<input>`. Keeps the layout height fixed and known, which is what lets the grid size itself reliably, and avoids fighting iOS over keyboard timing and viewport resizing.

`inputLetter`/`inputBackspace` were extracted out of `handleKeyDown` so both keyboards reach the **same** implementation — forking them would fork the `isComplete` read-only guard, and the day one side changed, a solved gold grid would become editable on the other.

### Mobile clue UX
`ClueBar` above the keyboard with ‹ › arrows walking one continuous Across→Down sequence (not `nextWord`/`prevWord`, which are direction-scoped and would trap you in Across). `ClueSheet` bottom sheet reuses `CluePanel` unchanged — its scroll-to-active finally works there because the sheet gives the `<ol>` a bounded height, which the deleted `md:hidden` section never did. `max-md:py-3` gets clue rows to 44px on phones only.

### Branching rule
**JS gates mounting, CSS gates visibility.** `useIsMobile` uses `useSyncExternalStore` with a server snapshot, so no hydration mismatch and no `useEffect` flag dance. Mobile subtrees also keep `md:hidden` for the frame before JS resolves. Both are needed. CSS-only branching is exactly what left the old mobile clue section clipped and unreachable.

### Bug caught by the regression suite
Adding `preventDefault()` to the cell `pointerdown` also suppressed the browser's default focus move to the focusable ancestor — which is how the grid container used to regain focus. On desktop, after clicking Reset or Show Incorrect, clicking a cell no longer restored focus, so **typing silently stopped working** with no recovery short of a reload. The Show-Incorrect-then-solve regression stalled with the wrong letters still in place, which is how it surfaced. Fixed with an explicit `containerRef.current?.focus()`.

This is the argument for keeping those harnesses: the bug was invisible in screenshots and in the happy-path solve.

### Separate commit
Backspace at a word's first cell cleared the *preceding black cell's* record — `retreat()` used `prevCellInWord` while the `clearLetter` beside it used naive `-1` arithmetic guarding only the array bound. No visible effect (black cells never render `userLetter`), but the paths are meant to agree, and they now share code.

### Verification
Desktop suite (clean solve, Show Incorrect → solve, error banner, mid-solve reload, revisit, reset → re-solve) all pass unchanged. Mobile suite on an emulated iPhone 13: types via the on-screen keyboard, arrows cross the Across/Down boundary, sheet opens with 44px rows, full solve gives gold + trophy + solved record, and a solved grid ignores the keyboard **even when the `disabled` attribute is bypassed with a forced `pointerdown`** — the guard holds in the handler, not just the DOM.

### Still Open — needs a real device
Emulation cannot confirm: that iOS honours the Next-generated `/apple-icon?<hash>` route for Add to Home Screen (fallback is a static `src/app/apple-icon.png`); that it launches standalone (Next emits `mobile-web-app-capable`, not the legacy `apple-` prefixed tag); safe-area clearance for the Dynamic Island and home indicator; and whether 21×21 at ~17px cells is comfortable to tap.

---

## Session 11 — Clue Bar Sized for Three Lines + Admin Length Warning

### The jump was on production, not on the branch

Reported as "the puzzle still jumps a little when we go from two to three
lines." It does — on `main`, which is what is deployed. There the bar carries no
height at all and the text is capped at `max-h-[4.5rem]` (72px, about 3.7 line
boxes), so the bar grows 1 → 2 → 3 lines and the grid rescales under it every
time. The branch fix (`d575938`) had already pinned the bar to 56px; it just
hasn't been merged. Verified with `stability.mjs`: one bar height, one grid size,
at 320/375/390/430px.

### Measured how many lines clues actually need

Before widening anything, `linecount.mjs` walked all 298 clues in the library at
four viewport widths, reading the text span's `scrollHeight` over its computed
line box. Max lines needed:

| Width | Max lines | Clues over three lines |
|---|---|---|
| 320px (SE 1st gen) | 5 | 7 |
| 375px (SE 2/3, 13 mini) | 4 | 3 |
| 390px (iPhone 12–16) | 4 | 1 |
| 430px (Pro Max) | 3 | 0 |

So **three is the right number, four is not worth it**: on any phone from the
last several years, three lines shows the entire clue for 295–298 of 298. A
fourth line would buy 1–3 clues and cost another 20px of grid on every puzzle.

### Bar sized for exactly three lines

`h-14` → `h-[4.75rem]` (76px = 3 × 19.25px line box + 16px of `py-2`), and the
text cap `max-h-[2.75em]` → `max-h-[4.125em]`. The cap stays in **em** so it
lands on a whole line box; a px cap halves the fourth line and reads as broken
instead of scrollable.

Cost is 20px of bar. It only comes out of the grid where the grid is
height-constrained: at 390px the grid stayed 374px (width-bound, so free), at
375px it went 359 → 344px, at 320px 284 → 264px. Clues needing internal scroll
dropped from 11 → 2 at 390px, 13 → 6 at 375px, and 8 → 0 at 430px.

### Admin warns on clues too long for three lines

Rather than a hard cap. `threshold.mjs` sweeps each width and reports the
crossover band — the longest real clue that still fits three lines versus the
shortest that spills — plus a synthetic prose sweep:

| Width | Fits 3 lines up to | Spills from |
|---|---|---|
| 320px | 86 chars | 93 chars |
| 375px | 101 chars | 114 chars |
| 390px | 117 chars | 132 chars |
| 430px | 132 chars | — |

`CLUE_THREE_LINE_LIMIT = 100` in `utils.ts` — the round number sitting safely
below the 375px band, so anything under it is safe on every phone still in
common use. The clue editor flags each offending row (amber border + a line
saying the count and that it will scroll on a narrow phone, "Still fine to
use") and tallies them beside the Across/Down heading, because a warning on one
row out of 140 is easy to scroll straight past.

**Deliberately no `maxLength`.** A character count can only approximate wrapping
— a line of "l"s is far narrower than a line of "W"s — so it will sometimes warn
on a clue that would have fit. That is the right way round for an advisory, and
a clue that does spill is not broken: it scrolls in the bar and is in full in the
clue sheet. Both the wizard and the edit page get this from the one component.

### Verification
Full suite re-run green: `stability.mjs` (one bar height 76px, one grid size, at
320/375/390/430 on both a 15×15 and the 21×21), `cluebar.mjs`, `mobile-solve.mjs`,
`solve.mjs` plain + check, `revisit.mjs`, `banner.mjs` — no console errors.
`admin-cluewarn.mjs` (new) confirms the boundary is exact at 100, that trailing
whitespace does not trip it, that the tally tracks live, and that a 400-character
clue is accepted with no `maxlength` attribute. `tsc --noEmit` and
`next build` clean.

**Note:** `npx eslint` is broken in this repo — `eslint-config-next/dist` is
missing from `node_modules`. Pre-existing, reproduces on a clean tree, unrelated
to this work. Worth an `npm install` fix.

---

## Session 12 — Auto-Advance Skips Filled Answers

NYT behaviour: don't make the solver type over letters they already have.

"Skip filled answers" turned out to be three separable moves, so the scope was
settled first: **auto-advance only.** Tab, `NEXT_WORD`/`PREV_WORD` and the mobile
clue-bar arrows are untouched, because they are how you get *back* to an answer
that is filled in but wrong — if they skipped too, a wrong answer would be
reachable only by tapping its cell in the grid.

### What ADVANCE does now
1. Skip forward within the word to the next cell that is still blank, so a
   crossing letter you already got from the other direction is stepped over.
2. When nothing is left to fill in the word, go to the next word that still has
   a blank — landing **on that blank**, not on the word's first cell.
3. The current word is tested last in that search (`i === clues.length` wraps
   back to it), so a gap you skipped past earlier gets picked up rather than
   orphaned.
4. If every word in the direction is full — the last letter of the puzzle, or a
   grid finished from the other direction — fall back to the literal next word
   so the cursor still lands somewhere sensible.

### The one non-obvious part: a `skipFilled` flag
`inputLetter` dispatches `SET_LETTER` then `ADVANCE`, and the reducer applies
them in order — so by the time `ADVANCE` runs, **"this word was just completed"
and "this word is being retyped" look identical**: both are full. The difference
only exists in the pre-keystroke state, which only `inputLetter` can still see.

So `inputLetter` computes `wordWasComplete` from `wordCells` (already returned by
the hook) and passes `skipFilled: !wordWasComplete`. When the answer was already
complete the cursor steps one cell at a time, which is what lets you retype the
whole thing. Without this, tapping into a wrong 5-letter answer and typing one
letter would eject you to some unrelated clue — the exact case Show Incorrect
sends you into, so it would have been hit constantly.

The within-word step also moved from `nextCellInWord` (grid adjacency) to the
clue's own `cells` list, which is what the next-word branch already used. Same
result on a well-formed word, one less place for the two to disagree.

### Verification
New `scripts/e2e/skipfilled.mjs`, 7 assertions, green on both the 15×15 and the
21×21: skips a filled crossing letter; jumps over a full word to the next one
with blanks; retyping a complete answer steps through it instead of ejecting;
Tab and Shift+Tab still walk into a full word; and a reopened gap is still
picked up. Full existing suite re-run green (`solve.mjs` plain + check,
`revisit.mjs`, `banner.mjs`, `mobile-solve.mjs`, `stability.mjs`) with no console
errors. `tsc --noEmit` and `next build` clean.

**Harness trap worth remembering:** three of these tests failed against correct
code at first, because clicking the cell that is already active toggles
direction — and with auto-advance the cursor is usually already on the cell you
were about to click. `go()` in that script clicks a scratch cell first, then
nudges with arrow keys to force a known direction.

---

## Session 12b — The Skip Wasn't Visible, Because Placement Was Still Wrong

Reported as "not seeing the change — when I get to an already filled in answer,
it starts with the first letter in that clue instead of skipping over it."

The Session 12 code *was* live (a probe confirmed the new behaviour was running
on the dev server). Two separate gaps made it invisible in normal solving, and
both surfaced as "the cursor is sitting on the first letter of a filled answer":

**1. Every path that moved the cursor into a word landed on `cells[0]`.**
Auto-advance had been taught to land on the first blank, but `NEXT_WORD`/`PREV_WORD`
(Tab), the mobile clue-bar arrows (`goClue` — a *separate* path from Tab), and
clicking a clue in the panel or sheet had not. So arrowing into a part-solved
answer put you on a letter you had already entered. That is the one that would
have been hit constantly, since it needs no unusual sequence at all.

Fixed with a single `firstUnfilledCell(clue, cells)` helper in `utils.ts`, now
used by all four. Five call sites previously wrote `cells[0]` by hand — the kind
of duplication where teaching one of them a new rule leaves the others behind,
which is exactly what happened.

**2. Retyping a complete answer to its end landed on the literal next clue.**
A real bug in the Session 12 change: the `skipFilled` flag correctly stops the
cursor skipping *within* an answer you are retyping, but it was also governing
the jump at the word boundary. So finishing a retype dumped you on the next
clue's first cell even when that clue was full. "The word I was retyping is
finished" is no reason to land on a full answer — both cases now take the same
next-word-with-a-blank jump, and only movement *inside* the word differs.

### Still deliberately not skipping
Tab and the clue-bar arrows still *visit* a completely filled answer — they land
on its first cell because it has no blank. That was the explicit choice in
Session 12: they are how you get back to an answer that is filled in but wrong,
and Show Incorrect sends you looking for exactly those.

### Verification
`skipfilled.mjs` grew from 7 to 10 desktop assertions plus a mobile one, green on
both the 15×15 and the 21×21. New cases: finishing a retyped full word still
skips a full next word; Tab into a partially filled word lands on its first
blank; a clue-list click does the same; and the mobile clue-bar arrow does too
(worth its own case — `goClue` is a different code path from `NEXT_WORD` and
would not have been covered by the Tab test). Full existing suite re-run green.
`tsc --noEmit` and `next build` clean.

**Testing lesson:** the Session 12 suite passed while the feature was, in
practice, not working. Every assertion drove the cursor with `Tab` or by typing,
and asserted on *auto-advance*; nothing asserted where the arrows and clue clicks
put the cursor. A green suite over one code path says nothing about the four
others that do the same job.

---

## Session 13 — Fresh-Start and Clock Audit

Two checks asked for: that no puzzle starts out filled in for a new visitor, and
that the clock behaves across leaving and re-entering a puzzle in one session.

### Nothing starts filled in — but a mismatched save was fatal

`initState` builds every cell with `userLetter: ''` and `CrosswordGrid` renders
only `userLetter`, never `grid[r][c].letter`, so a first visit cannot show
answers. Confirmed empirically by `freshstart.mjs` across all three puzzles,
desktop and mobile, in **pristine** browser contexts — 0 of 225 / 0 of 441 cells
filled, cursor on the first white cell, no modal, no console errors. (Worth doing
in a fresh context: every other harness here calls `localStorage.clear()` *after*
a load, which is not the same condition.)

The audit did turn up a real bug next door. `loadProgress` restored a saved
record **wholesale with no validation**, and `CHECK_COMPLETE`, `SHOW_INCORRECT`
and `RESTORE_SOLVED` all walk `state.cells` while indexing `puzzle.grid` at the
same coordinates. So a record whose shape no longer matched the grid:

| Seeded record | Before |
|---|---|
| 5×5 on a 15×15 | rendered, but showed 20 letters the visitor never typed |
| 21×21 on a 15×15 | **crash** — `Cannot read properties of undefined (reading 'type')` |
| `cells: 'nope'` | **crash** — `state.cells.every is not a function` |
| `cells: null` | **crash** — `Cannot read properties of null (reading 'every')` |

And because the bad record stayed in localStorage, *every reload crashed too* —
the puzzle was permanently dead for that visitor short of clearing site data.
**Editing a published puzzle's grid in admin is enough to cause it**, which is a
live risk given there is an edit page.

`loadProgress` now validates dimensions and cell shape and deletes anything that
doesn't fit — a record for a different grid is worthless anyway, and keeping it
only re-triggers the crash. All five seeded cases now render an empty grid; a
valid same-size record still restores all 187 letters, so the guard is not
over-rejecting.

### The clock is correct

`clock.mjs`, all passing:

| Behaviour | Result |
|---|---|
| Ticks while in the puzzle | 0s → 5s over 5s |
| Holds while out of it | left at 5s, back at 6s after a 6s absence (a running clock would read ~11s) |
| Resumes on return | 6s → 10s over 4s |
| Survives a reload | 10s → 10s |
| Monotonic across repeated exits | 10s → 11s across two 2.5s absences, no reset |
| Stops for good once solved | covered by `solve.mjs` TIMER_STOPPED and `revisit.mjs` frozen |

It works because the timer is a plain `setInterval` incrementer on a mounted
component: leaving the puzzle unmounts `SolverClient` and the interval is torn
down, so "exit pauses it" is structural rather than something that needed
building. Progress (cells + elapsed) is written every second, so at most one
second is lost on the way out.

**Not covered by emulation:** backgrounding the app rather than navigating away.
There is no `visibilitychange` handling, so that case relies on the browser's own
throttling — on iOS standalone JS is suspended, which pauses it as wanted; a
backgrounded desktop tab is throttled rather than stopped, so it may creep by a
few seconds. Only a real device settles it.

### One judgement call left open
Opening a puzzle and *only looking at it* starts the clock and persists it — 5
seconds of browsing is banked and shown on the next visit, and an empty progress
record is written before a single letter is typed. NYT behaves the same way
(the clock starts when the puzzle opens), and nothing in the UI surfaces that
record — `PuzzleCardActions` reads only the `crossword-solved-` key, so a card
never shows a peeked puzzle as started. Left as is; gating the clock on the first
letter is a one-line change if that is preferred.

---

## Session 14 — The Daylight Redesign

Six design directions were drafted as a canvas (library + solver + phone, each
with real puzzles and real clues), narrowed to two, then shown in light and dark.
**D · Daylight** was chosen: warm off-white, soft shadows, pill controls, a teal
accent, Bricolage Grotesque over DM Sans.

### One palette, in tokens, no `dark:` colour variants

The old styling hardcoded Tailwind shades and duplicated every one for dark
(`bg-white dark:bg-gray-800`, ~177 such references in admin alone). That is now
a token system in `globals.css` — `--canvas`, `--surface`, `--sunken`, `--ink`,
`--ink-soft`, `--line`, the `--accent*` family, a separate `--cell*` family for
the grid, `--danger*`, and `--diff-1..5` — exposed to Tailwind through
`@theme inline` so they come out as ordinary utilities (`bg-surface`,
`text-ink-soft`, `border-line`).

The tokens flip under `.dark`, so **a component names a role, not a colour, and
needs no `dark:` variant at all.** `src/` now contains zero `bg-gray-*`-style
palette classes and zero `dark:` colour utilities. That deleted more code than it
added and is why admin got a dark mode it never had.

The grid keeps its own token family on purpose: it has to stay legible when every
other surface changes, and reusing `--surface` for a cell would tie the two
together.

**Dark is warm** — brown-black `#17140f`, not blue-black. That was the whole
distinction between direction D and direction C once both were dark; a cool dark
here would quietly turn this into the other design.

`difficultyColors` in `utils.ts` went from ten Tailwind classes with `dark:`
halves to five token pairs (`bg-diff-1-soft text-diff-1`).

### Fonts
Bricolage Grotesque (`font-display`) and DM Sans (`font-sans`), both via
`next/font/google`. Playfair Display and two never-used Geist faces are gone —
and body text was falling through to **Arial**, since `--font-sans` pointed at a
Geist variable that was never applied.

### Two things the mockup got wrong, found only in the real app
1. **The rounded grid clipped 1-Across's number.** Rounding the cell container
   needs `overflow-hidden` to clip the corner, and the first cell's number sits
   exactly there. At mockup scale it wasn't visible.
2. **Rounded cells left pinholes.** A 3px cell radius over a 1.5px gap shows a
   small square of line colour at every four-way intersection — decorative noise
   across the whole grid.

Both fixed by making the grid square. It is now the one un-rounded element in a
design that rounds everything else, which is also just truer to a crossword.

### The harnesses broke, all at once — and that is the lesson
Every e2e script selected on **presentation**: `.bg-amber-300` for the cursor,
`.bg-black` for a block, `.bg-amber-400` for the celebration, `.text-red-600`
for a wrong letter, `.font-mono.tabular-nums` for the timer, and
`text=Puzzle Complete!` plus `text=🏆` for the modal. A restyle invalidated all
of it in one go — `solve.mjs` reported `MODAL=false TROPHY=false` against a
perfectly working modal, purely because the copy lost an exclamation mark and the
emoji became an SVG.

The app now carries stable hooks for exactly this — `data-grid`, `data-cell`,
`data-active`, `data-in-word`, `data-wrong`, `data-celebrating`, `data-timer`,
`data-complete-modal`, `data-complete-mark`, `data-clue-warning`,
`data-clue-tally` — and all fourteen harnesses were migrated onto them. **A test
should not be able to fail because a colour changed.**

### Admin
Mechanically mapped onto the palette rather than redesigned — it was not part of
the mockups, and it stays desktop-only. It gains a dark mode for free. Two
mechanical-pass bugs worth remembering:
- A negative lookbehind of `(?<![-\\w:])` silently skipped every `hover:` and
  `focus:` prefixed class, leaving a scatter of old shades behind. `(?<![-\\w])`
  is the correct guard.
- Twelve buttons were `bg-accent text-white`. White reads fine on the light
  accent (`#14776a`) and badly on the dark one (`#43c3ab`) — they need
  `text-accent-ink`, which flips with the accent.

Admin's *layout* is untouched and could use a proper pass later.

### Verification
Full suite green after migration: `freshstart`, `solve` plain + check, `revisit`,
`banner`, `mobile-solve`, `skipfilled` (10 + mobile), `clock`, `staleprogress`
(5/5), `stability` on 15×15 and 21×21, `admin-cluewarn`. No console or page
errors anywhere. `tsc --noEmit` and `next build` clean. Screenshots taken of
library, solver, phone and admin in **both** modes — that is how the two grid
problems above surfaced.

---

## Session 15 — The Arrows Now Skip Completed Answers

Reported as lost functionality after the redesign: "when a word is already
filled in, before it used to skip over it and now it's stopping on the first
letter."

**Nothing broke.** The reducer is byte-identical across the redesign
(`git diff d388811..HEAD -- src/hooks/useCrosswordSolver.ts` is empty) and
`SolverClient`'s diff is className-only. Auto-advance still skips correctly —
a realistic solve seeded with the top six rows of Across left **14 Down answers
complete from crossings, and auto-advance skipped every one**, never once
landing on a filled cell.

The culprit was the **arrows**, which never skipped — that was the explicit
choice in Session 12, on the reasoning that they are how you get back to an
answer that is filled in but wrong. Measuring it settled the argument:

| | arrow presses landing on an already-complete answer |
|---|---|
| before | **13 of 16** |
| after | **0 of 16** |

Thirteen out of sixteen makes the arrows useless exactly when you most want
them, so the Session 12 reasoning was wrong in practice. Tab / `NEXT_WORD` /
`PREV_WORD` and the mobile clue-bar ‹ › now skip answers with no blanks left,
landing on the first blank of the next one that has any.

### What keeps a filled-but-wrong answer reachable
- **Tapping its cell in the grid** — unchanged.
- **The clue list** (desktop panel and mobile sheet) — deliberately still visits
  every clue, filled or not.

That is the line: fast navigation skips, deliberate navigation does not. It also
means Show Incorrect is still followed by an obvious way to reach what it flags.

### Endgame fallback
Both paths fall back to the immediate neighbour when *nothing* is left to fill,
so the arrows keep moving on a finished grid rather than freezing — otherwise a
completed puzzle would be unreviewable. Covered by `skipfilled.mjs` case I.

### Verification
`skipfilled.mjs` is now 10 desktop assertions plus the mobile arrow, all green —
case D inverted (Tab must now skip the full word) and case I is new (arrows still
move on a full grid). The measurement harness is preserved as
`scripts/e2e/arrow-skip.mjs`. Full suite re-run green: `solve` plain + check,
`revisit`, `banner`, `mobile-solve`, `clock`, `freshstart`, `staleprogress` 5/5,
`stability`. `tsc --noEmit` clean.

**Process note:** this is the second time a navigation decision was settled by
argument and then reversed by measurement. The 13/16 number took one short
script and would have settled it in Session 12.

---

## Session 15b — Home Screen Icon on Daylight

The old icon was still the pre-redesign palette: periwinkle field, slate grid,
amber accent square. Five options were drawn from the Daylight tokens and shown
at the sizes that actually matter — 120px (Home Screen), 60px (Settings row),
40px (Spotlight) — with iOS's squircle and Android's adaptive-crop circle
overlaid. **A · Teal field** was chosen: the existing 5×5 concept recoloured,
cream cells on teal with one mint square at the centre.

Rasterizing the options first changed two things:
- **Only the low-detail options survive Spotlight size.** The 5×5 grids turn to
  texture at 40px and the mint accent square disappears entirely. Still legible
  as a crossword, which is what matters, but worth knowing the accent is a
  large-size detail only.
- **Option B was unusable as first drawn.** Using the light `--line` token for
  the grid on a cream field left it with no internal contrast and no edge — it
  washed out completely small, and would have vanished against a light
  wallpaper. Redrawn with the ink colour for the grid before it was shown.

### Two definitions that must agree
The icon exists twice on purpose: `apple-icon.tsx` renders the iOS 180×180
through `next/og`, and `gen-icons.mjs` rasterizes the three manifest PNGs through
`sharp` (manifest icons need stable paths, so they cannot point at Next's hashed
icon route). Both were updated, and the gap/radius geometry in `gen-icons.mjs`
was brought onto the same proportions as the preview so the shipped PNGs match
what was chosen.

`.flatten({ background: FIELD })` was added to the sharp pipeline. The art is
opaque today, but any transparency renders **black** behind the icon on iOS, and
Android's maskable crop expects full bleed — this makes shipping a transparent
one impossible by accident.

### Also fixed
`manifest.ts` still carried the pre-redesign `#b8c8e0` for `background_color` and
`theme_color` — a leftover the redesign missed, since only the `viewport`
`themeColor` in `layout.tsx` had been updated. Android uses these for the splash
screen and system bars. Both now `#f7f4ef`.

### Verification
Live `/apple-icon?<hash>` route fetched 200 and rendered; all three PNGs are the
right dimensions and confirmed fully opaque (alpha 255–255); the manifest serves
the new colours. All four rasterizations were compared side by side against the
chosen option, plus a 56px sample.

**Still needs a real iPhone** (unchanged from Session 10): that iOS honours the
generated route for Add to Home Screen. And remember the icon is cached at
install time — the shortcut has to be removed and re-added to see this.

---

## Session 16 — Solver Header: Difficulty Out, Timer Toggle In, Title Held Still

Three changes to the same strip of chrome.

### Difficulty badge removed from the solver
It stays on the puzzle card, where you are choosing what to play. Once you are
solving, the difficulty tells you nothing you can act on, and the badge was
costing the grid vertical space. Still shown in the completion modal as a stat.
Desktop header 95px, mobile 53px; `difficulty.mjs` asserts it appears on the
library and nowhere in the solver.

### Show timer in the ⋯ menu
Desktop already had a Timer switch in the header, where there is room; mobile had
none. `SolverActions` now takes optional `timerVisible` / `onToggleTimer` and the
menu variant renders a switch. It toggles **visibility only** — the interval is
untouched, so the clock keeps running while hidden and hiding it to take the
pressure off doesn't also stop your time. The menu stays open when flipped: it is
a setting, not an action.

### The title was drifting as the clock ticked
Reported as the title shifting "on certain numbers". Two causes compounding:

1. **DM Sans has no tabular figures.** The redesign dropped `font-mono` from the
   timer and relied on `font-variant-numeric: tabular-nums`, which the face does
   not implement — "1111" measures 20px against 39px for "8888". So the timer's
   width changed on almost every tick.
2. **The header's right block has no fixed width on mobile** (only
   `md:w-64 lg:w-72`), so that resize pushed the `flex-1` centre column.

Measured: **10 distinct title x positions over 11 seconds, 5.6px of drift** on
mobile. Desktop was already stable, but only by accident of the fixed `md:w-64`.

Fixed by reserving the timer's width (`w-16 md:w-[4.5rem] text-right`). Now one
title position on both viewports, and verified from `0:00` through `119:59`
without clipping — `formatTime` has no hour rollover, so a long solve really does
render three digits of minutes. `tabular-nums` is kept in case the face ever
gains the feature, but the reserved width is what holds the layout.

### Two harness traps worth recording
- **The emulated iPhone 13 viewport is 390×664, not 390×844.** Two tests tapped
  at y=700, which is off screen; the taps silently did nothing and burned the
  full 30s Playwright timeout inside a `.catch()`, which then read as "the menu
  won't dismiss". It dismisses fine.
- **Seeding a progress record while the solver is mounted races its save
  effect**, which writes every second and wins. Use a fresh context per value.

`clock.mjs`'s reload tolerance went from ≤2s to ≤3s — a loaded machine can spend
over two seconds on the reload itself, which made it flaky rather than wrong.

### Verification
`solve` plain, `revisit`, `mobile-solve`, `clock`, `timer-toggle`, `stability`
(21×21), `skipfilled` (10 + mobile), `title-shift`, `timer-width`, `difficulty` —
all green, no console or page errors. `tsc --noEmit` and `next build` clean.
Menu screenshotted in both modes.

---

## Session 17 — Backspace Was Trapped Inside One Word

Reported as: backspace works within a word, then gets stuck at the black
squares. Holding the key should keep deleting the last letter in whatever order
you are going.

### The cause
`RETREAT` derived its target from `prevCellInWord`, which **deliberately** stops
at the word's edge — it returns the same cell when there is no previous white
cell in the word. That is correct for movement *within* a word, and it was the
right fix for an earlier bug where hand-rolled `-1` arithmetic cleared the
preceding BLACK cell's record. But it left backspace with nowhere to go: at a
word's first cell the cursor could not move, so nothing more was ever deleted.

`ADVANCE` has a whole word-jumping path for exactly this situation at the *end*
of a word. `RETREAT` never got the mirror image.

### Measured, before the fix
Typed 13 letters across three consecutive across words (auto-advance carries you
between them), then pressed Backspace 23 times: **13 letters still on the grid,
one distinct cursor position.** Not "mostly working" — completely inert, because
auto-advance leaves the cursor on the *first* cell of the next word, which is
the exact spot where the old code was frozen.

### The fix
`prevCellForBackspace(puzzle, row, col, direction)` in `utils.ts`. Within a word
it defers to `prevCellInWord` unchanged; at a word's first cell it steps to the
**last cell of the previous clue** in the same direction, wrapping at the first
clue the way ADVANCE wraps at the last.

Both `RETREAT` and `inputBackspace` call it. They must agree on the target —
one moves the cursor, the other clears the letter — which is why it is one
helper and not two pieces of arithmetic.

### One judgement call: it does NOT skip
Tab and the clue-bar arrows skip answers that are already complete. Backspace
deliberately does not skip words with nothing to delete. **Backspace is
destructive**, and skipping would mean teleporting the cursor into a distant
answer and immediately erasing its last letter. Walking one cell at a time costs
nothing in practice, because the key auto-repeats when held — which is how the
bug was reported in the first place.

### The theoretical hole, left open on purpose
A white cell with no clue in its direction (a one-letter "word" between a black
square and the grid edge) has no word to leave, so the cursor stays. Checked all
three puzzles in the library: **zero such cells** — standard construction
forbids one-letter answers. `ADVANCE` treats the same case identically. Left
documented rather than invented around.

### Verification
New `scripts/e2e/backspace.mjs` — 14 assertions. **Confirmed it fails against
the pre-fix code (6 failures), then passes**, which is the only reason to trust
it. Regression suite re-run green: `skipfilled` (10), `arrow-skip` (0/16),
`solve` plain, `revisit`, `mobile-solve`, `banner`, `staleprogress`,
`freshstart`. No console or page errors. `tsc --noEmit` and `next build` clean.

### Also this session: the solved mark is a trophy now
On the library card, the mark beside your time was a checkmark. A tick reads as
"done" the way a completed form field does — but the card is where you *choose*
a puzzle, so the mark should say you beat this one. It is now a small stroked
trophy in `--gold` (`text-gold`), the same gold as the completion sweep, so the
reward reads as one colour across the app. The time beside it stays
`text-accent`; gold icon against teal figures was checked at 3× in both modes
before it was kept.

Gave it a `data-solved-mark` hook while there. The solved state only renders
once localStorage says so, which makes it the easiest thing on the page to break
without noticing, and nothing was selecting it at all.

`--gold`'s comment in `globals.css` said "celebration only". It no longer is.
