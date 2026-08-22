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

`threshold.mjs` takes a JSON array of every clue string in the library. Build it
with:

```bash
cd <repo> && set -a && source .env.local && set +a
curl -sS "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/puzzles?select=clues_across,clues_down" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); \
      out=[c for p in d for k in ('clues_across','clues_down') for c in p[k].values()]; \
      json.dump(out, open('/tmp/allclues.json','w'))"
```

`admin-cluewarn.mjs` needs the admin password; it is hardcoded as `rebus`.

`skipfilled.mjs` derives its own test words from `/tmp/grid.json`, so it works
on any puzzle — pass the id as the only argument and fetch the matching grid.

**Positioning trap, if you extend these:** clicking the cell that is *already
active* toggles direction, and auto-advance means the cursor is usually already
sitting on the cell you were about to click. `skipfilled.mjs` has a `go()`
helper that clicks a scratch cell first and then nudges with arrow keys (`MOVE`
derives direction from the delta) to land on a known cell in a known direction.
Three tests "failed" against correct code before that was in place.

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
| `linecount.mjs <id> <label> <w> <h>` | Histogram of how many rendered lines each clue takes in the clue bar, and the text of any that exceed three |
| `threshold.mjs <all-clues.json>` | Sweeps 320/375/390/430px and reports, per width, the longest clue that fits three lines and the shortest that spills — this is where `CLUE_THREE_LINE_LIMIT` comes from |
| `skipfilled.mjs [id]` | 10 desktop assertions plus a mobile one, covering every path that drops the cursor into a word: auto-advance skipping a crossing letter, jumping over a completed word, not ejecting you from an answer you are retyping, Tab/arrows still visiting a full word but landing on its first *blank*, clue-list clicks doing the same, the mobile clue-bar arrow (a separate code path from Tab), and a skipped gap still being reachable |
| `admin-cluewarn.mjs` | Logs into `/admin`, opens an edit page, and checks the over-length clue advisory: exact boundary at 100 chars, trailing space ignored, per-section tally, and that there is **no** `maxlength` cap |

## Not a test script

`gen-icons.mjs` regenerates the PWA icons in `public/`. Run it from the **repo
root** (it needs `sharp` from the project's `node_modules`) only if the icon
artwork changes. Note that changing the icon means removing and re-adding the
Home Screen shortcut on iOS — it caches the icon at install time.
