// One-off: rasterize the manifest PNGs. Manifest icons need stable paths, so they
// can't point at Next's hashed apple-icon route. Run from the project root.
import sharp from 'sharp'
import path from 'path'

const FIELD = '#b8c8e0', LINE = '#374151', BLACK = '#111827', WHITE = '#ffffff', ACCENT = '#fbbf24'
const PATTERN = ['b..b.', '..b..', 'b.a.b', '..b..', '.b..b']

// scale = fraction of the canvas the grid occupies. Maskable icons must keep art
// inside the centre 80% so Android's adaptive mask can't clip it.
function svg(px, scale) {
  const grid = Math.round(px * scale)
  const gap = Math.max(1, Math.round(grid * 0.014))
  const cell = (grid - gap * 6) / 5
  const origin = (px - grid) / 2
  const rects = []
  PATTERN.forEach((row, r) =>
    row.split('').forEach((ch, c) => {
      const fill = ch === 'b' ? BLACK : ch === 'a' ? ACCENT : WHITE
      const x = origin + gap + c * (cell + gap)
      const y = origin + gap + r * (cell + gap)
      rects.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="${fill}"/>`)
    })
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">
  <rect width="${px}" height="${px}" fill="${FIELD}"/>
  <rect x="${origin}" y="${origin}" width="${grid}" height="${grid}" rx="${Math.round(grid * 0.045)}" fill="${LINE}"/>
  ${rects.join('\n  ')}
</svg>`
}

const out = path.resolve('public')
const jobs = [
  ['icon-192.png', 192, 0.78],
  ['icon-512.png', 512, 0.78],
  ['icon-maskable-512.png', 512, 0.62],
]
for (const [name, px, scale] of jobs) {
  await sharp(Buffer.from(svg(px, scale))).png().toFile(path.join(out, name))
  console.log(`  wrote public/${name}  (${px}x${px}, grid ${Math.round(scale * 100)}%)`)
}
