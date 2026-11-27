import { useEffect, useState, type FormEvent } from 'react'
import { apiUrl, setPasscodeSession } from '../utils/api'
import './PasscodeLogin.css'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PasscodeLoginProps {
  onSuccess: (label: string) => void
  initialError?: string
}

export default function PasscodeLogin({ onSuccess, initialError = '' }: PasscodeLoginProps) {
  const [passcode, setPasscode] = useState('')
  const [showPasscode, setShowPasscode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  const isStandalone =
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstallApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null)
    }
  }

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
            <div className="passcode-input-wrap">
              <input
                id="passcode-input"
                type={showPasscode ? 'text' : 'password'}
                required
                autoFocus
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter unique passcode"
              />
              <button
                type="button"
                className="passcode-toggle-btn"
                onClick={() => setShowPasscode((prev) => !prev)}
                aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
              >
                {showPasscode ? 'Hide' : 'Show'}
              </button>
            </div>
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

        {!isStandalone && installPrompt && (
          <div className="passcode-desktop-banner">
            <div>
              <strong>Use LS Interiors on Desktop</strong>
              <span>Install as a standalone desktop app in one click.</span>
            </div>
            <button
              type="button"
              onClick={() => void handleInstallApp()}
              className="passcode-install-btn"
            >
              Install App
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
