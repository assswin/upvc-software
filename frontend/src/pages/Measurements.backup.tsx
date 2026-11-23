import { useEffect, useState, useRef, useMemo } from 'react'
import type { Customer } from './Customers'
import type { Language } from '../components/Sidebar'
import { A4FabricationModal } from '../components/A4FabricationModal'
import { WindowVisualizer2D } from '../components/WindowVisualizer2D'
import { convertMeasurementsToCalculationResults } from '../utils/cadBridge'
import { getModelColor } from '../utils/modelColors'
import {
  generateProjectSerialNumber,
  isDuplicateOrderName,
  matchesProjectSerial,
} from '../utils/projectSerials'

import {
  calculateSlidingWindow,
  WINDOW_MODELS,
  type WindowModelId,
  type MeasurementUnit,
  type SlidingCalculationResult,
  type CustomDeductionOverrides,
} from '../utils/slidingCalculations'

type RowUnit = 'in' | 'cm' | 'mm'

type FractionOption = {
  label: string
  numerator: number
  denominator: number
}

const fractionOptions: FractionOption[] = [
  { label: '1/8', numerator: 1, denominator: 8 },
  { label: '2/8', numerator: 2, denominator: 8 },
  { label: '3/8', numerator: 3, denominator: 8 },
  { label: '4/8', numerator: 4, denominator: 8 },
  { label: '5/8', numerator: 5, denominator: 8 },
  { label: '6/8', numerator: 6, denominator: 8 },
  { label: '7/8', numerator: 7, denominator: 8 },
  { label: '1/5', numerator: 1, denominator: 5 },
  { label: '1/4', numerator: 1, denominator: 4 },
  { label: '1/3', numerator: 1, denominator: 3 },
  { label: '1/2', numerator: 1, denominator: 2 },
  { label: '2/3', numerator: 2, denominator: 3 },
  { label: '3/4', numerator: 3, denominator: 4 },
]

const identificationColors = [
  '#FDE68A',
  '#BFDBFE',
  '#BBF7D0',
  '#FBCFE8',
  '#DDD6FE',
  '#FED7AA',
  '#A5F3FC',
  '#E5E7EB',
]

export type MeasurementRow = {
  id: number
  backendId?: string
  height: string
  width: string
  modelId: string
  variantLetter?: string
  glassType: string
  toleranceMm: number
  applyTolerance: boolean
  heightAdditionalMm: number
  widthAdditionalMm: number
  identificationColor: string
  status?: 'pending' | 'finished'
}

type SavedOrder = {
  id: string
  serialNumber?: string
  customerName: string
  customerPhone: string
  orderDate: string
  projectName: string
  defaultTolerance: number
  defaultApplyTolerance: boolean
  fromUnit: RowUnit
  toUnit: RowUnit
  rows: MeasurementRow[]
  createdAt: string
  updatedAt: string
}

export type MeasurementsProps = {
  selectedCustomer: Customer | null
  initialProjectId?: string | null
  language?: Language
}

const STORAGE_KEY = 'ls-interiors-saved-orders'
const FORMULAS_STORAGE_KEY = 'ls-interiors-custom-formulas'

const getTodayDate = () => {
  const today = new Date()
  const localDate = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  )
  return localDate.toISOString().slice(0, 10)
}

const loadSavedOrders = (): SavedOrder[] => {
  try {
    const storedOrders = localStorage.getItem(STORAGE_KEY)
    if (!storedOrders) return []
    const parsedOrders: unknown = JSON.parse(storedOrders)
    if (!Array.isArray(parsedOrders)) return []

    const orders = parsedOrders as SavedOrder[]
    const usedSerials: string[] = []

    return orders.map((o) => {
      let serial = o.serialNumber
      if (!serial || usedSerials.includes(serial)) {
        serial = generateProjectSerialNumber(usedSerials)
      }
      usedSerials.push(serial)
      return {
        ...o,
        serialNumber: serial,
      }
    })
  } catch {
    return []
  }
}

const loadCustomFormulas = (): Record<string, CustomDeductionOverrides> => {
  try {
    const stored = localStorage.getItem(FORMULAS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

/**
 * Resolves window numbers and variant labels (e.g., W1, W1a, W1b, W2, etc.)
 * Groups sequential manual variant letters under the same base window number.
 */
export function resolveWindowLabels(
  rows: { variantLetter?: string }[]
): { label: string; serialNo: string }[] {
  if (!rows || rows.length === 0) return []
  const resolvedNums = new Array<number>(rows.length)

  for (let i = 0; i < rows.length; i++) {
    const currLetter = rows[i]?.variantLetter?.toLowerCase().trim() || ''
    if (i > 0 && currLetter && currLetter !== 'a') {
      resolvedNums[i] = resolvedNums[i - 1]
    } else {
      if (i === 0) {
        resolvedNums[0] = 1
      } else {
        const maxPrev = Math.max(...resolvedNums.slice(0, i))
        resolvedNums[i] = maxPrev + 1
      }
    }
  }

  return rows.map((row, idx) => {
    const num = resolvedNums[idx]
    const letter = row?.variantLetter?.toLowerCase().trim() || ''
    if (letter) {
      return {
        label: `W${num}${letter}`,
        serialNo: `${num}${letter}`,
      }
    }
    return {
      label: `W${num}`,
      serialNo: String(num),
    }
  })
}

const createEmptyRow = (
  id: number,
  toleranceMm: number,
  applyTolerance: boolean,
  identificationColor: string
): MeasurementRow => ({
  id,
  height: '',
  width: '',
  modelId: '',
  variantLetter: '',
  glassType: '',
  toleranceMm,
  applyTolerance,
  heightAdditionalMm: 0,
  widthAdditionalMm: 0,
  identificationColor,
  status: 'pending',
})

const unitLabels: Record<RowUnit, string> = {
  in: 'Inches',
  cm: 'CM',
  mm: 'MM',
}

const unitShortLabels: Record<RowUnit, string> = {
  in: 'in',
  cm: 'cm',
  mm: 'mm',
}

const convertToMm = (value: number, unit: RowUnit): number => {
  switch (unit) {
    case 'in':
      return value * 25.4
    case 'cm':
      return value * 10
    case 'mm':
      return value
  }
}

const convertFromMm = (value: number, unit: RowUnit): number => {
  switch (unit) {
    case 'in':
      return value / 25.4
    case 'cm':
      return value / 10
    case 'mm':
      return value
  }
}

const convertValue = (
  value: number,
  fromUnit: RowUnit,
  toUnit: RowUnit
): number => {
  return convertFromMm(convertToMm(value, fromUnit), toUnit)
}

const formatStoredValue = (value: number): string => {
  return Number(value.toFixed(4)).toString()
}

const formatCutValue = (
  value: number | null | undefined,
  unit: RowUnit
): string => {
  if (value === null || value === undefined) {
    return '-'
  }

  const convertedValue = convertFromMm(value, unit)

  if (unit === 'mm') {
    return String(Math.round(convertedValue))
  }

  return Number(convertedValue.toFixed(2)).toString()
}

function Measurements({
  selectedCustomer,
  initialProjectId,
  language = 'en',
}: MeasurementsProps) {
  // Drawing & PDF Modals
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isCadModalOpen, setIsCadModalOpen] = useState(false)
  const [cadSelectedIndex, setCadSelectedIndex] = useState(0)

  // Customer and project details
  const [customerName, setCustomerName] = useState(selectedCustomer?.name ?? '')
  const [customerPhone, setCustomerPhone] = useState(
    selectedCustomer?.phone ?? ''
  )
  const [orderDate, setOrderDate] = useState(getTodayDate)
  const [projectName, setProjectName] = useState('')

  // Default calculation settings
  const [defaultTolerance, setDefaultTolerance] = useState(5)
  const [defaultApplyTolerance, setDefaultApplyTolerance] = useState(true)

  // Synchronization refs (reference old project WindowInputForm.tsx: lastEmittedRef)
  const lastEmittedRowsRef = useRef<MeasurementRow[] | null>(null)
  const prevToleranceRef = useRef<number>(defaultTolerance)
  const prevApplyToleranceRef = useRef<boolean>(defaultApplyTolerance)
  const isInitialMountRef = useRef<boolean>(true)

  // Adjust added mm / tolerance (min 0, no negative integers, reference old project adjustGlobalOffset)
  const adjustTolerance = (delta: number) => {
    const current = Math.max(0, defaultTolerance || 0)
    const next = Math.max(0, Math.min(50, current + delta))
    setDefaultTolerance(next)
  }

  // Measurement units
  const [fromUnit, setFromUnit] = useState<RowUnit>('in')
  const [toUnit, setToUnit] = useState<RowUnit>('mm')

  // Measurement rows
  const [rows, setRows] = useState<MeasurementRow[]>([
    createEmptyRow(1, 5, true, identificationColors[0]),
  ])

  // Real-time synchronization of Added MM (Tolerance) across all window rows (reference old project updateGlobalSetting)
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      return
    }
    if (
      prevToleranceRef.current === defaultTolerance &&
      prevApplyToleranceRef.current === defaultApplyTolerance
    ) {
      return
    }
    prevToleranceRef.current = defaultTolerance
    prevApplyToleranceRef.current = defaultApplyTolerance

    setRows((currentRows) => {
      const updated = currentRows.map((row) => ({
        ...row,
        toleranceMm: defaultTolerance,
        applyTolerance: defaultApplyTolerance,
      }))
      lastEmittedRowsRef.current = updated
      return updated
    })
  }, [defaultTolerance, defaultApplyTolerance])

  // Saved order management
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>(loadSavedOrders)
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(
    initialProjectId || null
  )

  // Real-time duplicate project name check for the selected customer
  const isDuplicateName = useMemo(() => {
    return isDuplicateOrderName(customerName, projectName, currentOrderId, savedOrders)
  }, [customerName, projectName, currentOrderId, savedOrders])

  const currentOrder = useMemo(() => {
    return savedOrders.find((o) => o.id === currentOrderId)
  }, [currentOrderId, savedOrders])

  // Search filter for saved orders by project name, customer, phone, or project ID (e.g. proj-1)
  const [savedOrderSearch, setSavedOrderSearch] = useState('')

  const filteredSavedOrders = useMemo(() => {
    if (!savedOrderSearch.trim()) return savedOrders
    const q = savedOrderSearch.trim().toLowerCase()
    return savedOrders.filter((order) => {
      const matchName = order.projectName.toLowerCase().includes(q)
      const matchCust = order.customerName.toLowerCase().includes(q)
      const matchPhone = (order.customerPhone || '').toLowerCase().includes(q)
      const matchSerial = matchesProjectSerial(order.serialNumber, q)
      return matchName || matchCust || matchPhone || matchSerial
    })
  }, [savedOrders, savedOrderSearch])

  // Custom formula overrides loaded from Settings
  const [customFormulas, setCustomFormulas] =
    useState<Record<string, CustomDeductionOverrides>>(loadCustomFormulas)

  // Sync formula overrides dynamically when updated in Settings page
  useEffect(() => {
    const syncFormulas = () => {
      setCustomFormulas(loadCustomFormulas())
    }
    window.addEventListener('storage', syncFormulas)
    window.addEventListener('focus', syncFormulas)
    return () => {
      window.removeEventListener('storage', syncFormulas)
      window.removeEventListener('focus', syncFormulas)
    }
  }, [])

  // Synchronize customer selection dynamically
  useEffect(() => {
    if (selectedCustomer) {
      setCustomerName(selectedCustomer.name ?? '')
      setCustomerPhone(selectedCustomer.phone ?? '')
    }
  }, [selectedCustomer])

  // Load project and measurements when updating an order from Customer page or Dashboard
  useEffect(() => {
    if (!initialProjectId) return
    setCurrentOrderId(initialProjectId)

    fetch(`/api/projects/${initialProjectId}`)
      .then(async (res) => {
        if (!res.ok) return
        const project = await res.json()
        setCurrentOrderId(project.id)
        setProjectName(project.name)
        const loadedTol = Number(project.default_tolerance_mm) || 5
        const loadedApplyTol = project.default_apply_tolerance ?? true
        prevToleranceRef.current = loadedTol
        prevApplyToleranceRef.current = loadedApplyTol
        setDefaultTolerance(loadedTol)
        setDefaultApplyTolerance(loadedApplyTol)
        if (project.input_unit) setFromUnit(project.input_unit as RowUnit)
        if (project.output_unit) setToUnit(project.output_unit as RowUnit)

        // Ensure customer details are populated
        if (project.customer_id && (!customerName || !customerPhone)) {
          fetch(`/api/customers/${project.customer_id}`)
            .then(async (cRes) => {
              if (cRes.ok) {
                const cust = await cRes.json()
                if (cust.name) setCustomerName(cust.name)
                if (cust.phone) setCustomerPhone(cust.phone)
              }
            })
            .catch(() => {})
        }

        const mRes = await fetch(
          `/api/projects/${initialProjectId}/measurements/`
        )
        if (mRes.ok) {
          const mData = await mRes.json()
          if (Array.isArray(mData) && mData.length > 0) {
            const loadedRows: MeasurementRow[] = mData.map(
              (m: any, idx: number) => ({
                id: idx + 1,
                height:
                  m.height !== null && m.height !== undefined
                    ? String(m.height)
                    : '',
                width:
                  m.width !== null && m.width !== undefined
                    ? String(m.width)
                    : '',
                modelId: m.model_id || '58-2',
                variantLetter: m.variant_letter || '',
                glassType: m.glass_type || '',
                toleranceMm: Number(m.tolerance_mm) || loadedTol,
                applyTolerance: m.apply_tolerance ?? loadedApplyTol,
                heightAdditionalMm: Number(m.height_additional_mm) || 0,
                widthAdditionalMm: Number(m.width_additional_mm) || 0,
                identificationColor:
                  m.identification_color ||
                  identificationColors[idx % identificationColors.length],
                backendId: m.id,
                status: m.status || 'pending',
              })
            )
            lastEmittedRowsRef.current = loadedRows
            setRows(loadedRows)
          }
        }
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
      .catch(console.error)
  }, [initialProjectId])

  // Sync projects from backend on mount
  useEffect(() => {
    fetch('/api/projects/')
      .then(async (res) => {
        if (!res.ok) return
        const backendProjects = await res.json()
        if (Array.isArray(backendProjects) && backendProjects.length > 0) {
          setSavedOrders((prev) => {
            const existingIds = new Set(prev.map((o) => o.id))
            const newFromBackend: SavedOrder[] = []
            for (const p of backendProjects) {
              if (!existingIds.has(p.id)) {
                newFromBackend.push({
                  id: p.id,
                  serialNumber: p.serial_number || generateProjectSerialNumber(prev.map(o => o.serialNumber)),
                  customerName: selectedCustomer?.name || 'Customer',
                  customerPhone: selectedCustomer?.phone || '',
                  orderDate: getTodayDate(),
                  projectName: p.name,
                  defaultTolerance: Number(p.default_tolerance_mm) || 5,
                  defaultApplyTolerance: p.default_apply_tolerance ?? true,
                  fromUnit: (p.input_unit as RowUnit) || 'in',
                  toUnit: (p.output_unit as RowUnit) || 'mm',
                  rows: [createEmptyRow(1, 5, true, identificationColors[0])],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                })
              }
            }
            return newFromBackend.length > 0
              ? [...prev, ...newFromBackend]
              : prev
          })
        }
      })
      .catch(() => {})
  }, [selectedCustomer])

  const getNextRowId = (currentRows: MeasurementRow[]) => {
    return Math.max(0, ...currentRows.map((row) => row.id)) + 1
  }

  const getNextColor = (currentRows: MeasurementRow[]) => {
    const usedColors = currentRows.map((row) =>
      row.identificationColor.toUpperCase()
    )

    return (
      identificationColors.find(
        (color) => !usedColors.includes(color.toUpperCase())
      ) ??
      identificationColors[currentRows.length % identificationColors.length]
    )
  }

  const addRow = () => {
    setRows((currentRows) => [
      ...currentRows,
      createEmptyRow(
        getNextRowId(currentRows),
        defaultTolerance,
        defaultApplyTolerance,
        getNextColor(currentRows)
      ),
    ])
  }

  const copyRow = (id: number) => {
    setRows((currentRows) => {
      const originalIndex = currentRows.findIndex((row) => row.id === id)

      if (originalIndex === -1) return currentRows

      const originalRow = currentRows[originalIndex]

      const copiedRow: MeasurementRow = {
        ...originalRow,
        id: getNextRowId(currentRows),
        variantLetter: originalRow.variantLetter || '',
      }

      const updatedRows = [...currentRows]
      updatedRows.splice(originalIndex + 1, 0, copiedRow)

      return updatedRows
    })
  }

  const updateRow = <K extends keyof MeasurementRow>(
    id: number,
    field: K,
    value: MeasurementRow[K]
  ) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    )
  }

  const deleteRow = (id: number) => {
    setRows((currentRows) => currentRows.filter((row) => row.id !== id))
  }

  // Save all order information to browser storage as local cache
  const saveOrdersToStorage = (orders: SavedOrder[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
      setSavedOrders(orders)
      return true
    } catch {
      window.alert('Unable to save this order in browser storage.')
      return false
    }
  }

  // Helper to ensure customer exists on backend
  const getOrCreateCustomerId = async (): Promise<string | null> => {
    if (selectedCustomer?.id) {
      return selectedCustomer.id
    }
    const name = customerName.trim()
    if (!name) return null
    try {
      const listRes = await fetch('/api/customers/')
      if (listRes.ok) {
        const customers: Customer[] = await listRes.json()
        const match = customers.find(
          (c) => c.name.toLowerCase() === name.toLowerCase()
        )
        if (match) return match.id
      }
      const createRes = await fetch('/api/customers/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: customerPhone.trim() || null,
          email: null,
          address: null,
        }),
      })
      if (createRes.ok) {
        const created: Customer = await createRes.json()
        return created.id
      }
    } catch (err) {
      console.error('Error finding/creating customer on backend:', err)
    }
    return null
  }

  // Helper to synchronize order and batch measurements to backend
  const syncOrderToBackend = async (
    existingProjectId: string | null,
    orderData: ReturnType<typeof getCurrentOrderData>
  ): Promise<{ id: string; serialNumber: string } | null> => {
    try {
      const customerId = await getOrCreateCustomerId()
      if (!customerId) return null

      let projectId = existingProjectId
      let projectSerial = ''
      const isUuid =
        projectId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          projectId
        )

      const projectPayload = {
        customer_id: customerId,
        name: orderData.projectName,
        description: `Order Date: ${orderData.orderDate}`,
        input_unit: orderData.fromUnit,
        output_unit: orderData.toUnit,
        default_tolerance_mm: orderData.defaultTolerance,
        default_apply_tolerance: orderData.defaultApplyTolerance,
      }

      if (isUuid) {
        const putRes = await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectPayload),
        })
        if (!putRes.ok) {
          const errData = await putRes.json().catch(() => ({}))
          if (errData?.detail === 'enter unique name' || String(errData?.detail).includes('unique name')) {
            window.alert('enter unique name')
            return null
          }
          projectId = null
        } else {
          const updated = await putRes.json()
          projectSerial = updated.serial_number || ''
        }
      }

      if (!projectId || !isUuid) {
        const postRes = await fetch('/api/projects/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectPayload),
        })
        if (!postRes.ok) {
          const errData = await postRes.json().catch(() => ({}))
          if (errData?.detail === 'enter unique name' || String(errData?.detail).includes('unique name')) {
            window.alert('enter unique name')
            return null
          }
        } else {
          const created = await postRes.json()
          projectId = created.id
          projectSerial = created.serial_number || ''
        }
      }

      if (projectId) {
        // Send all rows via atomic batch endpoint
        const validRows = orderData.rows.filter(
          (r) =>
            (r.height && parseFloat(r.height) > 0) ||
            (r.width && parseFloat(r.width) > 0)
        )
        const rowsToSave = validRows.length > 0 ? validRows : orderData.rows

        const batchPayload = {
          measurements: rowsToSave.map((row, idx) => ({
            row_order: idx + 1,
            height: row.height ? parseFloat(row.height) : null,
            width: row.width ? parseFloat(row.width) : null,
            input_unit: orderData.fromUnit,
            model_id: row.modelId || null,
            variant_letter: row.variantLetter || '',
            glass_type: row.glassType || null,
            tolerance_mm: row.toleranceMm,
            apply_tolerance: row.applyTolerance,
            height_additional_mm: row.heightAdditionalMm || 0,
            width_additional_mm: row.widthAdditionalMm || 0,
            identification_color: row.identificationColor || '#FDE68A',
            status: row.status || 'pending',
          })),
        }

        await fetch(`/api/projects/${projectId}/measurements/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batchPayload),
        })

        return { id: projectId, serialNumber: projectSerial }
      }
    } catch (err) {
      console.error('Error syncing order to backend:', err)
    }
    return null
  }

  const getCurrentOrderData = (): Omit<
    SavedOrder,
    'id' | 'createdAt' | 'updatedAt'
  > => ({
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    orderDate,
    projectName: projectName.trim(),
    defaultTolerance,
    defaultApplyTolerance,
    fromUnit,
    toUnit,
    rows: rows.map((row) => ({ ...row })),
  })

  // Save as a new order
  const saveOrder = async () => {
    if (currentOrderId) {
      await updateOrder()
      return
    }

    if (!customerName.trim()) {
      window.alert('Please enter the customer name.')
      return
    }

    if (!projectName.trim()) {
      window.alert('Please enter the project / order name.')
      return
    }

    // Duplicate order name check: if customer already has a saved order with this name, reject
    if (isDuplicateOrderName(customerName, projectName, currentOrderId, savedOrders)) {
      window.alert('enter unique name')
      return
    }

    const now = new Date().toISOString()
    const orderData = getCurrentOrderData()

    const syncResult = await syncOrderToBackend(null, orderData)
    // If backend rejected due to duplicate or failure, stop
    if (syncResult === null && !orderData.projectName) {
      return
    }

    const backendId = syncResult?.id || null
    const backendSerial = syncResult?.serialNumber || null
    const finalId = backendId || crypto.randomUUID()

    const allSerials = savedOrders.map((o) => o.serialNumber)
    const serialNumber = backendSerial || generateProjectSerialNumber(allSerials)

    const orderToSave: SavedOrder = {
      ...orderData,
      id: finalId,
      serialNumber,
      createdAt: now,
      updatedAt: now,
    }

    const updatedOrders = [...savedOrders, orderToSave]

    if (saveOrdersToStorage(updatedOrders)) {
      setCurrentOrderId(finalId)
      window.alert('Order saved successfully!')
    }
  }

  // Update the currently opened order
  const updateOrder = async () => {
    const targetId = currentOrderId || initialProjectId
    if (!targetId) {
      await saveOrder()
      return
    }

    if (!customerName.trim()) {
      window.alert('Please enter the customer name.')
      return
    }

    if (!projectName.trim()) {
      window.alert('Please enter the project / order name.')
      return
    }

    // Duplicate order name check for this customer (excluding targetId)
    if (isDuplicateOrderName(customerName, projectName, targetId, savedOrders)) {
      window.alert('enter unique name')
      return
    }

    const orderData = getCurrentOrderData()
    const syncResult = await syncOrderToBackend(targetId, orderData)
    if (syncResult === null) {
      // Backend rejected or failed
      return
    }

    const finalId = syncResult?.id || targetId
    setCurrentOrderId(finalId)

    const existingOrder = savedOrders.find((order) => order.id === targetId)
    const allSerials = savedOrders.filter((o) => o.id !== targetId).map((o) => o.serialNumber)
    const serialNumber = syncResult?.serialNumber || existingOrder?.serialNumber || generateProjectSerialNumber(allSerials)

    const updatedOrder: SavedOrder = {
      ...(existingOrder || {}),
      ...orderData,
      id: finalId,
      serialNumber,
      createdAt: existingOrder?.createdAt || orderDate || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const updatedOrders = savedOrders.some((order) => order.id === finalId)
      ? savedOrders.map((order) => (order.id === finalId ? updatedOrder : order))
      : [...savedOrders, updatedOrder]

    if (saveOrdersToStorage(updatedOrders)) {
      window.alert('Order updated successfully!')
    }
  }

  // Open an existing saved order
  const openOrder = async (order: SavedOrder) => {
    const confirmed = window.confirm(
      'Open this order? Any unsaved changes in the current form will be lost.'
    )

    if (!confirmed) return

    setCustomerName(order.customerName)
    setCustomerPhone(order.customerPhone)
    setOrderDate(order.orderDate)
    setProjectName(order.projectName)

    setDefaultTolerance(order.defaultTolerance)
    setDefaultApplyTolerance(order.defaultApplyTolerance)

    setFromUnit(order.fromUnit)
    setToUnit(order.toUnit)
    setCurrentOrderId(order.id)

    // Check if backend has measurements saved for this project
    const isUuid =
      order.id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        order.id
      )

    let loadedFromBackend = false
    if (isUuid) {
      try {
        const mRes = await fetch(`/api/projects/${order.id}/measurements/`)
        if (mRes.ok) {
          const mData = await mRes.json()
          if (Array.isArray(mData) && mData.length > 0) {
            const loadedRows: MeasurementRow[] = mData.map(
              (m: any, idx: number) => ({
                id: idx + 1,
                height:
                  m.height !== null && m.height !== undefined
                    ? String(m.height)
                    : '',
                width:
                  m.width !== null && m.width !== undefined
                    ? String(m.width)
                    : '',
                modelId: m.model_id || '58-2',
                variantLetter: m.variant_letter || '',
                glassType: m.glass_type || '',
                toleranceMm: Number(m.tolerance_mm) || 5,
                applyTolerance: m.apply_tolerance ?? true,
                heightAdditionalMm: Number(m.height_additional_mm) || 0,
                widthAdditionalMm: Number(m.width_additional_mm) || 0,
                identificationColor:
                  m.identification_color ||
                  identificationColors[idx % identificationColors.length],
                backendId: m.id,
                status: m.status || 'pending',
              })
            )
            setRows(loadedRows)
            loadedFromBackend = true
          }
        }
      } catch (err) {
        console.error('Error fetching backend measurements:', err)
      }
    }

    if (!loadedFromBackend) {
      setRows(
        order.rows.map((row) => ({
          ...row,
          variantLetter: row.variantLetter || '',
        }))
      )
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Delete an entire saved order
  const deleteOrder = (id: string) => {
    const order = savedOrders.find((item) => item.id === id)

    if (!order) return

    const confirmed = window.confirm(
      `Are you sure you want to delete "${order.projectName}"? This cannot be undone.`
    )

    if (!confirmed) return

    // Soft delete on backend if it's a backend UUID
    const isUuid =
      id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    if (isUuid) {
      fetch(`/api/projects/${id}`, { method: 'DELETE' }).catch(console.error)
    }

    const updatedOrders = savedOrders.filter((item) => item.id !== id)

    if (saveOrdersToStorage(updatedOrders)) {
      if (currentOrderId === id) {
        setCurrentOrderId(null)
      }

      window.alert('Order deleted successfully!')
    }
  }

  // Start a fresh order for the currently selected customer
  const createNewOrder = () => {
    const confirmed = window.confirm(
      'Start a new order? Any unsaved changes in the current form will be lost.'
    )

    if (!confirmed) return

    setCustomerName(selectedCustomer?.name ?? '')
    setCustomerPhone(selectedCustomer?.phone ?? '')
    setOrderDate(getTodayDate())
    setProjectName('')

    setDefaultTolerance(5)
    setDefaultApplyTolerance(true)

    setFromUnit('in')
    setToUnit('mm')

    setRows([createEmptyRow(1, 5, true, identificationColors[0])])

    setCurrentOrderId(null)

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Dynamic fabrication column checks
  const showMeshColumn = rows.some(
    (row) => row.modelId === '58-2.5' || row.modelId === '85-2.5'
  )
  const showMullionColumn = rows.some(
    (row) => row.modelId === 'open-double' || row.modelId === 'open-triple'
  )

  // Changing From converts existing entries without changing
  // the actual physical dimensions of the windows.
  const handleFromUnitChange = (newUnit: RowUnit) => {
    if (newUnit === fromUnit) return

    setRows((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        height: row.height.trim()
          ? formatStoredValue(
              convertValue(Number(row.height), fromUnit, newUnit)
            )
          : '',
        width: row.width.trim()
          ? formatStoredValue(
              convertValue(Number(row.width), fromUnit, newUnit)
            )
          : '',
      }))
    )

    setFromUnit(newUnit)
  }

  const applyFraction = (
    row: MeasurementRow,
    dimension: 'height' | 'width',
    selectedFraction: string
  ) => {
    const fraction = fractionOptions.find(
      (option) => option.label === selectedFraction
    )

    if (!fraction) return

    const currentValue = Number(row[dimension] || 0)

    if (!Number.isFinite(currentValue)) return

    const wholeNumber = Math.trunc(currentValue)
    const fractionInInches = fraction.numerator / fraction.denominator

    const fractionInCurrentUnit = convertValue(
      fractionInInches,
      'in',
      fromUnit
    )

    const updatedValue = Number(
      (wholeNumber + fractionInCurrentUnit).toFixed(4)
    )

    const isEighthFraction = fraction.denominator === 8

    setRows((currentRows) =>
      currentRows.map((currentRow) => {
        if (currentRow.id !== row.id) return currentRow

        if (dimension === 'height') {
          return {
            ...currentRow,
            height: String(updatedValue),
            heightAdditionalMm: isEighthFraction ? 3.5 : 0,
          }
        }

        return {
          ...currentRow,
          width: String(updatedValue),
          widthAdditionalMm: isEighthFraction ? 3.5 : 0,
        }
      })
    )
  }

  const getRowCalculation = (
    row: MeasurementRow
  ): SlidingCalculationResult | null => {
    if (!row.modelId || !row.height.trim() || !row.width.trim()) {
      return null
    }

    const height = Number(row.height)
    const width = Number(row.width)

    if (
      !Number.isFinite(height) ||
      !Number.isFinite(width) ||
      height <= 0 ||
      width <= 0
    ) {
      return null
    }

    const calculationUnit: MeasurementUnit =
      fromUnit === 'in' ? 'inches' : fromUnit === 'cm' ? 'cm' : 'mm'

    const modelOverrides = customFormulas[row.modelId]

    return calculateSlidingWindow({
      modelId: row.modelId as WindowModelId,
      height,
      width,
      unit: calculationUnit,
      toleranceMm: row.toleranceMm,
      applyTolerance: row.applyTolerance,
      heightAdditionalMm: row.heightAdditionalMm,
      widthAdditionalMm: row.widthAdditionalMm,
      customOverrides: modelOverrides,
    })
  }

  // Resolved window labels (W1, W1a, W1b, W2, etc.)
  const windowLabels = resolveWindowLabels(rows)

  // Memoized CAD calculation results for A4 sheet and 2D CAD blueprint
  const cadCalculationResults = useMemo(() => {
    return convertMeasurementsToCalculationResults(
      rows,
      windowLabels.map((w) => w.label),
      customFormulas,
      fromUnit
    )
  }, [rows, windowLabels, customFormulas, fromUnit])

  // Quantity grouped across all supported models
  const modelSummary = WINDOW_MODELS.map((model) => ({
    ...model,
    quantity: rows.filter((row) => row.modelId === model.id).length,
  })).filter((model) => model.quantity > 0)

  const unselectedModelCount = rows.filter((row) => !row.modelId).length

  return (
    <section className="measurement-workspace">
      <div className="measurement-toolbar" style={{ justifyContent: 'flex-end' }}>
        <div className="measurement-save-actions">
          <button
            type="button"
            className="save-order-primary-btn"
            onClick={currentOrderId ? updateOrder : saveOrder}
            style={{
              background: currentOrderId ? '#10b981' : '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              padding: '10px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            💾 Save Order
          </button>

          <button type="button" onClick={addRow} style={{ background: '#3b82f6' }}>
            + Add Window
          </button>

          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            style={{
              background: '#0284c7',
              color: '#ffffff',
              fontWeight: 700,
              padding: '10px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
            }}
            title="Export Official A4 Workshop Order Sheet or Glass Order Sheet (PDF)"
          >
            📄 {language === 'en' ? 'Export A4 PDF' : 'A4 PDF ஏற்றுமதி'}
          </button>

          <button
            type="button"
            onClick={() => {
              setCadSelectedIndex(0)
              setIsCadModalOpen(true)
            }}
            style={{
              background: '#334155',
              color: '#ffffff',
              fontWeight: 700,
              padding: '10px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
            }}
            title="View 2D CAD Blueprints, Elevation and Section Cuts"
          >
            📐 {language === 'en' ? '2D CAD Drawing' : '2D வரைபடம் (CAD)'}
          </button>

          {!currentOrderId && (
            <button
              type="button"
              onClick={createNewOrder}
              style={{
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
              }}
            >
              + New Order
            </button>
          )}
        </div>
      </div>

      {/* SAVED ORDERS */}
      <div className="saved-orders-panel">
        <div className="saved-orders-heading">
          <div>
            <h3>Saved Orders</h3>
            <p>Open, update or delete your previously saved orders.</p>
          </div>

          <strong>{savedOrders.length} saved</strong>
        </div>

        {savedOrders.length > 0 && (
          <div style={{ padding: '0 16px 12px 16px' }}>
            <input
              type="text"
              placeholder={
                language === 'ta'
                  ? 'திட்டம் அல்லது ID (எ.கா. proj-1) மூலம் தேடவும்...'
                  : 'Search saved orders by name or project ID (e.g. proj-1)...'
              }
              value={savedOrderSearch}
              onChange={(e) => setSavedOrderSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
        )}

        {savedOrders.length === 0 ? (
          <p className="saved-orders-empty">
            No saved orders yet. Complete an order and click Save Order.
          </p>
        ) : filteredSavedOrders.length === 0 ? (
          <p className="saved-orders-empty">
            No saved orders match "{savedOrderSearch}".
          </p>
        ) : (
          <div className="saved-orders-list">
            {filteredSavedOrders.map((order) => (
              <div className="saved-order-item" key={order.id}>
                <div className="saved-order-information">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {order.serialNumber && (
                      <span
                        style={{
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {order.serialNumber}
                      </span>
                    )}
                    <strong>{order.projectName}</strong>
                  </div>
                  <span>Customer: {order.customerName}</span>
                  <span>Phone: {order.customerPhone || '-'}</span>
                  <span>Date: {order.orderDate}</span>
                  <span>Windows: {order.rows.length}</span>
                </div>

                <div className="saved-order-actions">
                  <button type="button" onClick={() => openOrder(order)}>
                    Open
                  </button>

                  <button
                    type="button"
                    className="delete-row-button"
                    onClick={() => deleteOrder(order.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {currentOrderId && (
        <div
          className="current-order-indicator"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ecfdf5',
            borderLeft: '4px solid #10b981',
            color: '#065f46',
            padding: '12px 18px',
          }}
        >
          <span>
            {currentOrder?.serialNumber && (
              <span
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  marginRight: '8px',
                }}
              >
                {currentOrder.serialNumber}
              </span>
            )}
            <strong>Editing Saved Project:</strong> {projectName || 'Current Project'} — Click <strong>Save Order</strong> to save your window changes.
          </span>
          <span
            style={{
              fontSize: '12px',
              background: '#dcfce7',
              color: '#166534',
              padding: '4px 10px',
              borderRadius: '6px',
              fontWeight: 700,
            }}
          >
            ✓ Project Loaded
          </span>
        </div>
      )}

      <div className="tolerance-settings">
        <div>
          <h3>Outer Frame Added MM / Tolerance</h3>
          <p>Workshop added margin for outer frame calculations.</p>
        </div>

        <label>
          Added MM / Tolerance (mm)
          <div className="tolerance-stepper">
            <button
              type="button"
              className="tolerance-step-btn"
              onClick={() => adjustTolerance(-1)}
              disabled={defaultTolerance <= 0}
              aria-label="Decrease added mm"
            >
              -
            </button>
            <input
              type="number"
              min="0"
              max="50"
              step="any"
              value={defaultTolerance}
              onChange={(e) => {
                const val = e.target.value === '' ? 0 : Number(e.target.value)
                setDefaultTolerance(Math.max(0, val))
              }}
            />
            <button
              type="button"
              className="tolerance-step-btn"
              onClick={() => adjustTolerance(1)}
              aria-label="Increase added mm"
            >
              +
            </button>
          </div>
        </label>

        <label className="tolerance-checkbox">
          <input
            type="checkbox"
            checked={defaultApplyTolerance}
            onChange={(e) => setDefaultApplyTolerance(e.target.checked)}
          />
          Apply Added MM
        </label>

        <div className="unit-conversion-control">
          <span className="unit-conversion-title">Unit Conversion</span>

          <label>
            From
            <select
              value={fromUnit}
              onChange={(e) =>
                handleFromUnitChange(e.target.value as RowUnit)
              }
            >
              <option value="in">Inches</option>
              <option value="cm">CM</option>
              <option value="mm">MM</option>
            </select>
          </label>

          <span className="unit-conversion-arrow">→</span>

          <label>
            To
            <select
              value={toUnit}
              onChange={(e) => setToUnit(e.target.value as RowUnit)}
            >
              <option value="in">Inches</option>
              <option value="cm">CM</option>
              <option value="mm">MM</option>
            </select>
          </label>
        </div>
      </div>

      {/* CUSTOMER AND PROJECT DETAILS */}
      <div className="measurement-order-details">
        <label>
          Customer Name
          <input
            type="text"
            placeholder="Enter customer name"
            value={customerName}
            readOnly={selectedCustomer !== null}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </label>

        <label>
          Customer Phone Number
          <input
            type="tel"
            placeholder="Enter phone number"
            value={customerPhone}
            readOnly={selectedCustomer !== null}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </label>

        <label>
          Order Date
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
          />
        </label>

        <label>
          Project / Order Name
          <input
            type="text"
            placeholder="Enter project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            style={
              isDuplicateName
                ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' }
                : {}
            }
          />
          {isDuplicateName && (
            <span
              style={{
                color: '#dc2626',
                fontSize: '11px',
                fontWeight: 700,
                marginTop: '4px',
                display: 'block',
              }}
            >
              ⚠️ enter unique name
            </span>
          )}
        </label>
      </div>

      {/* COMPREHENSIVE FABRICATION TABLE */}
      <div className="measurement-table-wrapper">
        <table className="measurement-table">
          <thead>
            <tr>
              <th rowSpan={2}>S.No / Var</th>
              <th rowSpan={2}>Colour</th>

              <th rowSpan={2}>
                Height × Width
                <br />
                <span className="table-unit-note">
                  Enter in {unitLabels[fromUnit]}
                </span>
              </th>

              <th rowSpan={2}>
                Outer Frame ({unitShortLabels[toUnit]})
                <br />
                (H × W)
              </th>

              <th colSpan={2}>Model Details</th>

              <th colSpan={4}>Sash Cut ({unitShortLabels[toUnit]})</th>

              <th rowSpan={2}>Interlock ({unitShortLabels[toUnit]})</th>

              {showMullionColumn && (
                <th rowSpan={2}>
                  Mullion ({unitShortLabels[toUnit]})
                  <br />
                  (H Pcs)
                </th>
              )}

              {showMeshColumn && (
                <th colSpan={2}>Mesh Cut ({unitShortLabels[toUnit]})</th>
              )}

              <th colSpan={3}>Glass Cut ({unitShortLabels[toUnit]})</th>

              <th rowSpan={2}>Glass Type</th>
              <th rowSpan={2}>Status</th>
              <th rowSpan={2}>Action</th>
            </tr>

            <tr className="sub-heading">
              <th>Model Name</th>
              <th>Material</th>

              <th>H</th>
              <th>W</th>
              <th>H Pcs</th>
              <th>W Pcs</th>

              {showMeshColumn && (
                <>
                  <th>H</th>
                  <th>W</th>
                </>
              )}

              <th>H</th>
              <th>W</th>
              <th>Qty</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const selectedModel = WINDOW_MODELS.find(
                (model) => model.id === row.modelId
              )

              const calculation = getRowCalculation(row)
              const rowLabel = windowLabels[index]?.label || `W${index + 1}`

              return (
                <tr key={row.id}>
                  {/* S.No and Window Variant label & selector */}
                  <td>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <strong
                        style={{
                          fontSize: '13px',
                          color: '#1e293b',
                        }}
                      >
                        {rowLabel}
                      </strong>

                      <select
                        aria-label={`Window ${index + 1} variant`}
                        value={row.variantLetter || ''}
                        onChange={(e) =>
                          updateRow(row.id, 'variantLetter', e.target.value)
                        }
                        style={{
                          fontSize: '11px',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          background: row.variantLetter ? '#eff6ff' : '#ffffff',
                          fontWeight: row.variantLetter ? 600 : 400,
                          color: row.variantLetter ? '#1d4ed8' : '#64748b',
                          cursor: 'pointer',
                        }}
                        title="Variant letter (e.g. W1a, W1b)"
                      >
                        <option value="">-</option>
                        <option value="a">a</option>
                        <option value="b">b</option>
                        <option value="c">c</option>
                        <option value="d">d</option>
                        <option value="e">e</option>
                        <option value="f">f</option>
                      </select>
                    </div>
                  </td>

                  <td>
                    <label className="identification-color-control">
                      <span
                        className="identification-color-preview"
                        style={{
                          backgroundColor: row.identificationColor,
                        }}
                      />

                      <input
                        type="color"
                        aria-label={`Window ${index + 1} identification colour`}
                        value={row.identificationColor}
                        onChange={(e) =>
                          updateRow(
                            row.id,
                            'identificationColor',
                            e.target.value
                          )
                        }
                      />
                    </label>
                  </td>

                  <td className="dimension-cell">
                    <div className="dimension-horizontal">
                      <div className="dimension-item">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Height"
                          value={row.height}
                          onChange={(e) => {
                            updateRow(row.id, 'height', e.target.value)
                            updateRow(row.id, 'heightAdditionalMm', 0)
                          }}
                        />

                        <select
                          aria-label="Height fraction"
                          value=""
                          onChange={(e) =>
                            applyFraction(row, 'height', e.target.value)
                          }
                        >
                          <option value="" disabled>
                            + Fraction
                          </option>
                          {fractionOptions.map((fraction) => (
                            <option
                              key={fraction.label}
                              value={fraction.label}
                            >
                              +{fraction.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <span className="dimension-x">×</span>

                      <div className="dimension-item">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Width"
                          value={row.width}
                          onChange={(e) => {
                            updateRow(row.id, 'width', e.target.value)
                            updateRow(row.id, 'widthAdditionalMm', 0)
                          }}
                        />

                        <select
                          aria-label="Width fraction"
                          value=""
                          onChange={(e) =>
                            applyFraction(row, 'width', e.target.value)
                          }
                        >
                          <option value="" disabled>
                            + Fraction
                          </option>
                          {fractionOptions.map((fraction) => (
                            <option
                              key={fraction.label}
                              value={fraction.label}
                            >
                              +{fraction.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </td>

                  <td>
                    {calculation
                      ? `${formatCutValue(calculation.outerFrameHeight, toUnit)} × ${formatCutValue(calculation.outerFrameWidth, toUnit)}`
                      : '-'}
                  </td>

                  {/* Profile / Model Selection with Categories */}
                  <td>
                    <select
                      value={row.modelId}
                      onChange={(e) => {
                        const newModel = e.target.value
                        updateRow(row.id, 'modelId', newModel)
                        const uniqueColor = getModelColor(newModel)
                        if (uniqueColor) {
                          updateRow(row.id, 'identificationColor', uniqueColor)
                        }
                      }}
                      style={{ minWidth: '160px' }}
                    >
                      <option value="">Select Window / Door Model</option>

                      <optgroup label="58mm Sliding Windows">
                        {WINDOW_MODELS.filter(
                          (m) =>
                            m.category === 'sliding' && m.material === '58 mm'
                        ).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="66mm Sliding Windows">
                        {WINDOW_MODELS.filter(
                          (m) =>
                            m.category === 'sliding' && m.material === '66 mm'
                        ).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="85mm Sliding Doors">
                        {WINDOW_MODELS.filter(
                          (m) =>
                            m.category === 'sliding' && m.material === '85 mm'
                        ).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="60mm Casement / Open Windows">
                        {WINDOW_MODELS.filter(
                          (m) => m.category === 'open'
                        ).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="108mm Open Doors">
                        {WINDOW_MODELS.filter(
                          (m) => m.category === 'door'
                        ).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="Fixed & Ventilators">
                        {WINDOW_MODELS.filter(
                          (m) =>
                            (m.category === 'fixed' ||
                            m.category === 'ventilator') &&
                            m.id !== 'ventilator-fan'
                        ).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </td>

                  {/* Material */}
                  <td>
                    {selectedModel ? (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: '#f1f5f9',
                          color: '#334155',
                        }}
                      >
                        {selectedModel.material}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>

                  {/* Sash Cut Dimensions */}
                  <td>
                    {calculation && calculation.sashHeight !== null
                      ? formatCutValue(calculation.sashHeight, toUnit)
                      : '-'}
                  </td>

                  <td>
                    {calculation && calculation.sashWidth !== null
                      ? formatCutValue(calculation.sashWidth, toUnit)
                      : '-'}
                  </td>

                  <td>
                    {calculation && calculation.sashHeightPieces > 0
                      ? calculation.sashHeightPieces
                      : '-'}
                  </td>

                  <td>
                    {calculation && calculation.sashWidthPieces > 0
                      ? calculation.sashWidthPieces
                      : '-'}
                  </td>

                  {/* Interlock */}
                  <td>
                    {calculation && calculation.interlock !== null
                      ? formatCutValue(calculation.interlock, toUnit)
                      : '-'}
                  </td>

                  {/* Mullion (if present in order) */}
                  {showMullionColumn && (
                    <td>
                      {calculation && calculation.mullion !== null
                        ? `${formatCutValue(calculation.mullion, toUnit)} (${calculation.mullionPieces} pc)`
                        : '-'}
                    </td>
                  )}

                  {/* Mosquito Mesh (if present in order) */}
                  {showMeshColumn && (
                    <>
                      <td>
                        {calculation && calculation.meshHeight !== null
                          ? formatCutValue(calculation.meshHeight, toUnit)
                          : '-'}
                      </td>

                      <td>
                        {calculation && calculation.meshWidth !== null
                          ? formatCutValue(calculation.meshWidth, toUnit)
                          : '-'}
                      </td>
                    </>
                  )}

                  {/* Glass Cut Dimensions */}
                  <td>
                    {calculation && calculation.glassHeight !== null
                      ? formatCutValue(calculation.glassHeight, toUnit)
                      : '-'}
                  </td>

                  <td>
                    {calculation && calculation.glassWidth !== null
                      ? formatCutValue(calculation.glassWidth, toUnit)
                      : '-'}
                  </td>

                  <td>
                    {calculation && calculation.glassPieces > 0
                      ? `${calculation.glassPieces} pcs`
                      : '-'}
                  </td>

                  <td>
                    <input
                      type="text"
                      placeholder="Glass type"
                      value={row.glassType}
                      onChange={(e) =>
                        updateRow(row.id, 'glassType', e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <button
                      type="button"
                      title="Click to toggle fabrication status"
                      style={{
                        borderRadius: '6px',
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: row.status === 'finished' ? '#ecfdf5' : '#fef3c7',
                        color: row.status === 'finished' ? '#059669' : '#b45309',
                        border: `1px solid ${row.status === 'finished' ? '#a7f3d0' : '#fde68a'}`,
                        whiteSpace: 'nowrap',
                      }}
                      onClick={async () => {
                        const newStatus = row.status === 'finished' ? 'pending' : 'finished'
                        updateRow(row.id, 'status' as any, newStatus)
                        if (row.backendId && currentOrderId) {
                          try {
                            await fetch(`/api/projects/${currentOrderId}/measurements/${row.backendId}/status`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: newStatus }),
                            })
                          } catch (e) {
                            console.error('Failed to sync window status', e)
                          }
                        }
                      }}
                    >
                      {row.status === 'finished' ? '✓ Finished' : '⏳ Pending'}
                    </button>
                  </td>

                  <td>
                    <div className="row-action-buttons">
                      <button
                        type="button"
                        className="copy-row-button"
                        onClick={() => copyRow(row.id)}
                      >
                        Copy
                      </button>

                      <button
                        type="button"
                        className="delete-row-button"
                        onClick={() => deleteRow(row.id)}
                        disabled={rows.length === 1}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* WINDOW SUMMARY */}
      <div className="window-summary">
        <div className="window-summary-header">
          <div>
            <h3>Window & Door Summary</h3>
            <p>Total fabrication quantities grouped by profile model.</p>
          </div>

          <div className="window-summary-total">
            <span>Total Units</span>
            <strong>{rows.length}</strong>
          </div>
        </div>

        <div className="measurement-table-wrapper">
          <table className="measurement-table window-summary-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Model Name</th>
                <th>Category</th>
                <th>Material</th>
                <th>Short Code</th>
                <th>Window Quantity</th>
              </tr>
            </thead>

            <tbody>
              {modelSummary.map((model, index) => (
                <tr key={model.id}>
                  <td>{index + 1}</td>
                  <td>{model.name}</td>
                  <td style={{ textTransform: 'capitalize' }}>
                    {model.category}
                  </td>
                  <td>{model.material}</td>
                  <td>{model.shortCode}</td>
                  <td>
                    <strong>{model.quantity}</strong>
                  </td>
                </tr>
              ))}

              {unselectedModelCount > 0 && (
                <tr>
                  <td>{modelSummary.length + 1}</td>
                  <td>Model Not Selected</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>{unselectedModelCount}</td>
                </tr>
              )}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6}>No windows added yet.</td>
                </tr>
              )}
            </tbody>

            <tfoot>
              <tr>
                <th colSpan={5}>Total Windows & Doors</th>
                <th>{rows.length}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="measurement-footer">
        <span>{rows.length} window row(s) configured</span>
      </div>

      {/* LS INTERIORS A4 ORDER SHEET & PDF EXPORT MODAL */}
      {isExportModalOpen && (
        <A4FabricationModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          results={cadCalculationResults}
          language={language}
          initialCustomerName={customerName || ''}
          initialCustomerPhone={customerPhone || ''}
          projectName={projectName || ''}
          projectSerial={currentOrder?.serialNumber || ''}
        />
      )}

      {/* 2D ARCHITECTURAL CAD BLUEPRINT MODAL */}
      {isCadModalOpen && (
        <div className="cad-modal-backdrop" onClick={() => setIsCadModalOpen(false)}>
          <div className="cad-modal-container" onClick={(e) => e.stopPropagation()}>
            <WindowVisualizer2D
              results={cadCalculationResults}
              selectedIndex={cadSelectedIndex}
              onSelectIndex={setCadSelectedIndex}
              language={language}
              onClose={() => setIsCadModalOpen(false)}
              onExportPDF={() => {
                setIsCadModalOpen(false)
                setIsExportModalOpen(true)
              }}
            />
          </div>
        </div>
      )}
    </section>
  )
}

export default Measurements
