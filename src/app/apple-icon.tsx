import { ImageResponse } from 'next/og'

// iOS uses this one for Add to Home Screen. Must be opaque and square —
// iOS applies its own corner rounding.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Daylight tokens. Keep these in step with scripts/e2e/gen-icons.mjs, which
// rasterizes the manifest PNGs from the same pattern and geometry — the two
// have to agree or iOS and Android ship different icons.
const FIELD = '#14776a'   // --accent
const LINE = '#211d18'    // the grid's gaps, just off --cell-black
const BLACK = '#17140f'   // --canvas (dark)
const WHITE = '#f7f4ef'   // --canvas (light), as the cell fill
const ACCENT = '#43c3ab'  // --accent (dark), the one square that pops

// 5x5 with true 180° rotational symmetry, the way a real crossword is built.
// 'b' black, 'a' the accent square, '.' a cell.
const PATTERN = [
  'b..b.',
  '..b..',
  'b.a.b',
  '..b..',
  '.b..b',
]

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: FIELD,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: 4,
            background: LINE,
            borderRadius: 7,
          }}
        >
          {PATTERN.map((row, r) => (
            <div key={r} style={{ display: 'flex', gap: 4 }}>
              {row.split('').map((cell, c) => (
                <div
                  key={c}
                  style={{
                    width: 23,
                    height: 23,
                    background: cell === 'b' ? BLACK : cell === 'a' ? ACCENT : WHITE,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  )
}
