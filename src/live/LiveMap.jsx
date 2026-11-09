import { useEffect, useRef } from 'react'
import { render } from 'preact'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { BeaconPin } from './Pin.jsx'
import { circleRing } from './geo.js'
import footprint from './venue/salt-palace-footprint.json'

// The live map: a dark basemap with no key, each beacon where its last reading puts it (with a soft accuracy
// circle), seekers as a dot with a heading cone, and a line from the seeker to whoever is being found.
const VECTOR_STYLE = 'https://tiles.openfreemap.org/styles/dark'
const RASTER_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png`),
      tileSize: 256,
      maxzoom: 20,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
}
const VENUE = { lat: 40.7672, lon: -111.8947 }
const EMPTY = { type: 'FeatureCollection', features: [] }
const MOVE_MS = 900
const ease = (t) => 1 - (1 - t) ** 3
const lerp = (a, b, k) => a + (b - a) * k

// One or more markers that glide to each new position instead of jumping.
class Glider {
  constructor(map, markers, at) {
    this.markers = markers.map(({ el, ...opts }) => new maplibregl.Marker({ element: el, ...opts }).setLngLat([at.lon, at.lat]).addTo(map))
    this.els = markers.map((m) => m.el)
    this.from = this.to = this.now = at
    this.t0 = 0
  }
  moveTo(at) {
    this.from = this.now
    this.to = at
    this.t0 = performance.now()
  }
  step(time) {
    const k = Math.min(1, (time - this.t0) / MOVE_MS)
    const e = ease(k)
    this.now = {
      lat: lerp(this.from.lat, this.to.lat, e),
      lon: lerp(this.from.lon, this.to.lon, e),
      radius: lerp(this.from.radius || 0, this.to.radius || 0, e),
    }
    for (const m of this.markers) m.setLngLat([this.now.lon, this.now.lat])
    return k < 1
  }
  remove() {
    for (const el of this.els) render(null, el)
    for (const m of this.markers) m.remove()
  }
}

function SeekerDot({ seeker, mine }) {
  return (
    <div className={`seeker${mine ? ' mine' : ''}`}>
      <span className="seeker-dot" />
      <span className="seeker-label">{mine ? 'You' : seeker.name || seeker.id}</span>
    </div>
  )
}

export default function LiveMap({ state, me, mySeeker, focus }) {
  const box = useRef(null)
  const mapRef = useRef(null)
  const beacons = useRef(new Map())
  const seekers = useRef(new Map())
  const frame = useRef(0)
  const view = useRef({ targetBeacon: null, lineFrom: null, color: '#3DA992' })
  const centred = useRef(false)
  const fitted = useRef(false)

  // Draw what follows the markers: the accuracy circles and the line to the target.
  const drawShapes = () => {
    const map = mapRef.current
    const acc = map?.getSource('influence-accuracy')
    const line = map?.getSource('influence-line')
    if (!acc || !line) return
    const features = []
    for (const [id, g] of beacons.current) {
      if (!g.now.radius) continue
      features.push({
        type: 'Feature',
        properties: { color: g.color, target: id === view.current.targetBeacon ? 1 : 0 },
        geometry: { type: 'Polygon', coordinates: [circleRing(g.now.lat, g.now.lon, g.now.radius)] },
      })
    }
    acc.setData({ type: 'FeatureCollection', features })
    const to = beacons.current.get(view.current.targetBeacon)
    const from = seekers.current.get(view.current.lineFrom)
    line.setData(
      to && from
        ? { type: 'Feature', properties: { color: view.current.color }, geometry: { type: 'LineString', coordinates: [[from.now.lon, from.now.lat], [to.now.lon, to.now.lat]] } }
        : EMPTY,
    )
  }

  const tick = (time) => {
    let moving = false
    for (const g of beacons.current.values()) moving = g.step(time) || moving
    for (const g of seekers.current.values()) moving = g.step(time) || moving
    drawShapes()
    frame.current = moving ? requestAnimationFrame(tick) : 0
  }
  const kick = () => {
    if (!frame.current) frame.current = requestAnimationFrame(tick)
  }

  // The map, once.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: box.current,
      style: VECTOR_STYLE,
      center: [VENUE.lon, VENUE.lat],
      zoom: 17.7,
      pitch: 48,
      bearing: -18,
      maxPitch: 70,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    if (import.meta.env.DEV) window.__influenceMap = map
    let styled = false
    map.on('style.load', () => {
      styled = true
      addLayers(map)
      drawShapes()
    })
    // No vector tiles (a blocked host, a flaky link): fall back to CARTO's dark raster tiles.
    map.on('error', () => {
      if (styled || map.__fellBack) return
      map.__fellBack = true
      map.setStyle(RASTER_STYLE)
    })
    return () => {
      cancelAnimationFrame(frame.current)
      for (const g of beacons.current.values()) g.remove()
      for (const g of seekers.current.values()) g.remove()
      beacons.current.clear()
      seekers.current.clear()
      map.remove()
    }
  }, [])

  // Every snapshot: move, add and drop markers.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !state) return
    if (!centred.current && state.venue) {
      centred.current = true
      map.jumpTo({ center: [state.venue.lon, state.venue.lat] })
    }
    const target = state.targets?.find((t) => t.seekerId === mySeeker) || null
    const targetBeacon = target ? state.beacons.find((b) => b.id === target.beaconId) : null

    const seen = new Set()
    for (const b of state.beacons) {
      const est = b.reading?.estimate
      if (!est) continue
      seen.add(b.id)
      const at = { lat: est.lat, lon: est.lon, radius: est.radius }
      let g = beacons.current.get(b.id)
      if (!g) {
        g = new Glider(map, [{ el: document.createElement('div'), anchor: 'center' }], at)
        beacons.current.set(b.id, g)
      } else {
        g.moveTo(at)
      }
      g.color = b.influencer?.color || '#d9f5f3'
      g.els[0].style.zIndex = b.id === target?.beaconId ? '3' : '2'
      render(<BeaconPin beacon={b} isTarget={b.id === target?.beaconId} />, g.els[0])
    }
    for (const [id, g] of beacons.current) if (!seen.has(id)) (g.remove(), beacons.current.delete(id))
    if (!fitted.current && seen.size) {
      fitted.current = true
      const pts = state.beacons.filter((b) => b.reading?.estimate).map((b) => [b.reading.estimate.lon, b.reading.estimate.lat])
      for (const s of state.seekers || []) if (s.lat != null) pts.push([s.lon, s.lat])
      const bounds = pts.reduce((bb, p) => bb.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]))
      const narrow = map.getContainer().clientWidth < 720
      map.fitBounds(bounds, { padding: narrow ? { top: 170, bottom: 250, left: 50, right: 150 } : { top: 140, bottom: 220, left: 120, right: 280 }, maxZoom: 19, pitch: 50, duration: 1400 })
    }

    // Seekers: the server's, with this phone's own fix laid over its copy so it moves at once.
    const list = (state.seekers || []).filter((s) => s.lat != null && s.lon != null)
    if (me?.pos) {
      const mine = { ...(list.find((s) => s.id === mySeeker) || {}), id: mySeeker, ...me.pos, heading: me.heading }
      list.splice(0, list.length, ...list.filter((s) => s.id !== mySeeker), mine)
    }
    const seenSeekers = new Set()
    for (const s of list) {
      seenSeekers.add(s.id)
      const at = { lat: s.lat, lon: s.lon }
      let g = seekers.current.get(s.id)
      if (!g) {
        const cone = document.createElement('div')
        cone.className = 'cone'
        g = new Glider(
          map,
          [
            { el: cone, anchor: 'center', rotationAlignment: 'map', pitchAlignment: 'map' },
            { el: document.createElement('div'), anchor: 'center' },
          ],
          at,
        )
        seekers.current.set(s.id, g)
      } else {
        g.moveTo(at)
      }
      const hasHeading = s.heading != null
      g.els[0].style.opacity = hasHeading ? '1' : '0'
      if (hasHeading) g.markers[0].setRotation(s.heading)
      g.els[0].classList.toggle('mine', s.id === mySeeker)
      render(<SeekerDot seeker={s} mine={s.id === mySeeker} />, g.els[1])
    }
    for (const [id, g] of seekers.current) if (!seenSeekers.has(id)) (g.remove(), seekers.current.delete(id))

    // The line runs from the target's seeker, or else from the phone that ranged the beacon.
    const from = [target?.seekerId, targetBeacon?.reading?.seekerId].find((id) => id && seekers.current.has(id)) || null
    view.current = { targetBeacon: targetBeacon?.id || null, lineFrom: from, color: targetBeacon?.influencer?.color || '#3DA992' }
    kick()
  }, [state, me?.pos, me?.heading, mySeeker])

  // Fly somewhere when asked (this phone's first fix, the venue button).
  useEffect(() => {
    if (focus && mapRef.current) mapRef.current.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(mapRef.current.getZoom(), 18), speed: 0.8 })
  }, [focus])

  return <div ref={box} className="map" />
}

function addLayers(map) {
  const style = map.getStyle()
  // OpenFreeMap's tiles carry building heights: raise them a little so the pitch reads as a place.
  if (style.sources?.openmaptiles && !map.getLayer('influence-buildings')) {
    map.addLayer({
      id: 'influence-buildings',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 15,
      paint: {
        'fill-extrusion-color': '#17282c',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.7,
      },
    })
  }
  map.addSource('influence-venue', { type: 'geojson', data: footprint })
  map.addLayer({ id: 'influence-venue-fill', type: 'fill', source: 'influence-venue', paint: { 'fill-color': '#3DA992', 'fill-opacity': 0.06 } })
  map.addLayer({ id: 'influence-venue-glow', type: 'line', source: 'influence-venue', paint: { 'line-color': '#3DA992', 'line-width': 8, 'line-opacity': 0.18, 'line-blur': 6 } })
  map.addLayer({ id: 'influence-venue-line', type: 'line', source: 'influence-venue', paint: { 'line-color': '#3DA992', 'line-width': 1.5, 'line-opacity': 0.7 } })

  map.addSource('influence-accuracy', { type: 'geojson', data: EMPTY })
  map.addLayer({ id: 'influence-accuracy-fill', type: 'fill', source: 'influence-accuracy', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['==', ['get', 'target'], 1], 0.22, 0.12] } })
  map.addLayer({ id: 'influence-accuracy-line', type: 'line', source: 'influence-accuracy', paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-blur': 1, 'line-opacity': 0.6 } })

  map.addSource('influence-line', { type: 'geojson', data: EMPTY })
  map.addLayer({ id: 'influence-line-glow', type: 'line', source: 'influence-line', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 12, 'line-opacity': 0.25, 'line-blur': 8 } })
  map.addLayer({ id: 'influence-line', type: 'line', source: 'influence-line', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [0.5, 2] } })
}
