import { useEffect, useRef, useState } from 'react'
import { Avatar } from './Avatar.jsx'
import { findTarget, formatDistance, stopFinding } from './api.js'
import { bearingDeg, distanceM, normalizeDeg } from './geo.js'

const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

// "find Kunal", "where is Kelsey", "Kunal please" -> "kunal". The API matches the rest fuzzily, since speech
// spells names its own way.
export function parseName(said = '') {
  const s = said
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@'\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const m = s.match(/\b(?:find|seek|locate|where is|where's|show me|take me to|navigate to|go to)\s+(.+)$/)
  return (m ? m[1] : s)
    .replace(/^(?:me|the|to)\s+/, '')
    .replace(/\s+(?:please|now|for me)$/, '')
    .trim()
}

// How far and which way, from this phone: its own UWB reading when it ranged the beacon, else its GPS fix to the
// beacon's estimate, else the reading as the other phone saw it.
function wayTo(reading, me, mySeeker) {
  if (!reading) return {}
  if (reading.seekerId === mySeeker && reading.distance != null) return { distance: reading.distance, arrow: reading.azimuthDeg }
  if (me?.pos && reading.estimate) {
    const b = bearingDeg(me.pos, reading.estimate)
    return { distance: distanceM(me.pos, reading.estimate), arrow: me.heading != null ? b - me.heading : b, northUp: me.heading == null }
  }
  return { distance: reading.distance, arrow: reading.azimuthDeg }
}

// Turn the short way round: 350 -> 10 goes +20, not -340.
function useTurn(angle) {
  const acc = useRef(angle ?? 0)
  if (angle != null) acc.current += normalizeDeg(angle - acc.current)
  return acc.current
}

export default function FindBar({ state, me, mySeeker }) {
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState('')
  const [typed, setTyped] = useState('')
  const [note, setNote] = useState('')
  const rec = useRef(null)

  const target = state?.targets?.find((t) => t.seekerId === mySeeker) || null
  const beacon = target ? state.beacons.find((b) => b.id === target.beaconId) : null
  const inf = (target && state.influencers.find((i) => i.id === target.influencerId)) || beacon?.influencer || null
  const way = wayTo(beacon?.reading || target?.lastReading, me, mySeeker)
  const turn = useTurn(way.arrow)

  useEffect(() => () => rec.current?.abort?.(), [])

  const find = async (said) => {
    const name = parseName(said)
    if (!name) return
    setNote('')
    try {
      const t = await findTarget(name)
      setNote(t.note || '')
      setTyped('')
    } catch (e) {
      setNote(e.message)
    }
  }

  const listen = () => {
    if (listening) return rec.current?.stop()
    const r = new SpeechRecognition()
    r.lang = 'en-US'
    r.interimResults = true
    r.maxAlternatives = 1
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1]
      setHeard(last[0].transcript)
      if (last.isFinal) find(last[0].transcript)
    }
    r.onerror = (e) => setNote(e.error === 'not-allowed' ? 'Allow the microphone to find by voice.' : e.error === 'no-speech' ? 'I heard nothing. Try “find Kunal”.' : `Voice stopped: ${e.error}`)
    r.onend = () => setListening(false)
    rec.current = r
    setHeard('')
    setNote('')
    setListening(true)
    try {
      r.start()
    } catch {
      setListening(false)
    }
  }

  const stop = async () => {
    setNote('')
    try {
      await stopFinding()
    } catch (e) {
      setNote(e.message)
    }
  }

  const people = state?.influencers || []
  return (
    <section className="findbar" aria-label="Find">
      {target && (
        <div className="seek" style={{ '--c': inf?.color || '#3DA992' }}>
          {inf ? <Avatar inf={inf} size={52} /> : <span className="avatar" />}
          <div className="seek-who">
            <span className="eyebrow">Finding</span>
            <strong>{target.name || inf?.name}</strong>
            <span className="seek-sub">{way.distance != null ? (way.northUp ? 'Arrow points from north' : 'Live') : target.note || 'Waiting for a reading…'}</span>
          </div>
          <div className="seek-way">
            <span className="seek-dist">{formatDistance(way.distance) || '—'}</span>
            {way.arrow != null && (
              <svg className="seek-arrow" viewBox="0 0 48 48" style={{ transform: `rotate(${turn}deg)` }} aria-label={`Direction ${Math.round(normalizeDeg(way.arrow))} degrees`}>
                <circle cx="24" cy="24" r="22" />
                <path d="M24 7 L34 33 L24 27 L14 33 Z" />
              </svg>
            )}
          </div>
          <button className="btn ghost" onClick={stop}>
            Stop
          </button>
        </div>
      )}
      <div className="find-row">
        <div className="find-main">
          <div className="chips">
            {people.map((p) => (
              <button key={p.id} className={`chip${inf?.id === p.id ? ' on' : ''}`} style={{ '--c': p.color }} onClick={() => find(p.name)}>
                <span className="chip-dot" />
                {p.emoji ? `${p.emoji} ` : ''}
                {p.name}
              </button>
            ))}
          </div>
          <form
            className="typed"
            onSubmit={(e) => {
              e.preventDefault()
              find(typed)
            }}
          >
            <input value={typed} onInput={(e) => setTyped(e.currentTarget.value)} placeholder="Find someone…" aria-label="Who to find" enterKeyHint="search" />
            <button className="btn" type="submit" disabled={!typed.trim()}>
              Find
            </button>
          </form>
          {(listening || heard || note) && <p className={`heard${note ? ' note' : ''}`}>{note || (heard ? `“${heard}”` : 'Listening… say “find Kunal”')}</p>}
        </div>
        {SpeechRecognition && (
          <button className={`mic${listening ? ' on' : ''}`} onClick={listen} aria-label={listening ? 'Stop listening' : 'Find by voice'}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
            </svg>
          </button>
        )}
      </div>
    </section>
  )
}
