import type { CustomDeductionOverrides } from './slidingCalculations'

export type WindowIdentityRow = {
  id: number
  modelId: string
  height: string
  width: string
  variantLetter?: string
  glassType: string
  toleranceMm: number
  applyTolerance: boolean
  heightAdditionalMm: number
  widthAdditionalMm: number
}

export type WindowInputUnit = 'in' | 'cm' | 'mm'

export function resolveWindowLabels(
  rows: WindowIdentityRow[],
  fromUnit: WindowInputUnit,
  customFormulas: Record<string, CustomDeductionOverrides>
): { label: string; serialNo: string }[] {
  if (!rows.length) return []

  const specificationNumbers = new Map<string, number>()
  let nextWindowNumber = 0
  let currentFallbackNumber = 0

  return rows.map((row) => {
    const letter = row.variantLetter?.toLowerCase().trim() || ''
    const height = Number(row.height)
    const width = Number(row.width)
    const modelId = row.modelId.trim()
    const hasCompleteSpecification =
      !!modelId &&
      Number.isFinite(height) &&
      height > 0 &&
      Number.isFinite(width) &&
      width > 0

    let specificationKey: string | null = null

    if (hasCompleteSpecification) {
      const overrides = customFormulas[modelId] || {}
      const normalizedOverrides = Object.entries(overrides)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, value ?? null])

      specificationKey = JSON.stringify([
        modelId,
        height.toFixed(4),
        width.toFixed(4),
        fromUnit,
        Number(row.toleranceMm).toFixed(3),
        row.applyTolerance,
        Number(row.heightAdditionalMm).toFixed(3),
        Number(row.widthAdditionalMm).toFixed(3),
        row.glassType.trim(),
        normalizedOverrides,
      ])
    }

    let windowNumber: number

    if (specificationKey) {
      const existingNumber = specificationNumbers.get(specificationKey)
      if (existingNumber !== undefined) {
        windowNumber = existingNumber
      } else {
        windowNumber = ++nextWindowNumber
        specificationNumbers.set(specificationKey, windowNumber)
      }

      if (!letter) currentFallbackNumber = windowNumber
    } else if (!letter) {
      currentFallbackNumber = ++nextWindowNumber
      windowNumber = currentFallbackNumber
    } else {
      if (currentFallbackNumber === 0) {
        currentFallbackNumber = ++nextWindowNumber
      }
      windowNumber = currentFallbackNumber
    }

    return {
      label: letter
        ? `W${windowNumber}${letter}`
        : `W${windowNumber}`,
      serialNo: letter
        ? `${windowNumber}${letter}`
        : String(windowNumber),
    }
  })
}
