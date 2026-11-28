
import { jsPDF } from 'jspdf';
import type { CalculationResult } from '../types/cad';
import { WINDOW_MODELS, type WindowModelId } from './slidingCalculations';
import { getModelColor, hexToRgb, darkenRgb } from './modelColors';

export interface PDFExportOptions {
  customerName?: string;
  customerPhone?: string;
  customerSerial?: string;
  projectName?: string;
  projectSerial?: string;
  date?: string;
  shopName?: string;
  isTamil?: boolean;
}

const A4_LANDSCAPE_H = 210;
const MARGIN_LEFT = 8;
const TABLE_WIDTH = 281;
const ROWS_PER_PAGE_LANDSCAPE = 14;

const A4_PORTRAIT_H = 297;
const MARGIN_LEFT_PORTRAIT = 7;
const TABLE_WIDTH_PORTRAIT = 196;
const ROWS_PER_PAGE_PORTRAIT = 14;

interface ColumnDef {
  header: string;
  subHeader: string;
  width: number;
  align: 'left' | 'center' | 'right';
}

type WorkshopColumnKey =
  | 'sNo'
  | 'siteDim'
  | 'outerFrame'
  | 'type'
  | 'material'
  | 'sashH'
  | 'sashW'
  | 'sashHPcs'
  | 'sashWPcs'
  | 'mullionH'
  | 'mullionQty'
  | 'interlock'
  | 'glassH'
  | 'glassW'
  | 'glassQty'
  | 'glassType'
  | 'clientFill'
  | 'mesh';

interface WorkshopColumn {
  key: WorkshopColumnKey;
  width: number;
  header: string;
  subHeader?: string;
  group?: string;
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
    .split('')
    .filter((char) => char.charCodeAt(0) <= 127)
    .join('')
    .trim();
}

const INK_DEEP = [15, 23, 42];
const INK_SECONDARY = [71, 85, 105];
const INK_HEADER_BG = [241, 245, 249];
const INK_ACCENT = [29, 78, 216];
const INK_GREEN = [4, 120, 87];
const INK_SKY = [2, 132, 199];

function getModelDefinition(item: CalculationResult) {
  return (
    WINDOW_MODELS.find(
      (model) => model.id === (item.input.modelId as WindowModelId)
    ) ||
    WINDOW_MODELS.find((model) => model.name === item.ruleProfileName)
  );
}

function hasMeshOutput(item: CalculationResult): boolean {
  return Boolean(
    item.additionalPanels?.some(
      (panel) =>
        /mesh/i.test(panel.shutterType || '') &&
        panel.heightMM > 0 &&
        panel.widthMM > 0
    )
  );
}

function hasMullionOutput(item: CalculationResult): boolean {
  const mullionLength = item.mullionMM ?? item.frame.mullionCutMM;
  return mullionLength !== undefined && mullionLength > 0;
}

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
  const customer = cleanAscii(options.customerName || '');
  const phone = cleanAscii(options.customerPhone || '');
  const customerSerial = cleanAscii(options.customerSerial || '');
  const dateStr = cleanAscii(options.date || new Date().toLocaleDateString('en-GB'));

  const totalPages = Math.max(
    1,
    Math.ceil(results.length / ROWS_PER_PAGE_LANDSCAPE)
  );

  // Conditional columns are included only when at least one selected
  // window in this order requires that component.
  const showMeshColumn = results.some(hasMeshOutput);
  const showMullionColumns = results.some(hasMullionOutput);

  // The widths are scaled proportionally to keep the table exactly
  // within the available A4 landscape width.
  const baseColumns: WorkshopColumn[] = [
    { key: 'sNo', header: 'Si.No.', width: 10 },
    { key: 'siteDim', header: 'Height x Width', subHeader: 'Inches', width: 23 },
    { key: 'outerFrame', header: 'Outer Frame', subHeader: 'H x W (mm)', width: 22 },
    { key: 'type', header: 'Model Type', width: 24 },
    { key: 'material', header: 'Material', subHeader: '(mm)', width: 12 },

    { key: 'sashH', header: 'H', width: 13, group: 'Sash Cut (mm)' },
    { key: 'sashW', header: 'W', width: 13, group: 'Sash Cut (mm)' },
    { key: 'sashHPcs', header: 'H Pcs', width: 9, group: 'Sash Cut (mm)' },
    { key: 'sashWPcs', header: 'W Pcs', width: 9, group: 'Sash Cut (mm)' },

    ...(showMullionColumns
      ? [
          {
            key: 'mullionH' as const,
            header: 'H - 6',
            width: 13,
            group: 'Mullion (mm)',
          },
          {
            key: 'mullionQty' as const,
            header: 'No.Pcs',
            width: 8,
            group: 'Mullion (mm)',
          },
        ]
      : []),

    { key: 'interlock', header: 'Interlock', subHeader: '(mm)', width: 12 },

    ...(showMeshColumn
      ? [
          {
            key: 'mesh' as const,
            header: '2.5T Mesh',
            subHeader: 'H x W (mm)',
            width: 20,
          },
        ]
      : []),

    { key: 'glassH', header: 'H', width: 12, group: 'Glass Cut (mm)' },
    { key: 'glassW', header: 'W', width: 12, group: 'Glass Cut (mm)' },
    { key: 'glassQty', header: 'No.Pcs', width: 8, group: 'Glass Cut (mm)' },

    { key: 'glassType', header: 'Glass Type', width: 15 },
    { key: 'clientFill', header: 'Client Fill', width: 12 },
  ];

  const totalBaseWidth = baseColumns.reduce((sum, column) => sum + column.width, 0);
  const widthScale = TABLE_WIDTH / totalBaseWidth;

  const columns = baseColumns.map((column) => ({
    ...column,
    width: column.width * widthScale,
  }));

  const columnPositions = new Map<WorkshopColumnKey, number>();
  let runningX = MARGIN_LEFT;

  columns.forEach((column) => {
    columnPositions.set(column.key, runningX);
    runningX += column.width;
  });

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage();

    const startIdx = page * ROWS_PER_PAGE_LANDSCAPE;
    const pageRows = results.slice(
      startIdx,
      startIdx + ROWS_PER_PAGE_LANDSCAPE
    );

    // --------------------------------------------------
    // 1. WORKSHOP HEADER
    // --------------------------------------------------

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);

    doc.setFontSize(8);
    doc.text(
      doc.splitTextToSize(`Customer Name : ${customer}`, 72).slice(0, 2),
      MARGIN_LEFT,
      8
    );
    doc.text(
      doc.splitTextToSize(`Customer Phone : ${phone}`, 72).slice(0, 2),
      MARGIN_LEFT,
      17
    );
    doc.setFontSize(13);
    doc.setTextColor(INK_ACCENT[0], INK_ACCENT[1], INK_ACCENT[2]);
    doc.text(shopName, MARGIN_LEFT + TABLE_WIDTH / 2, 14, {
      align: 'center',
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);

    doc.text(
      `Customer Serial No: ${customerSerial || '—'}`,
      MARGIN_LEFT + TABLE_WIDTH,
      8,
      {
        align: 'right',
      }
    );
    doc.text(`Date : ${dateStr}`, MARGIN_LEFT + TABLE_WIDTH, 13, {
      align: 'right',
    });
    doc.text(
      `Total Windows: ${results.length}`,
      MARGIN_LEFT + TABLE_WIDTH,
      18,
      { align: 'right' }
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);

    doc.text(
      `WORKSHOP ORDER SHEET (Pg ${page + 1}/${totalPages})`,
      MARGIN_LEFT + TABLE_WIDTH / 2,
      24,
      { align: 'center' }
    );

    // --------------------------------------------------
    // 2. DYNAMIC TWO-TIER TABLE HEADER
    // --------------------------------------------------

    const headerY = 27;
    const headerTopH = 7;
    const headerBottomH = 6.5;
    const headerTotalH = headerTopH + headerBottomH;

    doc.setFillColor(
      INK_HEADER_BG[0],
      INK_HEADER_BG[1],
      INK_HEADER_BG[2]
    );

    doc.setDrawColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
    doc.setLineWidth(0.35);

    doc.rect(
      MARGIN_LEFT,
      headerY,
      TABLE_WIDTH,
      headerTotalH,
      'FD'
    );

    let columnIndex = 0;

    while (columnIndex < columns.length) {
      const column = columns[columnIndex];
      const x = columnPositions.get(column.key)!;

      if (column.group) {
        let groupWidth = 0;
        let nextIndex = columnIndex;

        while (
          nextIndex < columns.length &&
          columns[nextIndex].group === column.group
        ) {
          groupWidth += columns[nextIndex].width;
          nextIndex++;
        }

        doc.rect(x, headerY, groupWidth, headerTopH);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);

        doc.text(
          column.group,
          x + groupWidth / 2,
          headerY + 4.8,
          { align: 'center' }
        );

        for (let i = columnIndex; i < nextIndex; i++) {
          const subColumn = columns[i];
          const subX = columnPositions.get(subColumn.key)!;

          doc.rect(
            subX,
            headerY + headerTopH,
            subColumn.width,
            headerBottomH
          );

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);

          doc.text(
            subColumn.header,
            subX + subColumn.width / 2,
            headerY + headerTopH + 4.3,
            { align: 'center' }
          );
        }

        columnIndex = nextIndex;
      } else {
        doc.rect(x, headerY, column.width, headerTotalH);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);

        const headerText = column.header;
        const subHeaderText = column.subHeader || '';

        if (subHeaderText) {
          doc.text(
            headerText,
            x + column.width / 2,
            headerY + 5,
            { align: 'center' }
          );

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.8);
          doc.setTextColor(
            INK_SECONDARY[0],
            INK_SECONDARY[1],
            INK_SECONDARY[2]
          );

          doc.text(
            subHeaderText,
            x + column.width / 2,
            headerY + 10.5,
            { align: 'center' }
          );
        } else {
          const wrappedHeader = doc.splitTextToSize(
            headerText,
            column.width - 1.5
          );

          doc.text(
            wrappedHeader,
            x + column.width / 2,
            headerY + (wrappedHeader.length > 1 ? 5 : 8),
            { align: 'center' }
          );
        }

        columnIndex++;
      }
    }

    // --------------------------------------------------
    // 3. TABLE BODY
    // --------------------------------------------------

    const rowHeight = 10.5;
    let rowY = headerY + headerTotalH;

    for (let rowIndex = 0; rowIndex < ROWS_PER_PAGE_LANDSCAPE; rowIndex++) {
      const item = pageRows[rowIndex];

      if (item) {
        const hex = getModelColor(
          item.input.modelId,
          item.input.identificationColor
        );

        const rgb = hexToRgb(hex);

        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.rect(MARGIN_LEFT, rowY, TABLE_WIDTH, rowHeight, 'F');

        const darker = darkenRgb(rgb, 0.4);

        doc.setFillColor(darker[0], darker[1], darker[2]);
        doc.rect(MARGIN_LEFT, rowY, 2.5, rowHeight, 'F');
      } else if (rowIndex % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(MARGIN_LEFT, rowY, TABLE_WIDTH, rowHeight, 'F');
      }

      doc.setDrawColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);
      doc.setLineWidth(0.3);

      doc.rect(MARGIN_LEFT, rowY, TABLE_WIDTH, rowHeight);

      // Draw every dynamic column divider, including empty rows.
      columns.forEach((column) => {
        const x = columnPositions.get(column.key)!;

        if (x > MARGIN_LEFT) {
          doc.line(x, rowY, x, rowY + rowHeight);
        }
      });

      if (item) {
        const centerY = rowY + rowHeight / 2;
        const modelDef = getModelDefinition(item);

        const cellText = (
          key: WorkshopColumnKey,
          value: string,
          fontSize = 7,
          bold = false,
          color = INK_DEEP
        ) => {
          const column = columns.find((entry) => entry.key === key);
          if (!column) return;

          const x = columnPositions.get(key)!;

          doc.setFont('helvetica', bold ? 'bold' : 'normal');
          doc.setFontSize(fontSize);
          doc.setTextColor(color[0], color[1], color[2]);

          if (value) {
            const wrapped = doc.splitTextToSize(
              value,
              column.width - 1.5
            );

            const lines = wrapped.slice(0, 2);
            const lineHeight = 2.8;
            const startY =
              centerY - ((lines.length - 1) * lineHeight) / 2 + 1;

            doc.text(lines, x + column.width / 2, startY, {
              align: 'center',
              lineHeightFactor: 1,
            });
          }
        };

        const label =
          item.input.windowLabel || `W${startIdx + rowIndex + 1}`;

        const heightInches = (
          item.input.heightInch ||
          item.convertedHeightMM / 25.4
        ).toFixed(2);

        const widthInches = (
          item.input.widthInch ||
          item.convertedWidthMM / 25.4
        ).toFixed(2);

        const modelType = cleanAscii(modelDef?.shortCode || item.input.modelId || '');
        const material = cleanAscii(
          modelDef?.material || `${item.frame.profileDepthMM} mm`
        );

        cellText('sNo', label, 7.5, true, INK_ACCENT);

        cellText(
          'siteDim',
          `${heightInches}" x ${widthInches}"`,
          6.5
        );

        cellText(
          'outerFrame',
          `${item.convertedHeightMM} x ${item.convertedWidthMM}`,
          6.5,
          true
        );

        cellText('type', modelType, 6.5, true);
        cellText('material', material, 6.5);

        // Sash cut measurements and piece counts.
        const sashHeight =
          item.panel.heightMM > 0 ? String(item.panel.heightMM) : '';

        const sashWidth =
          item.panel.widthMM > 0 ? String(item.panel.widthMM) : '';

        const sashHeightPieces =
          item.panel.heightMM > 0
            ? String(
                item.panel.verticalPieces ||
                  (item.panel.count ? item.panel.count * 2 : 2)
              )
            : '';

        const sashWidthPieces =
          item.panel.widthMM > 0
            ? String(
                item.panel.horizontalPieces ||
                  (item.panel.count ? item.panel.count * 2 : 2)
              )
            : '';

        cellText('sashH', sashHeight, 7.5, true, INK_GREEN);
        cellText('sashW', sashWidth, 7.5, true, INK_GREEN);
        cellText('sashHPcs', sashHeightPieces, 7);
        cellText('sashWPcs', sashWidthPieces, 7);

        // Mullion: only Open Double and Open Triple use this column.
        if (showMullionColumns && hasMullionOutput(item)) {
          const mullionLength =
            item.mullionMM ?? item.frame.mullionCutMM ?? null;

          const mullionPieces = item.mullionPieces ??
            (item.input.modelId === 'open-triple' ? 2 : 1);

          cellText(
            'mullionH',
            mullionLength && mullionLength > 0
              ? String(mullionLength)
              : '',
            7.5,
            true,
            INK_GREEN
          );

          cellText(
            'mullionQty',
            mullionLength && mullionLength > 0
              ? String(mullionPieces)
              : '',
            7
          );
        }

        // Interlock.
        cellText(
          'interlock',
          item.interlockMM ? String(item.interlockMM) : '',
          7
        );

        // Glass cut.
        const hasGlass =
          Boolean(item.mirror) &&
          item.mirror.count > 0 &&
          item.mirror.heightMM > 0 &&
          item.mirror.widthMM > 0;

        cellText(
          'glassH',
          hasGlass ? String(item.mirror.heightMM) : '',
          7.5,
          true,
          INK_SKY
        );

        cellText(
          'glassW',
          hasGlass ? String(item.mirror.widthMM) : '',
          7.5,
          true,
          INK_SKY
        );

        cellText(
          'glassQty',
          hasGlass ? String(item.mirror.count) : '',
          7
        );

        // Client Fill is deliberately left empty for the user/workshop.
        // No automatic status or default text is inserted.

        if (showMeshColumn && hasMeshOutput(item)) {
          const meshPanel = item.additionalPanels?.find(
            (panel) =>
              /mesh/i.test(panel.shutterType || '') &&
              panel.heightMM > 0 &&
              panel.widthMM > 0
          );

          if (meshPanel) {
            cellText(
              'mesh',
              `${meshPanel.heightMM} x ${meshPanel.widthMM}`,
              6.5,
              true,
              INK_GREEN
            );
          }
        }
      }

      rowY += rowHeight;
    }

    // --------------------------------------------------
    // 4. FOOTER AND SIGNATURE
    // --------------------------------------------------

    doc.setDrawColor(
      INK_SECONDARY[0],
      INK_SECONDARY[1],
      INK_SECONDARY[2]
    );

    doc.setLineWidth(0.3);

    doc.line(
      MARGIN_LEFT,
      A4_LANDSCAPE_H - 12,
      MARGIN_LEFT + TABLE_WIDTH,
      A4_LANDSCAPE_H - 12
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(
      INK_SECONDARY[0],
      INK_SECONDARY[1],
      INK_SECONDARY[2]
    );

    doc.text(
      `${shopName} WORKSHOP ORDER SHEET`,
      MARGIN_LEFT,
      A4_LANDSCAPE_H - 7
    );

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(
      INK_DEEP[0],
      INK_DEEP[1],
      INK_DEEP[2]
    );

    doc.text(
      'Workshop Supervisor / QC Signature: ____________________________________',
      MARGIN_LEFT + TABLE_WIDTH,
      A4_LANDSCAPE_H - 7,
      { align: 'right' }
    );
  }

  return doc;
}

/**
 * Dedicated Glass Factory Cutting Order Sheet (A4 Portrait Vector PDF).
 * Existing glass-vendor calculations and layout are retained.
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
    doc.rect(MARGIN_LEFT_PORTRAIT, 7, TABLE_WIDTH_PORTRAIT, 23);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(16, 120, 80);
    doc.text(`${shopName} - GLASS FACTORY CUTTING ORDER`, MARGIN_LEFT_PORTRAIT + 3, 13);

    if (projectSerial) {
      doc.setFillColor(16, 120, 80);
      doc.roundedRect(
        MARGIN_LEFT_PORTRAIT + TABLE_WIDTH_PORTRAIT - 30,
        8.5,
        27,
        6.2,
        1,
        1,
        'F'
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(
        projectSerial,
        MARGIN_LEFT_PORTRAIT + TABLE_WIDTH_PORTRAIT - 16.5,
        12.9,
        { align: 'center' }
      );
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(INK_SECONDARY[0], INK_SECONDARY[1], INK_SECONDARY[2]);
    doc.text(
      'Vendor Glass Cut List with Square Feet Calculations',
      MARGIN_LEFT_PORTRAIT + 3,
      17
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(INK_DEEP[0], INK_DEEP[1], INK_DEEP[2]);

    const projPart = projectSerial ? `[${projectSerial}] ${project}` : project;

    doc.text(
      `Customer: ${customer}${projPart ? ` | Project: ${projPart}` : ''}`,
      MARGIN_LEFT_PORTRAIT + 3,
      22.5
    );

    if (phone) {
      doc.text(`Phone: ${phone}`, MARGIN_LEFT_PORTRAIT + 3, 26.5);
    }

    doc.text(
      `Date: ${dateStr}  |  Page ${page + 1} of ${totalPages}`,
      MARGIN_LEFT_PORTRAIT + TABLE_WIDTH_PORTRAIT - 3,
      26.5,
      { align: 'right' }
    );

    // Table header
    const tableHeaderY = 31.5;
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
              doc.text(
                item.input.windowLabel || `W${startIdx + r + 1}`,
                colX + col.width / 2,
                centerY + 1,
                { align: 'center' }
              );
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

    doc.text(
      `Total Estimated Area: ${pageTotalSqft.toFixed(2)} Sq.Ft`,
      MARGIN_LEFT_PORTRAIT,
      A4_PORTRAIT_H - 6
    );

    doc.text(
      'Vendor Acceptance: _____________________',
      MARGIN_LEFT_PORTRAIT + TABLE_WIDTH_PORTRAIT,
      A4_PORTRAIT_H - 6,
      { align: 'right' }
    );
  }

  return doc;
}
