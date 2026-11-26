
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Language } from '../components/Sidebar'
import { apiUrl, authFetch } from '../utils/api'
import './Customers.css'

export type Customer = {
  id: string
  name: string
  phone: string | null
  serial_number?: string | null
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

type Props = {
  language: Language
  selectedCustomer: Customer | null
  onSelectCustomer: (customer: Customer | null) => void
  onNewOrder: (customer: Customer) => void
}

type CustomerForm = {
  name: string
  phone: string
  serialNumber: string
  email: string
  address: string
}

const EMPTY_FORM: CustomerForm = {
  name: '',
  phone: '',
  serialNumber: '',
  email: '',
  address: '',
}

function Customers({
  language,
  selectedCustomer,
  onSelectCustomer,
  onNewOrder,
}: Props) {
  const isTamil = language === 'ta'

  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null)
  const [isAddingCustomer, setIsAddingCustomer] = useState(false)
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM)

  const t = (english: string, tamil: string) =>
    isTamil ? tamil : english

  async function loadData() {
    try {
      const customerResponse = await authFetch(
        apiUrl('/customers/?include_inactive=true'),
      )

      if (!customerResponse.ok) {
        throw new Error('Unable to load customers.')
      }

      const customerData: Customer[] =
        await customerResponse.json()

      setError('')
      setCustomers(customerData)

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
      } catch {
        setCustomers([])
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

      if (!query) return true

      return (
        customer.name.toLowerCase().includes(query) ||
        customer.id.toLowerCase().includes(query) ||
        (customer.phone ?? '').toLowerCase().includes(query) ||
        (customer.email ?? '').toLowerCase().includes(query)
      )
    })
  }, [customers, search, statusFilter])

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
      serialNumber: customer.serial_number ?? '',
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

  function openAddForm() {
    setIsAddingCustomer(true)
    setForm(EMPTY_FORM)
    setError('')
  }

  function closeAddForm() {
    setIsAddingCustomer(false)
    setForm(EMPTY_FORM)
    setError('')
  }

  function updatePhone(value: string) {
    setForm((previous) => ({
      ...previous,
      phone: value.replace(/\D/g, '').slice(0, 10),
    }))
  }

  function validateCustomerPhone(phone: string): boolean {
    if (!phone) return true
    if (!/^\d{10}$/.test(phone)) {
      setError('Phone number must contain exactly 10 digits.')
      return false
    }
    return true
  }

  async function handleCreateCustomer(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    if (!validateCustomerPhone(form.phone.trim())) return

    setSaving(true)
    setError('')

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      serial_number: form.serialNumber.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
    }

    try {
      const response = await authFetch(apiUrl('/customers/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.detail || 'Unable to add customer.')
      }

      await loadData()
      closeAddForm()
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Unable to add customer.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateCustomer(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!editingCustomer) return
    if (!validateCustomerPhone(form.phone.trim())) return

    setSaving(true)
    setError('')

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      serial_number: form.serialNumber.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
    }

    try {
      const response = await authFetch(
        apiUrl(`/customers/${editingCustomer.id}`),
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
      closeEditForm()
      onNewOrder(updatedCustomer)
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
        : `Move "${customer.name}" to Deleted Customers? Their associated records will be retained and can be restored.`,
    )

    if (!confirmed) return

    setSaving(true)
    setError('')

    try {
      const response = await authFetch(
        apiUrl(`/customers/${customer.id}`),
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
      `Move ${targets.length} selected customer(s) to Deleted Customers? Their associated records will be retained.`,
    )

    if (!confirmed) return

    setSaving(true)
    setError('')

    try {
      for (const customer of targets) {
        const response = await authFetch(
          apiUrl(`/customers/${customer.id}`),
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
      const response = await authFetch(
        apiUrl(`/customers/${customer.id}/restore`),
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
        const response = await authFetch(
          apiUrl(`/customers/${customer.id}/restore`),
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
      `PERMANENTLY DELETE "${customer.name}"?\n\nThis will permanently remove this customer, all associated measurement records. This action cannot be undone.`,
    )

    if (!confirmed) return

    setSaving(true)
    setError('')

    try {
      const response = await authFetch(
        apiUrl(`/customers/${customer.id}/permanent`),
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
      `PERMANENTLY DELETE ${targets.length} selected customer(s)?\n\nAll associated measurement records will also be permanently deleted. This action cannot be undone.`,
    )

    if (!confirmed) return

    setSaving(true)
    setError('')

    try {
      for (const customer of targets) {
        const response = await authFetch(
          apiUrl(`/customers/${customer.id}/permanent`),
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

  return (
    <div className="customers-workspace">
      <div className="customers-toolbar">
        <div>
          <h2>
            {t('Customer Management', 'à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯ à®®à¯‡à®²à®¾à®£à¯à®®à¯ˆ')}
          </h2>
          <p>
            {t(
              'View and manage customer records.',
              'à®µà®¾à®Ÿà®¿à®•à¯à®•à¯ˆà®¯à®¾à®³à®°à¯à®•à®³à¯, à®¤à®¿à®Ÿà¯à®Ÿà®™à¯à®•à®³à¯ à®®à®±à¯à®±à¯à®®à¯ à®ªà®¤à®¿à®µà¯à®•à®³à¯ˆ à®¨à®¿à®°à¯à®µà®•à®¿à®•à¯à®•à®µà¯à®®à¯.',
            )}
          </p>
        </div>

        <div className="customer-toolbar-actions">
          <button
            type="button"
            className="customer-secondary-button"
            onClick={openAddForm}
            disabled={saving}
          >
            {t('Add Customer', 'வாடிக்கையாளர் சேர்க்க')}
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
            placeholder={t('Search name, customer ID, phone or email...', 'வாடிக்கையாளர் பெயர், ID, தொலைபேசி அல்லது மின்னஞ்சல் மூலம் தேடு...')}
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
                  <th>{t('Customer Serial', 'வாடிக்கையாளர் வரிசை எண்')}</th>
                  <th className="customer-name-header">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) =>
                        toggleSelectAll(event.target.checked)
                      }
                      aria-label={t('Select all customers', 'அனைத்து வாடிக்கையாளர்களையும் தேர்வு செய்')}
                    />
                    {t('Customer Name', 'வாடிக்கையாளர் பெயர்')}
                  </th>
                  <th>{t('Customer Phone Number', 'வாடிக்கையாளர் தொலைபேசி எண்')}</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => {
                  const isSelected = selectedCustomer?.id === customer.id

                  return (
                    <tr
                      key={customer.id}
                      className={isSelected ? 'selected-row' : ''}
                    >
                      <td>
                        <span className="customer-id">
                          {customer.serial_number || customer.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div className="customer-name-cell">
                          <div className="customer-name-identity">
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
                            <button
                              type="button"
                              className="customer-details-button"
                              onClick={() => onSelectCustomer(customer)}
                            >
                              {customer.name}
                            </button>
                          </div>
                          <div className="customer-row-actions">
                            {customer.is_active ? (
                              <>
                                <button
                                  type="button"
                                  className="customer-action-button"
                                  onClick={() => openEditForm(customer)}
                                  disabled={saving}
                                >
                                  {t('Edit', 'Edit')}
                                </button>
                                <button
                                  type="button"
                                  className="customer-secondary-button"
                                  onClick={() => onNewOrder(customer)}
                                  disabled={saving}
                                >
                                  {t('Update Order / Measurement', 'ஆர்டர் / அளவீடு புதுப்பி')}
                                </button>
                                <button
                                  type="button"
                                  className="customer-danger-button"
                                  onClick={() => void deleteCustomer(customer)}
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
                                  onClick={() => void restoreCustomer(customer)}
                                  disabled={saving}
                                >
                                  {t('Restore', 'Restore')}
                                </button>
                                <button
                                  type="button"
                                  className="customer-danger-button"
                                  onClick={() => void permanentlyDeleteCustomer(customer)}
                                  disabled={saving}
                                >
                                  {t('Permanently Delete', 'Permanently Delete')}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{customer.phone || '—'}</td>
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
                {t('Customer contact information', 'வாடிக்கையாளர் தொடர்புத் தகவல்')}
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
              <span>{t('Customer Serial', 'வாடிக்கையாளர் வரிசை எண்')}</span>
              <strong>{selectedCustomer.serial_number || selectedCustomer.id}</strong>
            </div>
          </div>

          {selectedCustomer.is_active && (
            <button
              type="button"
              className="customer-primary-button"
              onClick={() => onNewOrder(selectedCustomer)}
            >
              {t('New Order', 'புதிய ஆர்டர்')}
            </button>
          )}
        </section>
      )}

      {isAddingCustomer && (
        <div className="customer-modal-backdrop">
          <section
            className="customer-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-add-title"
          >
            <div className="customer-details-heading">
              <h3 id="customer-add-title">
                {t('Add Customer', 'Add Customer')}
              </h3>
              <button
                type="button"
                className="customer-close-button"
                onClick={closeAddForm}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateCustomer}>
              <label>
                {t('Customer Name', 'Customer Name')}
                <input
                  required
                  minLength={2}
                  maxLength={150}
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </label>

              <label>
                {t('Phone Number', 'Phone Number')}
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={20}
                  value={form.phone}
                  onChange={(event) => updatePhone(event.target.value)}
                />
              </label>

              <label>
                {t('Customer Serial Number', 'Customer Serial Number')}
                <input
                  maxLength={50}
                  value={form.serialNumber}
                  placeholder="e.g. CUST-101 (optional)"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      serialNumber: event.target.value,
                    })
                  }
                />
                <small>
                  {t(
                    'Leave blank to generate one automatically.',
                    'Leave blank to generate one automatically.',
                  )}
                </small>
              </label>

              <label>
                {t('Email Address', 'Email Address')}
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
              </label>

              <label>
                {t('Address', 'Address')}
                <textarea
                  value={form.address}
                  onChange={(event) =>
                    setForm({ ...form, address: event.target.value })
                  }
                />
              </label>

              <div className="customer-form-actions">
                <button
                  type="button"
                  className="customer-secondary-button"
                  onClick={closeAddForm}
                  disabled={saving}
                >
                  {t('Cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="customer-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? t('Saving...', 'Saving...')
                    : t('Add Customer', 'Add Customer')}
                </button>
              </div>
            </form>
          </section>
        </div>
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
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={20}
                  value={form.phone}
                  onChange={(event) => updatePhone(event.target.value)}
                />
              </label>

              <label>
                {t('Customer Serial Number', 'Customer Serial Number')}
                <input
                  maxLength={50}
                  value={form.serialNumber}
                  placeholder="e.g. CUST-101 (optional)"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      serialNumber: event.target.value,
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
