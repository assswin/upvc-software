
import type { UserProfile } from '../utils/api'
import './Sidebar.css'

export type Language = 'en' | 'ta'

export type PageKey =
  | 'dashboard'
  | 'customers'
  | 'measurementsOrders'
  | 'drawings'
  | 'settings'

interface SidebarProps {
  language: Language
  onLanguageChange: (language: Language) => void
  activePage: PageKey
  onNavigate: (page: PageKey) => void
  userProfile?: UserProfile | null
  onLogout?: () => void
}

function Sidebar({
  language,
  onLanguageChange,
  activePage,
  onNavigate,
  userProfile,
  onLogout,
}: SidebarProps) {
  const menuItems: {
    key: PageKey
    en: string
    ta: string
    icon: string
  }[] = [
    {
      key: 'dashboard',
      en: 'Dashboard',
      ta: 'முகப்பு',
      icon: '▦',
    },
    {
      key: 'customers',
      en: 'Customers',
      ta: 'வாடிக்கையாளர்கள்',
      icon: '♙',
    },
    {
      key: 'measurementsOrders',
      en: 'Measurements & Orders',
      ta: 'அளவீடுகள் மற்றும் ஆர்டர்கள்',
      icon: '⌗',
    },
    {
      key: 'drawings',
      en: 'Drawings & PDFs',
      ta: 'வரைபடங்கள் மற்றும் PDF',
      icon: '▧',
    },
    {
      key: 'settings',
      en: 'Settings',
      ta: 'அமைப்புகள்',
      icon: '⚙',
    },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">LS</div>

        <div>
          <h2>LS INTERIORS</h2>
          <p>Window Management</p>
        </div>
      </div>

      <div className="sidebar-section-title">
        {language === 'en' ? 'WORKSPACE' : 'பணியிடம்'}
      </div>

      <nav className="sidebar-menu">
        {menuItems.map((item) => (
          <button
            type="button"
            className={`sidebar-link ${
              activePage === item.key ? 'active' : ''
            }`}
            key={item.key}
            onClick={() => onNavigate(item.key)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span>
              {language === 'en' ? item.en : item.ta}
            </span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {userProfile && (
          <div style={{ marginBottom: '12px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', fontSize: '12px' }}>
            <div style={{ fontWeight: 600, color: '#fff' }}>{userProfile.full_name}</div>
            <div style={{ color: '#94a3b8', marginTop: '2px', wordBreak: 'break-all' }}>{userProfile.email}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ textTransform: 'uppercase', fontSize: '10px', color: '#93c5fd' }}>{userProfile.role}</span>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  style={{
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  {language === 'en' ? 'Logout' : 'வெளியேறு'}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="language-label">
          {language === 'en' ? 'LANGUAGE' : 'மொழி'}
        </div>

        <div className="language-switch">
          <button
            className={language === 'en' ? 'selected' : ''}
            onClick={() => onLanguageChange('en')}
            type="button"
          >
            English
          </button>

          <button
            className={language === 'ta' ? 'selected' : ''}
            onClick={() => onLanguageChange('ta')}
            type="button"
          >
            தமிழ்
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
