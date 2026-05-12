import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './index.scss'
import App from './App.tsx'
import { applyReduceMotionFromStorage, applyScrollbarPrefFromStorage } from './prefs/workspace'

applyReduceMotionFromStorage()
applyScrollbarPrefFromStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
