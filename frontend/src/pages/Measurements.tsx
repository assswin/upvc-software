
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

type BackendMeasurement = {
  id?: string
  height?: number | string | null
  width?: number | string | null
  model_id?: string | null
  variant_letter?: string | null
  glass_type?: string | null
  tolerance_mm?: number | null
  apply_tolerance?: boolean | null
  height_additional_mm?: number | null
  width_additional_mm?: number | null
  identification_color?: string | null
  status?: 'pending' | 'finished' | null
}

type BackendProject = {
  id: string
  name: string
  customer_id?: string | null
  serial_number?: string | null
  default_tolerance_mm?: number | null
  default_apply_tolerance?: boolean | null
  input_unit?: RowUnit | null
  output_unit?: RowUnit | null
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

    return orders.map((order) => {
      let serial = order.serialNumber

      if (!serial || usedSerials.includes(serial)) {
        serial = generateProjectSerialNumber(usedSerials)
      }

      usedSerials.push(serial)

      return {
        ...order,
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

// Converts numbers to spreadsheet-style letters:
// 1 = a, 26 = z, 27 = aa, 28 = ab, etc.
function numberToVariantLetter(number: number): string {
  let result = ''
  let current = number

  while (current > 0) {
    current--
    result = String.fromCharCode(97 + (current % 26)) + result
    current = Math.floor(current / 26)
  }

  return result
}

function resolveWindowLabels(
  rows: { variantLetter?: string }[]
): { label: string; serialNo: string }[] {
  if (!rows.length) return []

  let currentWindowNumber = 0

  return rows.map((row) => {
    const letter = row.variantLetter?.toLowerCase().trim() || ''

    if (!letter) {
      currentWindowNumber++
    }

    if (currentWindowNumber === 0) {
      currentWindowNumber = 1
    }

    return {
      label: letter
        ? `W${currentWindowNumber}${letter}`
        : `W${currentWindowNumber}`,
      serialNo: letter
        ? `${currentWindowNumber}${letter}`
        : String(currentWindowNumber),
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
): number => convertFromMm(convertToMm(value, fromUnit), toUnit)

const formatStoredValue = (value: number): string =>
  Number(value.toFixed(4)).toString()

const formatCutValue = (
  value: number | null | undefined,
  unit: RowUnit
): string => {
  if (value === null || value === undefined) return '-'

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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isCadModalOpen, setIsCadModalOpen] = useState(false)
  const [cadSelectedIndex, setCadSelectedIndex] = useState(0)

  const [customerName, setCustomerName] = useState(
    selectedCustomer?.name ?? ''
  )
  const [customerPhone, setCustomerPhone] = useState(
    selectedCustomer?.phone ?? ''
  )
  const [orderDate, setOrderDate] = useState(getTodayDate)
  const [projectName, setProjectName] = useState('')

  const [defaultTolerance, setDefaultTolerance] = useState(5)
  const [defaultApplyTolerance, setDefaultApplyTolerance] = useState(true)

  const lastEmittedRowsRef = useRef<MeasurementRow[] | null>(null)
  const prevToleranceRef = useRef<number>(defaultTolerance)
  const prevApplyToleranceRef = useRef<boolean>(defaultApplyTolerance)
  const isInitialMountRef = useRef<boolean>(true)

  const adjustTolerance = (delta: number) => {
    const current = Math.max(0, defaultTolerance || 0)
    const next = Math.max(0, Math.min(50, current + delta))
    setDefaultTolerance(next)
  }

  const [fromUnit, setFromUnit] = useState<RowUnit>('in')
  const [toUnit, setToUnit] = useState<RowUnit>('mm')

  const [rows, setRows] = useState<MeasurementRow[]>([
    createEmptyRow(1, 5, true, identificationColors[0]),
  ])

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

  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>(loadSavedOrders)
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(
    initialProjectId || null
  )

  const isDuplicateName = useMemo(
    () =>
      isDuplicateOrderName(
        customerName,
        projectName,
        currentOrderId,
        savedOrders
      ),
    [customerName, projectName, currentOrderId, savedOrders]
  )

  const currentOrder = useMemo(
    () => savedOrders.find((order) => order.id === currentOrderId),
    [currentOrderId, savedOrders]
  )

  const [savedOrderSearch, setSavedOrderSearch] = useState('')

  const filteredSavedOrders = useMemo(() => {
    if (!savedOrderSearch.trim()) return savedOrders

    const query = savedOrderSearch.trim().toLowerCase()

    return savedOrders.filter((order) => {
      return (
        order.projectName.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        (order.customerPhone || '').toLowerCase().includes(query) ||
        matchesProjectSerial(order.serialNumber, query)
      )
    })
  }, [savedOrders, savedOrderSearch])

  const [customFormulas, setCustomFormulas] =
    useState<Record<string, CustomDeductionOverrides>>(loadCustomFormulas)

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

  // Keep manually entered customer details, but display the selected
  // customer's latest details whenever a customer is selected.
  const displayedCustomerName = selectedCustomer?.name ?? customerName
  const displayedCustomerPhone = selectedCustomer?.phone ?? customerPhone

  useEffect(() => {
    if (!initialProjectId) return

    let cancelled = false

    const loadProject = async () => {
      try {
        const response = await fetch(`/api/projects/${initialProjectId}`)
        if (!response.ok) return

        const project: BackendProject = await response.json()
        if (cancelled) return

        setCurrentOrderId(project.id)
        setProjectName(project.name)

        const loadedTolerance = Number(project.default_tolerance_mm) || 5
        const loadedApplyTolerance = project.default_apply_tolerance ?? true

        prevToleranceRef.current = loadedTolerance
        prevApplyToleranceRef.current = loadedApplyTolerance

        setDefaultTolerance(loadedTolerance)
        setDefaultApplyTolerance(loadedApplyTolerance)

        if (project.input_unit) setFromUnit(project.input_unit)
        if (project.output_unit) setToUnit(project.output_unit)

        if (project.customer_id && !selectedCustomer?.id) {
          try {
            const customerResponse = await fetch(
              `/api/customers/${project.customer_id}`
            )

            if (customerResponse.ok && !cancelled) {
              const customer: Customer = await customerResponse.json()

              if (customer.name) setCustomerName(customer.name)
              if (customer.phone) setCustomerPhone(customer.phone)
            }
          } catch {
            // Customer details are optional when loading a project.
          }
        }

        const measurementsResponse = await fetch(
          `/api/projects/${initialProjectId}/measurements/`
        )

        if (measurementsResponse.ok && !cancelled) {
          const measurementData: BackendMeasurement[] =
            await measurementsResponse.json()

          if (Array.isArray(measurementData) && measurementData.length > 0) {
            const loadedRows: MeasurementRow[] = measurementData.map(
              (measurement, index) => ({
                id: index + 1,
                height:
                  measurement.height !== null &&
                  measurement.height !== undefined
                    ? String(measurement.height)
                    : '',
                width:
                  measurement.width !== null &&
                  measurement.width !== undefined
                    ? String(measurement.width)
                    : '',
                modelId: measurement.model_id || '58-2',
                variantLetter: measurement.variant_letter || '',
                glassType: measurement.glass_type || '',
                toleranceMm:
                  Number(measurement.tolerance_mm) || loadedTolerance,
                applyTolerance:
                  measurement.apply_tolerance ?? loadedApplyTolerance,
                heightAdditionalMm:
                  Number(measurement.height_additional_mm) || 0,
                widthAdditionalMm:
                  Number(measurement.width_additional_mm) || 0,
                identificationColor:
                  measurement.identification_color ||
                  identificationColors[index % identificationColors.length],
                backendId: measurement.id,
                status: measurement.status || 'pending',
              })
            )

            lastEmittedRowsRef.current = loadedRows
            setRows(loadedRows)
          }
        }

        if (!cancelled) {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      } catch (error) {
        console.error('Error loading project:', error)
      }
    }

    void loadProject()

    return () => {
      cancelled = true
    }
  }, [initialProjectId, selectedCustomer?.id])

  useEffect(() => {
    let cancelled = false

    const syncBackendProjects = async () => {
      try {
        const response = await fetch('/api/projects/')
        if (!response.ok) return

        const backendProjects: BackendProject[] = await response.json()
        if (cancelled || !Array.isArray(backendProjects)) return

        if (backendProjects.length > 0) {
          setSavedOrders((previousOrders) => {
            const existingIds = new Set(
              previousOrders.map((order) => order.id)
            )

            const newOrders: SavedOrder[] = []

            for (const project of backendProjects) {
              if (existingIds.has(project.id)) continue

              newOrders.push({
                id: project.id,
                serialNumber:
                  project.serial_number ||
                  generateProjectSerialNumber(
                    previousOrders.map((order) => order.serialNumber)
                  ),
                customerName: selectedCustomer?.name || 'Customer',
                customerPhone: selectedCustomer?.phone || '',
                orderDate: getTodayDate(),
                projectName: project.name,
                defaultTolerance:
                  Number(project.default_tolerance_mm) || 5,
                defaultApplyTolerance:
                  project.default_apply_tolerance ?? true,
                fromUnit: project.input_unit || 'in',
                toUnit: project.output_unit || 'mm',
                rows: [
                  createEmptyRow(1, 5, true, identificationColors[0]),
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
            }

            return newOrders.length > 0
              ? [...previousOrders, ...newOrders]
              : previousOrders
          })
        }
      } catch {
        // Backend project sync is optional; local saved orders remain available.
      }
    }

    void syncBackendProjects()

    return () => {
      cancelled = true
    }
  }, [selectedCustomer?.name, selectedCustomer?.phone])

  const getNextRowId = (currentRows: MeasurementRow[]) =>
    Math.max(0, ...currentRows.map((row) => row.id)) + 1

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

  // Copies a row and automatically assigns the next available variation
  // within that original window group.
  const copyRow = (id: number, quantity = 1) => {
    const requestedQuantity = Number.isFinite(quantity) ? quantity : 1
    const safeQuantity = Math.max(
      1,
      Math.min(100, Math.floor(requestedQuantity))
    )

    setRows((currentRows) => {
      const originalIndex = currentRows.findIndex((row) => row.id === id)

      if (originalIndex === -1) return currentRows

      const originalRow = currentRows[originalIndex]

      // Find the original window row for this variation group.
      let baseIndex = originalIndex

      while (
        baseIndex > 0 &&
        currentRows[baseIndex].variantLetter?.trim()
      ) {
        baseIndex--
      }

      // Find the end of this window's variation group.
      let groupEnd = baseIndex + 1

      while (
        groupEnd < currentRows.length &&
        currentRows[groupEnd].variantLetter?.trim()
      ) {
        groupEnd++
      }

      // Collect the letters already used by this window.
      const usedLetters = new Set(
        currentRows
          .slice(baseIndex, groupEnd)
          .map((row) => row.variantLetter?.toLowerCase().trim() || '')
          .filter(Boolean)
      )

      const copies: MeasurementRow[] = []
      let nextId = getNextRowId(currentRows)

      for (let index = 0; index < safeQuantity; index++) {
        let letterNumber = 1
        let nextLetter = numberToVariantLetter(letterNumber)

        // Find the first unused letter: a, b, c ... z, aa, ab ...
        while (usedLetters.has(nextLetter)) {
          letterNumber++
          nextLetter = numberToVariantLetter(letterNumber)
        }

        usedLetters.add(nextLetter)

        copies.push({
          ...originalRow,
          id: nextId++,
          backendId: undefined,
          variantLetter: nextLetter,
        })
      }

      // Add copies at the end of this window's group.
      // This keeps W1, W1a, W1b, W1c together before W2.
      const updatedRows = [...currentRows]
      updatedRows.splice(groupEnd, 0, ...copies)

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

  const getOrCreateCustomerId = async (): Promise<string | null> => {
    if (selectedCustomer?.id) return selectedCustomer.id

    const name = customerName.trim()
    if (!name) return null

    try {
      const listResponse = await fetch('/api/customers/')

      if (listResponse.ok) {
        const customers: Customer[] = await listResponse.json()

        const match = customers.find(
          (customer) => customer.name.toLowerCase() === name.toLowerCase()
        )

        if (match) return match.id
      }

      const createResponse = await fetch('/api/customers/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: customerPhone.trim() || null,
          email: null,
          address: null,
        }),
      })

      if (createResponse.ok) {
        const created: Customer = await createResponse.json()
        return created.id
      }
    } catch (error) {
      console.error('Error finding/creating customer on backend:', error)
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
        !!projectId &&
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

      if (isUuid && projectId) {
        const updateResponse = await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectPayload),
        })

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json().catch(() => ({}))

          if (
            errorData?.detail === 'enter unique name' ||
            String(errorData?.detail).includes('unique name')
          ) {
            window.alert('enter unique name')
            return null
          }

          projectId = null
        } else {
          const updatedProject: BackendProject = await updateResponse.json()
          projectSerial = updatedProject.serial_number || ''
        }
      }

      if (!projectId || !isUuid) {
        const createResponse = await fetch('/api/projects/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectPayload),
        })

        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => ({}))

          if (
            errorData?.detail === 'enter unique name' ||
            String(errorData?.detail).includes('unique name')
          ) {
            window.alert('enter unique name')
          }

          return null
        }

        const createdProject: BackendProject = await createResponse.json()
        projectId = createdProject.id
        projectSerial = createdProject.serial_number || ''
      }

      if (!projectId) return null

      const validRows = orderData.rows.filter(
        (row) =>
          (row.height && parseFloat(row.height) > 0) ||
          (row.width && parseFloat(row.width) > 0)
      )

      const rowsToSave = validRows.length > 0 ? validRows : orderData.rows

      const batchPayload = {
        measurements: rowsToSave.map((row, index) => ({
          row_order: index + 1,
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

      const batchResponse = await fetch(
        `/api/projects/${projectId}/measurements/batch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batchPayload),
        }
      )

      if (!batchResponse.ok) {
        console.error(
          'Failed to save measurements:',
          await batchResponse.text()
        )
        return null
      }

      return { id: projectId, serialNumber: projectSerial }
    } catch (error) {
      console.error('Error syncing order to backend:', error)
      return null
    }
  }

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

    if (
      isDuplicateOrderName(
        customerName,
        projectName,
        currentOrderId,
        savedOrders
      )
    ) {
      window.alert('enter unique name')
      return
    }

    const now = new Date().toISOString()
    const orderData = getCurrentOrderData()

    const syncResult = await syncOrderToBackend(null, orderData)

    if (!syncResult) {
      window.alert('Unable to save the order to the server. Please try again.')
      return
    }

    const allSerials = savedOrders.map((order) => order.serialNumber)

    const orderToSave: SavedOrder = {
      ...orderData,
      id: syncResult.id,
      serialNumber:
        syncResult.serialNumber ||
        generateProjectSerialNumber(allSerials),
      createdAt: now,
      updatedAt: now,
    }

    if (saveOrdersToStorage([...savedOrders, orderToSave])) {
      setCurrentOrderId(orderToSave.id)
      window.alert('Order saved successfully!')
    }
  }

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

    if (
      isDuplicateOrderName(customerName, projectName, targetId, savedOrders)
    ) {
      window.alert('enter unique name')
      return
    }

    const orderData = getCurrentOrderData()
    const syncResult = await syncOrderToBackend(targetId, orderData)

    if (!syncResult) return

    const finalId = syncResult.id
    setCurrentOrderId(finalId)

    const existingOrder = savedOrders.find(
      (order) => order.id === targetId
    )

    const otherSerials = savedOrders
      .filter((order) => order.id !== targetId)
      .map((order) => order.serialNumber)

    const serialNumber =
      syncResult.serialNumber ||
      existingOrder?.serialNumber ||
      generateProjectSerialNumber(otherSerials)

    const updatedOrder: SavedOrder = {
      ...(existingOrder || {}),
      ...orderData,
      id: finalId,
      serialNumber,
      createdAt:
        existingOrder?.createdAt || orderDate || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const updatedOrders = savedOrders.some(
      (order) => order.id === finalId
    )
      ? savedOrders.map((order) =>
          order.id === finalId ? updatedOrder : order
        )
      : [...savedOrders, updatedOrder]

    if (saveOrdersToStorage(updatedOrders)) {
      window.alert('Order updated successfully!')
    }
  }

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

    const isUuid =
      !!order.id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        order.id
      )

    let loadedFromBackend = false

    if (isUuid) {
      try {
        const response = await fetch(
          `/api/projects/${order.id}/measurements/`
        )

        if (response.ok) {
          const measurementData: BackendMeasurement[] =
            await response.json()

          if (
            Array.isArray(measurementData) &&
            measurementData.length > 0
          ) {
            const loadedRows: MeasurementRow[] = measurementData.map(
              (measurement, index) => ({
                id: index + 1,
                height:
                  measurement.height !== null &&
                  measurement.height !== undefined
                    ? String(measurement.height)
                    : '',
                width:
                  measurement.width !== null &&
                  measurement.width !== undefined
                    ? String(measurement.width)
                    : '',
                modelId: measurement.model_id || '58-2',
                variantLetter: measurement.variant_letter || '',
                glassType: measurement.glass_type || '',
                toleranceMm: Number(measurement.tolerance_mm) || 5,
                applyTolerance: measurement.apply_tolerance ?? true,
                heightAdditionalMm:
                  Number(measurement.height_additional_mm) || 0,
                widthAdditionalMm:
                  Number(measurement.width_additional_mm) || 0,
                identificationColor:
                  measurement.identification_color ||
                  identificationColors[index % identificationColors.length],
                backendId: measurement.id,
                status: measurement.status || 'pending',
              })
            )

            setRows(loadedRows)
            loadedFromBackend = true
          }
        }
      } catch (error) {
        console.error('Error fetching backend measurements:', error)
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

  const deleteOrder = (id: string) => {
    const order = savedOrders.find((item) => item.id === id)
    if (!order) return

    const confirmed = window.confirm(
      `Are you sure you want to delete "${order.projectName}"? This cannot be undone.`
    )

    if (!confirmed) return

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )

    if (isUuid) {
      fetch(`/api/projects/${id}`, { method: 'DELETE' }).catch(console.error)
    }

    const updatedOrders = savedOrders.filter((item) => item.id !== id)

    if (saveOrdersToStorage(updatedOrders)) {
      if (currentOrderId === id) setCurrentOrderId(null)
      window.alert('Order deleted successfully!')
    }
  }

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

  const showMeshColumn = rows.some(
    (row) => row.modelId === '58-2.5' || row.modelId === '85-2.5'
  )

  const showMullionColumn = rows.some(
    (row) =>
      row.modelId === 'open-double' || row.modelId === 'open-triple'
  )

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

    return calculateSlidingWindow({
      modelId: row.modelId as WindowModelId,
      height,
      width,
      unit: calculationUnit,
      toleranceMm: row.toleranceMm,
      applyTolerance: row.applyTolerance,
      heightAdditionalMm: row.heightAdditionalMm,
      widthAdditionalMm: row.widthAdditionalMm,
      customOverrides: customFormulas[row.modelId],
    })
  }

  const windowLabels = useMemo(() => resolveWindowLabels(rows), [rows])

  const cadCalculationResults = useMemo(
    () =>
      convertMeasurementsToCalculationResults(
        rows,
        windowLabels.map((window) => window.label),
        customFormulas,
        fromUnit
      ),
    [rows, windowLabels, customFormulas, fromUnit]
  )

  const modelSummary = WINDOW_MODELS.map((model) => ({
    ...model,
    quantity: rows.filter((row) => row.modelId === model.id).length,
  })).filter((model) => model.quantity > 0)

  const unselectedModelCount = rows.filter((row) => !row.modelId).length

  return (
    <section className="measurement-workspace">
      <div
        className="measurement-toolbar"
        style={{ justifyContent: 'flex-end' }}
      >
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

          <button
            type="button"
            onClick={addRow}
            style={{ background: '#3b82f6' }}
          >
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
              onChange={(event) => setSavedOrderSearch(event.target.value)}
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
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
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
            <strong>Editing Saved Project:</strong>{' '}
            {projectName || 'Current Project'} — Click{' '}
            <strong>Save Order</strong> to save your window changes.
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
              onChange={(event) => {
                const value =
                  event.target.value === '' ? 0 : Number(event.target.value)
                setDefaultTolerance(Math.max(0, value))
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
            onChange={(event) =>
              setDefaultApplyTolerance(event.target.checked)
            }
          />
          Apply Added MM
        </label>

        <div className="unit-conversion-control">
          <span className="unit-conversion-title">Unit Conversion</span>

          <label>
            From
            <select
              value={fromUnit}
              onChange={(event) =>
                handleFromUnitChange(event.target.value as RowUnit)
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
              onChange={(event) =>
                setToUnit(event.target.value as RowUnit)
              }
            >
              <option value="in">Inches</option>
              <option value="cm">CM</option>
              <option value="mm">MM</option>
            </select>
          </label>
        </div>
      </div>

      <div className="measurement-order-details">
        <label>
          Customer Name
          <input
            type="text"
            placeholder="Enter customer name"
            value={displayedCustomerName}
            readOnly={selectedCustomer !== null}
            onChange={(event) => setCustomerName(event.target.value)}
          />
        </label>

        <label>
          Customer Phone Number
          <input
            type="tel"
            placeholder="Enter phone number"
            value={displayedCustomerPhone}
            readOnly={selectedCustomer !== null}
            onChange={(event) => setCustomerPhone(event.target.value)}
          />
        </label>

        <label>
          Order Date
          <input
            type="date"
            value={orderDate}
            onChange={(event) => setOrderDate(event.target.value)}
          />
        </label>

        <label>
          Project / Order Name
          <input
            type="text"
            placeholder="Enter project name"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
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
              const rowLabel =
                windowLabels[index]?.label || `W${index + 1}`

              return (
                <tr key={row.id}>
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
                        style={{ fontSize: '13px', color: '#1e293b' }}
                      >
                        {rowLabel}
                      </strong>
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
                        onChange={(event) =>
                          updateRow(
                            row.id,
                            'identificationColor',
                            event.target.value
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
                          onChange={(event) => {
                            updateRow(row.id, 'height', event.target.value)
                            updateRow(row.id, 'heightAdditionalMm', 0)
                          }}
                        />
                        <select
                          aria-label="Height fraction"
                          value=""
                          onChange={(event) =>
                            applyFraction(row, 'height', event.target.value)
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
                          onChange={(event) => {
                            updateRow(row.id, 'width', event.target.value)
                            updateRow(row.id, 'widthAdditionalMm', 0)
                          }}
                        />
                        <select
                          aria-label="Width fraction"
                          value=""
                          onChange={(event) =>
                            applyFraction(row, 'width', event.target.value)
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

                  <td>
                    <select
                      value={row.modelId}
                      onChange={(event) => {
                        const newModel = event.target.value
                        updateRow(row.id, 'modelId', newModel)

                        const uniqueColor = getModelColor(newModel)
                        if (uniqueColor) {
                          updateRow(
                            row.id,
                            'identificationColor',
                            uniqueColor
                          )
                        }
                      }}
                      style={{ minWidth: '160px' }}
                    >
                      <option value="">Select Window / Door Model</option>

                      <optgroup label="58mm Sliding Windows">
                        {WINDOW_MODELS.filter(
                          (model) =>
                            model.category === 'sliding' &&
                            model.material === '58 mm'
                        ).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="66mm Sliding Windows">
                        {WINDOW_MODELS.filter(
                          (model) =>
                            model.category === 'sliding' &&
                            model.material === '66 mm'
                        ).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="85mm Sliding Doors">
                        {WINDOW_MODELS.filter(
                          (model) =>
                            model.category === 'sliding' &&
                            model.material === '85 mm'
                        ).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="60mm Casement / Open Windows">
                        {WINDOW_MODELS.filter(
                          (model) => model.category === 'open'
                        ).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="108mm Open Doors">
                        {WINDOW_MODELS.filter(
                          (model) => model.category === 'door'
                        ).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="Fixed & Ventilators">
                        {WINDOW_MODELS.filter(
                          (model) =>
                            (model.category === 'fixed' ||
                              model.category === 'ventilator') &&
                            model.id !== 'ventilator-fan'
                        ).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </td>

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

                  <td>
                    {calculation && calculation.interlock !== null
                      ? formatCutValue(calculation.interlock, toUnit)
                      : '-'}
                  </td>

                  {showMullionColumn && (
                    <td>
                      {calculation && calculation.mullion !== null
                        ? `${formatCutValue(calculation.mullion, toUnit)} (${calculation.mullionPieces} pc)`
                        : '-'}
                    </td>
                  )}

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
                      onChange={(event) =>
                        updateRow(row.id, 'glassType', event.target.value)
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
                        background:
                          row.status === 'finished' ? '#ecfdf5' : '#fef3c7',
                        color:
                          row.status === 'finished' ? '#059669' : '#b45309',
                        border: `1px solid ${
                          row.status === 'finished' ? '#a7f3d0' : '#fde68a'
                        }`,
                        whiteSpace: 'nowrap',
                      }}
                      onClick={async () => {
                        const newStatus =
                          row.status === 'finished' ? 'pending' : 'finished'

                        updateRow(row.id, 'status', newStatus)

                        if (row.backendId && currentOrderId) {
                          try {
                            const response = await fetch(
                              `/api/projects/${currentOrderId}/measurements/${row.backendId}/status`,
                              {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ status: newStatus }),
                              }
                            )

                            if (!response.ok) {
                              console.error(
                                'Failed to update window status on backend.'
                              )
                            }
                          } catch (error) {
                            console.error(
                              'Failed to sync window status',
                              error
                            )
                          }
                        }
                      }}
                    >
                      {row.status === 'finished'
                        ? '✓ Finished'
                        : '⏳ Pending'}
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

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '12px 0',
        }}
      >
        <button type="button" onClick={addRow} style={{ background: '#3b82f6' }}>
          + Add Window
        </button>
      </div>

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

      {isExportModalOpen && (
        <A4FabricationModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          results={cadCalculationResults}
          language={language}
          initialCustomerName={displayedCustomerName || ''}
          initialCustomerPhone={displayedCustomerPhone || ''}
          projectName={projectName || ''}
          projectSerial={currentOrder?.serialNumber || ''}
        />
      )}

      {isCadModalOpen && (
        <div
          className="cad-modal-backdrop"
          onClick={() => setIsCadModalOpen(false)}
        >
          <div
            className="cad-modal-container"
            onClick={(event) => event.stopPropagation()}
          >
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
