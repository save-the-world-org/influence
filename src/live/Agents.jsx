import { useState } from 'react'
import { MCP_URL } from './api.js'
import { TOOLS } from './webmcp.js'

export function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="btn small ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1400)
        } catch {
          window.prompt('Copy this', text)
        }
      }}
    >
      {done ? 'Copied' : label}
    </button>
  )
}

// Agents can drive Influence too: Claude Code through the API's remote MCP server, and an agent in this browser
// through WebMCP when the browser offers it.
export default function Agents({ webmcp, onClose }) {
  const line = `claude mcp add --transport http influence ${MCP_URL}`
  return (
    <aside className="panel agents" aria-label="Agents">
      <header>
        <h2>Agents</h2>
        <button className="btn small ghost" onClick={onClose} aria-label="Close">
          Close
        </button>
      </header>
      <p>Ask Claude Code to “find Kunal”: add Influence as a remote MCP server.</p>
      <div className="code">
        <code>{line}</code>
        <CopyButton text={line} />
      </div>
      <p className="muted">
        WebMCP: {webmcp ? `this page gives the browser's agent ${TOOLS.length} tools` : 'this browser has no navigator.modelContext yet'}.
      </p>
      <ul className="tools">
        {TOOLS.map((t) => (
          <li key={t.name}>
            <code>{t.name}</code> {t.description}
          </li>
        ))}
      </ul>
    </aside>
  )
}
