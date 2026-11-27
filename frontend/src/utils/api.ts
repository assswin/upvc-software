const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
const API_BASE_URL = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, '') : '/api'

const SESSION_TOKEN_KEY = 'ls_interiors_passcode_token'
const SESSION_LABEL_KEY = 'ls_interiors_passcode_label'

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

export function getSessionToken(): string | null {
  return sessionStorage.getItem(SESSION_TOKEN_KEY)
}

export function getSessionLabel(): string | null {
  return sessionStorage.getItem(SESSION_LABEL_KEY)
}

export function setPasscodeSession(token: string, label: string): void {
  sessionStorage.setItem(SESSION_TOKEN_KEY, token)
  sessionStorage.setItem(SESSION_LABEL_KEY, label)
}

export function clearPasscodeSession(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY)
  sessionStorage.removeItem(SESSION_LABEL_KEY)
}

// ---------------------------------------------------------------------------
// Browser-only localStorage store (per passcode user, zero cloud database)
// ---------------------------------------------------------------------------

type LocalCustomer = {
  id: string
  name: string
  phone: string | null
  serial_number: string
  email: string | null
  address: string | null
  is_active: boolean
  created_at: string
}

type LocalProject = {
  id: string
  customer_id: string
  serial_number: string
  name: string
  description: string | null
  status: string
  input_unit: 'in' | 'cm' | 'mm'
  output_unit: 'in' | 'cm' | 'mm'
  default_tolerance_mm: number
  default_apply_tolerance: boolean
  created_at: string
  updated_at: string
}

type LocalMeasurement = {
  id: string
  project_id: string
  row_order: number
  height: number | null
  width: number | null
  input_unit: 'in' | 'cm' | 'mm'
  height_mm: number | null
  width_mm: number | null
  model_id: string | null
  variant_letter: string
  glass_type: string | null
  tolerance_mm: number
  apply_tolerance: boolean
  height_additional_mm: number
  width_additional_mm: number
  identification_color: string
  status: string
}

const UNIT_FACTORS: Record<string, number> = {
  in: 25.4,
  cm: 10,
  mm: 1,
}

function getScopeKey(): string {
  return (getSessionLabel() || 'default').replace(/[^a-zA-Z0-9_-]/g, '_')
}

function readTable<T>(table: 'customers' | 'projects' | 'measurements'): T[] {
  try {
    const raw = localStorage.getItem(`ls_store_${getScopeKey()}_${table}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function writeTable<T>(table: 'customers' | 'projects' | 'measurements', rows: T[]): void {
  localStorage.setItem(`ls_store_${getScopeKey()}_${table}`, JSON.stringify(rows))
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorResponse(detail: string, status: number): Response {
  return jsonResponse({ detail }, status)
}

function toMm(val: number | null | undefined, unit: string): number | null {
  if (val === null || val === undefined || !Number.isFinite(val)) return null
  return Number((val * (UNIT_FACTORS[unit] || 1)).toFixed(4))
}

function nextProjectSerial(projects: LocalProject[]): string {
  const used = new Set<number>()
  for (const p of projects) {
    const m = p.serial_number?.match(/(\d+)/)
    if (m) used.add(Number(m[1]))
  }
  let n = 1
  while (used.has(n)) n++
  return `PROJ-${n}`
}

function getIsoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

async function handleLocalApi(pathWithQuery: string, init: RequestInit): Promise<Response | null> {
  const method = (init.method || 'GET').toUpperCase()
  const url = new URL(pathWithQuery, 'http://localhost')
  const path = url.pathname.replace(/^\/api/, '')

  if (path.startsWith('/passcode')) {
    return null
  }

  let body: Record<string, unknown> = {}
  if (typeof init.body === 'string' && init.body.trim()) {
    try {
      body = JSON.parse(init.body) as Record<string, unknown>
    } catch {
      body = {}
    }
  }

  // -------------------- CUSTOMERS --------------------
  if (path === '/customers/' || path === '/customers') {
    const customers = readTable<LocalCustomer>('customers')
    if (method === 'GET') {
      const includeInactive = url.searchParams.get('include_inactive') === 'true'
      const filtered = includeInactive ? customers : customers.filter((c) => c.is_active)
      return jsonResponse(
        [...filtered].sort((a, b) => b.created_at.localeCompare(a.created_at))
      )
    }
    if (method === 'POST') {
      const name = String(body.name || '').trim()
      const phone = body.phone ? String(body.phone).trim() : null
      const email = body.email ? String(body.email).trim().toLowerCase() : null
      const address = body.address ? String(body.address) : null
      const serialInput = body.serial_number ? String(body.serial_number).trim() : ''

      if (name.length < 2) return errorResponse('Customer name is required.', 422)

      const existing = customers.find(
        (c) =>
          (phone && c.phone === phone) ||
          c.name.toLowerCase() === name.toLowerCase()
      )

      if (existing) {
        if (
          serialInput &&
          customers.some((c) => c.id !== existing.id && c.serial_number === serialInput)
        ) {
          return errorResponse('Customer serial number already exists.', 409)
        }
        existing.name = name
        if (phone) existing.phone = phone
        if (email) existing.email = email
        if (address) existing.address = address
        if (serialInput) existing.serial_number = serialInput
        existing.is_active = true
        writeTable('customers', customers)
        return jsonResponse(existing, 201)
      }

      const finalSerial =
        serialInput || `CUST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
      if (customers.some((c) => c.serial_number === finalSerial)) {
        return errorResponse('Customer serial number already exists.', 409)
      }

      const created: LocalCustomer = {
        id: crypto.randomUUID(),
        name,
        phone,
        serial_number: finalSerial,
        email,
        address,
        is_active: true,
        created_at: new Date().toISOString(),
      }
      customers.push(created)
      writeTable('customers', customers)
      return jsonResponse(created, 201)
    }
  }

  const custRestoreMatch = path.match(/^\/customers\/([^/]+)\/restore$/)
  if (custRestoreMatch && method === 'PATCH') {
    const customers = readTable<LocalCustomer>('customers')
    const cust = customers.find((c) => c.id === custRestoreMatch[1] && !c.is_active)
    if (!cust) return errorResponse('Deleted customer not found.', 404)
    cust.is_active = true
    writeTable('customers', customers)
    return jsonResponse({ message: 'Customer restored successfully.' })
  }

  const custPermMatch = path.match(/^\/customers\/([^/]+)\/permanent$/)
  if (custPermMatch && method === 'DELETE') {
    const custId = custPermMatch[1]
    const customers = readTable<LocalCustomer>('customers')
    if (!customers.some((c) => c.id === custId)) {
      return errorResponse('Customer not found.', 404)
    }
    const projects = readTable<LocalProject>('projects')
    const removedProjectIds = new Set(
      projects.filter((p) => p.customer_id === custId).map((p) => p.id)
    )
    const measurements = readTable<LocalMeasurement>('measurements')
    writeTable(
      'measurements',
      measurements.filter((m) => !removedProjectIds.has(m.project_id))
    )
    writeTable(
      'projects',
      projects.filter((p) => p.customer_id !== custId)
    )
    writeTable(
      'customers',
      customers.filter((c) => c.id !== custId)
    )
    return jsonResponse({ message: 'Customer, projects and measurements permanently deleted.' })
  }

  const custMatch = path.match(/^\/customers\/([^/]+)$/)
  if (custMatch) {
    const custId = custMatch[1]
    const customers = readTable<LocalCustomer>('customers')
    const cust = customers.find((c) => c.id === custId && c.is_active)
    if (!cust) return errorResponse('Customer not found.', 404)

    if (method === 'GET') return jsonResponse(cust)
    if (method === 'PUT') {
      const serialInput = body.serial_number
        ? String(body.serial_number).trim()
        : cust.serial_number
      if (customers.some((c) => c.id !== cust.id && c.serial_number === serialInput)) {
        return errorResponse('Customer serial number already exists.', 409)
      }
      cust.name = String(body.name || cust.name).trim()
      cust.phone = body.phone ? String(body.phone).trim() : null
      cust.serial_number = serialInput
      cust.email = body.email ? String(body.email).trim().toLowerCase() : null
      cust.address = body.address ? String(body.address) : null
      writeTable('customers', customers)
      return jsonResponse(cust)
    }
    if (method === 'DELETE') {
      cust.is_active = false
      writeTable('customers', customers)
      return jsonResponse({ message: 'Customer moved to Deleted Customers successfully.' })
    }
  }

  // -------------------- MEASUREMENTS --------------------
  const measBatchMatch = path.match(/^\/projects\/([^/]+)\/measurements\/batch$/)
  if (measBatchMatch && method === 'POST') {
    const projectId = measBatchMatch[1]
    const projects = readTable<LocalProject>('projects')
    const project = projects.find((p) => p.id === projectId && p.status !== 'inactive')
    if (!project) return errorResponse('Active project not found.', 404)

    const allMeasurements = readTable<LocalMeasurement>('measurements')
    const otherMeasurements = allMeasurements.filter((m) => m.project_id !== projectId)
    const existingById = new Map(
      allMeasurements.filter((m) => m.project_id === projectId).map((m) => [m.id, m])
    )

    const items = (body.measurements as Record<string, unknown>[]) || []
    const deleteIds = new Set((body.delete_ids as string[]) || [])

    const synced: LocalMeasurement[] = items.map((item) => {
      const itemId = item.id ? String(item.id) : crypto.randomUUID()
      const existing = existingById.get(itemId)
      const unit = (item.input_unit as 'in' | 'cm' | 'mm') || project.input_unit
      const height = item.height !== null && item.height !== undefined ? Number(item.height) : null
      const width = item.width !== null && item.width !== undefined ? Number(item.width) : null

      return {
        id: itemId,
        project_id: projectId,
        row_order: Number(item.row_order),
        height,
        width,
        input_unit: unit,
        height_mm: toMm(height, unit),
        width_mm: toMm(width, unit),
        model_id: item.model_id ? String(item.model_id) : null,
        variant_letter: item.variant_letter ? String(item.variant_letter) : '',
        glass_type: item.glass_type ? String(item.glass_type) : null,
        tolerance_mm:
          item.tolerance_mm !== null && item.tolerance_mm !== undefined
            ? Number(item.tolerance_mm)
            : existing?.tolerance_mm ?? project.default_tolerance_mm,
        apply_tolerance:
          item.apply_tolerance !== null && item.apply_tolerance !== undefined
            ? Boolean(item.apply_tolerance)
            : existing?.apply_tolerance ?? project.default_apply_tolerance,
        height_additional_mm: Number(item.height_additional_mm || 0),
        width_additional_mm: Number(item.width_additional_mm || 0),
        identification_color: String(item.identification_color || '#FDE68A'),
        status: String(item.status || 'pending'),
      }
    })

    const finalProjectMeasurements = synced
      .filter((m) => !deleteIds.has(m.id))
      .sort((a, b) => a.row_order - b.row_order)

    const allFinished =
      finalProjectMeasurements.length > 0 &&
      finalProjectMeasurements.every((m) =>
        ['finished', 'completed'].includes(m.status.toLowerCase())
      )
    if (allFinished) project.status = 'completed'
    else if (project.status === 'completed') project.status = 'active'
    project.updated_at = new Date().toISOString()

    writeTable('projects', projects)
    writeTable('measurements', [...otherMeasurements, ...finalProjectMeasurements])
    return jsonResponse(finalProjectMeasurements, 201)
  }

  const measMarkAllMatch = path.match(/^\/projects\/([^/]+)\/measurements\/mark-all-status$/)
  if (measMarkAllMatch && method === 'POST') {
    const projectId = measMarkAllMatch[1]
    const projects = readTable<LocalProject>('projects')
    const project = projects.find((p) => p.id === projectId && p.status !== 'inactive')
    if (!project) return errorResponse('Active project not found.', 404)

    const nextStatus = String(body.status || 'pending')
    const measurements = readTable<LocalMeasurement>('measurements')
    const updatedProjMeas: LocalMeasurement[] = []
    for (const m of measurements) {
      if (m.project_id === projectId) {
        m.status = nextStatus
        updatedProjMeas.push(m)
      }
    }
    if (['finished', 'completed'].includes(nextStatus.toLowerCase())) {
      project.status = 'completed'
    } else if (project.status === 'completed') {
      project.status = 'active'
    }
    writeTable('measurements', measurements)
    writeTable('projects', projects)
    return jsonResponse(updatedProjMeas)
  }

  const measStatusMatch = path.match(/^\/projects\/([^/]+)\/measurements\/([^/]+)\/status$/)
  if (measStatusMatch && method === 'PATCH') {
    const [, projectId, measId] = measStatusMatch
    const projects = readTable<LocalProject>('projects')
    const project = projects.find((p) => p.id === projectId && p.status !== 'inactive')
    if (!project) return errorResponse('Active project not found.', 404)

    const measurements = readTable<LocalMeasurement>('measurements')
    const target = measurements.find((m) => m.id === measId && m.project_id === projectId)
    if (!target) return errorResponse('Measurement not found.', 404)

    target.status = String(body.status || 'pending')
    const projMeas = measurements.filter((m) => m.project_id === projectId)
    const allFinished =
      projMeas.length > 0 &&
      projMeas.every((m) => ['finished', 'completed'].includes(m.status.toLowerCase()))
    if (allFinished) project.status = 'completed'
    else if (project.status === 'completed') project.status = 'active'

    writeTable('measurements', measurements)
    writeTable('projects', projects)
    return jsonResponse(target)
  }

  const measListMatch = path.match(/^\/projects\/([^/]+)\/measurements\/?$/)
  if (measListMatch && method === 'GET') {
    const projectId = measListMatch[1]
    const projects = readTable<LocalProject>('projects')
    const project = projects.find((p) => p.id === projectId && p.status !== 'inactive')
    if (!project) return errorResponse('Active project not found.', 404)

    const measurements = readTable<LocalMeasurement>('measurements')
      .filter((m) => m.project_id === projectId)
      .sort((a, b) => a.row_order - b.row_order)
    return jsonResponse(measurements)
  }

  // -------------------- PROJECTS --------------------
  if (path === '/projects/' || path === '/projects') {
    const projects = readTable<LocalProject>('projects')
    if (method === 'GET') {
      const custFilter = url.searchParams.get('customer_id')
      const statusFilter = url.searchParams.get('status_filter')
      let result = projects.filter((p) =>
        statusFilter && statusFilter.toLowerCase() !== 'all'
          ? p.status === statusFilter.toLowerCase()
          : p.status !== 'inactive'
      )
      if (custFilter) {
        result = result.filter((p) => p.customer_id === custFilter)
      }
      return jsonResponse(
        [...result].sort((a, b) => b.created_at.localeCompare(a.created_at))
      )
    }
    if (method === 'POST') {
      const customers = readTable<LocalCustomer>('customers')
      const customer = customers.find(
        (c) => c.id === String(body.customer_id) && c.is_active
      )
      if (!customer) return errorResponse('Active customer not found.', 404)

      const name = String(body.name || '').trim()
      if (
        projects.some(
          (p) =>
            p.customer_id === customer.id &&
            p.status !== 'inactive' &&
            p.name.toLowerCase() === name.toLowerCase()
        )
      ) {
        return errorResponse('enter unique name', 400)
      }

      const customSerial = body.serial_number
        ? String(body.serial_number).trim().toUpperCase()
        : ''
      if (customSerial && projects.some((p) => p.serial_number === customSerial)) {
        return errorResponse(`Serial number ${customSerial} already exists.`, 400)
      }

      const now = new Date().toISOString()
      const created: LocalProject = {
        id: crypto.randomUUID(),
        customer_id: customer.id,
        serial_number: customSerial || nextProjectSerial(projects),
        name,
        description: body.description ? String(body.description) : null,
        status: String(body.status || 'active'),
        input_unit: (body.input_unit as 'in' | 'cm' | 'mm') || 'in',
        output_unit: (body.output_unit as 'in' | 'cm' | 'mm') || 'mm',
        default_tolerance_mm: Number(body.default_tolerance_mm ?? 5),
        default_apply_tolerance: Boolean(body.default_apply_tolerance ?? true),
        created_at: now,
        updated_at: now,
      }
      projects.push(created)
      writeTable('projects', projects)
      return jsonResponse(created, 201)
    }
  }

  const projStatusMatch = path.match(/^\/projects\/([^/]+)\/status$/)
  if (projStatusMatch && method === 'PATCH') {
    const projects = readTable<LocalProject>('projects')
    const project = projects.find((p) => p.id === projStatusMatch[1])
    if (!project) return errorResponse('Project not found.', 404)
    project.status = String(body.status || project.status)
    project.updated_at = new Date().toISOString()
    writeTable('projects', projects)
    return jsonResponse(project)
  }

  const projMatch = path.match(/^\/projects\/([^/]+)$/)
  if (projMatch) {
    const projects = readTable<LocalProject>('projects')
    const project = projects.find((p) => p.id === projMatch[1] && p.status !== 'inactive')
    if (!project) return errorResponse('Project not found.', 404)

    if (method === 'GET') return jsonResponse(project)
    if (method === 'PUT') {
      const name = String(body.name || project.name).trim()
      if (
        projects.some(
          (p) =>
            p.id !== project.id &&
            p.customer_id === String(body.customer_id || project.customer_id) &&
            p.status !== 'inactive' &&
            p.name.toLowerCase() === name.toLowerCase()
        )
      ) {
        return errorResponse('enter unique name', 400)
      }
      project.customer_id = String(body.customer_id || project.customer_id)
      project.name = name
      project.description = body.description ? String(body.description) : null
      project.input_unit = (body.input_unit as 'in' | 'cm' | 'mm') || project.input_unit
      project.output_unit = (body.output_unit as 'in' | 'cm' | 'mm') || project.output_unit
      project.default_tolerance_mm = Number(
        body.default_tolerance_mm ?? project.default_tolerance_mm
      )
      project.default_apply_tolerance = Boolean(
        body.default_apply_tolerance ?? project.default_apply_tolerance
      )
      if (body.status) project.status = String(body.status)
      project.updated_at = new Date().toISOString()
      writeTable('projects', projects)
      return jsonResponse(project)
    }
    if (method === 'DELETE') {
      project.status = 'inactive'
      writeTable('projects', projects)
      return jsonResponse({ message: 'Project deactivated successfully.' })
    }
  }

  // -------------------- DASHBOARD STATS --------------------
  if (path === '/dashboard/stats' && method === 'GET') {
    const customers = readTable<LocalCustomer>('customers')
    const custMap = new Map(customers.filter((c) => c.is_active).map((c) => [c.id, c]))
    const projects = readTable<LocalProject>('projects')
      .filter((p) => p.status !== 'inactive' && custMap.has(p.customer_id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    const measurements = readTable<LocalMeasurement>('measurements')

    const statusCounts = { total: 0, pending: 0, active: 0, completed: 0 }
    const ordersByMonth: Record<string, number> = {}
    const ordersByWeek: Record<string, number> = {}
    const pendingByMonth: Record<string, number> = {}

    const summaries = projects.map((proj) => {
      const cust = custMap.get(proj.customer_id)!
      statusCounts.total += 1
      const st = (proj.status || 'active').toLowerCase()
      if (st === 'pending') statusCounts.pending += 1
      else if (st === 'completed' || st === 'finished') statusCounts.completed += 1
      else statusCounts.active += 1

      const projWindows = measurements
        .filter((m) => m.project_id === proj.id)
        .sort((a, b) => a.row_order - b.row_order)
      const totalW = projWindows.length
      const finishedW = projWindows.filter((m) =>
        ['finished', 'completed', 'done'].includes((m.status || '').toLowerCase())
      ).length
      const pendingW = totalW - finishedW
      const pct =
        totalW > 0
          ? Math.round((finishedW / totalW) * 1000) / 10
          : st === 'completed' || st === 'finished'
            ? 100
            : 0

      const dt = new Date(proj.created_at)
      const mKey = getMonthKey(dt)
      const wKey = getIsoWeekKey(dt)
      ordersByMonth[mKey] = (ordersByMonth[mKey] || 0) + 1
      ordersByWeek[wKey] = (ordersByWeek[wKey] || 0) + 1
      if (st === 'pending') pendingByMonth[mKey] = (pendingByMonth[mKey] || 0) + 1

      return {
        project_id: proj.id,
        project_name: proj.name,
        serial_number: proj.serial_number,
        customer_id: cust.id,
        customer_name: cust.name,
        customer_phone: cust.phone,
        status: proj.status,
        created_at: proj.created_at,
        total_windows: totalW,
        finished_windows: finishedW,
        not_finished_windows: pendingW,
        pending_windows: pendingW,
        completion_pct: pct,
        windows: projWindows.map((m) => ({
          id: m.id,
          row_order: m.row_order,
          model_id: m.model_id,
          variant_letter: m.variant_letter || '',
          height: m.height,
          width: m.width,
          input_unit: m.input_unit,
          glass_type: m.glass_type,
          status: m.status || 'pending',
          identification_color: m.identification_color,
        })),
      }
    })

    const now = new Date()
    const currentYM = getMonthKey(now)
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevYM = getMonthKey(prevMonthDate)
    const currentYW = getIsoWeekKey(now)
    const prevYW = getIsoWeekKey(new Date(now.getTime() - 7 * 86400000))

    const monthsHistory = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = getMonthKey(d)
      monthsHistory.push({
        month: key,
        label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        count: ordersByMonth[key] || 0,
        pending_count: pendingByMonth[key] || 0,
      })
    }

    const weeksHistory = []
    const dayOfWeek = (now.getDay() + 6) % 7
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek)
    for (let i = 5; i >= 0; i--) {
      const wStart = new Date(monday.getTime() - i * 7 * 86400000)
      const wEnd = new Date(wStart.getTime() + 6 * 86400000)
      const wKey = getIsoWeekKey(wStart)
      weeksHistory.push({
        week: wKey,
        label: `${wStart.toLocaleString('en-US', { month: 'short', day: '2-digit' })} - ${wEnd.toLocaleString('en-US', { month: 'short', day: '2-digit' })}`,
        count: ordersByWeek[wKey] || 0,
      })
    }

    return jsonResponse({
      project_status: statusCounts,
      monthly_pending: {
        current_month_pending: pendingByMonth[currentYM] || 0,
        total_pending: statusCounts.pending,
        history: monthsHistory.map((m) => ({
          month: m.month,
          label: m.label,
          pending_count: m.pending_count,
        })),
      },
      orders_per_month: {
        this_month_count: ordersByMonth[currentYM] || 0,
        last_month_count: ordersByMonth[prevYM] || 0,
        history: monthsHistory,
      },
      orders_per_week: {
        this_week_count: ordersByWeek[currentYW] || 0,
        last_week_count: ordersByWeek[prevYW] || 0,
        history: weeksHistory,
      },
      projects_window_summary: summaries,
    })
  }

  return null
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const localHandled = await handleLocalApi(input, init)
  if (localHandled) {
    return localHandled
  }

  const headers = new Headers(init.headers || {})
  const token = getSessionToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(input, { ...init, headers })

  if (response.status === 401 && !input.includes('/passcode/login')) {
    clearPasscodeSession()
    window.dispatchEvent(new CustomEvent('ls-passcode-expired'))
  }

  return response
}
