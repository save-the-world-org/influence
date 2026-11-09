import { render } from 'preact'
import { useEffect, useState } from 'react'
import { useLiveState } from './api.js'
import MapPage from './MapPage.jsx'
import Registry from './Registry.jsx'
import Me from './Me.jsx'
import './live.css'

// Hash routes, so nginx serves /live/ as it is: #/ the map, #/registry, #/me/<id>?key=<profile key>.
function useRoute() {
  const read = () => {
    const [path, query] = location.hash.replace(/^#/, '').split('?')
    return { path: path || '/', params: new URLSearchParams(query || '') }
  }
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

function Live() {
  const route = useRoute()
  const live = useLiveState()
  const me = route.path.match(/^\/me\/([^/]+)/)
  if (me) return <Me id={decodeURIComponent(me[1])} profileKey={route.params.get('key') || ''} live={live} />
  if (route.path === '/registry') return <Registry live={live} />
  return <MapPage live={live} />
}

render(<Live />, document.getElementById('live'))
