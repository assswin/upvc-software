/**
 * Model Color Palette for LS INTERIORS.
 * Maps every window and door model to its unique pastel identification color.
 * High-contrast, pastel tones for crystal-clear workshop reading and official PDF exports.
 */

export const MODEL_DEFAULT_COLORS: Record<string, string> = {
  // 58mm Sliding Windows (Sky Blue family)
  '58-2': '#E0F2FE', // Soft Sky Blue
  '58-2.5': '#BAE6FD', // Light Sky Blue
  '58-3': '#93C5FD', // Soft Cornflower Blue
  '58-4': '#7DD3FC', // Vivid Sky Blue

  // 66mm Sliding Windows (Cyan family)
  '66-2': '#A5F3FC', // Soft Cyan
  '66-3': '#67E8F9', // Light Cyan

  // 85mm Heavy Sliding Doors (Teal family)
  '85-2': '#CCFBF1', // Soft Mint Teal
  '85-2.5': '#99F6E4', // Light Aqua Teal
  '85-3': '#5EEAD4', // Medium Teal

  // Casement Open Windows (Green family)
  'open-single': '#DCFCE7', // Soft Emerald Green
  'open-double': '#ECFCCB', // Soft Lime Green
  'open-triple': '#D1FAE5', // Soft Mint Green

  // 108mm Open Doors (Amber / Gold family)
  'door-with-bottom': '#FEF3C7', // Soft Amber Gold
  'door-without-bottom': '#FDE68A', // Warm Amber Gold
  'double-door-with-bottom': '#FED7AA', // Soft Orange Peach
  'double-door-without-bottom': '#FDBA74', // Warm Peach Gold

  // Fixed Windows (Lavender / Purple family)
  'fixed': '#F3E8FF', // Soft Lavender Purple

  // Ventilators (Rose / Coral / Peach family)
  'ventilator-normal': '#FFE4E6', // Soft Rose Pink
  'ventilator-fan-left': '#FFEDD5', // Soft Peach Orange
  'ventilator-fan-right': '#FEF9C3', // Soft Pale Yellow
  'ventilator-fan': '#FFEDD5', // Soft Peach Orange
};

/**
 * Returns the unique color for a given model or custom color.
 */
export function getModelColor(modelId?: string | null, customColor?: string | null): string {
  if (customColor && customColor.trim() && customColor !== '#ffffff' && customColor !== '#000000') {
    return customColor.trim();
  }
  if (!modelId) return '#F1F5F9';

  const normalized = modelId.trim().toLowerCase();
  if (MODEL_DEFAULT_COLORS[normalized]) {
    return MODEL_DEFAULT_COLORS[normalized];
  }

  // Fallback pattern matching
  if (normalized.includes('double-door')) return '#FED7AA';
  if (normalized.includes('door')) return '#FEF3C7';
  if (normalized.includes('fan-left')) return '#FFEDD5';
  if (normalized.includes('fan-right')) return '#FEF9C3';
  if (normalized.includes('ventilator')) return '#FFE4E6';
  if (normalized.includes('fixed')) return '#F3E8FF';
  if (normalized.includes('open-double')) return '#ECFCCB';
  if (normalized.includes('open-triple')) return '#D1FAE5';
  if (normalized.includes('open')) return '#DCFCE7';
  if (normalized.includes('85-')) return '#CCFBF1';
  if (normalized.includes('66-')) return '#A5F3FC';
  if (normalized.includes('58-')) return '#E0F2FE';

  return '#E2E8F0';
}

/**
 * Converts Hex string to [r, g, b] numbers
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return [r, g, b];
  }
  return [241, 245, 249];
}

/**
 * Returns a slightly darker RGB for borders and indicator strips
 */
export function darkenRgb(rgb: [number, number, number], factor = 0.3): [number, number, number] {
  return [
    Math.max(0, Math.round(rgb[0] * (1 - factor))),
    Math.max(0, Math.round(rgb[1] * (1 - factor))),
    Math.max(0, Math.round(rgb[2] * (1 - factor))),
  ];
}
