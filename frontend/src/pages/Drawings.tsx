
import { useState } from 'react'
import type { Language } from '../components/Sidebar'
import type { CalculationResult } from '../types/cad'
import { WindowVisualizer2D } from '../components/WindowVisualizer2D'
import { A4FabricationModal } from '../components/A4FabricationModal'
import { convertMeasurementsToCalculationResults } from '../utils/cadBridge'
import { getModelColor } from '../utils/modelColors'
import { generateProjectSerialNumber } from '../utils/projectSerials'
import {
  generateWorkshopOrderPDF,
  generateGlassFactoryOrderPDF,
} from '../utils/pdfGenerator'
import type { MeasurementRow } from './Measurements'
import './Drawings.css'

interface DrawingsProps {
  language: Language
  initialProjectId?: string | null
  onOpenMeasurements?: (projectId?: string) => void
}

interface SavedOrder {
  id: string
  serialNumber?: string
  backendId?: string
  customerName: string
  customerPhone: string
  orderDate: string
  projectName: string
  rows: MeasurementRow[]
  windowLabels?: string[]
}

const STORAGE_KEY = 'ls-interiors-saved-orders'
const FORMULAS_STORAGE_KEY = 'ls-interiors-custom-formulas'

// Rebuild variation labels from saved measurement rows
// when windowLabels are missing.
function resolveSavedWindowLabels(rows: MeasurementRow[]): string[] {
  let rootLabel = ''
  let rootNumber = 0

  return rows.map((row) => {
    const variant = row.variantLetter?.trim()

    if (variant) {
      if (!rootLabel) {
        rootNumber += 1
        rootLabel = `W${rootNumber}`
      }

      return `${rootLabel}${variant}`
    }

    rootNumber += 1
    rootLabel = `W${rootNumber}`

    return rootLabel
  })
}

// Load saved orders safely.
function loadSavedOrders(): SavedOrder[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    if (!stored) return []

    const parsed = JSON.parse(stored) as SavedOrder[]

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return []
    }

    const usedSerials: string[] = []

    return parsed.map((order) => {
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
  } catch (error) {
    console.error('Error loading saved orders:', error)
    return []
  }
}

// Load custom formulas safely.
function loadSavedFormulas(): Exclude<
  Parameters<typeof convertMeasurementsToCalculationResults>[2],
  undefined
> {
  try {
    const storedFormulas = localStorage.getItem(FORMULAS_STORAGE_KEY)

    if (!storedFormulas) return {}

    const parsed: unknown = JSON.parse(storedFormulas)

    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return parsed as Exclude<
        Parameters<typeof convertMeasurementsToCalculationResults>[2],
        undefined
      >
    }

    return {}
  } catch (error) {
    console.error('Error loading saved formulas:', error)
    return {}
  }
}

export default function Drawings({
  language,
  initialProjectId,
  onOpenMeasurements,
}: DrawingsProps) {
  const isTamil = language === 'ta'

  // Load saved orders once when the component initializes.
  const [orders] = useState<SavedOrder[]>(loadSavedOrders)

  const [selectedOrderId, setSelectedOrderId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'cad' | 'pdf'>('cad')
  const [cadSelectedIndex, setCadSelectedIndex] = useState(0)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [exportSheetType, setExportSheetType] = useState<
    'workshop' | 'glass'
  >('workshop')

  // Select the manually selected project first.
  // Otherwise use the requested project, then the first saved order.
  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ||
    orders.find(
      (order) =>
        order.id === initialProjectId ||
        order.backendId === initialProjectId
    ) ||
    orders[0]

  // Convert measurement rows of selected order to CalculationResult[].
  const calculationResults: CalculationResult[] = (() => {
    if (
      !selectedOrder ||
      !selectedOrder.rows ||
      selectedOrder.rows.length === 0
    ) {
      return []
    }

    const formulas = loadSavedFormulas()

    // Use saved labels first.
    // If missing, rebuild labels using variantLetter.
    const labels =
      selectedOrder.windowLabels &&
      selectedOrder.windowLabels.length === selectedOrder.rows.length
        ? selectedOrder.windowLabels
        : resolveSavedWindowLabels(selectedOrder.rows)

    return convertMeasurementsToCalculationResults(
      selectedOrder.rows,
      labels,
      formulas
    )
  })()

  return (
    <div className="drawings-workspace">
      {/* Top Header & Project Selection */}
      <div className="drawings-header">
        <div>
          <h2>
            {isTamil
              ? '2D வரைபடங்கள் & A4 PDF தயாரிப்பு மையம்'
              : '2D CAD Blueprints & A4 Order Sheet PDF Center'}
          </h2>

          <p>
            {isTamil
              ? 'ஹை-டெபினிஷன் 2D வரைபடங்கள் மற்றும் பட்டறைக்கான அதிகாரப்பூர்வ A4 PDF தாள்கள்'
              : 'Ultra-High-Definition 2D Architectural CAD Drawings & Official Workshop A4 Vector PDFs'}
          </p>
        </div>

        <div className="drawings-project-selector">
          <label>
            {isTamil ? 'திட்டம் தேர்வு:' : 'Select Project:'}
          </label>

          <select
            value={selectedOrder?.id ?? ''}
            onChange={(e) => {
              setSelectedOrderId(e.target.value)
              setCadSelectedIndex(0)
            }}
          >
            {orders.length === 0 ? (
              <option value="">
                {isTamil ? 'ஆர்டர்கள் எதுவும் இல்லை' : 'No Orders Saved'}
              </option>
            ) : (
              orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.serialNumber
                    ? `[${order.serialNumber}] `
                    : ''}
                  {order.projectName ||
                    order.customerName ||
                    'Untitled Order'}{' '}
                  ({order.rows.length}{' '}
                  {isTamil ? 'சாளரங்கள்' : 'windows'})
                </option>
              ))
            )}
          </select>

          {onOpenMeasurements && (
            <button
              type="button"
              className="drawings-edit-btn"
              onClick={() => {
                if (selectedOrder) {
                  onOpenMeasurements(selectedOrder.id)
                }
              }}
              disabled={!selectedOrder}
            >
              ✏️{' '}
              {isTamil ? 'அளவீடுகளை திருத்து' : 'Edit Windows'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="drawings-tabs">
        <button
          type="button"
          className={`drawings-tab ${
            activeTab === 'cad' ? 'active' : ''
          }`}
          onClick={() => setActiveTab('cad')}
        >
          📐{' '}
          {isTamil
            ? '2D CAD வரைபடங்கள் (Elevation & Sections)'
            : '2D CAD Blueprints (Elevation & Sections)'}
        </button>

        <button
          type="button"
          className={`drawings-tab ${
            activeTab === 'pdf' ? 'active' : ''
          }`}
          onClick={() => setActiveTab('pdf')}
        >
          📄{' '}
          {isTamil
            ? 'L.S. Interiors A4 ஆர்டர் தாள் (Vector PDF)'
            : 'L.S. Interiors A4 Workshop Order Sheet (Vector PDF)'}
        </button>
      </div>

      {/* Content Area */}
      <div className="drawings-content">
        {calculationResults.length === 0 ? (
          <div className="drawings-empty-state">
            <span style={{ fontSize: '3rem' }}>📐</span>

            <h3>
              {isTamil
                ? 'சாளரங்கள் எதுவும் இல்லை'
                : 'No Windows Available to Draw'}
            </h3>

            <p>
              {isTamil
                ? 'அளவீடுகள் பக்கத்தில் சாளரங்களைச் சேர்த்து ஆர்டரைச் சேமிக்கவும்.'
                : 'Please add window measurements and click Save Order to generate 2D CAD drawings and A4 sheets.'}
            </p>

            {onOpenMeasurements && (
              <button
                type="button"
                className="drawings-goto-btn"
                onClick={() => onOpenMeasurements()}
              >
                +{' '}
                {isTamil
                  ? 'புதிய ஆர்டர் தொடங்க'
                  : 'Go to Measurements'}
              </button>
            )}
          </div>
        ) : activeTab === 'cad' ? (
          <WindowVisualizer2D
            results={calculationResults}
            selectedIndex={cadSelectedIndex}
            onSelectIndex={setCadSelectedIndex}
            language={language}
            projectName={selectedOrder?.projectName}
            projectSerial={selectedOrder?.serialNumber}
            customerName={selectedOrder?.customerName}
            onExportPDF={() => {
              setExportSheetType('workshop')
              setIsExportModalOpen(true)
            }}
            onExportGlassPDF={() => {
              setExportSheetType('glass')
              setIsExportModalOpen(true)
            }}
          />
        ) : (
          <div className="drawings-pdf-overview">
            <div className="drawings-pdf-banner">
              <div>
                <h3>
                  {isTamil
                    ? 'அதிகாரப்பூர்வ L.S. INTERIORS A4 பட்டறை தாள்'
                    : 'Official L.S. INTERIORS A4 Fabrication Sheets'}
                </h3>

                <p>
                  {isTamil
                    ? '14 சாளரங்கள் வரை ஒரு தாளில், தடிமனான மை, பெரிய எண்கள், ஜீரோ-ஓவர்லே பாக்ஸ் கட்டுப்பாடுகளுடன்'
                    : '14 windows per sheet, heavy bold ink, large stacked cuts, and zero-overflow box constraints.'}
                </p>
              </div>

              <div className="drawings-pdf-actions">
                <button
                  type="button"
                  className="drawings-action-btn primary"
                  onClick={() => {
                    setExportSheetType('workshop')
                    setIsExportModalOpen(true)
                  }}
                >
                  👁️{' '}
                  {isTamil
                    ? 'முழு தாளைப் பார் & PDF பதிவிறக்கு'
                    : 'Preview & Export Full Sheet (PDF)'}
                </button>

                <button
                  type="button"
                  className="drawings-action-btn secondary"
                  onClick={() => {
                    setExportSheetType('glass')
                    setIsExportModalOpen(true)
                  }}
                >
                  🔍{' '}
                  {isTamil
                    ? 'தனி கிளாஸ் கட்டிங் தாள் (PDF)'
                    : 'Dedicated Glass Sheet (PDF)'}
                </button>

                <button
                  type="button"
                  className="drawings-action-btn quick-download"
                  onClick={() => {
                    const doc = generateWorkshopOrderPDF(
                      calculationResults,
                      {
                        customerName: selectedOrder?.customerName || '',
                        customerPhone: selectedOrder?.customerPhone || '',
                        projectName: selectedOrder?.projectName || '',
                        projectSerial: selectedOrder?.serialNumber || '',
                        date:
                          selectedOrder?.orderDate ||
                          new Date().toLocaleDateString('en-GB'),
                        isTamil,
                      }
                    )

                    doc.save(
                      `LS_Interiors_Workshop_Order_${new Date()
                        .toISOString()
                        .slice(0, 10)}.pdf`
                    )
                  }}
                >
                  ⚡{' '}
                  {isTamil
                    ? 'நேரடி A4 PDF பதிவிறக்கு'
                    : 'Instant Workshop PDF'}
                </button>

                <button
                  type="button"
                  className="drawings-action-btn quick-download"
                  onClick={() => {
                    const doc = generateGlassFactoryOrderPDF(
                      calculationResults,
                      {
                        customerName: selectedOrder?.customerName || '',
                        customerPhone: selectedOrder?.customerPhone || '',
                        projectName: selectedOrder?.projectName || '',
                        projectSerial: selectedOrder?.serialNumber || '',
                        date:
                          selectedOrder?.orderDate ||
                          new Date().toLocaleDateString('en-GB'),
                        isTamil,
                      }
                    )

                    doc.save(
                      `LS_Interiors_Glass_Factory_Order_${new Date()
                        .toISOString()
                        .slice(0, 10)}.pdf`
                    )
                  }}
                >
                  ⚡{' '}
                  {isTamil
                    ? 'நேரடி கிளாஸ் PDF'
                    : 'Instant Glass PDF'}
                </button>
              </div>
            </div>

            {/* Quick Summary Table */}
            <div className="drawings-summary-table-wrap">
              <h4>
                {isTamil
                  ? `திட்ட சாளரங்களின் சுருக்கம் (${calculationResults.length} சாளரங்கள்)`
                  : `Project Windows Summary (${calculationResults.length} Windows)`}
              </h4>

              <table className="drawings-summary-table">
                <thead>
                  <tr>
                    <th>{isTamil ? 'எண்' : 'S.No'}</th>
                    <th>
                      {isTamil ? 'அளவீடு (H × W)' : 'Site Dimensions'}
                    </th>
                    <th>{isTamil ? 'மாடல்' : 'Window Model'}</th>
                    <th>
                      {isTamil ? 'வெளிப்புற சட்டம்' : 'Outer Frame (OU)'}
                    </th>
                    <th>{isTamil ? 'ஷட்டர் அளவு' : 'Sash Cut'}</th>
                    <th>{isTamil ? 'கண்ணாடி' : 'Glass Cut'}</th>
                  </tr>
                </thead>

                <tbody>
                  {calculationResults.map((result, index) => {
                    const rowColor = getModelColor(
                      result.input.modelId,
                      result.input.identificationColor
                    )

                    return (
                      <tr
                        key={result.id || index}
                        style={{
                          borderLeft: `5px solid ${rowColor}`,
                        }}
                      >
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-block',
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: rowColor,
                                border: '1px solid rgba(0, 0, 0, 0.25)',
                                flexShrink: 0,
                              }}
                            />

                            <strong>
                              {result.input.windowLabel ||
                                `W${index + 1}`}
                            </strong>
                          </div>
                        </td>

                        <td>
                          {result.input.heightInch}" ×{' '}
                          {result.input.widthInch}" (
                          {result.convertedHeightMM} ×{' '}
                          {result.convertedWidthMM} mm)
                        </td>

                        <td>
                          <span
                            className="drawings-model-pill"
                            style={{
                              backgroundColor: rowColor,
                              color: '#0f172a',
                              border: '1px solid rgba(0, 0, 0, 0.15)',
                              fontWeight: 600,
                            }}
                          >
                            {result.ruleProfileName}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {result.frame.leftRightCutMM} ×{' '}
                            {result.frame.topBottomCutMM} mm
                          </strong>
                        </td>

                        <td>
                          {result.panel && result.panel.heightMM > 0
                            ? `${result.panel.heightMM} × ${result.panel.widthMM} mm (${result.panel.count * 2} pcs)`
                            : '-'}
                        </td>

                        <td>
                          {result.mirror && result.mirror.count > 0
                            ? `${result.mirror.heightMM} × ${result.mirror.widthMM} mm (${result.mirror.count} pcs)`
                            : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
      <A4FabricationModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        results={calculationResults}
        initialSheetType={exportSheetType}
        language={language}
        initialCustomerName={selectedOrder?.customerName || ''}
        initialCustomerPhone={selectedOrder?.customerPhone || ''}
        projectName={selectedOrder?.projectName || ''}
        projectSerial={selectedOrder?.serialNumber || ''}
      />
    </div>
  )
}
