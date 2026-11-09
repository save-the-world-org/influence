import { initials } from './api.js'

// An influencer as the map and the lens show them: their photo, or their initials, in a ring of their colour.
// Each part honours their own `show` flags.
export function Avatar({ inf, size = 48 }) {
  const show = inf.show || {}
  const photo = show.photo !== false && inf.imageUrl
  const label = show.name !== false ? initials(inf.name) : inf.emoji || '?'
  return (
    <span className="avatar" style={{ '--c': inf.color || '#3DA992', width: `${size}px`, height: `${size}px` }}>
      {photo ? <img src={inf.imageUrl} alt="" referrerPolicy="no-referrer" /> : <span style={{ fontSize: `${Math.round(size * 0.36)}px` }}>{label}</span>}
    </span>
  )
}
