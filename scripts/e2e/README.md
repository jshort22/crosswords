# Solver end-to-end checks

Ad-hoc Playwright scripts that drive the real solver in a headless browser
against a running dev server. Not a formal test suite — no runner, no CI — but
they caught a genuine regression (`8ca3629`, where `preventDefault()` on cell
taps silently killed physical-keyboard input after any button click) that was
invisible in screenshots and in the happy-path solve.

Keep them working. Re-run them after any change to the solver.

## Setup

Playwright is deliberately **not** a project dependency — it's a dev-only tool
and doesn't belong in the app bundle. Install it somewhere outside the repo:

```bash
mkdir -p /tmp/e2e && cd /tmp/e2e
npm init -y && npm i playwright
npx playwright install chromium
```

Then run the scripts from that directory so `import 'playwright'` resolves:

```bash
cp <repo>/scripts/e2e/*.mjs /tmp/e2e/
```

Start the dev server first (`npm run dev` in the repo, on port 3000).

Several scripts read the puzzle grid from `/tmp/grid.json`. Fetch it with:

```bash
cd <repo> && set -a && source .env.local && set +a
curl -sS "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/puzzles?select=grid&id=eq.<PUZZLE_ID>" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  | python3 -c "import json,sys; open('/tmp/grid.json','w').write(json.dumps(json.load(sys.stdin)[0]['grid']))"
```

**Puzzle ids are hardcoded** in most scripts and will be wrong if the database
is reseeded. Grep for `const ID =` and update.

## The scripts

| Script | What it checks |
|---|---|
| `solve.mjs <id> plain` | Desktop clean solve → gold sweep, trophy modal, timer freeze, solved record, and that a solved grid rejects further input |
| `solve.mjs <id> check` | Same, but runs Show Incorrect on 20 wrong cells first — proves checking your work doesn't spoil the reward |
| `revisit.mjs` | Mid-solve reload restores letters + timer; revisiting a solved puzzle doesn't replay the animation and writes no junk progress record; reset → re-solve works |
| `banner.mjs` | Fills the grid with one wrong letter: error banner appears, no premature gold, celebrates after the fix |
| `mobile-solve.mjs` | Full mobile flow on an emulated iPhone 13 — on-screen keyboard, clue-bar arrows across the Across/Down boundary, clue sheet, complete solve, and that a solved grid ignores the keyboard **even when the `disabled` attribute is bypassed** |
| `stability.mjs <id> <label> <w> <h>` | Walks all clues recording every distinct grid size and clue-bar height. Both sets must have exactly one entry, or the grid is resizing between clues |
| `cluebar.mjs <id> <label>` | Clue-bar height range across every clue, how many need internal scrolling, and that the grid still fits |
| `final-shots.mjs <id>` | Portrait / landscape / desktop layout check — which chrome is visible where, and screenshots to `/tmp/final-*.png` |

## Not a test script

`gen-icons.mjs` regenerates the PWA icons in `public/`. Run it from the **repo
root** (it needs `sharp` from the project's `node_modules`) only if the icon
artwork changes. Note that changing the icon means removing and re-adding the
Home Screen shortcut on iOS — it caches the icon at install time.
