import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import './spatial' // initializes spatial navigation (binds arrow keys) on import
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
