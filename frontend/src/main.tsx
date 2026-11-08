import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App'
import { LogsPage } from './components/requestlog/LogsPage'
import { ToastProvider } from './components/layout/ToastProvider'
import { isLogsPath } from './lib/logsRoute'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      {/* /logs is public: it skips App, so no sign-in check and no session-expired handler. */}
      {isLogsPath() ? <LogsPage /> : <App />}
    </ToastProvider>
  </StrictMode>,
)
