// Small geodesy for the map and the find bar: metres between two points, the bearing from one to another, and an
// accuracy circle as a GeoJSON ring.
const R = 6371008.8
const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI

export function distanceM(a, b) {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function bearingDeg(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat))
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon))
  return (deg(Math.atan2(y, x)) + 360) % 360
}

export function circleRing(lat, lon, radiusM, steps = 64) {
  const ring = []
  const dLat = deg(radiusM / R)
  const dLon = dLat / Math.cos(rad(lat))
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI
    ring.push([lon + dLon * Math.cos(t), lat + dLat * Math.sin(t)])
  }
  return ring
}

// -180..180, so an arrow turns the short way.
export const normalizeDeg = (d) => ((((d + 180) % 360) + 360) % 360) - 180
