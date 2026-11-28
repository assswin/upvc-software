import { apiUrl, authFetch } from './api'
import type { CustomDeductionOverrides } from './slidingCalculations'

export const DRAFT_FORMULAS_KEY = 'ls-interiors-draft-formulas'
export const PROJECT_FORMULAS_KEY = 'ls-interiors-project-formulas'
const LEGACY_FORMULAS_KEY = 'ls-interiors-custom-formulas'

export type FormulasMap = Record<string, CustomDeductionOverrides>

export function notifyFormulasUpdated(): void {
  window.dispatchEvent(new CustomEvent('ls-formulas-updated'))
}

export function clearDraftFormulas(): void {
  try {
    localStorage.removeItem(DRAFT_FORMULAS_KEY)
    localStorage.removeItem(LEGACY_FORMULAS_KEY)
    notifyFormulasUpdated()
  } catch {
    // Ignore storage errors
  }
}

export function loadDraftFormulas(): FormulasMap {
  try {
    const raw = localStorage.getItem(DRAFT_FORMULAS_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as FormulasMap) : {}
  } catch {
    return {}
  }
}

export function saveDraftFormulas(formulas: FormulasMap): void {
  try {
    if (Object.keys(formulas).length === 0) {
      localStorage.removeItem(DRAFT_FORMULAS_KEY)
    } else {
      localStorage.setItem(DRAFT_FORMULAS_KEY, JSON.stringify(formulas))
    }
    notifyFormulasUpdated()
  } catch (e) {
    console.error(e)
  }
}

function loadAllProjectFormulasMap(): Record<string, FormulasMap> {
  try {
    const raw = localStorage.getItem(PROJECT_FORMULAS_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, FormulasMap>)
      : {}
  } catch {
    return {}
  }
}

export function loadLocalProjectFormulas(projectId: string): FormulasMap {
  const all = loadAllProjectFormulasMap()
  const entry = all[projectId]
  return entry && typeof entry === 'object' ? entry : {}
}

export function saveLocalProjectFormulas(
  projectId: string,
  formulas: FormulasMap
): void {
  try {
    const all = loadAllProjectFormulasMap()
    if (Object.keys(formulas).length === 0) {
      delete all[projectId]
    } else {
      all[projectId] = formulas
    }
    localStorage.setItem(PROJECT_FORMULAS_KEY, JSON.stringify(all))
    notifyFormulasUpdated()
  } catch (e) {
    console.error(e)
  }
}

export async function fetchProjectFormulas(
  projectId: string
): Promise<FormulasMap> {
  try {
    const response = await authFetch(
      apiUrl(`/settings/formulas?project_id=${encodeURIComponent(projectId)}`)
    )
    if (!response.ok) return loadLocalProjectFormulas(projectId)
    const data: { formulas?: FormulasMap } = await response.json()
    const formulas =
      data?.formulas && typeof data.formulas === 'object' ? data.formulas : {}
    saveLocalProjectFormulas(projectId, formulas)
    return formulas
  } catch {
    return loadLocalProjectFormulas(projectId)
  }
}

export async function saveProjectFormulasToServer(
  projectId: string,
  formulas: FormulasMap
): Promise<boolean> {
  saveLocalProjectFormulas(projectId, formulas)
  try {
    const response = await authFetch(apiUrl('/settings/formulas'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, formulas }),
    })
    return response.ok
  } catch (e) {
    console.error('Failed to sync project formulas to server:', e)
    return false
  }
}
