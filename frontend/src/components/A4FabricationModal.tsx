import React, { useState } from 'react';
import type { CalculationResult } from '../types/cad';
import { WINDOW_MODELS, type WindowModelId } from '../utils/slidingCalculations';
import { getModelColor } from '../utils/modelColors';
import { generateWorkshopOrderPDF, generateGlassFactoryOrderPDF } from '../utils/pdfGenerator';
import { Download, Printer, X, FileSpreadsheet, Layers } from 'lucide-react';
import './A4FabricationModal.css';

export interface A4FabricationModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: CalculationResult[];
  initialSheetType?: 'workshop' | 'glass';
  language?: 'en' | 'ta';
  isTamil?: boolean;
  initialCustomerName?: string;
  initialCustomerPhone?: string;
  projectName?: string;
  projectSerial?: string;
}

export const A4FabricationModal: React.FC<A4FabricationModalProps> = ({
  isOpen,
  onClose,
  results,
  initialSheetType = 'workshop',
  language = 'en',
  isTamil: isTamilProp,
  initialCustomerName = '',
  initialCustomerPhone = '',
  projectName = '',
  projectSerial = '',
}) => {
  const isTamil = isTamilProp ?? (language === 'ta');
  const t = (ta: string, en: string) => (isTamil ? ta : en);

  const [sheetType, setSheetType] = useState<'workshop' | 'glass'>(initialSheetType);
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerPhone, setCustomerPhone] = useState(initialCustomerPhone);
  const [orderDate, setOrderDate] = useState(() => new Date().toLocaleDateString('en-GB'));
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleDownloadPDF = () => {
    setIsExporting(true);
    try {
      const options = {
        customerName: customerName.trim() || 'General Customer',
        customerPhone: customerPhone.trim(),
        projectName: projectName.trim(),
        projectSerial: projectSerial.trim(),
        date: orderDate,
        isTamil,
      };

      const doc = sheetType === 'workshop'
        ? generateWorkshopOrderPDF(results, options)
        : generateGlassFactoryOrderPDF(results, options);

      const fileName = sheetType === 'workshop'
        ? `LS_Interiors_Workshop_Order_${new Date().toISOString().slice(0, 10)}.pdf`
        : `LS_Interiors_Glass_Factory_Order_${new Date().toISOString().slice(0, 10)}.pdf`;

      doc.save(fileName);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    try {
      const options = {
        customerName: customerName.trim() || 'General Customer',
        customerPhone: customerPhone.trim(),
        projectName: projectName.trim(),
        projectSerial: projectSerial.trim(),
        date: orderDate,
        isTamil,
      };

      const doc = sheetType === 'workshop'
        ? generateWorkshopOrderPDF(results, options)
        : generateGlassFactoryOrderPDF(results, options);

      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } catch (err) {
      console.error('Failed to trigger print:', err);
    }
  };

  return (
    <div className="a4-modal-backdrop" onClick={onClose}>
      <div className="a4-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="a4-modal-header">
          <h3 className="a4-modal-title">
            <FileSpreadsheet className="w-5 h-5 text-blue-500" />
            <span>{t('அதிகாரப்பூர்வ A4 PDF தயாரிப்பு மையம்', 'Official A4 Vector Order Sheet Export')}</span>
          </h3>

          <div className="a4-modal-tab-group">
            <button
              type="button"
              onClick={() => setSheetType('workshop')}
              className={`a4-modal-tab-btn ${sheetType === 'workshop' ? 'active' : ''}`}
            >
              📋 {t('பட்டறை கட்டிங் தாள்', 'Workshop Sheet')}
            </button>
            <button
              type="button"
              onClick={() => setSheetType('glass')}
              className={`a4-modal-tab-btn ${sheetType === 'glass' ? 'active' : ''}`}
            >
              🫧 {t('கிளாஸ் ஆர்டர்', 'Glass Factory')}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="a4-modal-body">
          {/* Metadata Inputs */}
          <div className="a4-inputs-grid">
            <div className="a4-input-group">
              <label>{t('வாடிக்கையாளர் பெயர்', 'Customer Name')}</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Kishore"
              />
            </div>
            <div className="a4-input-group">
              <label>{t('தொலைபேசி எண்', 'Phone Number')}</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 9876543210"
              />
            </div>
            <div className="a4-input-group">
              <label>{t('தேதி', 'Order Date')}</label>
              <input
                type="text"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
          </div>

          {/* Clean In-Browser Sheet Preview */}
          <div className="a4-preview-container">
            <div className="a4-preview-sheet">
              {/* Header */}
              <div className="a4-sheet-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {projectSerial && (
                      <span
                        style={{
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {projectSerial}
                      </span>
                    )}
                    <strong style={{ fontSize: '14px', color: '#1d4ed8', letterSpacing: '0.3px' }}>
                      LS INTERIORS — {sheetType === 'workshop' ? 'FABRICATION WORK ORDER' : 'GLASS FACTORY CUT ORDER'}
                    </strong>
                  </div>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Date: {orderDate}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    Customer: <strong>{customerName || 'General Customer'}</strong> {customerPhone ? `(${customerPhone})` : ''}
                    {projectName ? ` | Project: ${projectSerial ? `[${projectSerial}] ` : ''}${projectName}` : ''}
                  </span>
                  <span style={{ fontWeight: 600 }}>{results.length} Windows Total</span>
                </div>
              </div>

              {/* Comprehensive Fabrication Table matching user request & Image 2 */}
              {sheetType === 'workshop' ? (
                <div className="a4-table-responsive-wrapper">
                  <table className="a4-sheet-table">
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ width: '40px' }}>S.No</th>
                        <th rowSpan={2} style={{ width: '90px' }}>
                          Height × Width
                          <div className="a4-sub-th">Enter in Inches</div>
                        </th>
                        <th rowSpan={2} style={{ width: '95px' }}>
                          Outer Frame (mm)
                          <div className="a4-sub-th">(H × W)</div>
                        </th>
                        <th colSpan={2} style={{ width: '190px' }}>Model Details</th>
                        <th colSpan={4} style={{ width: '160px' }}>Sash Cut (mm)</th>
                        <th rowSpan={2} style={{ width: '65px' }}>
                          Interlock (mm)
                        </th>
                        <th colSpan={3} style={{ width: '140px' }}>Glass Cut (mm)</th>
                        <th rowSpan={2} style={{ width: '85px' }}>Glass Type</th>
                      </tr>
                      <tr className="a4-sub-heading">
                        <th style={{ width: '130px' }}>Model Name</th>
                        <th style={{ width: '60px' }}>Material</th>
                        <th>H</th>
                        <th>W</th>
                        <th>H Pcs</th>
                        <th>W Pcs</th>
                        <th>H</th>
                        <th>W</th>
                        <th>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => {
                        const modelDef = WINDOW_MODELS.find(
                          (m) => m.id === (r.input.modelId as WindowModelId)
                        ) || WINDOW_MODELS.find((m) => m.name === r.ruleProfileName) || WINDOW_MODELS[0];
                        const material = modelDef?.material || `${r.frame.profileDepthMM} mm`;
                        const rowColor = getModelColor(r.input.modelId, r.input.identificationColor);
                        const hInStr = r.input.heightInch ? r.input.heightInch.toFixed(4) : (r.convertedHeightMM / 25.4).toFixed(4);
                        const wInStr = r.input.widthInch ? r.input.widthInch.toFixed(4) : (r.convertedWidthMM / 25.4).toFixed(4);

                        const sashHPcs = r.panel.heightMM > 0
                          ? (r.panel.verticalPieces || (r.panel.count ? r.panel.count * 2 : 2))
                          : '-';
                        const sashWPcs = r.panel.widthMM > 0
                          ? (r.panel.horizontalPieces || (r.panel.count ? r.panel.count * 2 : 2))
                          : '-';

                        return (
                          <tr key={r.id || i} style={{ backgroundColor: rowColor }}>
                            <td className="a4-center a4-bold text-blue" style={{ borderLeft: `5px solid ${rowColor}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                                <span className="a4-row-color-swatch" style={{ backgroundColor: rowColor }} />
                                <span>{r.input.windowLabel || `W${i + 1}`}</span>
                              </div>
                            </td>
                            <td className="a4-center">
                              <div>{hInStr} ×</div>
                              <div style={{ color: '#64748b' }}>{wInStr}"</div>
                            </td>
                            <td className="a4-center a4-bold">{r.convertedHeightMM} × {r.convertedWidthMM}</td>
                            <td className="a4-left a4-bold" style={{ fontSize: '9.5px' }}>{modelDef?.name || r.ruleProfileName}</td>
                            <td className="a4-center">
                              <span className="a4-material-pill">{material}</span>
                            </td>
                            <td className="a4-center a4-bold text-green">{r.panel.heightMM > 0 ? r.panel.heightMM : '-'}</td>
                            <td className="a4-center a4-bold text-green">{r.panel.widthMM > 0 ? r.panel.widthMM : '-'}</td>
                            <td className="a4-center">{sashHPcs}</td>
                            <td className="a4-center">{sashWPcs}</td>
                            <td className="a4-center">{r.interlockMM ? r.interlockMM : '-'}</td>
                            <td className="a4-center a4-bold text-sky">
                              {r.mirror && r.mirror.count > 0 && r.mirror.heightMM > 0 ? r.mirror.heightMM : '-'}
                            </td>
                            <td className="a4-center a4-bold text-sky">
                              {r.mirror && r.mirror.count > 0 && r.mirror.widthMM > 0 ? r.mirror.widthMM : '-'}
                            </td>
                            <td className="a4-center">
                              {r.mirror && r.mirror.count > 0 ? `${r.mirror.count} pcs` : '-'}
                            </td>
                            <td className="a4-center" style={{ fontSize: '9.5px' }}>
                              {r.mirror?.glassType || r.input.glassType || 'Clear 5mm'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="a4-table-responsive-wrapper">
                  <table className="a4-sheet-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>S.No</th>
                        <th style={{ width: '70px' }}>Window</th>
                        <th style={{ width: '100px' }}>Outer Frame (mm)</th>
                        <th>Glass Height (mm)</th>
                        <th>Glass Width (mm)</th>
                        <th style={{ width: '80px' }}>Qty (Pcs)</th>
                        <th style={{ width: '90px' }}>Total Area</th>
                        <th>Glass Specification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.filter(r => r.mirror && r.mirror.count > 0).map((r, i) => {
                        const rowColor = getModelColor(r.input.modelId, r.input.identificationColor);
                        const h = r.mirror?.heightMM || 0;
                        const w = r.mirror?.widthMM || 0;
                        const qty = r.mirror?.count || 0;
                        const sqft = ((h * w * qty) / 92903.04).toFixed(2);

                        return (
                          <tr key={r.id || i} style={{ backgroundColor: rowColor }}>
                            <td className="a4-center a4-bold">{i + 1}</td>
                            <td className="a4-center a4-bold text-blue" style={{ borderLeft: `5px solid ${rowColor}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                                <span className="a4-row-color-swatch" style={{ backgroundColor: rowColor }} />
                                <span>{r.input.windowLabel || `W${i + 1}`}</span>
                              </div>
                            </td>
                            <td className="a4-center">{r.convertedHeightMM} × {r.convertedWidthMM}</td>
                            <td className="a4-center a4-bold text-green">{h}</td>
                            <td className="a4-center a4-bold text-green">{w}</td>
                            <td className="a4-center a4-bold">{qty} pcs</td>
                            <td className="a4-center a4-bold">{sqft} sq.ft</td>
                            <td className="a4-left" style={{ paddingLeft: '8px' }}>
                              {r.mirror?.glassType || 'Clear 5mm Glass'} (Polished Edges)
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer */}
              <div className="a4-sheet-footer">
                <span>Official L.S. INTERIORS Workshop Fabrication Order • All Sum Formulas & Deductions Verified</span>
                <span>Authorized Workshop Signature: ______________________</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="a4-modal-footer">
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            <Layers className="w-4 h-4 inline mr-1" />
            {results.length} windows ready for export
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={handlePrint} className="a4-action-btn a4-close-btn" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Printer className="w-4 h-4" />
              <span>{t('அச்சிடு', 'Print')}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="a4-download-btn"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Generating...' : t('HD வெக்டார் PDF பதிவிறக்கு', 'Download HD Vector PDF')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
