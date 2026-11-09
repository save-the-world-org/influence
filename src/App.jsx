import { useEffect, useRef, useState } from 'react'

// Ray-Ban Display gives a Web App arrow keys and Enter from the touchpad and the
// Neural Band. The browser moves focus between real buttons and Enter fires a
// normal click, so the app uses plain <button>s and never translates keys itself.
// Back is history.back(): opening a card pushes one entry, so Back comes home.
// The host allows five history entries in all, so at most one is pushed at a time.

const CARDS = [
  { id: 'hello', title: 'Hello', hint: 'Say hi' },
  { id: 'now', title: 'Now', hint: 'Time and date' },
  { id: 'about', title: 'About', hint: 'What this is' },
]

export default function App() {
  const [view, setView] = useState('home')
  const lastCard = useRef('hello')

  useEffect(() => {
    const onPop = () => setView('home')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const open = (id) => {
    lastCard.current = id
    history.pushState({ view: id }, '')
    setView(id)
  }
  const back = () => history.back()

  return (
    <main className="frame">
      {view === 'home' && <Home onOpen={open} focusId={lastCard.current} />}
      {view === 'hello' && <Hello onBack={back} />}
      {view === 'now' && <Now onBack={back} />}
      {view === 'about' && <About onBack={back} />}
    </main>
  )
}

function useAutoFocus() {
  const ref = useRef(null)
  useEffect(() => ref.current?.focus(), [])
  return ref
}

function Home({ onOpen, focusId }) {
  const first = useAutoFocus()
  return (
    <section className="screen home">
      <header>
        <p className="eyebrow">Darkshift</p>
        <h1 className="wordmark">Influence</h1>
        <p className="lede">Hello, world.</p>
      </header>
      <nav className="cards" aria-label="Influence">
        {CARDS.map((c) => (
          <button
            key={c.id}
            ref={c.id === focusId ? first : undefined}
            className="card"
            onClick={() => onOpen(c.id)}
          >
            <span className="card-title">{c.title}</span>
            <span className="card-hint">{c.hint}</span>
          </button>
        ))}
      </nav>
    </section>
  )
}

function Screen({ title, onBack, children, focus = true }) {
  const backRef = useAutoFocus()
  return (
    <section className="screen detail">
      <h2 className="title">{title}</h2>
      <div className="body">{children}</div>
      <button ref={focus ? backRef : undefined} className="pill ghost" onClick={onBack}>
        Back
      </button>
    </section>
  )
}

function Hello({ onBack }) {
  const [count, setCount] = useState(0)
  const waveRef = useAutoFocus()
  return (
    <Screen title="Hello" onBack={onBack} focus={false}>
      <p className="big">{count === 0 ? 'Hi there.' : `${count} ${count === 1 ? 'wave' : 'waves'}`}</p>
      <button ref={waveRef} className="pill" onClick={() => setCount((n) => n + 1)}>
        Wave
      </button>
    </Screen>
  )
}

function Now({ onBack }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <Screen title="Now" onBack={onBack}>
      <p className="clock">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
      <p className="muted">{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    </Screen>
  )
}

function About({ onBack }) {
  return (
    <Screen title="About" onBack={onBack}>
      <p className="muted">
        Influence is a React app on Ray-Ban Display, built and shipped by Infrared.
      </p>
      <img className="logo" src="/brand/Logo_Darkshift_landscape_white.svg" alt="Darkshift" />
    </Screen>
  )
}
