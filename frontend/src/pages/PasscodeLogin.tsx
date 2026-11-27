import { useState, type FormEvent } from 'react'
import { apiUrl, setPasscodeSession } from '../utils/api'
import './PasscodeLogin.css'

const DESKTOP_EXE_URL =
  (import.meta.env.VITE_DESKTOP_DOWNLOAD_URL as string | undefined)?.trim() ||
  'https://github.com/yuvaraj-marty-spark/upvc-software/releases/latest/download/LS-Interiors-Setup.exe'

interface PasscodeLoginProps {
  onSuccess: (label: string) => void
  initialError?: string
}

export default function PasscodeLogin({ onSuccess, initialError = '' }: PasscodeLoginProps) {
  const [passcode, setPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const isDesktopApp =
    typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(apiUrl('/passcode/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.detail || 'Invalid passcode.')
      }

      setPasscodeSession(data.session_token, data.label)
      onSuccess(data.label)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify passcode.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="passcode-shell">
      <div className="passcode-card">
        <div className="passcode-brand">
          <div className="passcode-logo">LS</div>
          <div>
            <h1>LS INTERIORS</h1>
            <p>Enter your unique passcode to access your workspace</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="passcode-form">
          <label htmlFor="passcode-input">
            Passcode
            <input
              id="passcode-input"
              type="password"
              required
              autoFocus
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter unique passcode"
            />
          </label>
          <button type="submit" className="passcode-submit-btn" disabled={loading}>
            {loading ? 'Checking...' : 'Unlock Workspace'}
          </button>
        </form>

        {error && (
          <p className="passcode-error" role="alert">
            {error}
          </p>
        )}

        {!isDesktopApp && (
          <div className="passcode-desktop-banner">
            <div>
              <strong>Use LS Interiors on Desktop</strong>
              <span>Install the Windows app for a cleaner, dedicated window.</span>
            </div>
            <a
              href={DESKTOP_EXE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="passcode-download-btn"
            >
              Download (.exe)
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
