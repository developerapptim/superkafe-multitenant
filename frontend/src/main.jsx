import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/glassmorphism.css'
import App from './App.jsx'
import { SocketProvider } from './context/SocketContext'
import { registerSW } from 'virtual:pwa-register'

// Register Service Worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Versi baru aplikasi tersedia. Muat ulang sekarang?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SocketProvider>
      <App />
    </SocketProvider>
  </StrictMode>,
)
