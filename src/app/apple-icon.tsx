import { ImageResponse } from 'next/og'

// iOS uses this one for Add to Home Screen. Must be opaque and square —
// iOS applies its own corner rounding.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const FIELD = '#b8c8e0'
const LINE = '#374151'
const BLACK = '#111827'
const WHITE = '#ffffff'
const ACCENT = '#fbbf24'

// 5x5 with true 180° rotational symmetry, the way a real crossword is built.
// 'b' black, 'a' the amber accent square, '.' white.
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
            gap: 2,
            padding: 2,
            background: LINE,
            borderRadius: 6,
          }}
        >
          {PATTERN.map((row, r) => (
            <div key={r} style={{ display: 'flex', gap: 2 }}>
              {row.split('').map((cell, c) => (
                <div
                  key={c}
                  style={{
                    width: 26,
                    height: 26,
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
