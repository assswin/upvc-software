import { useState } from 'react'
import type { Language } from '../components/Sidebar'
import {
  calculateSlidingWindow,
  WINDOW_MODELS,
  type WindowModelId,
  type CustomDeductionOverrides,
} from '../utils/slidingCalculations'
import './Settings.css'

const FORMULAS_STORAGE_KEY = 'ls-interiors-custom-formulas'

type ModelFormulaPreset = {
  name: string
  tamilName: string
  category: string
  material: string
  heightDeduction: number
  widthType: 'deduction' | 'addition' | 'none'
  widthLabel: string
  widthValue: number
  glassReference: 'shutter' | 'frame' | 'none'
  glassDeduction: number
  hasMullion?: boolean
  defaultMullionDeduction?: number
  hasMesh?: boolean
  defaultMeshDeduction?: number
  formulaDescription: string
}

const FORMULA_PRESETS: Record<WindowModelId, ModelFormulaPreset> = {
  '58-2': {
    name: '58mm 2 Track Sliding Window',
    tamilName: '2 டிராக் ஸ்லைடிங் (58mm)',
    category: 'sliding',
    material: '58 mm',
    heightDeduction: 94,
    widthType: 'deduction',
    widthLabel: 'Width Deduction (W/2 - X)',
    widthValue: 11,
    glassReference: 'shutter',
    glassDeduction: 94,
    formulaDescription:
      'Sash H: H-94 | Sash W: W/2-11 | Glass: Shutter-94 (H-188, W/2-105) | Interlock: Sash H-5',
  },
  '58-2.5': {
    name: '58mm 2.5 Track Sliding with Mesh',
    tamilName: '2.5 டிராக் கொசுவலை (58mm)',
    category: 'sliding',
    material: '58 mm',
    heightDeduction: 82,
    widthType: 'deduction',
    widthLabel: 'Width Deduction ((W - X)/2)',
    widthValue: 10,
    glassReference: 'shutter',
    glassDeduction: 94,
    hasMesh: true,
    defaultMeshDeduction: 10,
    formulaDescription:
      'Sash H: H-82 | Sash W: (W-10)/2 | Glass: Shutter-94 | Mesh H: H-10, Mesh W: (W-10)/2',
  },
  '58-3': {
    name: '58mm 3 Track Sliding Window',
    tamilName: '3 டிராக் ஸ்லைடிங் (58mm)',
    category: 'sliding',
    material: '58 mm',
    heightDeduction: 91,
    widthType: 'addition',
    widthLabel: 'Width Overlap Addition (W/3 + X)',
    widthValue: 11,
    glassReference: 'shutter',
    glassDeduction: 94,
    formulaDescription:
      'Sash H: H-91 | Sash W: W/3+11 | Glass: Shutter-94 (H-185, W/3-83) | Interlock: Sash H-5',
  },
  '58-4': {
    name: '58mm 4 Track Sliding Window',
    tamilName: '4 டிராக் ஸ்லைடிங் (58mm)',
    category: 'sliding',
    material: '58 mm',
    heightDeduction: 92,
    widthType: 'addition',
    widthLabel: 'Width Overlap Addition (W/4 + X)',
    widthValue: 11,
    glassReference: 'shutter',
    glassDeduction: 95,
    formulaDescription:
      'Sash H: H-92 | Sash W: W/4+11 | Glass: Shutter-95 (H-187, W/4-84) | Interlock: Sash H-5',
  },
  '66-2': {
    name: '66mm 2 Track Sliding Window',
    tamilName: '2 டிராக் ஸ்லைடிங் (66mm)',
    category: 'sliding',
    material: '66 mm',
    heightDeduction: 94,
    widthType: 'deduction',
    widthLabel: 'Width Deduction ((W - X)/2)',
    widthValue: 22,
    glassReference: 'shutter',
    glassDeduction: 112,
    formulaDescription:
      'Sash H: H-94 | Sash W: (W-22)/2 | Glass: Shutter-112 (H-206, (W-22)/2-112) | Interlock: Sash H-5',
  },
  '66-3': {
    name: '66mm 3 Track Sliding Window',
    tamilName: '3 டிராக் ஸ்லைடிங் (66mm)',
    category: 'sliding',
    material: '66 mm',
    heightDeduction: 88,
    widthType: 'addition',
    widthLabel: 'Width Overlap Addition ((W + X)/3)',
    widthValue: 48,
    glassReference: 'shutter',
    glassDeduction: 112,
    formulaDescription:
      'Sash H: H-88 | Sash W: (W+48)/3 | Glass: Shutter-112 (H-200, (W+48)/3-112) | Interlock: Sash H-5',
  },
  '85-2': {
    name: '85mm 2 Track Heavy Sliding Door',
    tamilName: '2 டிராக் டோர் (85mm Door)',
    category: 'sliding',
    material: '85 mm',
    heightDeduction: 94,
    widthType: 'deduction',
    widthLabel: 'Width Deduction ((W - X)/2)',
    widthValue: 2,
    glassReference: 'shutter',
    glassDeduction: 152,
    formulaDescription:
      'Sash H: H-94 | Sash W: (W-2)/2 | Glass: Shutter-152 | Interlock: Sash H-5',
  },
  '85-2.5': {
    name: '85mm 2.5 Track Sliding Door with Mesh',
    tamilName: '2.5 டிராக் டோர் மெஷ் (85mm Door)',
    category: 'sliding',
    material: '85 mm',
    heightDeduction: 82,
    widthType: 'addition',
    widthLabel: 'Width Overlap Addition ((W + X)/2)',
    widthValue: 12,
    glassReference: 'shutter',
    glassDeduction: 152,
    hasMesh: true,
    defaultMeshDeduction: 0,
    formulaDescription:
      'Sash H: H-82 | Sash W: (W+12)/2 | Glass: Shutter-152 | Mesh: Same H & W as Sash',
  },
  '85-3': {
    name: '85mm 3 Track Heavy Sliding Door',
    tamilName: '3 டிராக் டோர் (85mm Door)',
    category: 'sliding',
    material: '85 mm',
    heightDeduction: 88,
    widthType: 'addition',
    widthLabel: 'Width Overlap Addition ((W + X)/3)',
    widthValue: 90,
    glassReference: 'shutter',
    glassDeduction: 152,
    formulaDescription:
      'Sash H: H-88 | Sash W: (W+90)/3 | Glass: Shutter-152 | Interlock: Sash H-5',
  },
  'open-single': {
    name: 'Single Open Casement Window',
    tamilName: 'தனி திறக்கும் ஜன்னல் (1 Shutter)',
    category: 'open',
    material: '60 mm',
    heightDeduction: 64,
    widthType: 'deduction',
    widthLabel: 'Width Deduction (W - X)',
    widthValue: 64,
    glassReference: 'shutter',
    glassDeduction: 124,
    formulaDescription:
      'Sash H: H-64 | Sash W: W-64 | Glass: Shutter-124 (1 Pc)',
  },
  'open-double': {
    name: 'Double Open Window with Mullion',
    tamilName: 'இரட்டை திறக்கும் ஜன்னல் (2 Shutter + Mullion)',
    category: 'open',
    material: '60 mm',
    heightDeduction: 64,
    widthType: 'deduction',
    widthLabel: 'Width Deduction (W/2 - X)',
    widthValue: 37,
    glassReference: 'shutter',
    glassDeduction: 126,
    hasMullion: true,
    defaultMullionDeduction: 6,
    formulaDescription:
      'Sash H: H-64 | Sash W: W/2-37 | Glass: Shutter-126 (2 Pcs) | Mullion: Outer Frame H-6 (1 Pc)',
  },
  'open-triple': {
    name: '3-Open Window with 2 Mullions',
    tamilName: '3-திறக்கும் ஜன்னல் (3 Shutter + 2 Mullion)',
    category: 'open',
    material: '60 mm',
    heightDeduction: 64,
    widthType: 'deduction',
    widthLabel: 'Width Deduction (W/3 - X)',
    widthValue: 40,
    glassReference: 'shutter',
    glassDeduction: 125,
    hasMullion: true,
    defaultMullionDeduction: 6,
    formulaDescription:
      'Sash H: H-64 | Sash W: W/3-40 | Glass: Shutter-125 (3 Pcs) | Mullions: Outer Frame H-6 (2 Pcs)',
  },
  'door-with-bottom': {
    name: 'Single Open Door with Bottom – 108 mm',
    tamilName: 'சிங்கிள் ஓபன் டோர் - பாட்டம் உண்டு',
    category: 'door',
    material: '108 mm',
    heightDeduction: 63,
    widthType: 'deduction',
    widthLabel: 'Width Deduction (W - X)',
    widthValue: 63,
    glassReference: 'none',
    glassDeduction: 0,
    formulaDescription:
      'Sash H: H-63 | Sash W: W-63 | Solid/PVC Panel Door (No Glass Cut Required)',
  },
  'door-without-bottom': {
    name: 'Single Open Door without Bottom – 108 mm',
    tamilName: 'சிங்கிள் ஓபன் டோர் - பாட்டம் இல்லை',
    category: 'door',
    material: '108 mm',
    heightDeduction: 38,
    widthType: 'deduction',
    widthLabel: 'Width Deduction (W - X)',
    widthValue: 63,
    glassReference: 'none',
    glassDeduction: 0,
    formulaDescription:
      'Sash H: H-38 | Sash W: W-63 | Solid/PVC Panel Door (No Glass Cut Required)',
  },
  'double-door-with-bottom': {
    name: 'Double Open Door with Bottom – 108 mm',
    tamilName: 'டபுள் ஓபன் டோர் - பாட்டம் உண்டு',
    category: 'door',
    material: '108 mm',
    heightDeduction: 63,
    widthType: 'deduction',
    widthLabel: 'Width Deduction (W/2 - X)',
    widthValue: 35,
    glassReference: 'none',
    glassDeduction: 0,
    formulaDescription:
      'Sash H: H-63 | Sash W: W/2-35 | Solid/PVC Panel Door (No Glass Cut Required)',
  },
  'double-door-without-bottom': {
    name: 'Double Open Door without Bottom – 108 mm',
    tamilName: 'டபுள் ஓபன் டோர் - பாட்டம் இல்லை',
    category: 'door',
    material: '108 mm',
    heightDeduction: 38,
    widthType: 'deduction',
    widthLabel: 'Width Deduction (W/2 - X)',
    widthValue: 35,
    glassReference: 'none',
    glassDeduction: 0,
    formulaDescription:
      'Sash H: H-38 | Sash W: W/2-35 | Solid/PVC Panel Door (No Glass Cut Required)',
  },
  fixed: {
    name: 'Fixed Window (Direct Glazing)',
    tamilName: 'நிலையான ஜன்னல் (Direct Glazing)',
    category: 'fixed',
    material: '50 mm',
    heightDeduction: 0,
    widthType: 'none',
    widthLabel: 'Direct Outer Frame Only',
    widthValue: 0,
    glassReference: 'frame',
    glassDeduction: 96,
    formulaDescription:
      'Outer Frame Only (No Sash) | Direct Frame Glazing Glass: Outer Frame (OU) - 96 mm',
  },
  'ventilator-normal': {
    name: 'Ventilator (Standard Louver)',
    tamilName: 'வென்டிலேட்டர் (நேரடி அங்குலம் → MM)',
    category: 'ventilator',
    material: '50 mm',
    heightDeduction: 0,
    widthType: 'none',
    widthLabel: 'Direct Outer Frame Only',
    widthValue: 0,
    glassReference: 'none',
    glassDeduction: 0,
    formulaDescription:
      'Outer Frame Only (No Sash) | Louver Frame (No Glass Cut Required)',
  },
  'ventilator-fan-left': {
    name: 'Ventilator with Fan (Left)',
    tamilName: 'வென்டிலேட்டர் மின்விசிறி (இடது)',
    category: 'ventilator',
    material: '50 mm',
    heightDeduction: 0,
    widthType: 'none',
    widthLabel: 'Direct Outer Frame Only',
    widthValue: 0,
    glassReference: 'none',
    glassDeduction: 0,
    formulaDescription:
      'Outer Frame Only (No Sash) | Exhaust Fan Provision Left (No Glass Cut Required)',
  },
  'ventilator-fan-right': {
    name: 'Ventilator with Fan (Right)',
    tamilName: 'வென்டிலேட்டர் மின்விசிறி (வலது)',
    category: 'ventilator',
    material: '50 mm',
    heightDeduction: 0,
    widthType: 'none',
    widthLabel: 'Direct Outer Frame Only',
    widthValue: 0,
    glassReference: 'none',
    glassDeduction: 0,
    formulaDescription:
      'Outer Frame Only (No Sash) | Exhaust Fan Provision Right (No Glass Cut Required)',
  },
  'ventilator-fan': {
    name: 'Ventilator with Fan (Left)',
    tamilName: 'வென்டிலேட்டர் மின்விசிறி (இடது)',
    category: 'ventilator',
    material: '50 mm',
    heightDeduction: 0,
    widthType: 'none',
    widthLabel: 'Direct Outer Frame Only',
    widthValue: 0,
    glassReference: 'none',
    glassDeduction: 0,
    formulaDescription:
      'Outer Frame Only (No Sash) | Exhaust Fan Provision (No Glass Cut Required)',
  },
}

interface SettingsProps {
  language: Language
}

export default function Settings({ language }: SettingsProps) {
  const [selectedModel, setSelectedModel] = useState<WindowModelId>('58-2')
  const [customFormulas, setCustomFormulas] = useState<
    Record<string, CustomDeductionOverrides>
  >(() => {
    try {
      const stored = localStorage.getItem(FORMULAS_STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })
  const [saveStatus, setSaveStatus] = useState<string>('')

  const activePreset = FORMULA_PRESETS[selectedModel]
  const activeOverrides = customFormulas[selectedModel] || {}

  const updateOverride = (
    field: keyof CustomDeductionOverrides,
    value: number | undefined
  ) => {
    setCustomFormulas((prev) => {
      const current = prev[selectedModel] || {}
      const updatedOverrides = {
        ...current,
        [field]: value,
      }
      const updatedAll = {
        ...prev,
        [selectedModel]: updatedOverrides,
      }
      try {
        localStorage.setItem(FORMULAS_STORAGE_KEY, JSON.stringify(updatedAll))
      } catch (e) {
        console.error(e)
      }
      return updatedAll
    })
    setSaveStatus('Auto-saved!')
    setTimeout(() => setSaveStatus(''), 2000)
  }

  const resetCurrentModel = () => {
    setCustomFormulas((prev) => {
      const updated = { ...prev }
      delete updated[selectedModel]
      try {
        localStorage.setItem(FORMULAS_STORAGE_KEY, JSON.stringify(updated))
      } catch (e) {
        console.error(e)
      }
      return updated
    })
    setSaveStatus('Reset to workshop defaults')
    setTimeout(() => setSaveStatus(''), 2000)
  }

  const resetAllModels = () => {
    const confirmed = window.confirm(
      language === 'en'
        ? 'Are you sure you want to reset ALL profile formulas to workshop standards?'
        : 'அனைத்து ஃபார்முலாக்களையும் ஆரம்ப நிலைக்கு மீட்டமைக்க விரும்புகிறீர்களா?'
    )
    if (!confirmed) return

    setCustomFormulas({})
    try {
      localStorage.removeItem(FORMULAS_STORAGE_KEY)
    } catch (e) {
      console.error(e)
    }
    setSaveStatus('All models reset to defaults')
    setTimeout(() => setSaveStatus(''), 2000)
  }

  // Calculate live preview cuts for a standard test dimension (48" x 60" / 1219 x 1524 mm)
  const previewResult = calculateSlidingWindow({
    modelId: selectedModel,
    height: 60,
    width: 48,
    unit: 'inches',
    applyTolerance: false,
    customOverrides: activeOverrides,
  })

  const categories = [
    {
      id: 'sliding',
      labelEn: '58mm Sliding Series',
      labelTa: '58mm ஸ்லைடிங் தொடர்',
      models: WINDOW_MODELS.filter(
        (m) => m.category === 'sliding' && m.material === '58 mm'
      ),
    },
    {
      id: 'sliding66',
      labelEn: '66mm Sliding Series',
      labelTa: '66mm ஸ்லைடிங் தொடர்',
      models: WINDOW_MODELS.filter(
        (m) => m.category === 'sliding' && m.material === '66 mm'
      ),
    },
    {
      id: 'door85',
      labelEn: '85mm Heavy Sliding Doors',
      labelTa: '85mm கனரக ஸ்லைடிங் கதவு',
      models: WINDOW_MODELS.filter(
        (m) => m.category === 'sliding' && m.material === '85 mm'
      ),
    },
    {
      id: 'open',
      labelEn: '60mm Casement / Open Windows',
      labelTa: '60mm திறக்கும் ஜன்னல்கள்',
      models: WINDOW_MODELS.filter((m) => m.category === 'open'),
    },
    {
      id: 'door108',
      labelEn: '108mm Open Doors',
      labelTa: '108mm ஓபன் கதவுகள்',
      models: WINDOW_MODELS.filter((m) => m.category === 'door'),
    },
    {
      id: 'fixedVent',
      labelEn: 'Fixed & Ventilators',
      labelTa: 'நிலையான ஜன்னல் & வென்டிலேட்டர்',
      models: WINDOW_MODELS.filter(
        (m) =>
          (m.category === 'fixed' || m.category === 'ventilator') &&
          m.id !== 'ventilator-fan'
      ),
    },
  ]

  return (
    <div className="settings-workspace">
      <div className="settings-header">
        <h2>
          {language === 'en'
            ? 'Fabrication Formula Settings'
            : 'ஃபார்முலா அமைப்புகள்'}
        </h2>
        <p>
          {language === 'en'
            ? 'Customize millimeter cutting deductions and glass formulas across all window & door profile series. Changes apply dynamically to all measurements.'
            : 'அனைத்து சுயவிவர தொடர்களுக்கும் வெட்டு கழித்தல் மற்றும் கண்ணாடி கணக்கீடுகளை மாற்றவும்.'}
        </p>
      </div>

      <div className="settings-layout">
        {/* Profile Series Navigation Sidebar */}
        <aside className="settings-sidebar">
          {categories.map((cat) => (
            <div key={cat.id}>
              <div className="settings-category-title">
                {language === 'en' ? cat.labelEn : cat.labelTa}
              </div>
              {cat.models.map((model) => (
                <button
                  type="button"
                  key={model.id}
                  className={`settings-model-btn ${
                    selectedModel === model.id ? 'active' : ''
                  }`}
                  onClick={() => setSelectedModel(model.id)}
                >
                  <span>
                    {language === 'en'
                      ? model.name
                      : FORMULA_PRESETS[model.id]?.tamilName || model.name}
                  </span>
                  <span className="settings-model-badge">
                    {model.shortCode}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Selected Profile Settings Card */}
        <div className="settings-content-card">
          <div className="settings-model-header">
            <div>
              <h3>
                {language === 'en'
                  ? activePreset.name
                  : activePreset.tamilName}
              </h3>
              <span>
                {language === 'en' ? 'Material Series' : 'பொருள் தொடர்'}:{' '}
                <strong>{activePreset.material}</strong> | Code:{' '}
                <code>{activePreset.category.toUpperCase()}</code>
              </span>
            </div>

            {saveStatus && (
              <span className="settings-save-indicator">✓ {saveStatus}</span>
            )}
          </div>

          {/* Workshop Rule Reference Box */}
          <div className="settings-rule-box">
            <span className="settings-rule-title">
              {language === 'en'
                ? 'Workshop Standard Fabrication Rule'
                : 'பணிமனை நிலையான ஃபார்முலா'}
            </span>
            <p className="settings-rule-desc">
              {activePreset.formulaDescription}
            </p>
            <div className="settings-glass-badge">
              {activePreset.glassReference === 'shutter' &&
                (language === 'en'
                  ? '✓ Glass Formula: Deducted directly from Sash (Shutter) Dimensions'
                  : '✓ கண்ணாடி: ஷட்டர் அளவிலிருந்து நேரடியாக கழிக்கப்படுகிறது')}
              {activePreset.glassReference === 'frame' &&
                (language === 'en'
                  ? '✓ Glass Formula: Deducted directly from Outer Frame (OU) Dimensions'
                  : '✓ கண்ணாடி: வெளிப்புற சட்ட அளவிலிருந்து நேரடியாக கழிக்கப்படுகிறது')}
              {activePreset.glassReference === 'none' &&
                (language === 'en'
                  ? '✓ Solid Panel / Louver Opening (No Glass Cut Required)'
                  : '✓ கண்ணாடி தேவையில்லை')}
            </div>
          </div>

          {/* Custom Deduction Override Inputs */}
          <div className="settings-inputs-grid">
            {/* Height Deduction */}
            {activePreset.heightDeduction > 0 && (
              <div className="settings-field">
                <label>
                  {language === 'en'
                    ? 'Sash Height Deduction (mm)'
                    : 'ஷட்டர் உயரம் கழித்தல் (mm)'}
                </label>
                <input
                  type="number"
                  placeholder={`Default: ${activePreset.heightDeduction} mm (H - ${activePreset.heightDeduction})`}
                  value={activeOverrides.heightDeductionMM ?? ''}
                  onChange={(e) =>
                    updateOverride(
                      'heightDeductionMM',
                      e.target.value === '' ? undefined : Number(e.target.value)
                    )
                  }
                />
                <span className="settings-field-note">
                  Outer Frame H - {activeOverrides.heightDeductionMM ?? activePreset.heightDeduction} mm
                </span>
              </div>
            )}

            {/* Width Deduction or Overlap Addition */}
            {activePreset.widthType !== 'none' && (
              <div className="settings-field">
                <label>
                  {activePreset.widthLabel} (mm)
                </label>
                <input
                  type="number"
                  placeholder={`Default: ${activePreset.widthValue} mm`}
                  value={
                    activePreset.widthType === 'addition'
                      ? activeOverrides.widthAdditionMM ?? ''
                      : activeOverrides.widthDeductionMM ?? ''
                  }
                  onChange={(e) => {
                    const val =
                      e.target.value === '' ? undefined : Number(e.target.value)
                    if (activePreset.widthType === 'addition') {
                      updateOverride('widthAdditionMM', val)
                    } else {
                      updateOverride('widthDeductionMM', val)
                    }
                  }}
                />
                <span className="settings-field-note">
                  {activePreset.widthType === 'addition'
                    ? `W + ${activeOverrides.widthAdditionMM ?? activePreset.widthValue} mm overlap`
                    : activePreset.widthLabel.includes('W/2')
                    ? `(W / 2) - ${activeOverrides.widthDeductionMM ?? activePreset.widthValue} mm deduction`
                    : activePreset.widthLabel.includes('W/3')
                    ? `(W / 3) - ${activeOverrides.widthDeductionMM ?? activePreset.widthValue} mm deduction`
                    : activePreset.widthLabel.includes('W/4')
                    ? `(W / 4) - ${activeOverrides.widthDeductionMM ?? activePreset.widthValue} mm deduction`
                    : `W - ${activeOverrides.widthDeductionMM ?? activePreset.widthValue} mm deduction`}
                </span>
              </div>
            )}

            {/* Glass Deduction */}
            {activePreset.glassReference !== 'none' ? (
              <div className="settings-field">
                <label>
                  {activePreset.glassReference === 'shutter'
                    ? language === 'en'
                      ? 'Glass Deduction from Shutter (mm)'
                      : 'ஷட்டரிலிருந்து கண்ணாடி கழித்தல் (mm)'
                    : language === 'en'
                      ? 'Glass Deduction from Outer Frame (mm)'
                      : 'வெளிப்புற சட்டத்திலிருந்து கண்ணாடி கழித்தல் (mm)'}
                </label>
                <input
                  type="number"
                  placeholder={`Default: ${activePreset.glassDeduction} mm`}
                  value={activeOverrides.glassDeductionMM ?? ''}
                  onChange={(e) =>
                    updateOverride(
                      'glassDeductionMM',
                      e.target.value === '' ? undefined : Number(e.target.value)
                    )
                  }
                />
                <span className="settings-field-note">
                  {activePreset.glassReference === 'shutter'
                    ? `Glass = Shutter - ${activeOverrides.glassDeductionMM ?? activePreset.glassDeduction} mm`
                    : `Glass = Outer Frame (OU) - ${activeOverrides.glassDeductionMM ?? activePreset.glassDeduction} mm`}
                </span>
              </div>
            ) : (
              <div className="settings-field">
                <label>
                  {language === 'en' ? 'Glazing Schedule' : 'கண்ணாடி அளவு'}
                </label>
                <div
                  style={{
                    padding: '10px 12px',
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#64748b',
                  }}
                >
                  ℹ{' '}
                  {language === 'en'
                    ? 'Solid door / louver profile: No glass cut required.'
                    : 'கண்ணாடி தேவையில்லை.'}
                </div>
              </div>
            )}

            {/* Mullion Deduction (for casement double and triple) */}
            {activePreset.hasMullion && (
              <div className="settings-field">
                <label>
                  {language === 'en'
                    ? 'Mullion Deduction from Frame Height (mm)'
                    : 'முல்லியன் கழித்தல் (mm)'}
                </label>
                <input
                  type="number"
                  placeholder={`Default: ${activePreset.defaultMullionDeduction ?? 6} mm (H - 6)`}
                  value={activeOverrides.mullionDeductionMM ?? ''}
                  onChange={(e) =>
                    updateOverride(
                      'mullionDeductionMM',
                      e.target.value === '' ? undefined : Number(e.target.value)
                    )
                  }
                />
                <span className="settings-field-note">
                  Mullion Cut = Outer Frame H - {activeOverrides.mullionDeductionMM ?? activePreset.defaultMullionDeduction ?? 6} mm
                </span>
              </div>
            )}

            {/* Mosquito Mesh Deduction (for 2.5 track mesh) */}
            {activePreset.hasMesh && (
              <div className="settings-field">
                <label>
                  {language === 'en'
                    ? 'Mosquito Mesh Deduction (mm)'
                    : 'கொசுவலை கழித்தல் (mm)'}
                </label>
                <input
                  type="number"
                  placeholder={`Default: ${activePreset.defaultMeshDeduction ?? 0} mm`}
                  value={activeOverrides.meshDeductionMM ?? ''}
                  onChange={(e) =>
                    updateOverride(
                      'meshDeductionMM',
                      e.target.value === '' ? undefined : Number(e.target.value)
                    )
                  }
                />
                <span className="settings-field-note">
                  Mesh Height = H - {activeOverrides.meshDeductionMM ?? activePreset.defaultMeshDeduction ?? 0} mm
                </span>
              </div>
            )}
          </div>

          {/* Live Calculation Preview Box */}
          <div className="settings-preview-box">
            <div className="settings-preview-title">
              🔍{' '}
              {language === 'en'
                ? 'Live Calculation Simulation (Test Dimension: 48" × 60" / 1219 × 1524 mm)'
                : 'நேரடி கணக்கீடு முன்னோட்டம் (48" × 60")'}
            </div>
            <table className="settings-preview-table">
              <thead>
                <tr>
                  <th>Outer Frame (H × W)</th>
                  <th>Sash Cut (H × W)</th>
                  <th>Sash Pieces</th>
                  <th>Interlock</th>
                  <th>Mullion</th>
                  <th>Mesh Cut</th>
                  <th>Glass Cut (H × W)</th>
                  <th>Glass Pcs</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    {previewResult.outerFrameHeight} × {previewResult.outerFrameWidth} mm
                  </td>
                  <td>
                    {previewResult.sashHeight !== null
                      ? `${previewResult.sashHeight} × ${previewResult.sashWidth} mm`
                      : '-'}
                  </td>
                  <td>
                    {previewResult.sashHeightPieces > 0
                      ? `${previewResult.sashHeightPieces} pcs`
                      : '-'}
                  </td>
                  <td>
                    {previewResult.interlock !== null
                      ? `${previewResult.interlock} mm`
                      : '-'}
                  </td>
                  <td>
                    {previewResult.mullion !== null
                      ? `${previewResult.mullion} mm (${previewResult.mullionPieces} pc)`
                      : '-'}
                  </td>
                  <td>
                    {previewResult.meshHeight !== null
                      ? `${previewResult.meshHeight} × ${previewResult.meshWidth} mm`
                      : '-'}
                  </td>
                  <td>
                    {previewResult.glassHeight !== null
                      ? `${previewResult.glassHeight} × ${previewResult.glassWidth} mm`
                      : '-'}
                  </td>
                  <td>
                    {previewResult.glassPieces > 0
                      ? `${previewResult.glassPieces} pcs`
                      : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div className="settings-actions">
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="settings-btn-reset-model"
                onClick={resetCurrentModel}
              >
                {language === 'en'
                  ? 'Reset This Profile'
                  : 'இந்த சுயவிவரத்தை மீட்டமை'}
              </button>

              <button
                type="button"
                className="settings-btn-reset-all"
                onClick={resetAllModels}
              >
                {language === 'en'
                  ? 'Reset All Profiles to Defaults'
                  : 'அனைத்தையும் மீட்டமை'}
              </button>
            </div>

            <span style={{ fontSize: '13px', color: '#64748b' }}>
              {language === 'en'
                ? 'All formula changes take effect immediately on Measurements & Orders.'
                : 'மாற்றங்கள் உடனடியாக அளவீடுகளில் பிரதிபலிக்கும்.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
