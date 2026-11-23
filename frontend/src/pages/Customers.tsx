
import { useEffect, useState } from 'react'
import type { Language } from '../components/Sidebar'
import { matchesProjectSerial } from '../utils/projectSerials'
import './Customers.css'

export type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  is_active: boolean
}

export type Project = {
  id: string
  customer_id: string
  serial_number?: string
  name: string
  description: string | null
  status: string
  input_unit: string
  output_unit: string
  default_tolerance_mm: number
  default_apply_tolerance: boolean
  created_at?: string
}

type Props = {
  language: Language
  selectedCustomer: Customer | null
  onSelectCustomer: (customer: Customer | null) => void
  onNewOrder: (customer: Customer) => void
  onUpdateOrder: (customer: Customer, project: Project) => void
}

function Customers({
  language,
  selectedCustomer,
  onSelectCustomer,
  onNewOrder,
  onUpdateOrder,
}: Props) {
  const isTamil = language === 'ta'

  const [customers, setCustomers] = useState<Customer[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null)

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  })

  const t = (english: string, tamil: string) =>
    isTamil ? tamil : english

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [customerResponse, projectResponse] =
        await Promise.all([
          fetch('/api/customers/'),
          fetch('/api/projects/'),
        ])

      if (customerResponse.ok) {
        const customerData: Customer[] = await customerResponse.json()
        const projectData: Project[] = projectResponse.ok
          ? await projectResponse.json()
          : []
        setCustomers(customerData)
        setProjects(projectData)
        try {
          localStorage.setItem('ls-interiors-customers', JSON.stringify(customerData))
        } catch {}
        return
      }
    } catch {
      // Backend not reachable - seamless fallback to local storage
    } finally {
      setLoading(false)
    }

    // Client-side fallback for static deployment / offline mode
    try {
      const localCusts = localStorage.getItem('ls-interiors-customers')
      if (localCusts) {
        setCustomers(JSON.parse(localCusts))
        return
      }
      const rawOrders = localStorage.getItem('ls-interiors-saved-orders')
      if (rawOrders) {
        const orders = JSON.parse(rawOrders)
        const extracted: Customer[] = []
        orders.forEach((o: any, idx: number) => {
          if (o.customerName && !extracted.some((c) => c.name.toLowerCase() === o.customerName.toLowerCase())) {
            extracted.push({
              id: o.customerId || `cust-${idx + 1}`,
              name: o.customerName,
              phone: o.customerPhone || '',
              email: '',
              address: '',
              is_active: true,
            })
          }
        })
        if (extracted.length > 0) {
          setCustomers(extracted)
          localStorage.setItem('ls-interiors-customers', JSON.stringify(extracted))
        }
      }
    } catch {}
  }

  useEffect(() => {
    let isActive = true

    loadData().then(() => {
      if (!isActive) return
    })

    return () => {
      isActive = false
    }
  }, [])

  function openAddForm() {
    setEditingCustomer(null)

    setForm({
      name: '',
      phone: '',
      email: '',
      address: '',
    })

    setShowForm(true)
    setError('')
  }

  function openEditForm(customer: Customer) {
    setEditingCustomer(customer)

    setForm({
      name: customer.name,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
    })

    setShowForm(true)
    setError('')
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setSaving(true)
    setError('')

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
    }

    try {
      const url = editingCustomer
        ? `/api/customers/${editingCustomer.id}`
        : '/api/customers/'

      const response = await fetch(url, {
        method: editingCustomer ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const result = await response.json()

        throw new Error(
          result.detail || 'Unable to save customer.',
        )
      }

      const savedCustomer: Customer = await response.json()

      await loadData()

      onSelectCustomer(savedCustomer)

      setShowForm(false)
      setEditingCustomer(null)
    } catch {
      // Local fallback for offline/GitHub Pages deployment
      const localCustomer: Customer = {
        id: editingCustomer ? editingCustomer.id : `cust-${Date.now()}`,
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        address: payload.address,
        is_active: true,
      }
      setCustomers((prev) => {
        const next = editingCustomer
          ? prev.map((c) => (c.id === editingCustomer.id ? localCustomer : c))
          : [localCustomer, ...prev]
        try {
          localStorage.setItem('ls-interiors-customers', JSON.stringify(next))
        } catch {}
        return next
      })
      onSelectCustomer(localCustomer)
      setShowForm(false)
      setEditingCustomer(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCustomer(customer: Customer) {
    const confirmed = window.confirm(
      isTamil
        ? `"${customer.name}" வாடிக்கையாளரை நிச்சயமாக நீக்க விரும்புகிறீர்களா?`
        : `Are you sure you want to delete customer "${customer.name}"?`
    )

    if (!confirmed) return

    try {
      setLoading(true)
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Unable to delete customer.')
      }

      onSelectCustomer(null)
      await loadData()
    } catch {
      setCustomers((prev) => {
        const next = prev.filter((c) => c.id !== customer.id)
        try {
          localStorage.setItem('ls-interiors-customers', JSON.stringify(next))
        } catch {}
        return next
      })
      onSelectCustomer(null)
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter((customer) => {
    const query = search.trim().toLowerCase()
    if (!query) return true

    // Match customer name, phone, email
    const matchCustomer =
      customer.name.toLowerCase().includes(query) ||
      (customer.phone ?? '').toLowerCase().includes(query) ||
      (customer.email ?? '').toLowerCase().includes(query)

    if (matchCustomer) return true

    // Match any project of this customer by project name or project ID (e.g. proj-1)
    return projects.some((project) => {
      if (project.customer_id !== customer.id) return false
      const matchProjName = project.name.toLowerCase().includes(query)
      const matchSerial = matchesProjectSerial(project.serial_number, query)
      return matchProjName || matchSerial
    })
  })

  const customerProjects = selectedCustomer
    ? projects.filter(
        (project) => project.customer_id === selectedCustomer.id,
      )
    : []

  return (
    <div className="customers-workspace">

      <div className="customers-toolbar">
        <div>
          <h2>
            {t('Customer Management', 'வாடிக்கையாளர் மேலாண்மை')}
          </h2>

          <p>
            {t(
              'Manage your customers and their orders.',
              'உங்கள் வாடிக்கையாளர்கள் மற்றும் ஆர்டர்களை நிர்வகிக்கவும்.',
            )}
          </p>
        </div>

        <button
          className="customer-primary-button"
          onClick={openAddForm}
        >
          + {t('Add Customer', 'வாடிக்கையாளரைச் சேர்க்கவும்')}
        </button>
      </div>

      {error && (
        <div className="customer-error">
          {error}
        </div>
      )}

      {showForm && (
        <section className="customer-form-card">

          <div className="customer-section-heading">
            <h3>
              {editingCustomer
                ? t('Edit Customer', 'வாடிக்கையாளர் விவரங்களைத் திருத்து')
                : t('New Customer', 'புதிய வாடிக்கையாளர்')}
            </h3>

            <button
              className="customer-close-button"
              type="button"
              onClick={() => setShowForm(false)}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="customer-form-grid">

              <label>
                {t('Customer Name *', 'வாடிக்கையாளர் பெயர் *')}

                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={150}
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder={t('Enter customer name', 'பெயரை உள்ளிடவும்')}
                />
              </label>

              <label>
                {t('Phone Number', 'தொலைபேசி எண்')}

                <input
                  type="tel"
                  maxLength={20}
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  placeholder={t('Enter phone number', 'தொலைபேசி எண்ணை உள்ளிடவும்')}
                />
              </label>

              <label>
                {t('Email Address', 'மின்னஞ்சல் முகவரி')}

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  placeholder="example@email.com"
                />
              </label>

              <label>
                {t('Address', 'முகவரி')}

                <textarea
                  rows={3}
                  value={form.address}
                  onChange={(event) =>
                    setForm({ ...form, address: event.target.value })
                  }
                  placeholder={t('Enter customer address', 'முகவரியை உள்ளிடவும்')}
                />
              </label>

            </div>

            <div className="customer-form-actions">

              <button
                type="button"
                className="customer-secondary-button"
                onClick={() => setShowForm(false)}
              >
                {t('Cancel', 'ரத்து செய்')}
              </button>

              <button
                type="submit"
                className="customer-primary-button"
                disabled={saving}
              >
                {saving
                  ? t('Saving...', 'சேமிக்கிறது...')
                  : editingCustomer
                    ? t('Update Customer', 'புதுப்பிக்கவும்')
                    : t('Save Customer', 'சேமிக்கவும்')}
              </button>

            </div>
          </form>
        </section>
      )}

      <div className="customers-content-grid">

        {/* CUSTOMER LIST */}

        <section className="customer-list-card">

          <div className="customer-list-heading">
            <div>
              <h3>
                {t('All Customers', 'அனைத்து வாடிக்கையாளர்கள்')}
              </h3>

              <span>
                {customers.length} {t('customers', 'வாடிக்கையாளர்கள்')}
              </span>
            </div>
          </div>

          <input
            className="customer-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t(
              'Search by name, phone, email or ID (e.g. proj-1)...',
              'பெயர், தொலைபேசி, மின்னஞ்சல் அல்லது ID (எ.கா. proj-1) மூலம் தேடவும்...',
            )}
          />

          {loading ? (
            <p className="customer-empty">
              {t('Loading customers...', 'வாடிக்கையாளர்களை ஏற்றுகிறது...')}
            </p>
          ) : filteredCustomers.length === 0 ? (
            <p className="customer-empty">
              {t('No customers found.', 'வாடிக்கையாளர்கள் இல்லை.')}
            </p>
          ) : (
            <div className="customer-list">

              {filteredCustomers.map((customer) => {
                const orderCount = projects.filter(
                  (project) => project.customer_id === customer.id,
                ).length

                return (
                  <button
                    type="button"
                    key={customer.id}
                    className={`customer-list-item ${
                      selectedCustomer?.id === customer.id
                        ? 'selected'
                        : ''
                    }`}
                    onClick={() => {
                      onSelectCustomer(customer)
                      setShowForm(false)
                    }}
                  >

                    <div className="customer-avatar">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="customer-list-info">
                      <strong>{customer.name}</strong>

                      <span>
                        {customer.phone ||
                          t('No phone number', 'தொலைபேசி எண் இல்லை')}
                      </span>
                    </div>

                    <span className="customer-order-count">
                      {orderCount} {t('Orders', 'ஆர்டர்கள்')}
                    </span>

                  </button>
                )
              })}

            </div>
          )}

        </section>

        {/* CUSTOMER PROFILE */}

        <section className="customer-profile-card">

          {!selectedCustomer ? (
            <div className="customer-profile-empty">

              <div className="customer-empty-icon">♙</div>

              <h3>
                {t('Customer Profile', 'வாடிக்கையாளர் விவரம்')}
              </h3>

              <p>
                {t(
                  'Select a customer to view their details and order history.',
                  'விவரங்கள் மற்றும் ஆர்டர் வரலாற்றைக் காண வாடிக்கையாளரைத் தேர்ந்தெடுக்கவும்.',
                )}
              </p>

            </div>
          ) : (
            <>

              <div className="customer-profile-heading">

                <div className="customer-profile-identity">

                  <div className="customer-profile-avatar">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <h3>{selectedCustomer.name}</h3>

                    <span>
                      {t('Customer Profile', 'வாடிக்கையாளர் விவரம்')}
                    </span>
                  </div>

                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="customer-secondary-button"
                    onClick={() => openEditForm(selectedCustomer)}
                  >
                    {t('Edit Details', 'விவரங்களைத் திருத்து')}
                  </button>

                  <button
                    type="button"
                    className="customer-danger-button"
                    onClick={() => handleDeleteCustomer(selectedCustomer)}
                  >
                    {t('Delete Customer', 'வாடிக்கையாளரை நீக்கு')}
                  </button>
                </div>

              </div>

              <div className="customer-detail-grid">

                <div>
                  <span>{t('Phone Number', 'தொலைபேசி எண்')}</span>
                  <strong>{selectedCustomer.phone || '—'}</strong>
                </div>

                <div>
                  <span>{t('Email Address', 'மின்னஞ்சல் முகவரி')}</span>
                  <strong>{selectedCustomer.email || '—'}</strong>
                </div>

                <div className="customer-address-detail">
                  <span>{t('Address', 'முகவரி')}</span>
                  <strong>{selectedCustomer.address || '—'}</strong>
                </div>

              </div>

              {/* ORDER HISTORY */}

              <div className="customer-order-history">

                <div className="customer-section-heading">

                  <div>
                    <h3>
                      {t('Order History', 'ஆர்டர் வரலாறு')}
                    </h3>

                    <p>
                      {customerProjects.length}{' '}
                      {t(
                        'orders linked to this customer',
                        'ஆர்டர்கள்',
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="customer-primary-button"
                    onClick={() => onNewOrder(selectedCustomer)}
                  >
                    + {t('New Order', 'புதிய ஆர்டர்')}
                  </button>

                </div>

                {customerProjects.length === 0 ? (
                  <div className="customer-empty-orders">

                    <p>
                      {t(
                        'No orders have been created for this customer yet.',
                        'இந்த வாடிக்கையாளருக்கு இன்னும் ஆர்டர்கள் இல்லை.',
                      )}
                    </p>

                  </div>
                ) : (
                  <div className="customer-order-list">

                    {customerProjects.map((project) => (
                      <div
                        className="customer-order-item"
                        key={project.id}
                      >

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            {project.serial_number && (
                              <span
                                style={{
                                  backgroundColor: '#2563eb',
                                  color: '#ffffff',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  fontFamily: 'monospace',
                                }}
                              >
                                {project.serial_number}
                              </span>
                            )}
                            <strong>{project.name}</strong>
                          </div>

                          <span>
                            {t('Input', 'உள்ளீடு')}:{' '}
                            {project.input_unit.toUpperCase()}
                            {' · '}
                            {t('Output', 'வெளியீடு')}:{' '}
                            {project.output_unit.toUpperCase()}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            className={`customer-status ${project.status}`}
                          >
                            {project.status}
                          </span>

                          <button
                            type="button"
                            className="customer-secondary-button"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => onUpdateOrder(selectedCustomer, project)}
                          >
                            {t('Update Order', 'ஆர்டரைப் புதுப்பிக்கவும்')}
                          </button>
                        </div>

                      </div>
                    ))}

                  </div>
                )}

              </div>

            </>
          )}

        </section>

      </div>
    </div>
  )
}

export default Customers
