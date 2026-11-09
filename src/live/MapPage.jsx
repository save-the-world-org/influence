import { useEffect, useRef, useState } from 'react'
import { getSeekerId } from './api.js'
import { useMyDevice } from './device.js'
import { distanceM } from './geo.js'
import Agents from './Agents.jsx'
import FindBar from './FindBar.jsx'
import LiveMap from './LiveMap.jsx'
import Minimap from './Minimap.jsx'
import { registerWebMCP } from './webmcp.js'

export function Wordmark() {
  return (
    <a className="brand" href="#/">
      <img src="/brand/Logo_Darkshift_sign_white.svg" alt="" />
      <span className="wordmark">Influence</span>
    </a>
  )
}

const LOCATE = { off: 'Use my location', asking: 'Locating…', on: 'Location on', denied: 'Location blocked', unsupported: 'No location' }

export default function MapPage({ live }) {
  const { state, live: connected, error } = live
  const me = useMyDevice()
  const mySeeker = getSeekerId()
  const [agents, setAgents] = useState(false)
  const [webmcp] = useState(registerWebMCP)
  const [focus, setFocus] = useState(null)
  const flown = useRef(false)

  // This phone's first fix: fly to it when it is at the venue (within 2 km), and stay on the venue otherwise.
  useEffect(() => {
    if (flown.current || !me.pos || !state?.venue) return
    flown.current = true
    if (distanceM(me.pos, state.venue) < 2000) setFocus({ ...me.pos })
  }, [me.pos, state?.venue])

  return (
    <div className="mappage">
      <LiveMap state={state} me={me} mySeeker={mySeeker} focus={focus} />
      <header className="topbar">
        <Wordmark />
        <span className={`live-dot${connected ? ' on' : ''}`} title={connected ? 'Live' : error || 'Connecting'}>
          {connected ? 'Live' : 'Connecting'}
        </span>
        {state?.demo && <span className="tag">Demo</span>}
        <nav className="topnav">
          <button className={`btn small${me.status === 'on' ? ' on' : ''}`} onClick={me.start} disabled={me.status === 'unsupported'}>
            {LOCATE[me.status]}
            {me.heading != null ? ` · ${me.heading}°` : ''}
          </button>
          <button className="btn small ghost" onClick={() => setFocus(state?.venue ? { ...state.venue } : null)}>
            Venue
          </button>
          <button className={`btn small ghost${agents ? ' on' : ''}`} onClick={() => setAgents((a) => !a)}>
            Agents
          </button>
          <a className="btn small ghost" href="#/registry">
            Registry
          </a>
        </nav>
      </header>
      <Minimap state={state} me={me} mySeeker={mySeeker} />
      {agents && <Agents webmcp={webmcp} onClose={() => setAgents(false)} />}
      <FindBar state={state} me={me} mySeeker={mySeeker} />
    </div>
  )
}
