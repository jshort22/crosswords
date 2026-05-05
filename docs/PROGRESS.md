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
