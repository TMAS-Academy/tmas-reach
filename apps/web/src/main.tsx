import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { store } from './lib/store'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary scope="TMAS Reach" onResetData={() => store.resetToDefault()}>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
