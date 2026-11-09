import { useEffect, useState } from 'react'
import { Avatar } from './Avatar.jsx'
import { api, formatDistance } from './api.js'
import { Wordmark } from './MapPage.jsx'
import { BeaconPin } from './Pin.jsx'

// An influencer's own page, from the link the registry hands them (#/me/<id>?key=<profile key>): how they appear
// on the map and in the lens, theirs to set. Saves with PUT and their own key.
const FIELDS = ['name', 'handle', 'tagline', 'bio', 'imageUrl', 'color', 'emoji', 'show', 'visible']
const SHOW = [
  ['name', 'My name'],
  ['photo', 'My photo'],
  ['tagline', 'My tagline'],
  ['distance', 'How far away I am'],
]

export default function Me({ id, profileKey, live }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api(`/api/influencers/${encodeURIComponent(id)}`, { key: '' })
      .then((i) => setForm(Object.fromEntries(FIELDS.map((f) => [f, i[f]]))))
      .catch((e) => setError(e.message))
  }, [id])

  const beacon = live.state?.beacons?.find((b) => b.influencerId === id)
  const distance = beacon?.reading?.distance ?? 12
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.currentTarget.value }))
  const flip = (field) => (e) => setForm((f) => ({ ...f, show: { ...f.show, [field]: e.currentTarget.checked } }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved('')
    try {
      const out = await api(`/api/influencers/${encodeURIComponent(id)}`, { method: 'PUT', body: form, key: profileKey })
      setForm(Object.fromEntries(FIELDS.map((f) => [f, out[f]])))
      setSaved('Saved. The map shows it now.')
    } catch (err) {
      setError(/401/.test(err.message) || /key/.test(err.message) ? 'This link’s key does not match. Ask for a new link.' : err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!form) {
    return (
      <div className="page">
        <header className="page-head">
          <Wordmark />
        </header>
        {error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}
      </div>
    )
  }

  const inf = { id, ...form }
  return (
    <div className="page">
      <header className="page-head">
        <Wordmark />
        <a className="btn small ghost" href="#/">
          See the map
        </a>
      </header>
      <span className="eyebrow">KubeCon NA 2026 · Salt Lake City</span>
      <h1>Be found</h1>
      <p className="lede">This is how people at KubeCon find you with Influence: on the live map, and in the lens of their Ray-Ban Display glasses. You choose what shows.</p>
      {!profileKey && <p className="error">This link has no key, so it can show your profile but not save it.</p>}

      <div className="me-grid">
        <form className="card" onSubmit={save} style={{ display: 'grid', gap: 14 }}>
          <div className="form-2">
            <label className="field">
              Name
              <input value={form.name} onInput={set('name')} maxLength={60} required />
            </label>
            <label className="field">
              Handle
              <input value={form.handle} onInput={set('handle')} maxLength={40} placeholder="@you" />
            </label>
          </div>
          <label className="field">
            Tagline
            <input value={form.tagline} onInput={set('tagline')} maxLength={140} placeholder="Ask me about…" />
          </label>
          <label className="field">
            Bio
            <textarea value={form.bio} onInput={set('bio')} maxLength={600} />
          </label>
          <label className="field">
            Photo URL (https)
            <input value={form.imageUrl} onInput={set('imageUrl')} type="url" placeholder="https://" />
          </label>
          <div className="form-2">
            <label className="field">
              Colour
              <input type="color" value={form.color || '#3DA992'} onInput={set('color')} />
            </label>
            <label className="field">
              Emoji
              <input value={form.emoji} onInput={set('emoji')} maxLength={8} placeholder="✨" />
            </label>
          </div>
          <div className="field">
            Show
            <div className="toggles">
              {SHOW.map(([k, label]) => (
                <label key={k} className="toggle">
                  <input type="checkbox" checked={form.show?.[k] !== false} onChange={flip(k)} /> {label}
                </label>
              ))}
            </div>
          </div>
          <label className="toggle" style={{ justifySelf: 'start' }}>
            <input type="checkbox" checked={form.visible !== false} onChange={(e) => setForm((f) => ({ ...f, visible: e.currentTarget.checked }))} /> Findable right now
          </label>
          <div>
            <button className="btn" type="submit" disabled={saving || !profileKey}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          {saved && <p className="ok">{saved}</p>}
        </form>

        <div className="previews">
          <div className="preview">
            <span className="preview-label">On the map</span>
            <div className="preview-map">
              {form.visible !== false ? (
                <BeaconPin beacon={{ id: 'preview', name: 'Beacon', influencer: inf, reading: { distance } }} isTarget />
              ) : (
                <p className="empty" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', margin: 0 }}>
                  Hidden: nobody can find you.
                </p>
              )}
            </div>
          </div>
          <div className="preview">
            <span className="preview-label">In the lens</span>
            <div className="lens">
              <div className="lens-card" style={{ '--c': form.color }}>
                <Avatar inf={inf} size={84} />
                {form.show?.name !== false && <span className="lens-name">{form.name}</span>}
                {form.show?.tagline !== false && form.tagline && <span className="lens-tag">{form.tagline}</span>}
                {form.show?.distance !== false && (
                  <span className="lens-dist">
                    <svg viewBox="0 0 48 48" style={{ transform: 'rotate(35deg)' }} aria-hidden="true">
                      <path d="M24 5 L36 37 L24 30 L12 37 Z" />
                    </svg>
                    {formatDistance(distance).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
