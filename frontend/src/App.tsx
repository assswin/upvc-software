
import { useState } from 'react'

import Customers, {
  type Customer,
  type Project,
} from './pages/Customers'

import Sidebar, {
  type Language,
  type PageKey,
} from './components/Sidebar'

import Measurements from './pages/Measurements'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import Drawings from './pages/Drawings'

import './App.css'

function App() {
  const [language, setLanguage] = useState<Language>('en')

  const [activePage, setActivePage] =
    useState<PageKey>('dashboard')

  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null)

  const [selectedProjectId, setSelectedProjectId] =
    useState<string | null>(null)

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

  function handleUpdateOrder(customer: Customer, project: Project) {
    setSelectedCustomer(customer)
    setSelectedProjectId(project.id)
    setActivePage('measurementsOrders')
  }

  return (
    <div className="app-shell">
      <Sidebar
        language={language}
        onLanguageChange={setLanguage}
        activePage={activePage}
        onNavigate={setActivePage}
      />

      <main className="main-content">
        <header className="dashboard-header">
          <div>
            <h1>
              {language === 'en'
                ? currentTitle.en
                : currentTitle.ta}
            </h1>

            <p>
              {language === 'en'
                ? 'Welcome to LS INTERIORS'
                : 'LS INTERIORS-க்கு வரவேற்கிறோம்'}
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
            onUpdateOrder={handleUpdateOrder}
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
            onOpenMeasurements={(projId) => {
              if (projId) setSelectedProjectId(projId)
              setActivePage('measurementsOrders')
            }}
          />
        ) : activePage === 'settings' ? (
          <Settings language={language} />
        ) : (
          <section className="dashboard-placeholder">
            {currentTitle.en}
          </section>
        )}
      </main>
    </div>
  )
}

export default App
