import { useEffect, useMemo, useState } from 'react'
import { Avatar } from './Avatar.jsx'
import { CopyButton } from './Agents.jsx'
import { api, getWriteKey, setWriteKey, store } from './api.js'
import { Wordmark } from './MapPage.jsx'

// The registry: influencers and beacons, each beacon mapped to an influencer or to nobody. Writes send the
// write key when one is set (the API asks for it only when it has WRITE_KEY).
const readKeys = () => {
  try {
    return JSON.parse(store.get('influence.profileKeys', '{}')) || {}
  } catch {
    return {}
  }
}
const profileLink = (id, key) => `${location.origin}${location.pathname}#/me/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`
const BLANK_INF = { name: '', handle: '', tagline: '', imageUrl: '', color: '#3DA992', emoji: '', visible: true }
const BLANK_BEACON = { name: '', hardwareId: '', influencerId: '' }

export default function Registry({ live }) {
  const { state } = live
  const [key, setKey] = useState(getWriteKey)
  const [all, setAll] = useState([])
  const [keys, setKeys] = useState(readKeys)
  const [edit, setEdit] = useState(null) // { kind: 'inf' | 'beacon', id?, draft }
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const changeStamp = useMemo(() => (state?.influencers || []).map((i) => `${i.id}:${i.updatedAt}`).join(), [state?.influencers])
  const reload = () => api('/api/influencers').then(setAll).catch((e) => setError(e.message))
  useEffect(() => {
    reload()
  }, [changeStamp])

  const run = async (what, fn) => {
    setError('')
    setOk('')
    try {
      const out = await fn()
      setOk(what)
      await reload()
      return out
    } catch (e) {
      setError(e.message)
      return null
    }
  }
  const rememberKey = (id, k) => {
    const next = { ...keys, [id]: k }
    setKeys(next)
    store.set('influence.profileKeys', JSON.stringify(next))
  }
  // The API's GET /api/influencers/<id>/key answers with the influencer itself today, so when that has no key,
  // an upsert of the same id (no changes) hands it back instead.
  const getLink = (id) =>
    run('Profile link ready.', async () => {
      let out = await api(`/api/influencers/${encodeURIComponent(id)}/key`)
      if (!out?.profileKey) out = await api('/api/influencers', { method: 'POST', body: { id } })
      if (!out?.profileKey) throw new Error('the API gave no profile key')
      rememberKey(id, out.profileKey)
    })

  const saveInf = (e) => {
    e.preventDefault()
    const { id, draft } = edit
    return run(id ? 'Saved.' : 'Added.', async () => {
      const out = id
        ? await api(`/api/influencers/${encodeURIComponent(id)}`, { method: 'PUT', body: draft })
        : await api('/api/influencers', { method: 'POST', body: draft })
      if (out?.profileKey) rememberKey(out.id, out.profileKey)
      setEdit(null)
    })
  }
  const saveBeacon = (e) => {
    e.preventDefault()
    const { id, draft } = edit
    const body = { ...draft, influencerId: draft.influencerId || null }
    return run(id ? 'Saved.' : 'Added.', async () => {
      await (id ? api(`/api/beacons/${encodeURIComponent(id)}`, { method: 'PUT', body }) : api('/api/beacons', { method: 'POST', body }))
      setEdit(null)
    })
  }
  const mapBeacon = (b, influencerId) => run('Mapped.', () => api(`/api/beacons/${encodeURIComponent(b.id)}`, { method: 'PUT', body: { influencerId: influencerId || null } }))
  const remove = (kind, item) =>
    window.confirm(`Delete ${item.name}?`) && run('Deleted.', () => api(`/api/${kind}/${encodeURIComponent(item.id)}`, { method: 'DELETE' }))
  const demo = () => run(state?.demo ? 'Demo off.' : 'Demo on.', () => api('/api/demo', { method: 'POST', body: { on: !state?.demo } }))

  const set = (field) => (e) => {
    const t = e.currentTarget
    setEdit((x) => ({ ...x, draft: { ...x.draft, [field]: t.type === 'checkbox' ? t.checked : t.value } }))
  }
  const beacons = state?.beacons || []

  return (
    <div className="page">
      <header className="page-head">
        <Wordmark />
        <a className="btn small ghost" href="#/">
          Map
        </a>
      </header>
      <h1>Registry</h1>
      <p className="lede">Who is findable, and which beacon each one carries. A beacon mapped to nobody shows on the map by its name alone.</p>

      <div className="keybar">
        <label htmlFor="wk">Write key</label>
        <input id="wk" type="password" value={key} onInput={(e) => setKey(e.currentTarget.value)} placeholder="Only if the API asks for one" autoComplete="off" />
        <button className="btn small" onClick={() => (setWriteKey(key), setOk(key ? 'Write key kept on this device.' : 'Write key cleared.'))}>
          Keep
        </button>
        <span className="switch" style={{ marginLeft: 'auto' }}>
          Demo
          <button role="switch" aria-checked={state?.demo ? 'true' : 'false'} aria-label="Demo readings" onClick={demo} />
        </span>
      </div>
      {error && <p className="error">{error}</p>}
      {ok && !error && <p className="ok">{ok}</p>}

      <div className="cols">
        <section className="card">
          <div className="card-head">
            <h2>Influencers</h2>
            <button className="btn small" onClick={() => setEdit({ kind: 'inf', draft: { ...BLANK_INF } })}>
              Add
            </button>
          </div>
          {edit?.kind === 'inf' && !edit.id && <InfForm draft={edit.draft} set={set} onSubmit={saveInf} onCancel={() => setEdit(null)} />}
          {!all.length && <p className="empty">Nobody yet.</p>}
          {all.map((i) => (
            <div key={i.id}>
              <div className="row">
                <Avatar inf={i} size={44} />
                <div className="row-main">
                  <strong>
                    {i.emoji ? `${i.emoji} ` : ''}
                    {i.name}
                    {i.visible === false ? ' (hidden)' : ''}
                  </strong>
                  <span>{[i.handle, i.tagline].filter(Boolean).join(' · ') || i.id}</span>
                </div>
                <div className="row-actions">
                  <button className="btn small ghost" onClick={() => setEdit({ kind: 'inf', id: i.id, draft: { name: i.name, handle: i.handle, tagline: i.tagline, imageUrl: i.imageUrl, color: i.color, emoji: i.emoji, visible: i.visible !== false } })}>
                    Edit
                  </button>
                  <button className="btn small danger" onClick={() => remove('influencers', i)}>
                    Delete
                  </button>
                </div>
              </div>
              <div className="linkline">
                {keys[i.id] ? (
                  <>
                    <code>{profileLink(i.id, keys[i.id])}</code>
                    <CopyButton text={profileLink(i.id, keys[i.id])} label="Copy link" />
                    <a className="btn small ghost" href={`#/me/${encodeURIComponent(i.id)}?key=${encodeURIComponent(keys[i.id])}`}>
                      Open
                    </a>
                  </>
                ) : (
                  <button className="btn small ghost" onClick={() => getLink(i.id)}>
                    Get profile link
                  </button>
                )}
              </div>
              {edit?.kind === 'inf' && edit.id === i.id && <InfForm draft={edit.draft} set={set} onSubmit={saveInf} onCancel={() => setEdit(null)} />}
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Beacons</h2>
            <button className="btn small" onClick={() => setEdit({ kind: 'beacon', draft: { ...BLANK_BEACON } })}>
              Add
            </button>
          </div>
          {edit?.kind === 'beacon' && !edit.id && <BeaconForm draft={edit.draft} set={set} people={all} onSubmit={saveBeacon} onCancel={() => setEdit(null)} />}
          {!beacons.length && <p className="empty">No beacons yet.</p>}
          {beacons.map((b) => (
            <div key={b.id}>
              <div className="row">
                <div className="row-main">
                  <strong>{b.name}</strong>
                  <span>
                    {b.hardwareId || 'no hardware id'}
                    {b.reading ? ` · last ${Math.round(b.reading.distance ?? 0)} m from ${b.reading.seekerId}` : ' · no reading yet'}
                  </span>
                </div>
                <label className="field" style={{ minWidth: 130 }}>
                  <select value={b.influencerId || ''} onChange={(e) => mapBeacon(b, e.currentTarget.value)} aria-label={`Who carries ${b.name}`}>
                    <option value="">Nobody</option>
                    {all.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="row-actions">
                  <button className="btn small ghost" onClick={() => setEdit({ kind: 'beacon', id: b.id, draft: { name: b.name, hardwareId: b.hardwareId, influencerId: b.influencerId || '' } })}>
                    Edit
                  </button>
                  <button className="btn small danger" onClick={() => remove('beacons', b)}>
                    Delete
                  </button>
                </div>
              </div>
              {edit?.kind === 'beacon' && edit.id === b.id && <BeaconForm draft={edit.draft} set={set} people={all} onSubmit={saveBeacon} onCancel={() => setEdit(null)} />}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

function InfForm({ draft, set, onSubmit, onCancel }) {
  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="form-2">
        <label className="field">
          Name
          <input value={draft.name} onInput={set('name')} required maxLength={60} />
        </label>
        <label className="field">
          Handle
          <input value={draft.handle} onInput={set('handle')} maxLength={40} placeholder="@handle" />
        </label>
      </div>
      <label className="field">
        Tagline
        <input value={draft.tagline} onInput={set('tagline')} maxLength={140} />
      </label>
      <div className="form-2">
        <label className="field">
          Photo URL (https)
          <input value={draft.imageUrl} onInput={set('imageUrl')} type="url" placeholder="https://" />
        </label>
        <div className="form-2">
          <label className="field">
            Colour
            <input type="color" value={draft.color || '#3DA992'} onInput={set('color')} />
          </label>
          <label className="field">
            Emoji
            <input value={draft.emoji} onInput={set('emoji')} maxLength={8} />
          </label>
        </div>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={draft.visible !== false} onChange={set('visible')} /> Visible on the map
      </label>
      <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn" type="submit">
          Save
        </button>
        <button className="btn ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function BeaconForm({ draft, set, people, onSubmit, onCancel }) {
  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="form-2">
        <label className="field">
          Name
          <input value={draft.name} onInput={set('name')} required maxLength={60} />
        </label>
        <label className="field">
          Hardware id
          <input value={draft.hardwareId} onInput={set('hardwareId')} maxLength={80} placeholder="Bluetooth name or iOS identifier" />
        </label>
      </div>
      <label className="field">
        Carried by
        <select value={draft.influencerId} onChange={set('influencerId')}>
          <option value="">Nobody</option>
          {people.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn" type="submit">
          Save
        </button>
        <button className="btn ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
