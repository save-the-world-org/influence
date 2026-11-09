import { findTarget, mcpTool, stopFinding } from './api.js'

// WebMCP: when the browser offers navigator.modelContext, the page hands an agent in the browser the same four
// actions a person has on it. Two shapes exist in the wild: provideContext({tools}) and registerTool(tool).
const text = (value) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] })
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: e.message || String(e) }] })

export const TOOLS = [
  {
    name: 'find_influencer',
    description: 'Start finding an influencer at KubeCon: the phone seeks their beacon and the glasses show the way. Example: find Kunal.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Who to find, as said: "Kunal", "Kelsey"' } }, required: ['name'] },
    async execute({ name } = {}) {
      try {
        const t = await findTarget(name)
        return text(t.note ? `Finding ${t.name}. ${t.note}` : `Finding ${t.name}.`)
      } catch (e) {
        return fail(e)
      }
    },
  },
  {
    name: 'stop_finding',
    description: 'Stop finding: clears who this phone seeks.',
    inputSchema: { type: 'object', properties: {} },
    async execute() {
      try {
        await stopFinding()
        return text('Stopped.')
      } catch (e) {
        return fail(e)
      }
    },
  },
  {
    name: 'list_influencers',
    description: 'List the influencers, each with their beacon and where it was last seen.',
    inputSchema: { type: 'object', properties: {} },
    async execute() {
      try {
        return await mcpTool('list_influencers')
      } catch (e) {
        return fail(e)
      }
    },
  },
  {
    name: 'where_is',
    description: 'Where an influencer was last seen: distance, direction and an estimated position.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    async execute({ name } = {}) {
      try {
        return await mcpTool('where_is', { name })
      } catch (e) {
        return fail(e)
      }
    },
  },
]

let registered = null
export function registerWebMCP() {
  if (registered !== null) return registered
  const mc = typeof navigator !== 'undefined' ? navigator.modelContext : null
  registered = false
  if (!mc) return registered
  try {
    if (typeof mc.provideContext === 'function') {
      mc.provideContext({ tools: TOOLS })
      registered = true
    } else if (typeof mc.registerTool === 'function') {
      for (const tool of TOOLS) mc.registerTool(tool)
      registered = true
    }
  } catch (e) {
    console.warn('WebMCP registration failed', e)
  }
  return registered
}
