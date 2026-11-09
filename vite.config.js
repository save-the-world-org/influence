import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The glasses load over a slow link (Meta: under 300 KB and 15 requests on first load), so React's API runs on
// Preact's compat layer: the same components and hooks at a tenth of React's size.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom/client': 'preact/compat/client',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
      'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
    },
  },
})
