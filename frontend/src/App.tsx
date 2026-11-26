import { useEffect, useState } from 'react'

import Customers, { type Customer } from './pages/Customers'
import Sidebar, { type Language, type PageKey } from './components/Sidebar'
import Measurements from './pages/Measurements'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import Drawings from './pages/Drawings'
import AuthPortal from './pages/AuthPortal'
import {
  apiRequest,
  clearAccessToken,
  getAccessToken,
  type UserProfile,
} from './utils/api'

import './App.css'

function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [authNotice, setAuthNotice] = useState<string>('')
  const [authChecking, setAuthChecking] = useState<boolean>(() => Boolean(getAccessToken()))
  const [language, setLanguage] = useState<Language>('en')
  const [activePage, setActivePage] = useState<PageKey>('dashboard')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      return
    }
    let active = true
    apiRequest<UserProfile>('/auth/me')
      .then((profile) => {
        if (active) setUserProfile(profile)
      })
      .catch(() => {
        clearAccessToken()
        if (active) setUserProfile(null)
      })
      .finally(() => {
        if (active) setAuthChecking(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleExpired = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>
      setUserProfile(null)
      setSelectedCustomer(null)
      setSelectedProjectId(null)
      setAuthNotice(customEvent.detail?.message || '')
    }
    window.addEventListener('ls-auth-expired', handleExpired)
    return () => window.removeEventListener('ls-auth-expired', handleExpired)
  }, [])

  useEffect(() => {
    if (!userProfile) return
    const verifySession = () => {
      if (!getAccessToken()) return
      void apiRequest<UserProfile>('/auth/me').catch(() => {
        // 401/403 is handled by authFetch -> ls-auth-expired
      })
    }
    const intervalId = window.setInterval(verifySession, 10000)
    window.addEventListener('focus', verifySession)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', verifySession)
    }
  }, [userProfile])

  async function handleLogout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' })
    } catch {
      // Ignore network errors on logout
    } finally {
      clearAccessToken()
      setUserProfile(null)
      setSelectedCustomer(null)
      setSelectedProjectId(null)
      setActivePage('dashboard')
    }
  }

  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading LS Interiors...
      </div>
    )
  }

  if (!userProfile) {
    return (
      <AuthPortal
        initialError={authNotice}
        onAuthSuccess={(profile) => {
          setAuthNotice('')
          setUserProfile(profile)
        }}
      />
    )
  }

  const pageTitles: Record<PageKey, { en: string; ta: string }> = {
    dashboard: { en: 'Dashboard', ta: 'முகப்பு' },
    customers: { en: 'Customers', ta: 'வாடிக்கையாளர்கள்' },
    measurementsOrders: {
      en: 'Measurements & Orders',
      ta: 'அளவீடுகள் மற்றும் ஆர்டர்கள்',
    },
    drawings: { en: 'Drawings & PDFs', ta: 'வரைபடங்கள் மற்றும் PDF' },
    settings: { en: 'Settings', ta: 'அமைப்புகள்' },
  }

  const currentTitle = pageTitles[activePage]

  function handleNewOrder(customer: Customer) {
    setSelectedCustomer(customer)
    setSelectedProjectId(null)
    setActivePage('measurementsOrders')
  }

  return (
    <div className="app-shell">
      <Sidebar
        language={language}
        onLanguageChange={setLanguage}
        activePage={activePage}
        onNavigate={setActivePage}
        userProfile={userProfile}
        onLogout={() => void handleLogout()}
      />

      <main className="main-content">
        <header className="dashboard-header">
          <div>
            <h1>{language === 'en' ? currentTitle.en : currentTitle.ta}</h1>
            <p>
              {language === 'en'
                ? `Welcome to LS INTERIORS, ${userProfile.full_name}`
                : `LS INTERIORS-க்கு வரவேற்கிறோம், ${userProfile.full_name}`}
            </p>
          </div>
        </header>

        {activePage === 'dashboard' ? (
          <Dashboard
            language={language}
            onOpenProject={(customer, project) => {
              setSelectedCustomer(customer)
              setSelectedProjectId(project.id)
              setActivePage('measurementsOrders')
            }}
            onNewOrder={() => {
              setSelectedCustomer(null)
              setSelectedProjectId(null)
              setActivePage('measurementsOrders')
            }}
          />
        ) : activePage === 'customers' ? (
          <Customers
            language={language}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={setSelectedCustomer}
            onNewOrder={handleNewOrder}
          />
        ) : activePage === 'measurementsOrders' ? (
          <Measurements
            key={selectedProjectId || (selectedCustomer ? `customer-${selectedCustomer.id}` : 'new-order')}
            selectedCustomer={selectedCustomer}
            initialProjectId={selectedProjectId}
            language={language}
          />
        ) : activePage === 'drawings' ? (
          <Drawings
            language={language}
            initialProjectId={selectedProjectId}
            onOpenMeasurements={(projId, customer) => {
              if (projId) setSelectedProjectId(projId)
              if (customer) setSelectedCustomer(customer)
              setActivePage('measurementsOrders')
            }}
          />
        ) : activePage === 'settings' ? (
          <Settings
            language={language}
            userProfile={userProfile}
            onLogout={() => void handleLogout()}
          />
        ) : (
          <section className="dashboard-placeholder">{currentTitle.en}</section>
        )}
      </main>
    </div>
  )
}

export default App
