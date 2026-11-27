import { useState, type FormEvent } from 'react'
import { ADMIN_TOKEN_KEY, apiRequest, setAccessToken, type UserProfile } from '../utils/api'
import './AuthPortal.css'

type AuthScreen =
  | 'login'
  | 'loginOtp'
  | 'register'
  | 'forgotPassword'
  | 'resetPassword'
  | 'adminLogin'
  | 'adminDashboard'

interface AuthPortalProps {
  onAuthSuccess: (profile: UserProfile) => void
  initialError?: string
}

export default function AuthPortal({ onAuthSuccess, initialError = '' }: AuthPortalProps) {
  const [screen, setScreen] = useState<AuthScreen>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [message, setMessage] = useState('')

  // Login / Register
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  // OTP / Reset
  const [otpRequested, setOtpRequested] = useState(false)
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // Admin
  const [adminPasscode, setAdminPasscode] = useState('')
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([])
  const [adminLoading, setAdminLoading] = useState(false)

  function switchScreen(next: AuthScreen) {
    setScreen(next)
    setError('')
    setMessage('')
  }

  async function completeLoginWithToken(token: string) {
    setAccessToken(token)
    const profile = await apiRequest<UserProfile>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    onAuthSuccess(profile)
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await apiRequest<{ requires_otp?: boolean; access_token?: string; message?: string }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
      )
      if (res.requires_otp) {
        setOtp('')
        setMessage(res.message || 'Verification code sent to your email.')
        setScreen('loginOtp')
      } else if (res.access_token) {
        await completeLoginWithToken(res.access_token)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await apiRequest<UserProfile>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone: phone.trim() || null,
          password,
        }),
      })
      setMessage('Account created! Please sign in.')
      setPassword('')
      setScreen('login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendLoginOtp() {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await apiRequest<{ message: string }>('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMessage(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await apiRequest<{ access_token: string }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      })
      await completeLoginWithToken(res.access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await apiRequest<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setOtpRequested(true)
      setMessage(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset code')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyResetOtp(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await apiRequest<{ reset_token: string }>('/auth/verify-reset-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      })
      setResetToken(res.reset_token)
      setOtpRequested(false)
      setOtp('')
      setScreen('resetPassword')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid reset code')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await apiRequest<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }),
      })
      setNewPassword('')
      setResetToken('')
      setMessage(res.message)
      setScreen('login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  async function loadAdminUsers(tokenOverride?: string) {
    const token = tokenOverride || sessionStorage.getItem(ADMIN_TOKEN_KEY)
    if (!token) return
    setAdminLoading(true)
    try {
      const users = await apiRequest<UserProfile[]>('/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setAdminUsers(users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setAdminLoading(false)
    }
  }

  async function handleAdminLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await apiRequest<{ admin_token: string; message: string }>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ passcode: adminPasscode }),
      })
      sessionStorage.setItem(ADMIN_TOKEN_KEY, res.admin_token)
      setScreen('adminDashboard')
      await loadAdminUsers(res.admin_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid admin passcode')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleBlockUser(userId: string) {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY)
    if (!token) return
    setError('')
    try {
      const updated = await apiRequest<UserProfile>(`/admin/users/${userId}/toggle-block`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setAdminUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    }
  }

  async function handleDeleteUser(userId: string) {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY)
    if (!token) return
    setError('')
    try {
      await apiRequest(`/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setAdminUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  return (
    <div className="auth-portal-shell">
      <div className={`auth-portal-card ${screen === 'adminDashboard' ? 'admin-wide' : ''}`}>
        <div className="auth-portal-brand">
          <div className="auth-logo">LS</div>
          <div>
            <h1>LS INTERIORS</h1>
            <p>
              {screen === 'adminLogin'
                ? 'Admin Verification'
                : screen === 'adminDashboard'
                  ? 'Admin Management'
                  : screen === 'register'
                    ? 'Create Staff / Owner Account'
                    : 'Sign in to Window Management'}
            </p>
          </div>
        </div>

        {screen === 'login' && (
          <form onSubmit={handleLogin} className="auth-portal-form">
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@lsinteriors.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </label>
            <button type="submit" className="auth-primary-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="auth-links-row">
              <button type="button" onClick={() => switchScreen('register')}>
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtpRequested(false)
                  setOtp('')
                  switchScreen('forgotPassword')
                }}
              >
                Forgot Password?
              </button>
            </div>
            <div className="auth-admin-link">
              <button type="button" onClick={() => switchScreen('adminLogin')}>
                🔒 Admin Portal
              </button>
            </div>
          </form>
        )}

        {screen === 'register' && (
          <form onSubmit={handleRegister} className="auth-portal-form">
            <label>
              Full Name
              <input
                type="text"
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter full name"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@lsinteriors.com"
              />
            </label>
            <label>
              Phone (Optional)
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
              />
            </label>
            <button type="submit" className="auth-primary-btn" disabled={loading}>
              {loading ? 'Creating...' : 'Register'}
            </button>
            <div className="auth-links-row">
              <button type="button" onClick={() => switchScreen('login')}>
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {screen === 'loginOtp' && (
          <form onSubmit={handleVerifyOtp} className="auth-portal-form">
            <label>
              Email
              <input type="email" value={email} disabled />
            </label>
            <label>
              6-Digit OTP
              <input
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP code"
              />
            </label>
            <button type="submit" className="auth-primary-btn" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <div className="auth-links-row">
              <button type="button" onClick={() => void handleResendLoginOtp()} disabled={loading}>
                Resend OTP
              </button>
              <button type="button" onClick={() => switchScreen('login')}>
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {screen === 'forgotPassword' && (
          <form
            onSubmit={otpRequested ? handleVerifyResetOtp : handleForgotPassword}
            className="auth-portal-form"
          >
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={otpRequested}
                placeholder="name@lsinteriors.com"
              />
            </label>
            {otpRequested && (
              <label>
                Reset OTP
                <input
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter reset OTP"
                />
              </label>
            )}
            <button type="submit" className="auth-primary-btn" disabled={loading}>
              {loading ? 'Processing...' : otpRequested ? 'Verify Reset OTP' : 'Send Reset Code'}
            </button>
            <div className="auth-links-row">
              <button type="button" onClick={() => switchScreen('login')}>
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {screen === 'resetPassword' && (
          <form onSubmit={handleResetPassword} className="auth-portal-form">
            <label>
              New Password
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
              />
            </label>
            <button type="submit" className="auth-primary-btn" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}

        {screen === 'adminLogin' && (
          <form onSubmit={handleAdminLogin} className="auth-portal-form">
            <label>
              Admin Passcode
              <input
                type="password"
                required
                value={adminPasscode}
                onChange={(e) => setAdminPasscode(e.target.value)}
                placeholder="Enter 6-digit passcode"
              />
            </label>
            <button type="submit" className="auth-primary-btn" disabled={loading}>
              {loading ? 'Verifying...' : 'Open Admin Portal'}
            </button>
            <div className="auth-links-row">
              <button type="button" onClick={() => switchScreen('login')}>
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {screen === 'adminDashboard' && (
          <div className="admin-panel-box">
            <div className="admin-panel-toolbar">
              <h2>Registered Users ({adminUsers.length})</h2>
              <div className="admin-toolbar-actions">
                <button
                  type="button"
                  className="auth-secondary-btn"
                  onClick={() => void loadAdminUsers()}
                  disabled={adminLoading}
                >
                  {adminLoading ? 'Refreshing...' : '↻ Refresh'}
                </button>
                <button
                  type="button"
                  className="auth-secondary-btn"
                  onClick={() => {
                    sessionStorage.removeItem(ADMIN_TOKEN_KEY)
                    setAdminPasscode('')
                    setAdminUsers([])
                    switchScreen('login')
                  }}
                >
                  Exit Admin Panel
                </button>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center' }}>
                        No registered users yet.
                      </td>
                    </tr>
                  ) : (
                    adminUsers.map((u) => (
                      <tr key={u.id}>
                        <td>{u.full_name}</td>
                        <td>{u.email}</td>
                        <td>{u.phone || '—'}</td>
                        <td>{u.role}</td>
                        <td>{u.is_active ? 'Active' : 'Blocked'}</td>
                        <td className="admin-row-actions">
                          <button
                            type="button"
                            className="auth-secondary-btn"
                            onClick={() => void handleToggleBlockUser(u.id)}
                          >
                            {u.is_active ? 'Block' : 'Unblock'}
                          </button>
                          <button
                            type="button"
                            className="auth-danger-btn"
                            onClick={() => void handleDeleteUser(u.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <p className="auth-status error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="auth-status success" role="status">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
