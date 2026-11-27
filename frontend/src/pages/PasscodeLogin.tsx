import { useState, type FormEvent } from 'react'
import { apiUrl, setPasscodeSession } from '../utils/api'
import './PasscodeLogin.css'

interface PasscodeLoginProps {
  onSuccess: (label: string) => void
  initialError?: string
}

export default function PasscodeLogin({ onSuccess, initialError = '' }: PasscodeLoginProps) {
  const [passcode, setPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)

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
      </div>
    </div>
  )
}
