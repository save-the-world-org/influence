import { Avatar } from './Avatar.jsx'
import { formatDistance } from './api.js'

// A beacon on the map: its influencer's photo or initials in their colour, with their name, tagline and distance
// as their show flags allow; an unmapped beacon shows only its name.
export function BeaconPin({ beacon, isTarget }) {
  const inf = beacon.influencer
  const dist = formatDistance(beacon.reading?.distance)
  if (!inf) {
    return (
      <div className="pin plain">
        <span className="pin-dot" />
        <span className="pin-card">
          <strong>{beacon.name}</strong>
        </span>
      </div>
    )
  }
  const show = inf.show || {}
  return (
    <div className={`pin${isTarget ? ' is-target' : ''}`} style={{ '--c': inf.color }}>
      {isTarget && <span className="pulse" />}
      {isTarget && <span className="pulse late" />}
      <Avatar inf={inf} size={isTarget ? 60 : 50} />
      <span className="pin-card">
        {show.name !== false && (
          <strong>
            {inf.emoji ? `${inf.emoji} ` : ''}
            {inf.name}
          </strong>
        )}
        {show.tagline !== false && inf.tagline && <span className="pin-tag">{inf.tagline}</span>}
        {show.distance !== false && dist && <span className="pin-dist">{dist}</span>}
      </span>
    </div>
  )
}
