
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
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
  created_at?: string
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

type StatusFilter = 'all' | 'active' | 'inactive'
type ProjectFilter = 'all' | 'with-projects' | 'without-projects'

type Props = {
  language: Language
  selectedCustomer: Customer | null
  onSelectCustomer: (customer: Customer | null) => void
  onNewOrder: (customer: Customer) => void
  onUpdateOrder: (customer: Customer, project: Project) => void
}

type CustomerForm = {
  name: string
  phone: string
  email: string
  address: string
}

const EMPTY_FORM: CustomerForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
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
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all')
  const [projectFilter, setProjectFilter] =
    useState<ProjectFilter>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM)

  const t = (english: string, tamil: string) =>
    isTamil ? tamil : english

  async function loadData() {
    try {
      const [customerResponse, projectResponse] =
        await Promise.all([
          fetch('/api/customers/?include_inactive=true'),
          fetch('/api/projects/'),
        ])

      if (!customerResponse.ok) {
        throw new Error('Unable to load customers.')
      }

      if (!projectResponse.ok) {
        throw new Error('Unable to load projects.')
      }

      const customerData: Customer[] =
        await customerResponse.json()
      const projectData: Project[] =
        await projectResponse.json()

      setError('')
      setCustomers(customerData)
      setProjects(projectData)

      try {
        localStorage.setItem(
          'ls-interiors-customers',
          JSON.stringify(customerData),
        )
      } catch {
        // Local storage is optional.
      }
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load customer data.'

      setError(message)

      // Read-only fallback when the backend is unavailable.
      try {
        const localCustomers = localStorage.getItem(
          'ls-interiors-customers',
        )

        if (localCustomers) {
          setCustomers(JSON.parse(localCustomers))
        }

        setProjects([])
      } catch {
        setCustomers([])
        setProjects([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [])

  const projectCount = (customerId: string) =>
    projects.filter(
      (project) => project.customer_id === customerId,
    ).length

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return customers.filter((customer) => {
      if (
        statusFilter === 'active' &&
        !customer.is_active
      ) {
        return false
      }

      if (
        statusFilter === 'inactive' &&
        customer.is_active
      ) {
        return false
      }

      const count = projects.filter(
        (project) => project.customer_id === customer.id,
      ).length

      if (
        projectFilter === 'with-projects' &&
        count === 0
      ) {
        return false
      }

      if (
        projectFilter === 'without-projects' &&
        count !== 0
      ) {
        return false
      }

      if (!query) return true

      const customerMatch =
        customer.name.toLowerCase().includes(query) ||
        customer.id.toLowerCase().includes(query) ||
        (customer.phone ?? '').toLowerCase().includes(query) ||
        (customer.email ?? '').toLowerCase().includes(query)

      if (customerMatch) return true

      return projects.some((project) => {
        if (project.customer_id !== customer.id) {
          return false
        }

        return (
          project.name.toLowerCase().includes(query) ||
          matchesProjectSerial(project.serial_number, query)
        )
      })
    })
  }, [customers, projects, search, statusFilter, projectFilter])

  const selectedProjects = selectedCustomer
    ? projects.filter(
        (project) => project.customer_id === selectedCustomer.id,
      )
    : []

  const allVisibleSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every(
      (customer) => selectedIds.includes(customer.id),
    )

  const selectedActiveCustomers = customers.filter(
    (customer) =>
      selectedIds.includes(customer.id) &&
      customer.is_active,
  )

  const selectedDeletedCustomers = customers.filter(
    (customer) =>
      selectedIds.includes(customer.id) &&
      !customer.is_active,
  )

  function toggleCustomerSelection(
    customerId: string,
    checked: boolean,
  ) {
    setSelectedIds((previous) =>
      checked
        ? [...new Set([...previous, customerId])]
        : previous.filter((id) => id !== customerId),
    )
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((previous) => [
        ...new Set([
          ...previous,
          ...filteredCustomers.map((customer) => customer.id),
        ]),
      ])
    } else {
      const visibleIds = new Set(
        filteredCustomers.map((customer) => customer.id),
      )

      setSelectedIds((previous) =>
        previous.filter((id) => !visibleIds.has(id)),
      )
    }
  }

  function openEditForm(customer: Customer) {
    setEditingCustomer(customer)

    setForm({
      name: customer.name,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
    })

    setError('')
  }

  function closeEditForm() {
    setEditingCustomer(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  async function handleUpdateCustomer(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!editingCustomer) return

    setSaving(true)
    setError('')

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
    }

    try {
      const response = await fetch(
        `/api/customers/${editingCustomer.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )

      if (!response.ok) {
        const result = await response.json()

        throw new Error(
          result.detail || 'Unable to update customer.',
        )
      }

      const updatedCustomer: Customer =
        await response.json()

      await loadData()
      onSelectCustomer(updatedCustomer)
      closeEditForm()
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Unable to update customer.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function deleteCustomer(customer: Customer) {
    const confirmed = window.confirm(
      isTamil
        ? `"${customer.name}" à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯ˆ Delete à®šà¯†à®¯à¯à®¯à®µà®¾?`
        : `Move "${customer.name}" to Deleted Customers? Their projects and measurements will be retained and can be restored.`,
    )

    if (!confirmed) return

    setSaving(true)
    setError('')

    try {
      const response = await fetch(
        `/api/customers/${customer.id}`,
        { method: 'DELETE' },
      )

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(
          result?.detail || 'Unable to delete customer.',
        )
      }

      if (selectedCustomer?.id === customer.id) {
        onSelectCustomer(null)
      }

      setSelectedIds((previous) =>
        previous.filter((id) => id !== customer.id),
      )

      await loadData()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to delete customer.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function deleteSelectedCustomers() {
    const targets = selectedActiveCustomers

    if (targets.length === 0) return

    const confirmed = window.confirm(
      `Move ${targets.length} selected customer(s) to Deleted Customers? Their projects and measurements will be retained.`,
    )

    if (!confirmed) return

    setSaving(true)
    setError('')

    try {
      for (const customer of targets) {
        const response = await fetch(
          `/api/customers/${customer.id}`,
          { method: 'DELETE' },
        )

        if (!response.ok) {
          const result = await response.json().catch(() => null)
          throw new Error(
            result?.detail ||
              `Unable to delete ${customer.name}.`,
          )
        }
      }

      if (
        selectedCustomer &&
        targets.some(
          (customer) => customer.id === selectedCustomer.id,
        )
      ) {
        onSelectCustomer(null)
      }

      setSelectedIds([])
      await loadData()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to delete selected customers.',
      )
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  async function restoreCustomer(customer: Customer) {
    const confirmed = window.confirm(
      `Restore "${customer.name}" to the active customer list?`,
    )

    if (!confirmed) return

    setSaving(true)
    setError('')

    try {
      const response = await fetch(
        `/api/customers/${customer.id}/restore`,
        { method: 'PATCH' },
      )

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(
          result?.detail || 'Unable to restore customer.',
        )
      }

      setSelectedIds((previous) =>
        previous.filter((id) => id !== customer.id),
      )

      await loadData()
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : 'Unable to restore customer.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function restoreSelectedCustomers() {
    const targets = selectedDeletedCustomers

    if (targets.length === 0) return

    const confirmed = window.confirm(
      `Restore ${targets.length} selected customer(s)?`,
    )

    if (!confirmed) return

    setSaving(true)
    setError('')

    try {
      for (const customer of targets) {
        const response = await fetch(
          `/api/customers/${customer.id}/restore`,
          { method: 'PATCH' },
        )

        if (!response.ok) {
          const result = await response.json().catch(() => null)
          throw new Error(
            result?.detail ||
              `Unable to restore ${customer.name}.`,
          )
        }
      }

      setSelectedIds([])
      await loadData()
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : 'Unable to restore selected customers.',
      )
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  async function permanentlyDeleteCustomer(
    customer: Customer,
  ) {
    const confirmed = window.confirm(
      `PERMANENTLY DELETE "${customer.name}"?\n\nThis will permanently remove this customer, all their projects, and all associated measurements. This action cannot be undone.`,
    )

    if (!confirmed) return

    setSaving(true)
    setError('')

    try {
      const response = await fetch(
        `/api/customers/${customer.id}/permanent`,
        { method: 'DELETE' },
      )

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(
          result?.detail ||
            'Unable to permanently delete customer.',
        )
      }

      if (selectedCustomer?.id === customer.id) {
        onSelectCustomer(null)
      }

      setSelectedIds((previous) =>
        previous.filter((id) => id !== customer.id),
      )

      await loadData()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to permanently delete customer.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function permanentlyDeleteSelectedCustomers() {
    const targets = selectedDeletedCustomers

    if (targets.length === 0) return

    const confirmed = window.confirm(
      `PERMANENTLY DELETE ${targets.length} selected customer(s)?\n\nAll their projects and associated measurements will also be permanently deleted. This action cannot be undone.`,
    )

    if (!confirmed) return

    setSaving(true)
    setError('')

    try {
      for (const customer of targets) {
        const response = await fetch(
          `/api/customers/${customer.id}/permanent`,
          { method: 'DELETE' },
        )

        if (!response.ok) {
          const result = await response.json().catch(() => null)
          throw new Error(
            result?.detail ||
              `Unable to permanently delete ${customer.name}.`,
          )
        }
      }

      if (
        selectedCustomer &&
        targets.some(
          (customer) => customer.id === selectedCustomer.id,
        )
      ) {
        onSelectCustomer(null)
      }

      setSelectedIds([])
      await loadData()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to permanently delete selected customers.',
      )
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  function exportCustomersCsv() {
    const headers = [
      'S.No',
      'Customer ID',
      'Customer Name',
      'Date',
      'Phone',
      'Email',
      'Address',
      'Project Count',
      'Status',
    ]

    const rows = filteredCustomers.map((customer, index) => [
      String(index + 1),
      customer.id,
      customer.name,
      customer.created_at ?? '',
      customer.phone ?? '',
      customer.email ?? '',
      customer.address ?? '',
      String(projectCount(customer.id)),
      customer.is_active ? 'Active' : 'Deleted',
    ])

    const escapeCsv = (value: string) =>
      `"${value.replace(/"/g, '""')}"`

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\r\n')

    const blob = new Blob(
      ['\uFEFF', csv],
      { type: 'text/csv;charset=utf-8;' },
    )

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = 'ls-interiors-customers.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function formatDate(value?: string) {
    if (!value) return '—'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return '—'

    return date.toLocaleDateString(
      isTamil ? 'ta-IN' : 'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      },
    )
  }

  return (
    <div className="customers-workspace">
      <div className="customers-toolbar">
        <div>
          <h2>
            {t('Customer Management', 'à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯ à®®à¯‡à®²à®¾à®£à¯à®®à¯ˆ')}
          </h2>
          <p>
            {t(
              'View and manage customers, projects and records.',
              'à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯à®•à®³à¯, à®¤à®¿à®Ÿà¯à®Ÿà®™à¯à®•à®³à¯ à®®à®±à¯à®±à¯à®®à¯ à®ªà®¤à®¿à®µà¯à®•à®³à¯ˆ à®¨à®¿à®°à¯à®µà®•à®¿à®•à¯à®•à®µà¯à®®à¯.',
            )}
          </p>
        </div>

        <div className="customer-toolbar-actions">
          <button
            type="button"
            className="customer-secondary-button"
            onClick={exportCustomersCsv}
            disabled={filteredCustomers.length === 0}
          >
            {t('Export Excel', 'Excel à®à®±à¯à®±à¯à®®à®¤à®¿')}
          </button>

          <button
            type="button"
            className="customer-secondary-button"
            onClick={() => window.print()}
          >
            {t('Export PDF', 'PDF à®à®±à¯à®±à¯à®®à®¤à®¿')}
          </button>
        </div>
      </div>

      {error && (
        <div className="customer-error" role="alert">
          {error}
        </div>
      )}

      <section className="customer-table-card">
        <div className="customer-table-heading">
          <div>
            <h3>
              {statusFilter === 'inactive'
                ? t('Deleted Customers', 'Deleted Customers')
                : statusFilter === 'active'
                  ? t('Active Customers', 'Active Customers')
                  : t('All Customers', 'à®…à®©à¯ˆà®¤à¯à®¤à¯ à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯à®•à®³¯')}
            </h3>
            <span>
              {filteredCustomers.length}{' '}
              {t('customers shown', 'à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯à®•à®³¯')}
            </span>
          </div>

          <button
            type="button"
            className="customer-secondary-button"
            onClick={() => {
              setLoading(true)
              void loadData()
            }}
            disabled={loading || saving}
          >
            {t('Refresh', 'à®ªà¯à®¤à¯à®ªà¯à®ªà®¿')}
          </button>
        </div>

        <div className="customer-filter-bar">
          <input
            className="customer-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t(
              'Search name, customer ID, phone, email or project...',
              'à®ªà¯†à®¯à®°à¯, à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯ ID, à®¤à¯Šà®²à¯ˆà®ªà¯‡à®šà®¿ à®…à®²à¯à®²à®¤à¯ à®¤à®¿à®Ÿà¯à®Ÿà®¤à¯à®¤à¯ˆà®¤à¯ à®¤à¯‡à®Ÿà®µà¯à®®à¯...',
            )}
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            aria-label={t('Customer status filter', 'à®¨à®¿à®²à¯ˆ à®µà®Ÿà®¿à®•à®Ÿà¯à®Ÿà®¿')}
          >
            <option value="all">
              {t('All Customers', 'à®…à®©à¯ˆà®¤à¯à®¤à¯')}
            </option>
            <option value="active">
              {t('Active Customers', 'Active Customers')}
            </option>
            <option value="inactive">
              {t('Deleted Customers', 'Deleted Customers')}
            </option>
          </select>

          <select
            value={projectFilter}
            onChange={(event) =>
              setProjectFilter(event.target.value as ProjectFilter)
            }
            aria-label={t('Project filter', 'à®¤à®¿à®Ÿà¯à®Ÿ à®µà®Ÿà®¿à®•à®Ÿà¯à®Ÿà®¿')}
          >
            <option value="all">
              {t('All projects', 'à®…à®©à¯ˆà®¤à¯à®¤à¯ à®¤à®¿à®Ÿà¯à®Ÿà®™à¯à®•à®³¯')}
            </option>
            <option value="with-projects">
              {t('With projects', 'à®¤à®¿à®Ÿà¯à®Ÿà®™à¯à®•à®³¯ à®‰à®³à¯à®³à®µà¯ˆ')}
            </option>
            <option value="without-projects">
              {t('Without projects', 'à®¤à®¿à®Ÿà¯à®Ÿà®™à¯à®•à®³¯ à®‡à®²à¯à®²à®¾à®¤à®µà¯ˆ')}
            </option>
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className="customer-bulk-toolbar">
            <strong>
              {selectedIds.length}{' '}
              {t('selected', 'à®¤à¯‡à®°à¯à®¨à¯à®¤à¯†à®Ÿà¯à®•à¯à®•à®ªà¯à®ªà®Ÿà¯à®Ÿà®©')}
            </strong>

            <div>
              {selectedActiveCustomers.length > 0 && (
                <button
                  type="button"
                  className="customer-danger-button"
                  onClick={() => void deleteSelectedCustomers()}
                  disabled={saving}
                >
                  {t('Delete Selected', 'Delete Selected')}
                  {' '}({selectedActiveCustomers.length})
                </button>
              )}

              {selectedDeletedCustomers.length > 0 && (
                <>
                  <button
                    type="button"
                    className="customer-secondary-button"
                    onClick={() => void restoreSelectedCustomers()}
                    disabled={saving}
                  >
                    {t('Restore Selected', 'Restore Selected')}
                    {' '}({selectedDeletedCustomers.length})
                  </button>

                  <button
                    type="button"
                    className="customer-danger-button"
                    onClick={() =>
                      void permanentlyDeleteSelectedCustomers()
                    }
                    disabled={saving}
                  >
                    {t('Permanently Delete Selected', 'Permanently Delete Selected')}
                    {' '}({selectedDeletedCustomers.length})
                  </button>
                </>
              )}

              <button
                type="button"
                className="customer-text-button"
                onClick={() => setSelectedIds([])}
                disabled={saving}
              >
                {t('Clear selection', 'à®¤à¯‡à®°à¯à®µà¯ˆ à®¨à¯€à®•à¯à®•à¯')}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="customer-empty">
            {t('Loading customers...', 'à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯à®•à®³à¯ˆ à®à®±à¯à®±à¯à®•à®¿à®±à®¤à¯...')}
          </p>
        ) : filteredCustomers.length === 0 ? (
          <p className="customer-empty">
            {t('No customers found.', 'à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯à®•à®³¯ à®‡à®²à¯à®²à¯ˆ.')}
          </p>
        ) : (
          <div className="customer-table-scroll">
            <table className="customer-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) =>
                        toggleSelectAll(event.target.checked)
                      }
                      aria-label={t('Select all customers', 'à®…à®©à¯ˆà®µà®°à¯ˆà®¯à¯à®®à¯ à®¤à¯‡à®°à¯à®µà¯')}
                    />
                  </th>
                  <th>{t('S.No', 'à®µ.à®Žà®£à¯')}</th>
                  <th>{t('Customer ID', 'à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯ ID')}</th>
                  <th>{t('Customer Name', 'à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯ à®ªà¯†à®¯à®°à¯')}</th>
                  <th>{t('Date', 'à®¤à¯‡à®¤à®¿')}</th>
                  <th>{t('Phone Number', 'à®¤à¯Šà®²à¯ˆà®ªà¯‡à®šà®¿ à®Žà®£à¯')}</th>
                  <th>{t('Projects', 'à®¤à®¿à®Ÿà¯à®Ÿà®™à¯à®•à®³¯')}</th>
                  <th>{t('Details', 'à®µà®¿à®µà®°à®™à¯à®•à®³¯')}</th>
                  <th>{t('Status', 'à®¨à®¿à®²à¯ˆ')}</th>
                  <th>{t('Actions', 'à®šà¯†à®¯à®²à¯à®•à®³¯')}</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer, index) => {
                  const count = projectCount(customer.id)
                  const isSelected =
                    selectedCustomer?.id === customer.id

                  return (
                    <tr
                      key={customer.id}
                      className={isSelected ? 'selected-row' : ''}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(customer.id)}
                          onChange={(event) =>
                            toggleCustomerSelection(
                              customer.id,
                              event.target.checked,
                            )
                          }
                          aria-label={`Select ${customer.name}`}
                        />
                      </td>

                      <td>{index + 1}</td>

                      <td>
                        <span className="customer-id">
                          {customer.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>

                      <td>
                        <strong className="customer-name">
                          {customer.name}
                        </strong>
                      </td>

                      <td>{formatDate(customer.created_at)}</td>

                      <td>{customer.phone || '—'}</td>

                      <td>
                        <button
                          type="button"
                          className="customer-project-count"
                          onClick={() => onSelectCustomer(customer)}
                        >
                          {count}
                        </button>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="customer-details-button"
                          onClick={() => onSelectCustomer(customer)}
                        >
                          {t('View Details', 'à®µà®¿à®µà®°à®™à¯à®•à®³¯')}
                        </button>
                      </td>

                      <td>
                        <span
                          className={`customer-status-badge ${
                            customer.is_active ? 'active' : 'inactive'
                          }`}
                        >
                          {customer.is_active
                            ? t('Active', 'à®šà¯†à®¯à®²à®¿à®²à¯')
                            : t('Deleted', 'Deleted')}
                        </span>
                      </td>

                      <td>
                        <div className="customer-row-actions">
                          {customer.is_active ? (
                            <>
                              <button
                                type="button"
                                className="customer-action-button"
                                onClick={() => openEditForm(customer)}
                                disabled={saving}
                              >
                                {t('Edit', 'à®¤à®¿à®°à¯à®¤à¯à®¤à¯')}
                              </button>

                              <button
                                type="button"
                                className="customer-danger-button"
                                onClick={() =>
                                  void deleteCustomer(customer)
                                }
                                disabled={saving}
                              >
                                {t('Delete', 'Delete')}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="customer-secondary-button"
                                onClick={() =>
                                  void restoreCustomer(customer)
                                }
                                disabled={saving}
                              >
                                {t('Restore', 'Restore')}
                              </button>

                              <button
                                type="button"
                                className="customer-danger-button"
                                onClick={() =>
                                  void permanentlyDeleteCustomer(customer)
                                }
                                disabled={saving}
                              >
                                {t('Permanently Delete', 'Permanently Delete')}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedCustomer && (
        <section className="customer-details-panel">
          <div className="customer-details-heading">
            <div>
              <h3>{selectedCustomer.name}</h3>
              <p>
                {t('Customer details and associated projects', 'à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯ à®µà®¿à®µà®°à®™à¯à®•à®³¯ à®®à®±à¯à®±à¯à®®à¯ à®¤à¯Šà®Ÿà®°à¯à®ªà¯à®Ÿà¯ˆà®¯ à®¤à®¿à®Ÿà¯à®Ÿà®™à¯à®•à®³¯')}
              </p>
            </div>

            <button
              type="button"
              className="customer-secondary-button"
              onClick={() => onSelectCustomer(null)}
            >
              {t('Close Details', 'à®®à¯‚à®Ÿà¯')}
            </button>
          </div>

          <div className="customer-contact-grid">
            <div>
              <span>{t('Phone', 'à®¤à¯Šà®²à¯ˆà®ªà¯‡à®šà®¿')}</span>
              <strong>{selectedCustomer.phone || '—'}</strong>
            </div>

            <div>
              <span>{t('Email', 'à®®à®¿à®©à¯à®©à®žà¯à®šà®²à¯')}</span>
              <strong>{selectedCustomer.email || '—'}</strong>
            </div>

            <div>
              <span>{t('Address', 'à®®à¯à®•à®µà®°à®¿')}</span>
              <strong>{selectedCustomer.address || '—'}</strong>
            </div>

            <div>
              <span>{t('Customer ID', 'à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯ ID')}</span>
              <strong>{selectedCustomer.id}</strong>
            </div>
          </div>

          <div className="customer-projects-heading">
            <h4>
              {t('Associated Projects', 'à®¤à¯Šà®Ÿà®°à¯à®ªà¯à®Ÿà¯ˆà®¯ à®¤à®¿à®Ÿà¯à®Ÿà®™à¯à®•à®³¯')}
              {' '}({selectedProjects.length})
            </h4>

            {selectedCustomer.is_active && (
              <button
                type="button"
                className="customer-primary-button"
                onClick={() => onNewOrder(selectedCustomer)}
              >
                {t('New Order', 'à®ªà¯à®¤à®¿à®¯ à®†à®°à¯à®Ÿà®°à¯')}
              </button>
            )}
          </div>

          {selectedProjects.length === 0 ? (
            <p className="customer-empty">
              {t(
                'No projects found for this customer.',
                'à®‡à®¨à¯à®¤ à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯à®•à¯à®•à¯ à®¤à®¿à®Ÿà¯à®Ÿà®™à¯à®•à®³¯ à®‡à®²à¯à®²à¯ˆ.',
              )}
            </p>
          ) : (
            <div className="customer-project-list">
              {selectedProjects.map((project) => (
                <div
                  className="customer-project-item"
                  key={project.id}
                >
                  <div>
                    <strong>{project.name}</strong>
                    <span>
                      {project.serial_number || project.id}
                    </span>
                    <span>
                      {t('Input', 'à®‰à®³à¯à®³à¯€à®Ÿà¯')}:{' '}
                      {project.input_unit.toUpperCase()}
                      {' · '}
                      {t('Output', 'à®µà¯†à®³à®¿à®¯à¯€à®Ÿà¯')}:{' '}
                      {project.output_unit.toUpperCase()}
                    </span>
                  </div>

                  <div className="customer-project-actions">
                    <span className="customer-project-status">
                      {project.status}
                    </span>

                    <button
                      type="button"
                      className="customer-secondary-button"
                      onClick={() =>
                        onUpdateOrder(selectedCustomer, project)
                      }
                      disabled={!selectedCustomer.is_active}
                    >
                      {t('Open Measurements', 'à®…à®³à®µà¯€à®Ÿà¯à®•à®³¯ˆà®¤à¯ à®¤à®¿à®±')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {editingCustomer && (
        <div className="customer-modal-backdrop">
          <section
            className="customer-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-edit-title"
          >
            <div className="customer-details-heading">
              <h3 id="customer-edit-title">
                {t('Edit Customer', 'à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯ à®µà®¿à®µà®°à®™à¯à®•à®³¯ˆà®¤à¯ à®¤à®¿à®°à¯à®¤à¯à®¤à¯')}
              </h3>

              <button
                type="button"
                className="customer-close-button"
                onClick={closeEditForm}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer}>
              <label>
                {t('Customer Name', 'à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯ à®ªà¯†à®¯à®°à¯')}
                <input
                  required
                  minLength={2}
                  maxLength={150}
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                {t('Phone Number', 'à®¤à¯Šà®²à¯ˆà®ªà¯‡à®šà®¿ à®Žà®£à¯')}
                <input
                  type="tel"
                  maxLength={20}
                  value={form.phone}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      phone: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                {t('Email Address', 'à®®à®¿à®©à¯à®©à®žà¯à®šà®²à¯ à®®à¯à®•à®µà®°à®¿')}
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      email: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                {t('Address', 'à®®à¯à®•à®µà®°à®¿')}
                <textarea
                  value={form.address}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      address: event.target.value,
                    })
                  }
                />
              </label>

              <div className="customer-form-actions">
                <button
                  type="button"
                  className="customer-secondary-button"
                  onClick={closeEditForm}
                  disabled={saving}
                >
                  {t('Cancel', 'à®°à®¤à¯à®¤à¯ à®šà¯†à®¯à¯')}
                </button>

                <button
                  type="submit"
                  className="customer-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? t('Saving...', 'à®šà¯‡à®®à®¿à®•à¯à®•à®¿à®±à®¤à¯...')
                    : t('Save Changes', 'à®®à®¾à®±à¯à®±à®™à¯à®•à®³¯ˆà®šà¯ à®šà¯‡à®®à®¿')}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default Customers
