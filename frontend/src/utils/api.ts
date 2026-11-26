const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
const API_BASE_URL = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, '') : '/api'

export const ACCESS_TOKEN_KEY = 'ls_interiors_access_token'
export const ADMIN_TOKEN_KEY = 'ls_interiors_admin_token'

export type UserProfile = {
  id: string
  shop_id: string
  full_name: string
  email: string
  phone?: string | null
  role: string
  is_active: boolean
  is_logged_in: boolean
  created_at: string
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {})
  const token = getAccessToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(input, { ...init, headers })

  const isAuthAction =
    (input.includes('/auth/') && !input.includes('/auth/me')) || input.includes('/admin/')
  if ((response.status === 401 || response.status === 403) && !isAuthAction) {
    clearAccessToken()
    const message =
      response.status === 403
        ? 'Your account has been blocked or deactivated by an administrator.'
        : 'Your session has expired. Please sign in again.'
    window.dispatchEvent(new CustomEvent('ls-auth-expired', { detail: { message } }))
  }

  return response
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await authFetch(apiUrl(path), { ...init, headers })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = data?.detail || `Request failed (${response.status})`
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return data as T
}
