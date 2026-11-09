import outline from './venue/salt-palace-outline.svg'
import frame from './venue/salt-palace-frame.json'

// A 2D outline of the Salt Palace with the seekers and beacons on it. salt-palace-frame.json gives the outline's
// viewBox and the lat/lon of its corners; a point maps onto it linearly (affine, from the nw, ne and sw corners).
const box = typeof frame.viewBox === 'string' ? frame.viewBox.split(/[\s,]+/).map(Number) : frame.viewBox
const [x0, y0, w, h] = box
const pick = (...keys) => {
  for (const k of keys) {
    const c = frame.corners?.[k] ?? frame[k]
    if (c) return Array.isArray(c) ? { lat: c[1], lon: c[0] } : { lat: c.lat, lon: c.lon ?? c.lng }
  }
  return null
}
const nw = pick('nw', 'northWest', 'topLeft', 'top_left')
const se = pick('se', 'southEast', 'bottomRight', 'bottom_right')
const ne = pick('ne', 'northEast', 'topRight', 'top_right') || { lat: nw.lat, lon: se.lon }
const sw = pick('sw', 'southWest', 'bottomLeft', 'bottom_left') || { lat: se.lat, lon: nw.lon }

// Solve p = nw + u (ne - nw) + v (sw - nw) for u, v in lat/lon space.
export function toFrame(lat, lon) {
  const ax = ne.lon - nw.lon
  const ay = ne.lat - nw.lat
  const bx = sw.lon - nw.lon
  const by = sw.lat - nw.lat
  const px = lon - nw.lon
  const py = lat - nw.lat
  const det = ax * by - ay * bx
  if (!det) return null
  const u = (px * by - py * bx) / det
  const v = (ax * py - ay * px) / det
  return { x: x0 + u * w, y: y0 + v * h, inside: u >= 0 && u <= 1 && v >= 0 && v <= 1 }
}

export default function Minimap({ state, me, mySeeker }) {
  const seekers = (state?.seekers || []).filter((s) => s.id !== mySeeker && s.lat != null)
  const mine = me?.pos || (state?.seekers || []).find((s) => s.id === mySeeker)
  const dots = (state?.beacons || []).filter((b) => b.reading?.estimate)
  const r = w / 45
  return (
    <figure className="minimap" aria-label="You in the Salt Palace">
      <svg viewBox={box.join(' ')}>
        <image href={outline} x={x0} y={y0} width={w} height={h} />
        {dots.map((b) => {
          const p = toFrame(b.reading.estimate.lat, b.reading.estimate.lon)
          return p && <circle key={b.id} cx={p.x} cy={p.y} r={r} fill={b.influencer?.color || '#d9f5f3'} />
        })}
        {seekers.map((s) => {
          const p = toFrame(s.lat, s.lon)
          return p && <circle key={s.id} cx={p.x} cy={p.y} r={r * 0.8} fill="#d9f5f3" opacity="0.7" />
        })}
        {mine &&
          (() => {
            const p = toFrame(mine.lat, mine.lon)
            return (
              p && (
                <g>
                  <circle className="mini-pulse" cx={p.x} cy={p.y} r={r * 2.2} fill="#4da3ff" opacity="0.35" />
                  <circle cx={p.x} cy={p.y} r={r * 1.1} fill="#4da3ff" stroke="#fff" strokeWidth={r * 0.35} />
                </g>
              )
            )
          })()}
      </svg>
      <figcaption>Salt Palace</figcaption>
    </figure>
  )
}
