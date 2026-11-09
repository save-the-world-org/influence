import { useEffect, useState } from 'react'

// Influence's API (save-the-world-org/influence-api). Reads, readings and the seek target are open; registry
// writes send the write key when one is set, and an influencer's own page sends their profile key instead.
export const API = (import.meta.env.VITE_API_BASE || 'https://influence-api.darkshift.cloud').replace(/\/$/, '')
export const MCP_URL = `${API}/mcp`

// localStorage can throw (private windows, blocked storage): every read and write goes through here.
export const store = {
  get(key, fallback = '') {
    try {
      return localStorage.getItem(key) ?? fallback
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      if (value == null || value === '') localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch {
      /* storage unavailable: the value lives for this page only */
    }
  },
}

export const getWriteKey = () => store.get('influence.writeKey')
export const setWriteKey = (k) => store.set('influence.writeKey', k.trim())
// Which phone this page follows: ?seeker=<id> in the address (the id the seek app shows, such as seeker-1a2b3c),
// kept for later visits; 'phone' when none was ever given.
export const getSeekerId = () => {
  try {
    const given = new URLSearchParams(window.location.search).get('seeker')?.trim()
    if (given) store.set('influence.seeker', given)
  } catch {
    /* no address to read: keep the stored id */
  }
  return store.get('influence.seeker', 'phone') || 'phone'
}

export async function api(path, { method = 'GET', body, key } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  const bearer = key ?? getWriteKey()
  if (bearer) headers.authorization = `Bearer ${bearer}`
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { error: text }
  }
  if (!res.ok) throw new Error(data?.error || `${method} ${path} answered ${res.status}`)
  return data
}

export const findTarget = (name, seeker = getSeekerId()) =>
  api(`/api/target?seeker=${encodeURIComponent(seeker)}`, { method: 'PUT', body: { name } })
export const stopFinding = (seeker = getSeekerId()) =>
  api(`/api/target?seeker=${encodeURIComponent(seeker)}`, { method: 'DELETE' })

// Call one of the API's own MCP tools (where_is, list_influencers) and hand back its MCP result as is.
export async function mcpTool(name, args = {}) {
  const out = await api('/mcp', { method: 'POST', body: { jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } } })
  if (out?.error) throw new Error(out.error.message)
  return out.result
}

// The whole snapshot, live: one GET for the first paint, then Server-Sent Events (`event: state`) on every change.
// EventSource reconnects by itself (the server asks for a 2 s retry).
export function useLiveState() {
  const [state, setState] = useState(null)
  const [live, setLive] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let closed = false
    api('/api/state')
      .then((s) => !closed && setState((prev) => prev || s))
      .catch((e) => !closed && setError(e.message))
    const es = new EventSource(`${API}/api/events`)
    es.addEventListener('state', (e) => {
      try {
        setState(JSON.parse(e.data))
        setLive(true)
        setError('')
      } catch {
        /* a torn frame: the next one replaces it */
      }
    })
    es.onerror = () => setLive(false)
    return () => {
      closed = true
      es.close()
    }
  }, [])
  return { state, live, error }
}

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?'

export const formatDistance = (m) => (m == null || Number.isNaN(m) ? '' : m < 10 ? `${m.toFixed(1)} m` : `${Math.round(m)} m`)
