import { useCallback, useEffect, useRef, useState } from 'react'
import { api, getSeekerId, store } from './api.js'

// This phone as a seeker: its GPS position from watchPosition and its compass heading from DeviceOrientation,
// posted to /api/seekers/<id> at most once a second. iOS asks for both from a tap, so start() runs from one.
export function useMyDevice() {
  const [pos, setPos] = useState(null) // { lat, lon, accuracy }
  const [heading, setHeading] = useState(null)
  const [status, setStatus] = useState('off') // off | asking | on | denied | unsupported
  const watch = useRef(null)
  const last = useRef({ sent: 0, pos: null, heading: null, timer: null })

  const post = useCallback(() => {
    const l = last.current
    if (!l.pos) return
    const wait = 1000 - (Date.now() - l.sent)
    if (wait > 0) {
      if (!l.timer) l.timer = setTimeout(() => ((l.timer = null), post()), wait)
      return
    }
    l.sent = Date.now()
    api(`/api/seekers/${encodeURIComponent(getSeekerId())}`, {
      method: 'POST',
      body: { ...l.pos, heading: l.heading, name: 'This phone' },
      key: '', // seekers need no key
    }).catch(() => {})
  }, [])

  const onOrientation = useCallback(
    (e) => {
      let h = null
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading // iOS: degrees from north
      else if (e.absolute && typeof e.alpha === 'number') h = (360 - e.alpha) % 360 // Android: alpha counts anticlockwise
      if (h == null) return
      h = Math.round(h)
      if (last.current.heading != null && Math.abs(((h - last.current.heading + 540) % 360) - 180) < 3) return
      last.current.heading = h
      setHeading(h)
      post()
    },
    [post],
  )

  const start = useCallback(async () => {
    if (!('geolocation' in navigator)) return setStatus('unsupported')
    setStatus('asking')
    // The compass: iOS 13+ needs requestPermission() from this tap; Android has deviceorientationabsolute.
    try {
      const DOE = window.DeviceOrientationEvent
      if (DOE && typeof DOE.requestPermission === 'function') {
        const answer = await DOE.requestPermission()
        if (answer === 'granted') window.addEventListener('deviceorientation', onOrientation)
      } else if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', onOrientation)
      } else if (DOE) {
        window.addEventListener('deviceorientation', onOrientation)
      }
    } catch {
      /* no compass: the map still shows the dot, without a cone */
    }
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current)
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }
        last.current.pos = next
        setPos(next)
        setStatus('on')
        store.set('influence.locate', '1')
        post()
      },
      (err) => setStatus(err.code === 1 ? 'denied' : 'asking'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    )
  }, [onOrientation, post])

  // Location granted on an earlier visit: pick it up again without a tap (the iOS compass still needs one).
  useEffect(() => {
    if (store.get('influence.locate') !== '1' || !navigator.permissions?.query) return
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((p) => p.state === 'granted' && start())
      .catch(() => {})
  }, [start])

  useEffect(
    () => () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current)
      window.removeEventListener('deviceorientation', onOrientation)
      window.removeEventListener('deviceorientationabsolute', onOrientation)
      clearTimeout(last.current.timer)
    },
    [onOrientation],
  )

  return { pos, heading, status, start }
}
