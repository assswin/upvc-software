import { jsPDF } from 'jspdf';
import type { CalculationResult } from '../types/cad';
import { WINDOW_MODELS, type WindowModelId } from './slidingCalculations';
import { getModelColor, hexToRgb, darkenRgb } from './modelColors';

export interface PDFExportOptions {
  customerName?: string;
  customerPhone?: string;
  projectName?: string;
  projectSerial?: string;
  date?: string;
  shopName?: string;
  isTamil?: boolean;
}

/**
 * Creative, High-Definition Vector PDF Engine for LS INTERIORS.
 * Built from first principles for Tamil Nadu UPVC & Aluminum workshops.
 * Features:
 * - A4 Landscape geometry (297 x 210 mm) for comprehensive fabrication schedules.
 * - Exact 14-column layout matching workshop calculation grid:
 *   [S.No] [Height x Width Inches] [Outer Frame HxW mm] [Model Details: Name | Material]
 *   [Sash Cut: H | W | H Pcs | W Pcs] [Interlock mm] [Glass Cut: H | W | Qty] [Glass Type]
 * - Two-tier grouped table headers.
 * - Bold, high-contrast dark ink for workshop readability.
 * - Zero vertical whitespace gap - table starts immediately beneath the header.
 */

const A4_LANDSCAPE_H = 210;
const MARGIN_LEFT = 8;
const TABLE_WIDTH = 281; // 297 - 16
const ROWS_PER_PAGE_LANDSCAPE = 12;

const A4_PORTRAIT_H = 297;
const MARGIN_LEFT_PORTRAIT = 7;
const TABLE_WIDTH_PORTRAIT = 196; // 210 - 14
const ROWS_PER_PAGE_PORTRAIT = 14;

interface ColumnDef {
  header: string;
  subHeader: string;
  width: number;
  align: 'left' | 'center' | 'right';
}

function cleanAscii(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/[—–]/g, '-')
    .replace(/×/g, 'x')
    .replace(/[•·]/g, '|')
    .replace(/°/g, ' deg')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x00-\x7F]/g, '')
    .trim();
}

// High-contrast ink palette
const INK_DEEP = [15, 23, 42]; // Slate 900
const INK_SECONDARY = [71, 85, 105]; // Slate 600
const INK_HEADER_BG = [241, 245, 249]; // Slate 100
const INK_ACCENT = [29, 78, 216]; // Blue 700
const INK_GREEN = [4, 120, 87]; // Emerald 700
const INK_SKY = [2, 132, 199]; // Sky 600

export function generateWorkshopOrderPDF(
  results: CalculationResult[],
  options: PDFExportOptions = {}
): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const shopName = cleanAscii(options.shopName || 'LS INTERIORS');
  const customer = cleanAscii(options.customerName || 'General Order');
  const phone = cleanAscii(options.customerPhone || '');
  const project = cleanAscii(options.projectName || '');
  const projectSerial = cleanAscii(options.projectSerial || '');
  const dateStr = cleanAscii(options.date || new Date().toLocaleDateString('en-GB'));

  const totalPages = Math.max(1, Math.ceil(results.length / ROWS_PER_PAGE_LANDSCAPE));

  // Column definitions (Sum of widths = 281 mm)
  const COL_WIDTHS = {
    sNo: 14,
    siteDim: 28,
    outerFrame: 28,
    modelName: 46,
    material: 16,
    sashH: 16,
    sashW: 16,
    sashHPcs: 13,
    sashWPcs: 13,
    interlock: 18,
    glassH: 16,
    glassW: 16,
    glassQty: 15,
    glassType: 26,
  };

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage();

    const startIdx = page * ROWS_PER_PAGE_LANDSCAPE;
    const pageRows = results.slice(startIdx, startIdx + ROWS_PER_PAGE_LANDSCAPE);

    // 1. TOP HEADER BLOCK (y = 8 to 22 mm)
    doc.setDrawColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    doc.setLineWidth(0.5);
    doc.rect(MARGIN_LEFT, 8, TABLE_WIDTH, 14);

    // Main Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(INK_ACCENT[0], INK_ACCENT[1], INK_ACCENT[2]);
    doc.text(`${shopName} - OFFICIAL WORKSHOP FABRICATION ORDER`, MARGIN_LEFT + 3, 13.5);

    // Prominent Project Serial Number Badge
    if (projectSerial) {
      doc.setFillColor(INK_ACCENT[0], INK_ACCENT[1], INK_ACCENT[2]);
      doc.roundedRect(MARGIN_LEFT + TABLE_WIDTH - 32, 9.5, 29, 6.2, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(projectSerial, MARGIN_LEFT + TABLE_WIDTH - 17.5, 13.9, { align: 'center' });
    }

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(INK_SECONDARY[0], INK_SECONDARY[1], INK_SECONDARY[2]);
    doc.text('High-Precision Cutting, Sash, Interlock & Glass Specification Schedule', MARGIN_LEFT + 3, 17);

    // Metadata Right & Left
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    const projPart = projectSerial ? `[${projectSerial}] ${project}` : project;
    const customerMeta = `Customer: ${customer}${phone ? ` (${phone})` : ''}${projPart ? ` | Project: ${projPart}` : ''}`;
    doc.text(customerMeta, MARGIN_LEFT + 3, 20.8);

    const rightMeta = `Date: ${dateStr}  |  Total Windows: ${results.length}  |  Page ${page + 1} of ${totalPages}`;
    doc.text(rightMeta, MARGIN_LEFT + TABLE_WIDTH - 3, 20.8, { align: 'right' });

    // 2. TWO-TIER TABLE HEADER (y = 23 to 36.5 mm)
    const thY1 = 23;
    const thH1 = 7;
    const thY2 = 30;
    const thH2 = 6.5;
    const thTotalH = thH1 + thH2; // 13.5 mm

    doc.setFillColor(INK_HEADER_BG[0], INK_HEADER_BG[1], INK_HEADER_BG[2]);
    doc.setDrawColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    doc.setLineWidth(0.4);

    // Tier 1 background
    doc.rect(MARGIN_LEFT, thY1, TABLE_WIDTH, thTotalH, 'FD');

    // Tier 1 Groups & Rowspan Headers:
    let curX = MARGIN_LEFT;

    // Col 1: S.No (Rowspan 2)
    doc.rect(curX, thY1, COL_WIDTHS.sNo, thTotalH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    doc.text('S.No', curX + COL_WIDTHS.sNo / 2, thY1 + 8, { align: 'center' });
    curX += COL_WIDTHS.sNo;

    // Col 2: Height x Width (Enter in Inches) (Rowspan 2)
    doc.rect(curX, thY1, COL_WIDTHS.siteDim, thTotalH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Height x Width', curX + COL_WIDTHS.siteDim / 2, thY1 + 5.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(INK_SECONDARY[0], INK_SECONDARY[1], INK_SECONDARY[2]);
    doc.text('Enter in Inches', curX + COL_WIDTHS.siteDim / 2, thY1 + 9.5, { align: 'center' });
    curX += COL_WIDTHS.siteDim;

    // Col 3: Outer Frame (mm) (H x W) (Rowspan 2)
    doc.rect(curX, thY1, COL_WIDTHS.outerFrame, thTotalH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    doc.text('Outer Frame (mm)', curX + COL_WIDTHS.outerFrame / 2, thY1 + 5.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(INK_SECONDARY[0], INK_SECONDARY[1], INK_SECONDARY[2]);
    doc.text('(H x W)', curX + COL_WIDTHS.outerFrame / 2, thY1 + 9.5, { align: 'center' });
    curX += COL_WIDTHS.outerFrame;

    // Col 4 & 5: Model Details (Colspan 2)
    const modelGroupW = COL_WIDTHS.modelName + COL_WIDTHS.material;
    doc.rect(curX, thY1, modelGroupW, thH1);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    doc.text('Model Details', curX + modelGroupW / 2, thY1 + 5, { align: 'center' });

    // Sub-tier Model Name & Material
    doc.rect(curX, thY2, COL_WIDTHS.modelName, thH2);
    doc.setFontSize(7);
    doc.text('Model Name', curX + 3, thY2 + 4.5);
    doc.rect(curX + COL_WIDTHS.modelName, thY2, COL_WIDTHS.material, thH2);
    doc.text('Material', curX + COL_WIDTHS.modelName + COL_WIDTHS.material / 2, thY2 + 4.5, { align: 'center' });
    curX += modelGroupW;

    // Col 6, 7, 8, 9: Sash Cut (mm) (Colspan 4)
    const sashGroupW = COL_WIDTHS.sashH + COL_WIDTHS.sashW + COL_WIDTHS.sashHPcs + COL_WIDTHS.sashWPcs;
    doc.rect(curX, thY1, sashGroupW, thH1);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    doc.text('Sash Cut (mm)', curX + sashGroupW / 2, thY1 + 5, { align: 'center' });

    // Sub-tier Sash H, W, H Pcs, W Pcs
    let sashSubX = curX;
    doc.rect(sashSubX, thY2, COL_WIDTHS.sashH, thH2);
    doc.setFontSize(7);
    doc.text('H', sashSubX + COL_WIDTHS.sashH / 2, thY2 + 4.5, { align: 'center' });
    sashSubX += COL_WIDTHS.sashH;

    doc.rect(sashSubX, thY2, COL_WIDTHS.sashW, thH2);
    doc.text('W', sashSubX + COL_WIDTHS.sashW / 2, thY2 + 4.5, { align: 'center' });
    sashSubX += COL_WIDTHS.sashW;

    doc.rect(sashSubX, thY2, COL_WIDTHS.sashHPcs, thH2);
    doc.text('H Pcs', sashSubX + COL_WIDTHS.sashHPcs / 2, thY2 + 4.5, { align: 'center' });
    sashSubX += COL_WIDTHS.sashHPcs;

    doc.rect(sashSubX, thY2, COL_WIDTHS.sashWPcs, thH2);
    doc.text('W Pcs', sashSubX + COL_WIDTHS.sashWPcs / 2, thY2 + 4.5, { align: 'center' });
    curX += sashGroupW;

    // Col 10: Interlock (mm) (Rowspan 2)
    doc.rect(curX, thY1, COL_WIDTHS.interlock, thTotalH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    doc.text('Interlock', curX + COL_WIDTHS.interlock / 2, thY1 + 5.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(INK_SECONDARY[0], INK_SECONDARY[1], INK_SECONDARY[2]);
    doc.text('(mm)', curX + COL_WIDTHS.interlock / 2, thY1 + 9.5, { align: 'center' });
    curX += COL_WIDTHS.interlock;

    // Col 11, 12, 13: Glass Cut (mm) (Colspan 3)
    const glassGroupW = COL_WIDTHS.glassH + COL_WIDTHS.glassW + COL_WIDTHS.glassQty;
    doc.rect(curX, thY1, glassGroupW, thH1);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    doc.text('Glass Cut (mm)', curX + glassGroupW / 2, thY1 + 5, { align: 'center' });

    // Sub-tier Glass H, W, Qty
    let glassSubX = curX;
    doc.rect(glassSubX, thY2, COL_WIDTHS.glassH, thH2);
    doc.setFontSize(7);
    doc.text('H', glassSubX + COL_WIDTHS.glassH / 2, thY2 + 4.5, { align: 'center' });
    glassSubX += COL_WIDTHS.glassH;

    doc.rect(glassSubX, thY2, COL_WIDTHS.glassW, thH2);
    doc.text('W', glassSubX + COL_WIDTHS.glassW / 2, thY2 + 4.5, { align: 'center' });
    glassSubX += COL_WIDTHS.glassW;

    doc.rect(glassSubX, thY2, COL_WIDTHS.glassQty, thH2);
    doc.text('Qty', glassSubX + COL_WIDTHS.glassQty / 2, thY2 + 4.5, { align: 'center' });
    curX += glassGroupW;

    // Col 14: Glass Type (Rowspan 2)
    doc.rect(curX, thY1, COL_WIDTHS.glassType, thTotalH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    doc.text('Glass Type', curX + COL_WIDTHS.glassType / 2, thY1 + 8, { align: 'center' });

    // 3. TABLE BODY ROWS (Starts immediately at y = 36.5 mm, NO void gap!)
    const rowHeight = 11.2;
    let rowY = thY1 + thTotalH;

    for (let r = 0; r < ROWS_PER_PAGE_LANDSCAPE; r++) {
      const item = pageRows[r];

      // Model identification background fill (exact pastel matching measurement section)
      if (item) {
        const hex = getModelColor(item.input.modelId, item.input.identificationColor);
        const rgb = hexToRgb(hex);
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.rect(MARGIN_LEFT, rowY, TABLE_WIDTH, rowHeight, 'F');

        // Elegant solid identification indicator on S.No column left edge
        const darker = darkenRgb(rgb, 0.4);
        doc.setFillColor(darker[0], darker[1], darker[2]);
        doc.rect(MARGIN_LEFT, rowY, 2.5, rowHeight, 'F');
      } else if (r % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(MARGIN_LEFT, rowY, TABLE_WIDTH, rowHeight, 'F');
      }

      // Border for entire row
      doc.setDrawColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
      doc.setLineWidth(0.35);
      doc.rect(MARGIN_LEFT, rowY, TABLE_WIDTH, rowHeight);

      if (item) {
        const centerY = rowY + rowHeight / 2;
        let cX = MARGIN_LEFT;

        // Model lookup
        const modelDef = WINDOW_MODELS.find(
          (m) => m.id === (item.input.modelId as WindowModelId)
        ) || WINDOW_MODELS.find((m) => m.name === item.ruleProfileName) || WINDOW_MODELS[0];

        const material = modelDef?.material || `${item.frame.profileDepthMM} mm`;

        // 1. S.No / Window Label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(INK_ACCENT[0], INK_ACCENT[1], INK_ACCENT[2]);
        const label = item.input.windowLabel || `W${startIdx + r + 1}`;
        doc.text(label, cX + COL_WIDTHS.sNo / 2, centerY + 1, { align: 'center' });
        cX += COL_WIDTHS.sNo;
        doc.line(cX, rowY, cX, rowY + rowHeight);

        // 2. Height x Width (Inches)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
        const hInStr = item.input.heightInch ? item.input.heightInch.toFixed(4) : (item.convertedHeightMM / 25.4).toFixed(4);
        const wInStr = item.input.widthInch ? item.input.widthInch.toFixed(4) : (item.convertedWidthMM / 25.4).toFixed(4);
        doc.text(`${hInStr} x`, cX + COL_WIDTHS.siteDim / 2, centerY - 1.5, { align: 'center' });
        doc.text(`${wInStr}"`, cX + COL_WIDTHS.siteDim / 2, centerY + 3.2, { align: 'center' });
        cX += COL_WIDTHS.siteDim;
        doc.line(cX, rowY, cX, rowY + rowHeight);

        // 3. Outer Frame (mm)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
        doc.text(`${item.convertedHeightMM} x ${item.convertedWidthMM}`, cX + COL_WIDTHS.outerFrame / 2, centerY + 1, { align: 'center' });
        cX += COL_WIDTHS.outerFrame;
        doc.line(cX, rowY, cX, rowY + rowHeight);

        // 4. Model Name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
        let modelTitle = cleanAscii(modelDef?.name || item.ruleProfileName || '');
        if (modelTitle.length > 26) {
          modelTitle = modelTitle.substring(0, 24) + '..';
        }
        doc.text(modelTitle, cX + 2, centerY + 1);
        cX += COL_WIDTHS.modelName;
        doc.line(cX, rowY, cX, rowY + rowHeight);

        // 5. Material
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(INK_SECONDARY[0], INK_SECONDARY[1], INK_SECONDARY[2]);
        doc.text(cleanAscii(material), cX + COL_WIDTHS.material / 2, centerY + 1, { align: 'center' });
        cX += COL_WIDTHS.material;
        doc.line(cX, rowY, cX, rowY + rowHeight);

        // 6. Sash Cut H
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(INK_GREEN[0], INK_GREEN[1], INK_GREEN[2]);
        const sashH = item.panel.heightMM > 0 ? `${item.panel.heightMM}` : '-';
        doc.text(sashH, cX + COL_WIDTHS.sashH / 2, centerY + 1, { align: 'center' });
        cX += COL_WIDTHS.sashH;
        doc.line(cX, rowY, cX, rowY + rowHeight);

        // 7. Sash Cut W
        const sashW = item.panel.widthMM > 0 ? `${item.panel.widthMM}` : '-';
        doc.text(sashW, cX + COL_WIDTHS.sashW / 2, centerY + 1, { align: 'center' });
        cX += COL_WIDTHS.sashW;
        doc.line(cX, rowY, cX, rowY + rowHeight);

        // 8. Sash H Pcs
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
        const sashHPcs = item.panel.heightMM > 0 ? String(item.panel.verticalPieces || (item.panel.count ? item.panel.count * 2 : 2)) : '-';
        doc.text(sashHPcs, cX + COL_WIDTHS.sashHPcs / 2, centerY + 1, { align: 'center' });
        cX += COL_WIDTHS.sashHPcs;
        doc.line(cX, rowY, cX, rowY + rowHeight);

        // 9. Sash W Pcs
        const sashWPcs = item.panel.widthMM > 0 ? String(item.panel.horizontalPieces || (item.panel.count ? item.panel.count * 2 : 2)) : '-';
        doc.text(sashWPcs, cX + COL_WIDTHS.sashWPcs / 2, centerY + 1, { align: 'center' });
        cX += COL_WIDTHS.sashWPcs;
        doc.line(cX, rowY, cX, rowY + rowHeight);

        // 10. Interlock (mm)
        const interlockStr = item.interlockMM ? `${item.interlockMM}` : '-';
        doc.text(interlockStr, cX + COL_WIDTHS.interlock / 2, centerY + 1, { align: 'center' });
        cX += COL_WIDTHS.interlock;
        doc.line(cX, rowY, cX, rowY + rowHeight);

        // 11. Glass Cut H
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(INK_SKY[0], INK_SKY[1], INK_SKY[2]);
        const glassH = item.mirror && item.mirror.count > 0 && item.mirror.heightMM > 0 ? `${item.mirror.heightMM}` : '-';
        doc.text(glassH, cX + COL_WIDTHS.glassH / 2, centerY + 1, { align: 'center' });
        cX += COL_WIDTHS.glassH;
        doc.line(cX, rowY, cX, rowY + rowHeight);

        // 12. Glass Cut W
        const glassW = item.mirror && item.mirror.count > 0 && item.mirror.widthMM > 0 ? `${item.mirror.widthMM}` : '-';
        doc.text(glassW, cX + COL_WIDTHS.glassW / 2, centerY + 1, { align: 'center' });
        cX += COL_WIDTHS.glassW;
        doc.line(cX, rowY, cX, rowY + rowHeight);

        // 13. Glass Qty
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
        const glassQty = item.mirror && item.mirror.count > 0 ? `${item.mirror.count} pcs` : '-';
        doc.text(glassQty, cX + COL_WIDTHS.glassQty / 2, centerY + 1, { align: 'center' });
        cX += COL_WIDTHS.glassQty;
        doc.line(cX, rowY, cX, rowY + rowHeight);

        // 14. Glass Type
        const glassTypeStr = cleanAscii(item.mirror?.glassType || item.input.glassType || 'Clear 5mm');
        doc.setFontSize(7.5);
        doc.text(glassTypeStr.substring(0, 16), cX + COL_WIDTHS.glassType / 2, centerY + 1, { align: 'center' });
      } else {
        // Draw empty cell dividers for clean engineering worksheet structure
        let cX = MARGIN_LEFT;
        Object.values(COL_WIDTHS).forEach((w, idx) => {
          if (idx > 0) {
            doc.line(cX, rowY, cX, rowY + rowHeight);
          }
          cX += w;
        });
      }

      rowY += rowHeight;
    }

    // 4. FOOTER NOTE & SIGNATURE (At bottom of landscape sheet, y = 196 to 204 mm)
    doc.setDrawColor(INK_SECONDARY[0], INK_SECONDARY[1], INK_SECONDARY[2]);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_LEFT, A4_LANDSCAPE_H - 12, MARGIN_LEFT + TABLE_WIDTH, A4_LANDSCAPE_H - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(INK_SECONDARY[0], INK_SECONDARY[1], INK_SECONDARY[2]);
    const footerText = `Certified Fabrication Order | Generated by ${shopName} CAD Engine | Exact Sum Formulas & Deductions Verified`;
    doc.text(footerText, MARGIN_LEFT, A4_LANDSCAPE_H - 7);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    doc.text('Authorized Workshop Signature: ________________________________', MARGIN_LEFT + TABLE_WIDTH, A4_LANDSCAPE_H - 7, {
      align: 'right',
    });
  }

  return doc;
}

/**
 * Dedicated Glass Factory Cutting Order Sheet (A4 Portrait Vector PDF)
 * Optimized for glass vendors: square feet calculation, thickness, and packing notes.
 */
export function generateGlassFactoryOrderPDF(
  results: CalculationResult[],
  options: PDFExportOptions = {}
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const shopName = cleanAscii(options.shopName || 'LS INTERIORS');
  const customer = cleanAscii(options.customerName || 'Glass Order');
  const phone = cleanAscii(options.customerPhone || '');
  const project = cleanAscii(options.projectName || '');
  const projectSerial = cleanAscii(options.projectSerial || '');
  const dateStr = cleanAscii(options.date || new Date().toLocaleDateString('en-GB'));

  // Filter only items with glass cuts
  const glassItems = results.filter(
    (r) => r.mirror && r.mirror.count > 0 && r.mirror.heightMM > 0 && r.mirror.widthMM > 0
  );

  const columns: ColumnDef[] = [
    { header: 'S.NO', subHeader: 'Item No.', width: 14, align: 'center' },
    { header: 'WINDOW', subHeader: 'Tag / Mark', width: 22, align: 'center' },
    { header: 'HEIGHT (MM)', subHeader: 'Cut Height', width: 34, align: 'center' },
    { header: 'WIDTH (MM)', subHeader: 'Cut Width', width: 34, align: 'center' },
    { header: 'QTY (PCS)', subHeader: 'Quantity', width: 22, align: 'center' },
    { header: 'SQ.FT', subHeader: 'Total Area', width: 28, align: 'center' },
    { header: 'GLASS SPECIFICATION', subHeader: 'Type & Finish', width: 42, align: 'left' },
  ];

  const totalPages = Math.max(1, Math.ceil(Math.max(1, glassItems.length) / ROWS_PER_PAGE_PORTRAIT));

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage();

    const startIdx = page * ROWS_PER_PAGE_PORTRAIT;
    const pageRows = glassItems.slice(startIdx, startIdx + ROWS_PER_PAGE_PORTRAIT);

    // Header
    doc.setDrawColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    doc.setLineWidth(0.6);
    doc.rect(MARGIN_LEFT_PORTRAIT, 7, TABLE_WIDTH_PORTRAIT, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(16, 120, 80); // Emerald Green
    doc.text(`${shopName} - GLASS FACTORY CUTTING ORDER`, MARGIN_LEFT_PORTRAIT + 3, 13);

    // Project Serial Badge
    if (projectSerial) {
      doc.setFillColor(16, 120, 80);
      doc.roundedRect(MARGIN_LEFT_PORTRAIT + TABLE_WIDTH_PORTRAIT - 30, 8.5, 27, 6.2, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(projectSerial, MARGIN_LEFT_PORTRAIT + TABLE_WIDTH_PORTRAIT - 16.5, 12.9, { align: 'center' });
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(INK_SECONDARY[0], INK_SECONDARY[1], INK_SECONDARY[2]);
    doc.text('Vendor Glass Cut List with Square Feet Calculations', MARGIN_LEFT_PORTRAIT + 3, 17);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    const projPart = projectSerial ? `[${projectSerial}] ${project}` : project;
    doc.text(`Customer: ${customer} ${phone ? `(${phone})` : ''}${projPart ? ` | Project: ${projPart}` : ''}`, MARGIN_LEFT_PORTRAIT + 3, 22.5);
    doc.text(`Date: ${dateStr}  |  Page ${page + 1} of ${totalPages}`, MARGIN_LEFT_PORTRAIT + TABLE_WIDTH_PORTRAIT - 3, 22.5, { align: 'right' });

    // Table Header
    const tableHeaderY = 26;
    const tableHeaderH = 10;
    doc.setFillColor(INK_HEADER_BG[0], INK_HEADER_BG[1], INK_HEADER_BG[2]);
    doc.rect(MARGIN_LEFT_PORTRAIT, tableHeaderY, TABLE_WIDTH_PORTRAIT, tableHeaderH, 'FD');

    let currentX = MARGIN_LEFT_PORTRAIT;
    columns.forEach((col) => {
      doc.setLineWidth(0.4);
      doc.setDrawColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
      doc.line(currentX, tableHeaderY, currentX, tableHeaderY + tableHeaderH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);

      const textX = col.align === 'center' ? currentX + col.width / 2 : currentX + 2;
      doc.text(col.header, textX, tableHeaderY + 4.5, { align: col.align });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(INK_SECONDARY[0], INK_SECONDARY[1], INK_SECONDARY[2]);
      doc.text(col.subHeader, textX, tableHeaderY + 8.2, { align: col.align });

      currentX += col.width;
    });

    // Rows
    const rowHeight = 17.4;
    let rowY = tableHeaderY + tableHeaderH;
    let pageTotalSqft = 0;

    for (let r = 0; r < ROWS_PER_PAGE_PORTRAIT; r++) {
      const item = pageRows[r];

      if (item) {
        const hex = getModelColor(item.input.modelId, item.input.identificationColor);
        const rgb = hexToRgb(hex);
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.rect(MARGIN_LEFT_PORTRAIT, rowY, TABLE_WIDTH_PORTRAIT, rowHeight, 'F');

        const darker = darkenRgb(rgb, 0.4);
        doc.setFillColor(darker[0], darker[1], darker[2]);
        doc.rect(MARGIN_LEFT_PORTRAIT, rowY, 2.5, rowHeight, 'F');
      } else if (r % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(MARGIN_LEFT_PORTRAIT, rowY, TABLE_WIDTH_PORTRAIT, rowHeight, 'F');
      }

      doc.setDrawColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
      doc.setLineWidth(0.35);
      doc.rect(MARGIN_LEFT_PORTRAIT, rowY, TABLE_WIDTH_PORTRAIT, rowHeight);

      let colX = MARGIN_LEFT_PORTRAIT;

      columns.forEach((col, cIdx) => {
        if (cIdx > 0) {
          doc.setLineWidth(0.3);
          doc.line(colX, rowY, colX, rowY + rowHeight);
        }

        if (item && item.mirror) {
          const centerY = rowY + rowHeight / 2;
          const h = item.mirror.heightMM;
          const w = item.mirror.widthMM;
          const qty = item.mirror.count;
          const sqft = Number(((h * w * qty) / 92903.04).toFixed(2));
          pageTotalSqft += sqft;

          switch (cIdx) {
            case 0:
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(10);
              doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
              doc.text(`${startIdx + r + 1}`, colX + col.width / 2, centerY + 1, { align: 'center' });
              break;
            case 1:
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(11);
              doc.setTextColor(INK_ACCENT[0], INK_ACCENT[1], INK_ACCENT[2]);
              doc.text(item.input.windowLabel || `W${startIdx + r + 1}`, colX + col.width / 2, centerY + 1, { align: 'center' });
              break;
            case 2:
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(12);
              doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
              doc.text(`${h}`, colX + col.width / 2, centerY - 1, { align: 'center' });
              doc.setFontSize(7);
              doc.setTextColor(INK_SECONDARY[0], INK_SECONDARY[1], INK_SECONDARY[2]);
              doc.text(`${(h / 25.4).toFixed(1)}"`, colX + col.width / 2, centerY + 4.5, { align: 'center' });
              break;
            case 3:
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(12);
              doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
              doc.text(`${w}`, colX + col.width / 2, centerY - 1, { align: 'center' });
              doc.setFontSize(7);
              doc.setTextColor(INK_SECONDARY[0], INK_SECONDARY[1], INK_SECONDARY[2]);
              doc.text(`${(w / 25.4).toFixed(1)}"`, colX + col.width / 2, centerY + 4.5, { align: 'center' });
              break;
            case 4:
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(12);
              doc.setTextColor(16, 120, 80);
              doc.text(`${qty}`, colX + col.width / 2, centerY + 1, { align: 'center' });
              break;
            case 5:
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(10.5);
              doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
              doc.text(`${sqft} sq.ft`, colX + col.width / 2, centerY + 1, { align: 'center' });
              break;
            case 6:
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(8.5);
              doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
              doc.text(item.mirror.glassType || 'Clear 5mm Glass', colX + 2, centerY - 1);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7);
              doc.setTextColor(INK_SECONDARY[0], INK_SECONDARY[1], INK_SECONDARY[2]);
              doc.text('Polished Edges | 0mm Tol', colX + 2, centerY + 4);
              break;
          }
        }

        colX += col.width;
      });

      rowY += rowHeight;
    }

    // Footer
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    doc.text(`Total Estimated Area: ${pageTotalSqft.toFixed(2)} Sq.Ft`, MARGIN_LEFT_PORTRAIT, A4_PORTRAIT_H - 6);
    doc.text('Vendor Acceptance: _____________________', MARGIN_LEFT_PORTRAIT + TABLE_WIDTH_PORTRAIT, A4_PORTRAIT_H - 6, {
      align: 'right',
    });
  }

  return doc;
}
