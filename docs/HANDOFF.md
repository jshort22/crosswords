# Crossword Builder — Project Handoff

## What This Is

A personal web app for Jack Short to take crossword puzzles he has made on paper and turn them into polished, playable digital puzzles his friends can solve online. Think NYT Crossword UX but self-hosted, with an admin workflow for uploading and publishing puzzles.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (Postgres) |
| Storage | Supabase Storage (bucket: `puzzle-sources`) |
| PDF parsing | `pdfjs-dist` v5 — server-side, no worker, in-thread via `globalThis.pdfjsWorker` |
| AI | None |
| Auth | Simple password gate on `/admin` — cookie-based, no Supabase Auth |
| Deployment | Not yet deployed — running locally via `npm run dev` |

---

## Running the Project

```bash
cd "Crossword Builder"
npm install
npm run dev
```

Requires `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=https://qfbvoiotkzwrnnnzazmk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
SUPABASE_SERVICE_ROLE_KEY=<key>
```

`pdfjs-dist` is listed in `serverExternalPackages` in `next.config.ts` so Next.js does not bundle it — it runs as a native Node.js module in the API route.

---

## Routes

| Route | Description |
|---|---|
| `/` | Public puzzle list — shows all published puzzles as cards |
| `/puzzles/[id]` | Full crossword solver (NYT-style) |
| `/admin/login` | Password gate for admin (password: `rebus`) |
| `/admin` | Admin puzzle list with draft/published status — requires auth |
| `/admin/new` | 4-step wizard to create a new puzzle — requires auth |
| `/admin/puzzles/[id]/edit` | Edit an existing puzzle's grid, clues, and metadata — requires auth |
| `/api/extract-clues` | POST — accepts a PDF, extracts clue text via pdfjs-dist, returns `{ cluesAcross, cluesDown }` |

---

## Key Source Files

```
src/
├── app/
│   ├── page.tsx                                    # Landing / puzzle list
│   ├── puzzles/[id]/page.tsx                       # Solver page (server, fetches puzzle)
│   ├── admin/
│   │   ├── login/page.tsx                          # Password login page + server action
│   │   └── (protected)/                            # Route group — layout checks cookie
│   │       ├── layout.tsx                          # Redirects to /admin/login if no valid cookie
│   │       ├── page.tsx                            # Admin list (server)
│   │       ├── new/page.tsx                        # Just renders NewPuzzleWizard
│   │       └── puzzles/[id]/edit/page.tsx          # Just renders EditPuzzleClient
│   └── api/extract-clues/route.ts                  # PDF clue extraction (pdfjs-dist, server-side)
│
├── components/
│   ├── PuzzleCard.tsx                    # Card on landing page (server component)
│   ├── PuzzleCardActions.tsx             # Client component: solved state badge + button
│   ├── solver/
│   │   ├── SolverClient.tsx              # Main solver UI (client)
│   │   ├── CrosswordGrid.tsx             # Grid renderer + cell interactions
│   │   ├── CluePanel.tsx                 # Scrollable clue list sidebar
│   │   └── CompletionModal.tsx           # Gold celebration modal
│   └── admin/
│       ├── NewPuzzleWizard.tsx           # 4-step creation wizard (client)
│       ├── EditPuzzleClient.tsx          # Edit existing puzzle (client)
│       ├── GridEditor.tsx                # Keyboard-driven grid builder with 180° symmetry
│       ├── ClueEditor.tsx                # Clue input form per numbered entry
│       └── StepIndicator.tsx             # Wizard step progress bar
│
├── hooks/
│   └── useCrosswordSolver.ts             # All solver state (reducer)
│
└── lib/
    ├── crossword/
    │   ├── types.ts                      # Grid, Clue, CrosswordPuzzle, SolverState types
    │   └── utils.ts                      # Grid numbering, serialization, navigation helpers
    └── supabase/
        ├── client.ts                     # Browser Supabase client
        ├── server.ts                     # Server Supabase client (uses cookies)
        └── types.ts                      # Database type definitions
```

---

## Admin Auth

The admin section is protected by a simple password gate (not Supabase Auth).

- **Login page**: `/admin/login` — renders outside the protected route group, so it never redirects to itself
- **Password**: `rebus`
- **Session**: `httpOnly` cookie named `admin-auth` with value `authenticated`, `sameSite: lax`, 30-day `maxAge`
- **Guard**: `src/app/admin/(protected)/layout.tsx` — reads the cookie with `await cookies()`, redirects to `/admin/login` if missing or wrong
- **Server action** in `login/page.tsx` validates the password and sets the cookie, then redirects to `/admin`. Wrong password redirects to `/admin/login?error=1`.
- **Logout**: not yet implemented — clear the `admin-auth` cookie manually or wait 30 days

---

## Database

Single table: `puzzles`. Schema lives in `supabase/schema.sql` — run this in the Supabase SQL editor to set up (safe to re-run).

### Grid serialization format
The grid is stored as JSONB — an array of rows, each row an array of cell objects:
```json
[{"t": "w", "l": "A", "n": 1}, {"t": "b", "l": "", "n": null}]
```
- `t`: `"w"` (white) or `"b"` (black)
- `l`: solution letter (empty string for black cells)
- `n`: clue number or null

### Clue format
`clues_across` and `clues_down` are JSONB objects keyed by clue number string:
```json
{"1": "They clash with humans in a certain movie franchise", "5": "Natural Earth structure..."}
```

---

## Landing Page

Published puzzles are split into two sections — **15×15** on top, **21×21** below — each sorted by difficulty (Beginner → Expert) left to right. Section headings are small-caps labels (`text-sm font-black tracking-widest uppercase text-gray-600`), no border. If all puzzles are one size, only that section renders.

## Puzzle Card

Each published puzzle is shown as a card with:
- **Grid thumbnail**: live SVG rendered from the `grid` JSONB — rounded corners (`rounded-lg overflow-hidden` on the container). No storage needed.
- **Serif title** (`font-serif` / Playfair Display), centered
- **Two badges**: `Grid: 15×15` (blue, left) and `Difficulty: Medium` (color-coded, right), spread across the card with `justify-between`
- **Hover lift**: `hover:-translate-y-1 transition-all duration-200`
- **Solve/View button**: blue (`bg-blue-600`) when unsolved; gold (`bg-amber-400`) after solving
- **Solved state** (client-side, `PuzzleCardActions.tsx`): trophy + solve time above button; button reads "View Puzzle". Reads `localStorage` key `crossword-solved-{puzzleId}`.

The date and author fields are intentionally not shown on the card.

---

## Solver Layout

The solver is a full-viewport `h-screen` layout (not `min-h-screen`) so nothing overflows the page and both clue panels scroll independently:

```
[Header: w-40 back btn | flex-1 title+difficulty | w-64/72 timer+toggles]
[Main: w-40 left panel | flex-1 grid column | w-64/72 right clue panels]
```

- **Header**: 3-column `flex` layout — widths match the main panels exactly so the title/difficulty badge is centred over the puzzle grid, not the full page.
- **Left panel** (desktop only, `bg-gray-100`, `w-40`): Reset Puzzle and Show Incorrect buttons (white with shadow, `bg-white border shadow-sm`), then Fill (Test) at the bottom of the list (muted gray). First two have inline orange confirmation.
- **Grid column** (`flex-1`): scrollable grid area (grid + error banner) + active clue bar pinned below (outside scroll container, always visible)
- **Right clue panels** (`w-64/72`): Across and Down, each independently scrollable

---

## Solver UX

- Click a cell to focus it; click the same cell again to toggle across/down direction
- Arrow keys move around the grid (and switch direction to match the axis)
- Typing a letter fills the cell and advances to the next cell in the word
- **At the end of a word**: cursor automatically jumps to the first cell of the next word in the same direction (wraps back to the first word), skipping black cells and borders
- Backspace clears the current cell or retreats if already empty
- Active cell: amber highlight; current word: blue highlight
- **Active clue bar**: pinned below the grid (outside the scroll container), always visible; format is "53 Across" / "7 Down" (full word, not abbreviation)
- **Error banner**: shown inside the scrollable grid area when the grid is fully filled but at least one letter is wrong. Disappears as soon as the user edits any cell.
- **Tab / Shift+Tab**: jumps to the first cell of the next / previous word in the current direction (wraps); direction is preserved
- Clue panels on the right (desktop) / below (mobile) — only the active direction's clue is highlighted; panel scrolls to bring the active clue to the top of the list
- Clicking a clue in the Across panel forces direction to across; clicking in the Down panel forces direction to down
- **Back button**: "← All Puzzles" styled as a bordered pill button in the solver header (left column)
- **Timer**: starts immediately when the puzzle page loads. Shown in header (right column) with a toggle switch. Toggle controls visibility only — timer always runs in the background. Timer is a simple incrementer (`setElapsed(e => e + 1)` every second) — does not depend on `state.startTime`. On revisit, `elapsed` is restored from localStorage via `useLayoutEffect` before the first paint; the incrementer continues from that value.
- **Reset Puzzle** button (left panel): clears all entered letters and incorrect markers, resets timer to 0 and removes the solve record; requires inline confirmation
- **Show Incorrect** button (left panel): highlights wrong letters red, leaves blanks untouched; requires inline confirmation. Red letters are stored in `isCorrect` field of `SolverCell`.
- **Fill (Test)** button (left panel): fills all white cells with correct solution letters except the last one, and moves the cursor there — for testing the completion flow
- On completion: gold sweep animation (2.2s, deliberate ease-in) across grid → borders turn gold → modal with time + difficulty
- **Revisiting a solved puzzle**: grid loads fully filled with gold borders and the solve time displayed. No animation or modal on revisit. Reset clears the solved state entirely.

---

## Solver Progress Persistence

Two separate `localStorage` keys per puzzle:

**In-progress**: `crossword-progress-{puzzleId}`
- Saved every second (timer tick) and on every cell change
- Contains `{ cells: SolverCell[][], elapsed: number }`
- On restore: `useLayoutEffect` reads `elapsed` from localStorage and calls `setElapsed(savedElapsed)` before the first paint. The timer incrementer then continues from that value — no `startTime` reconstruction needed.
- Cleared when the puzzle is solved

**Solved**: `crossword-solved-{puzzleId}`
- Written when the puzzle is completed: `{ elapsed: number }`
- On revisit: grid is restored fully filled with gold borders; timer shows solve time (frozen)
- Cleared when the user resets the puzzle
- Read by `PuzzleCardActions.tsx` on the landing page to show the trophy + time and change the button label

---

## Solver Actions (useCrosswordSolver)

The reducer handles these actions:

| Action | Effect |
|---|---|
| `SET_LETTER` | Fills a cell; clears `hasErrors` |
| `CLEAR_LETTER` | Clears a cell; clears `hasErrors` |
| `SET_ACTIVE` | Moves cursor; clicking same cell toggles direction |
| `SET_DIRECTION` | Sets across/down explicitly |
| `MOVE` | Arrow key navigation; changes direction to match axis |
| `ADVANCE` | Moves to next cell in word; at end of word jumps to first cell of next word |
| `RETREAT` | Moves to previous cell in word |
| `NEXT_WORD` | Jumps to first cell of next word in current direction (wraps); triggered by Tab |
| `PREV_WORD` | Jumps to first cell of previous word in current direction (wraps); triggered by Shift+Tab |
| `RESTORE` | Restores saved cells + startTime from localStorage |
| `RESTORE_SOLVED` | Fills all cells with solution letters, sets `isComplete: true` — used when revisiting a completed puzzle |
| `RESET` | Clears all userLetters and isCorrect state; resets startTime to now (timer restarts immediately) |
| `SHOW_INCORRECT` | Marks each filled cell isCorrect true/false by comparing to solution |
| `CHECK_COMPLETE` | Checks if all cells are correctly filled; sets `isComplete` if all correct, sets `hasErrors: true` if all filled but wrong |
| `FILL_FOR_TEST` | Fills all white cells with correct letters except the last one; moves cursor there |

`SolverState` includes `hasErrors: boolean` — set true when the grid is fully filled but incorrect; cleared on any edit or reset.

---

## Difficulty Levels

Five named levels (stored as integers 1–5 in the database):

| Value | Label |
|---|---|
| 1 | Beginner |
| 2 | Easy |
| 3 | Medium |
| 4 | Hard |
| 5 | Expert |

Defined in `difficultyLabel()` in `src/lib/crossword/utils.ts`. A companion `difficultyColors` Record (also exported from `utils.ts`) maps each level to a Tailwind class string including `dark:` variants — used on puzzle cards, solver header badge, and completion modal. Single source of truth for both label and colour.

---

## Admin Wizard Flow (4 steps)

1. **Metadata** — title and difficulty (Beginner / Easy / Medium / Hard / Expert). No author field.
2. **Build Grid** — type-through keyboard input; spacebar makes a cell black; letters fill and auto-advance **skipping black squares** (advance scans forward in reading order for the next white cell); rows wrap automatically; 180° rotational symmetry on by default (toggle to disable); right-click or Ctrl+click also toggles black; 15×15 and 21×21 presets; custom row/col resize; clue numbers auto-assigned
3. **Enter Clues** — upload a PDF or image as a visual reference (stored in Supabase Storage); PDF displays starting from page 2 to skip the grid page; uploading a PDF automatically calls `/api/extract-clues` to pre-populate all clue inputs via text extraction; user reviews and edits; clue inputs are one per numbered across/down entry
4. **Preview & Publish** — summary + live interactive preview; "Save as Draft" always available; "Publish" is disabled until all white grid cells have solution letters

---

## PDF Clue Extraction (`/api/extract-clues`)

- **Input**: multipart POST with a `file` field (PDF only; images are skipped)
- **Output**: `{ cluesAcross: Record<string, string>, cluesDown: Record<string, string> }`
- **Library**: `pdfjs-dist` v5, legacy build, running in-thread (no web worker)
- **Worker setup**: imports `pdf.worker.mjs` and assigns it to `globalThis.pdfjsWorker` before calling `getDocument` — this triggers pdfjs's `#mainThreadWorkerMessageHandler` path, avoiding the need for a browser or Node.js Worker
- **Text reconstruction**: text items grouped by rounded Y coordinate, sorted descending (PDF Y=0 is bottom), then sorted by X within each line
- **Parsing**: finds `ACROSS` / `DOWN` section headers, matches lines starting with a number, handles multi-line clues, strips trailing all-caps answer words (e.g. `APES`, `RUSTPROOF`, `THECLAW`)
- **Failure mode**: silent — if extraction fails or returns nothing, the clue inputs stay empty for manual entry

---

## Supabase Setup Checklist

- [x] `puzzles` table created (via `supabase/schema.sql`)
- [x] RLS policies in place (anon can read/insert/update)
- [x] Grants: `anon` and `authenticated` roles have `select, insert, update` on `puzzles`
- [x] Storage bucket `puzzle-sources` created (public)
- [x] Storage policies allow anon upload and read

---

## Fonts

**Playfair Display** is loaded via `next/font/google` in `layout.tsx` and exposed as the CSS variable `--font-playfair`. `globals.css` maps it to Tailwind's `--font-serif` so the class `font-serif` uses Playfair Display everywhere. Applied to: landing page `<h1>`, puzzle card titles, solver header title, section headings, completion modal heading.

---

## Dark Mode

Class-based dark mode — `dark` class on `<html>`. Tailwind's `dark:` variants are enabled via `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css`.

- **Flash prevention**: inline `<script>` in `<head>` of `layout.tsx` reads `localStorage.getItem('theme')` and adds the `dark` class before React hydrates.
- **Hydration**: `<html>` has `suppressHydrationWarning` so React doesn't strip the `dark` class during hydration (which would cause the toggle to appear broken).
- **Toggle**: `src/components/ThemeToggle.tsx` — client component with a moon/sun SVG icon. Writes to `localStorage` key `theme`. Rendered in both the landing page header and the solver header (next to the timer toggle).
- **Preference**: stored as `'dark'` or `'light'` in `localStorage`. Falls back to `prefers-color-scheme` system preference on first visit.
- **Crossword grid cells**: intentionally NOT themed — white and black cells stay white and black in dark mode (traditional crossword appearance).

---

## What Is NOT Built Yet

- Logout button (admin session expires after 30 days or can be cleared via DevTools)
- Mobile keyboard support (the grid captures keypresses via a focused `div` — works on desktop; mobile would need a hidden `<input>` to trigger the native keyboard)
- Puzzle sharing / social features
- Solver leaderboard / times
- Any deployment / hosting setup

---

## Known Decisions & Gotchas

| Topic | Decision |
|---|---|
| Admin auth | Simple cookie-based password gate (password: `rebus`). Not Supabase Auth. Cookie is `httpOnly`, 30-day expiry. |
| Route group for auth | Admin pages live in `src/app/admin/(protected)/` — the route group layout checks the cookie. Login page is at `src/app/admin/login/` outside the group to avoid infinite redirect. |
| Grid serialization | Compact `{t, l, n}` format in JSONB. `solution` column is redundant (letters are already in `grid`) but kept for potential future use |
| Clue numbering | Auto-assigned on every grid edit using standard crossword rules |
| TypeScript + Supabase | Used `as any` casts on `.insert()` and `.update()` to avoid `RejectExcessProperties` errors from Supabase SDK v2 — acceptable for admin-only mutations |
| Mobile keyboard | Desktop-only — grid captures keypresses via a focused `div` |
| PDF iframe | Uses `#page=2` fragment to open on the clues page; Safari may block iframe PDF rendering |
| pdfjs-dist bundling | Must stay in `serverExternalPackages` in `next.config.ts` — if bundled by webpack, internal dynamic imports inside pdfjs break |
| Turbopack root | `turbopack.root` is explicitly set to `path.resolve(__dirname)` in `next.config.ts`. There is a `package.json` at `/Users/jackshort/Library/Mobile Documents/package.json` (iCloud parent dir) that Turbopack would otherwise find as the workspace root, breaking module resolution. |
| Grid fill requirement | Not required to advance steps in the wizard, but required to publish (Publish button disabled with tooltip if any white cell is empty) |
| Clue panel scroll | Uses `useLayoutEffect` + manual `scrollTop` calculation via `getBoundingClientRect` — specifically avoids `scrollIntoView` which scrolls the whole page, not just the panel |
| Solver progress | In-progress saved to `localStorage` as `{ cells, elapsed }` every second. Solved state saved separately as `{ elapsed }` under `crossword-solved-{id}`. |
| Solver layout | Uses `h-screen overflow-hidden` (not `min-h-screen`) so the page never scrolls — all scrolling happens inside the grid column and clue panels |
| Timer | Simple incrementer: `setElapsed(e => e + 1)` every second. Does NOT use `state.startTime` for tick calculation. Starts from `elapsed` restored by `useLayoutEffect`. RESET calls `setElapsed(0)`. Toggle controls display only. |
| Word auto-advance | At end of word, ADVANCE jumps to first cell of next word in clue order (wraps). Tab/Shift+Tab dispatch NEXT_WORD/PREV_WORD for explicit word skipping. |
| Grid thumbnail | SVG rendered inline in PuzzleCard from the `grid` JSONB — no image storage, always accurate. Container has `rounded-lg overflow-hidden` to clip corners. |
| Author field | Removed from admin UI and save payloads. Column still exists in the database but is always `null` for new puzzles. Public display code checks for author before rendering, so nothing breaks. |
| PuzzleCardActions | Split out of PuzzleCard as a client component solely to read `localStorage` for solved state. PuzzleCard itself remains a server component. |
| Timer restore | `useLayoutEffect` calls `setElapsed(savedElapsed)` before paint. Timer incrementer then continues from that value — no startTime reconstruction. |
| Dark mode | Class-based (`dark` on `<html>`). Inline script in `<head>` prevents flash. `suppressHydrationWarning` on `<html>` prevents React hydration from stripping the `dark` class. ThemeToggle writes `localStorage` key `theme`. Tailwind v4.2 `@custom-variant dark` in globals.css. |
| Fonts | Playfair Display via `next/font/google`. CSS variable `--font-playfair` → `--font-serif` in `@theme inline`. Use `font-serif` Tailwind class. |
| difficultyColors | Exported from `src/lib/crossword/utils.ts` alongside `difficultyLabel`. Includes both light and `dark:` Tailwind classes. Import from utils, not defined per-component. |
| Grid editor advance | Skips black cells in reading order (left-to-right, top-to-bottom). If no white cell exists beyond current position, cursor stays put. |
