import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './find.css'

// Find, in the lens: who the phone seeks ("find Kunal"), how far, and which way. It polls the API once a second
// (one small request, no stream, for the glasses' slow link) and adds no dependency to this entry.
const API = (import.meta.env.VITE_API_BASE || 'https://influence-api.darkshift.cloud').replace(/\/$/, '')

// Which phone the lens follows: ?seeker=<id> in the Web App's address (as added in Meta AI), kept for later launches;
// 'phone' when none was ever given.
function seekerId() {
  try {
    const given = new URLSearchParams(window.location.search).get('seeker')?.trim()
    if (given) localStorage.setItem('influence.seeker', given)
    return localStorage.getItem('influence.seeker') || 'phone'
  } catch {
    return 'phone'
  }
}

export default function Find({ onBack }) {
  const [target, setTarget] = useState(undefined) // undefined while loading, null when nobody is sought
  const [offline, setOffline] = useState(false)
  const turn = useRef(0)
  const back = useRef(null)
  useLayoutEffect(() => back.current?.focus(), [])

  useEffect(() => {
    let alive = true
    let timer
    const poll = async () => {
      try {
        const res = await fetch(`${API}/api/target?seeker=${encodeURIComponent(seekerId())}`, { cache: 'no-store' })
        const t = await res.json()
        if (alive) (setTarget(t && t.name ? t : null), setOffline(false))
      } catch {
        if (alive) setOffline(true)
      }
      if (alive) timer = setTimeout(poll, 1000)
    }
    poll()
    return () => ((alive = false), clearTimeout(timer))
  }, [])

  const r = target?.lastReading
  const az = r?.azimuthDeg
  // Turn the short way round: 350 -> 10 is +20, not -340.
  if (az != null) turn.current += ((((az - turn.current + 180) % 360) + 360) % 360) - 180
  const dist = r?.distance != null ? (r.distance < 10 ? r.distance.toFixed(1) : Math.round(r.distance)) : null

  return (
    <section className="screen detail find">
      <h2 className="title">Find</h2>
      <div className="body">
        {target === undefined && <p className="muted">{offline ? 'No link to Influence.' : 'Looking…'}</p>}
        {target === null && <p className="muted">Nobody yet. Say “find Kunal” on the phone.</p>}
        {target && (
          <>
            <p className="find-name">{target.name}</p>
            {dist != null ? (
              <div className="find-way">
                {az != null && (
                  <svg className="find-arrow" viewBox="0 0 48 48" style={{ transform: `rotate(${turn.current}deg)` }} aria-label="Direction">
                    <path d="M24 4 L37 38 L24 30 L11 38 Z" />
                  </svg>
                )}
                <span className="find-dist">{dist} M</span>
              </div>
            ) : (
              <p className="muted">{target.note || 'Waiting for the beacon…'}</p>
            )}
          </>
        )}
      </div>
      <button ref={back} className="pill ghost" onClick={onBack}>
        Back
      </button>
    </section>
  )
}
