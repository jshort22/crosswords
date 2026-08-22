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
npm init -y && npm i playwright @axe-core/playwright axe-core
npx playwright install chromium
```

Then run the scripts from that directory so `import 'playwright'` resolves:

```bash
cp <repo>/scripts/e2e/*.mjs /tmp/e2e/
```

Start the dev server first (`npm run dev` in the repo, on port 3000).

**Except for anything that taps near the bottom of a phone-sized viewport.** The
Next.js dev overlay (`nextjs-portal`) renders `position: fixed` content over that
area — its host element measures 0x0, so it is invisible to
`getBoundingClientRect` but not to taps. It made `key-hits.mjs` report a correct
keyboard as 6/24. Use `npm run build && npx next start -p 3000` for those.

Several scripts read the puzzle grid from `/tmp/grid.json`. Fetch it with:

```bash
cd <repo> && set -a && source .env.local && set +a
curl -sS "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/puzzles?select=grid&id=eq.<PUZZLE_ID>" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  | python3 -c "import json,sys; open('/tmp/grid.json','w').write(json.dumps(json.load(sys.stdin)[0]['grid']))"
```

**Most scripts read `/tmp/grid.json` and will time out with
`waiting for locator(...).nth(N)` if it holds a *different* puzzle's grid than
the id you passed.** That is a data mismatch, not a regression — re-fetch the
grid for the puzzle under test.

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

`admin-cluewarn.mjs` and `theme-admin.mjs` need the admin password; it is hardcoded as `rebus`.

**If your test fills a grid with wrong letters and then keeps clicking**, set
`crossword-wrongshown-<id>` in `localStorage` first. A full-but-wrong grid raises
the "Not quite" modal, and being a modal it intercepts pointer events — every
click after that times out with `<div data-wrong-modal> intercepts pointer
events`. That flag is the intended opt-out. `skipfilled.mjs` does this.

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
| `freshstart.mjs <id...>` | First-visit state on every puzzle, desktop and mobile, in a **pristine** browser context (no storage ever touched — not `localStorage.clear()` after a load): grid must be completely empty, cursor on the first white cell, no modal, no console errors |
| `staleprogress.mjs` | Seeds saved records that no longer match the grid (too small, too big, wrong shape, null) and checks the page still renders. A mismatched record used to throw on render *and* on every reload after it |
| `clock.mjs [id]` | Timer across a session: ticks while in the puzzle, holds while you are out of it, resumes on return, survives a reload, stays monotonic across repeated exits |
| `arrow-skip.mjs` | Seeds the top rows of a grid, then walks the clue-bar arrow 16 times and counts how many presses land on an answer that is already complete. This is the measurement that changed the arrows' behaviour: 13/16 before, 0/16 after |
| `title-shift.mjs` | Records every distinct x position of the puzzle title over ~11s on mobile and desktop, and reports whether the timer's font actually has tabular figures. Should print exactly one position per viewport |
| `timer-toggle.mjs` | The ⋯ menu's Show timer switch: hides the clock face, keeps the menu open, and — the point — the clock still accrues while hidden |
| `difficulty.mjs` | Difficulty appears on the library and nowhere in the solver, on both viewports |
| `backspace.mjs [id]` | Backspace across word boundaries: clearing within a word (unchanged), crossing from a word's first cell into the previous clue's last cell in both directions, and — the point — that holding the key empties everything you typed instead of sticking at the first black square |
| `cluebar-toggle.mjs [id]` | The mobile clue bar's centre tap switches direction instead of opening the clue list: the chip flips A<->D, the cursor does not move, typing then runs the new way, and the clue list is still reachable from the ... menu and still jumps the cursor when you pick from it |
| `a11y.mjs` | axe-core against WCAG 2.2 A/AA across 11 states — both themes, both viewports, and the overlay states (... menu, clue sheet, completion modal) that a page-load scan never sees. Should print zero violations |
| `target-size.mjs [id]` | WCAG 2.2 SC 2.5.8: every interactive target measured against the 24x24px minimum, plus the grid cell size reported separately (it relies on the *essential* exception) |
| `theme-links.mjs [id]` | Theme links end to end: the marquee lights every theme answer, a theme answer lights the marquee and **not** its siblings, an unrelated answer lights nothing, no cell is both linked and in-word, and an empty theme set links nothing. **Self-seeding** — writes a theme set over the REST API and restores the original afterwards, so it needs `set -a && source .env.local && set +a` and the `theme_set` column |
| `theme-admin.mjs` | The admin round-trip for theme links: the radios/checkboxes render, the summary updates, the two roles are mutually exclusive, only one marquee can be checked, it saves to the DB, the editor reflects it on reload, and the solver highlights it. Logs in with the hardcoded password and **restores the puzzle's original `theme_set` afterwards**. Needs `set -a && source .env.local && set +a` |
| `hold-delete.mjs [id]` | Press-and-hold on the mobile ⌫: a 1200ms hold clears many cells (not one — that is the stale-callback failure mode), a tap still clears exactly one, releasing stops it, sliding a finger off the key stops it, and holding past the start of the grid empties it without error |
| `key-hits.mjs [id]` | Keyboard hit targets on three phone sizes: every key centre hits the right key, every key gap and row gap is live (they used to be dead), no dead pixels across a full key pitch, and no key steals its neighbour. **Run this against a production build** — the dev overlay covers the keyboard and makes it fail. |
| `wrong-modal.mjs [id]` | The full-but-wrong modal: it appears centred, the grid's box does not move or resize, the button reads "Keep trying" and dismisses it, it does **not** return on a later full-but-wrong grid, a Reset earns it again, and fixing the last letter still celebrates |
| `admin-cluewarn.mjs` | Logs into `/admin`, opens an edit page, and checks the over-length clue advisory: exact boundary at 100 chars, trailing space ignored, per-section tally, and that there is **no** `maxlength` cap |

## Not a test script

`gen-icons.mjs` regenerates the PWA icons in `public/`. Run it from the **repo
root** (it needs `sharp` from the project's `node_modules`) only if the icon
artwork changes. Note that changing the icon means removing and re-adding the
Home Screen shortcut on iOS — it caches the icon at install time.
