// LS Interiors Comprehensive Window & Door Calculation Engine
// Based on Tamil Nadu Workshop Audited Standards (Method of Sum)
// Fully logical cutting & deduction system with profile-specific glass references

export type WindowModelId =
  // 58mm Sliding Series
  | "58-2"
  | "58-2.5"
  | "58-3"
  | "58-4"
  // 66mm Sliding Series
  | "66-2"
  | "66-3"
  // 85mm Heavy Sliding Door Series
  | "85-2"
  | "85-2.5"
  | "85-3"
  // Casement / Open Window Series (60mm / No Track)
  | "open-single"
  | "open-double"
  | "open-triple"
  // 108mm Heavy Open Door Series
  | "door-with-bottom"
  | "door-without-bottom"
  | "double-door-with-bottom"
  | "double-door-without-bottom"
  // Fixed & Ventilator Series
  | "fixed"
  | "ventilator-normal"
  | "ventilator-fan"
  | "ventilator-fan-left"
  | "ventilator-fan-right";

export type SlidingModelId = WindowModelId; // Backward-compatible alias

export type MeasurementUnit = "inches" | "cm" | "mm";

export type WindowCategory = "sliding" | "open" | "door" | "fixed" | "ventilator";

export type GlassReferenceType = "shutter" | "frame" | "none";

export interface WindowModelDefinition {
  id: WindowModelId;
  name: string;
  category: WindowCategory;
  material: string;
  shortCode: string;
  glassReference: GlassReferenceType;
  defaultGlassDeductionMM: number;
}

export const WINDOW_MODELS: WindowModelDefinition[] = [
  // 58mm Sliding Windows (Glass = Shutter - 94mm / -95mm)
  {
    id: "58-2",
    name: "2 Track Sliding Window – 58 mm",
    category: "sliding",
    material: "58 mm",
    shortCode: "SL/SL",
    glassReference: "shutter",
    defaultGlassDeductionMM: 94,
  },
  {
    id: "58-2.5",
    name: "2.5 Track Sliding Window with Mesh – 58 mm",
    category: "sliding",
    material: "58 mm",
    shortCode: "SL/SL/MESH",
    glassReference: "shutter",
    defaultGlassDeductionMM: 94,
  },
  {
    id: "58-3",
    name: "3 Track Sliding Window – 58 mm",
    category: "sliding",
    material: "58 mm",
    shortCode: "SL/SL/SL",
    glassReference: "shutter",
    defaultGlassDeductionMM: 94,
  },
  {
    id: "58-4",
    name: "4 Track Sliding Window – 58 mm",
    category: "sliding",
    material: "58 mm",
    shortCode: "SL/SL/SL/SL",
    glassReference: "shutter",
    defaultGlassDeductionMM: 95,
  },
  // 66mm Sliding Windows (Glass = Shutter - 112mm)
  {
    id: "66-2",
    name: "2 Track Sliding Window – 66 mm",
    category: "sliding",
    material: "66 mm",
    shortCode: "SL/SL",
    glassReference: "shutter",
    defaultGlassDeductionMM: 112,
  },
  {
    id: "66-3",
    name: "3 Track Sliding Window – 66 mm",
    category: "sliding",
    material: "66 mm",
    shortCode: "SL/SL/SL",
    glassReference: "shutter",
    defaultGlassDeductionMM: 112,
  },
  // 85mm Heavy Sliding Doors (Glass = Shutter - 152mm)
  {
    id: "85-2",
    name: "2 Track Sliding Door – 85 mm",
    category: "sliding",
    material: "85 mm",
    shortCode: "SL/SL [DOOR]",
    glassReference: "shutter",
    defaultGlassDeductionMM: 152,
  },
  {
    id: "85-2.5",
    name: "2.5 Track Sliding Door with Mesh – 85 mm",
    category: "sliding",
    material: "85 mm",
    shortCode: "SL/SL/MESH [DOOR]",
    glassReference: "shutter",
    defaultGlassDeductionMM: 152,
  },
  {
    id: "85-3",
    name: "3 Track Sliding Door – 85 mm",
    category: "sliding",
    material: "85 mm",
    shortCode: "SL/SL/SL [DOOR]",
    glassReference: "shutter",
    defaultGlassDeductionMM: 152,
  },
  // 60mm Casement / Open Windows (Glass = Shutter - 124mm / -126mm / -125mm)
  {
    id: "open-single",
    name: "Single Open Casement Window",
    category: "open",
    material: "60 mm",
    shortCode: "OPEN/1",
    glassReference: "shutter",
    defaultGlassDeductionMM: 124,
  },
  {
    id: "open-double",
    name: "Double Open Window (with Central Mullion)",
    category: "open",
    material: "60 mm",
    shortCode: "OPEN/2",
    glassReference: "shutter",
    defaultGlassDeductionMM: 126,
  },
  {
    id: "open-triple",
    name: "3-Open Window (with 2 Central Mullions)",
    category: "open",
    material: "60 mm",
    shortCode: "OPEN/3",
    glassReference: "shutter",
    defaultGlassDeductionMM: 125,
  },
  // 108mm Heavy Open Doors (No Glass Cut - Solid / PVC Panel Door)
  {
    id: "door-with-bottom",
    name: "Single Open Door with Bottom – 108 mm",
    category: "door",
    material: "108 mm",
    shortCode: "OP/DOOR [WITH BOTTOM]",
    glassReference: "none",
    defaultGlassDeductionMM: 0,
  },
  {
    id: "door-without-bottom",
    name: "Single Open Door without Bottom – 108 mm",
    category: "door",
    material: "108 mm",
    shortCode: "OP/DOOR [WITHOUT BOTTOM]",
    glassReference: "none",
    defaultGlassDeductionMM: 0,
  },
  {
    id: "double-door-with-bottom",
    name: "Double Open Door with Bottom – 108 mm",
    category: "door",
    material: "108 mm",
    shortCode: "[OP/OP/DOOR WITH BOTTOM]",
    glassReference: "none",
    defaultGlassDeductionMM: 0,
  },
  {
    id: "double-door-without-bottom",
    name: "Double Open Door without Bottom – 108 mm",
    category: "door",
    material: "108 mm",
    shortCode: "[OP/OP/DOOR WITHOUT BOTTOM]",
    glassReference: "none",
    defaultGlassDeductionMM: 0,
  },
  // Fixed Window (Direct Outer Frame Glazing: Glass = Outer Frame - 96mm)
  {
    id: "fixed",
    name: "Fixed Window (Direct Glazing)",
    category: "fixed",
    material: "50 mm",
    shortCode: "FIXED",
    glassReference: "frame",
    defaultGlassDeductionMM: 96,
  },
  // Ventilators (Outer Frame Only - No Glass Cut, Direct Inch to MM)
  {
    id: "ventilator-normal",
    name: "Ventilator (Standard Louver)",
    category: "ventilator",
    material: "50 mm",
    shortCode: "VENT",
    glassReference: "none",
    defaultGlassDeductionMM: 0,
  },
  {
    id: "ventilator-fan-left",
    name: "Ventilator with Fan (Left)",
    category: "ventilator",
    material: "50 mm",
    shortCode: "VENT/FAN [LEFT]",
    glassReference: "none",
    defaultGlassDeductionMM: 0,
  },
  {
    id: "ventilator-fan-right",
    name: "Ventilator with Fan (Right)",
    category: "ventilator",
    material: "50 mm",
    shortCode: "VENT/FAN [RIGHT]",
    glassReference: "none",
    defaultGlassDeductionMM: 0,
  },
  {
    id: "ventilator-fan",
    name: "Ventilator with Fan (Left)",
    category: "ventilator",
    material: "50 mm",
    shortCode: "VENT/FAN [LEFT]",
    glassReference: "none",
    defaultGlassDeductionMM: 0,
  },
];

export interface CustomDeductionOverrides {
  heightDeductionMM?: number;
  widthDeductionMM?: number;
  widthAdditionMM?: number;
  glassDeductionMM?: number;
  mirrorDeductionMM?: number; // Backward-compatible alias
  mullionDeductionMM?: number;
  meshDeductionMM?: number;
}

export interface SlidingCalculationInput {
  modelId: WindowModelId;
  height: number;
  width: number;
  unit: MeasurementUnit;
  toleranceMm?: number;
  applyTolerance?: boolean;
  heightAdditionalMm?: number;
  widthAdditionalMm?: number;
  customOverrides?: CustomDeductionOverrides;
}

export interface SlidingCalculationResult {
  originalHeightMm: number;
  originalWidthMm: number;
  outerFrameHeight: number;
  outerFrameWidth: number;
  sashHeight: number | null;
  sashWidth: number | null;
  sashHeightPieces: number;
  sashWidthPieces: number;
  interlock: number | null;
  mullion: number | null;
  mullionPieces: number | null;
  glassHeight: number | null;
  glassWidth: number | null;
  glassPieces: number;
  meshHeight: number | null;
  meshWidth: number | null;
  materialMM: string;
  category: WindowCategory;
  shortCode: string;
}

/**
 * Converts inches, cm, or mm to millimeters according to the
 * workshop eighths rule (+3.5 mm for odd eighths 1/8, 3/8, 5/8, 7/8).
 */
export function convertToMm(value: number, unit: MeasurementUnit): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  switch (unit) {
    case "inches": {
      const whole = Math.floor(value);
      const frac = Math.round((value - whole) * 1000) / 1000;

      // Odd eighths: add 3.5mm extra margin
      if (Math.abs(frac - 0.125) < 0.001) {
        return Math.round(whole * 25.4 + 3.5);
      }
      if (Math.abs(frac - 0.375) < 0.001) {
        return Math.round((whole + 0.25) * 25.4 + 3.5);
      }
      if (Math.abs(frac - 0.625) < 0.001) {
        return Math.round((whole + 0.5) * 25.4 + 3.5);
      }
      if (Math.abs(frac - 0.7875) < 0.001 || Math.abs(frac - 0.875) < 0.001) {
        return Math.round((whole + 0.75) * 25.4 + 3.5);
      }

      // Standard fraction decimals (1/4, 1/2, 3/4) and whole inches
      return Math.round(value * 25.4);
    }
    case "cm":
      return Math.round(value * 10);
    case "mm":
      return Math.round(value);
  }
}

/**
 * Primary calculation engine implementing audited Tamil Nadu workshop formulas.
 * Supports customized deductions and dedicated glass calculation categories.
 */
export function calculateSlidingWindow(
  input: SlidingCalculationInput
): SlidingCalculationResult {
  const {
    modelId,
    height,
    width,
    unit,
    toleranceMm = 5,
    applyTolerance = true,
    heightAdditionalMm = 0,
    widthAdditionalMm = 0,
    customOverrides = {},
  } = input;

  const originalHeightMm = convertToMm(height, unit);
  const originalWidthMm = convertToMm(width, unit);

  // Normalize modelId to safely handle empty inputs, legacy database values, and aliases
  const rawModelId = typeof modelId === 'string' ? modelId.trim() : '';
  let normalizedModelId = rawModelId;
  if (normalizedModelId === 'ventilator-fan') {
    normalizedModelId = 'ventilator-fan-left';
  } else if (
    normalizedModelId === 'open-door' ||
    normalizedModelId === 'door' ||
    normalizedModelId === 'open-door-with-bottom'
  ) {
    normalizedModelId = 'door-with-bottom';
  } else if (normalizedModelId === 'open-door-without-bottom') {
    normalizedModelId = 'door-without-bottom';
  }

  const modelDef =
    WINDOW_MODELS.find((m) => m.id === normalizedModelId) || WINDOW_MODELS[0];
  const effectiveModelId = (WINDOW_MODELS.some((m) => m.id === normalizedModelId)
    ? normalizedModelId
    : modelDef.id) as WindowModelId;

  const isVentilator =
    modelDef.category === "ventilator" ||
    effectiveModelId === "ventilator-normal" ||
    effectiveModelId === "ventilator-fan" ||
    effectiveModelId === "ventilator-fan-left" ||
    effectiveModelId === "ventilator-fan-right";

  // Added MM (tolerance / workshop offset): ALWAYS positive added value (+ toleranceMm), 0 for ventilators (per workshop standard)
  const allowance = isVentilator ? 0 : (applyTolerance ? Math.abs(toleranceMm) : 0);

  // If convertToMm already incorporated odd eighths (+3.5 mm), avoid double-adding
  const fracH = Math.round((height - Math.floor(height)) * 1000) / 1000;
  const isOddEighthH =
    unit === "inches" &&
    [0.125, 0.375, 0.625, 0.875].some((f) => Math.abs(fracH - f) < 0.001);
  const extraH = isOddEighthH ? 0 : heightAdditionalMm;

  const fracW = Math.round((width - Math.floor(width)) * 1000) / 1000;
  const isOddEighthW =
    unit === "inches" &&
    [0.125, 0.375, 0.625, 0.875].some((f) => Math.abs(fracW - f) < 0.001);
  const extraW = isOddEighthW ? 0 : widthAdditionalMm;

  const H = Math.round(originalHeightMm + allowance + extraH);
  const W = Math.round(originalWidthMm + allowance + extraW);

  // Helper to resolve glass deduction override
  const getGlassDeduction = (defaultVal: number) => {
    if (customOverrides.glassDeductionMM !== undefined) {
      return customOverrides.glassDeductionMM;
    }
    if (customOverrides.mirrorDeductionMM !== undefined) {
      return customOverrides.mirrorDeductionMM;
    }
    return defaultVal;
  };

  let res: Omit<
    SlidingCalculationResult,
    | "originalHeightMm"
    | "originalWidthMm"
    | "outerFrameHeight"
    | "outerFrameWidth"
    | "materialMM"
    | "category"
    | "shortCode"
  >;

  switch (effectiveModelId) {
    // ----------------------------------------------------
    // 58mm Sliding Series
    // ----------------------------------------------------
    case "58-2": {
      const hDed = customOverrides.heightDeductionMM ?? 94;
      const wDed = customOverrides.widthDeductionMM ?? 11;
      const gDed = getGlassDeduction(94);
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, Math.round(W / 2) - wDed);
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 4,
        sashWidthPieces: 4,
        interlock: Math.max(0, sH - 5),
        mullion: null,
        mullionPieces: null,
        glassHeight: Math.max(10, sH - gDed),
        glassWidth: Math.max(10, sW - gDed),
        glassPieces: 2,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    case "58-2.5": {
      const hDed = customOverrides.heightDeductionMM ?? 82;
      const wDed = customOverrides.widthDeductionMM ?? 10;
      const gDed = getGlassDeduction(94);
      const mHDed = customOverrides.meshDeductionMM ?? 10;
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, Math.round((W - wDed) / 2));
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 4,
        sashWidthPieces: 4,
        interlock: Math.max(0, sH - 5),
        mullion: null,
        mullionPieces: null,
        glassHeight: Math.max(10, sH - gDed),
        glassWidth: Math.max(10, sW - gDed),
        glassPieces: 2,
        meshHeight: Math.max(10, H - mHDed),
        meshWidth: sW,
      };
      break;
    }

    case "58-3": {
      const hDed = customOverrides.heightDeductionMM ?? 91;
      const wAdd =
        customOverrides.widthAdditionMM ??
        (customOverrides.widthDeductionMM !== undefined
          ? -customOverrides.widthDeductionMM
          : 11);
      const gDed = getGlassDeduction(94);
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, Math.round(W / 3) + wAdd);
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 6,
        sashWidthPieces: 6,
        interlock: Math.max(0, sH - 5),
        mullion: null,
        mullionPieces: null,
        glassHeight: Math.max(10, sH - gDed),
        glassWidth: Math.max(10, sW - gDed),
        glassPieces: 3,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    case "58-4": {
      const hDed = customOverrides.heightDeductionMM ?? 92;
      const wAdd =
        customOverrides.widthAdditionMM ??
        (customOverrides.widthDeductionMM !== undefined
          ? -customOverrides.widthDeductionMM
          : 11);
      const gDed = getGlassDeduction(95);
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, Math.round(W / 4) + wAdd);
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 8,
        sashWidthPieces: 8,
        interlock: Math.max(0, sH - 5),
        mullion: null,
        mullionPieces: null,
        glassHeight: Math.max(10, sH - gDed),
        glassWidth: Math.max(10, sW - gDed),
        glassPieces: 4,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    // ----------------------------------------------------
    // 66mm Sliding Series
    // ----------------------------------------------------
    case "66-2": {
      const hDed = customOverrides.heightDeductionMM ?? 94;
      const wDed = customOverrides.widthDeductionMM ?? 22;
      const gDed = getGlassDeduction(112);
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, Math.round((W - wDed) / 2));
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 4,
        sashWidthPieces: 4,
        interlock: Math.max(0, sH - 5),
        mullion: null,
        mullionPieces: null,
        glassHeight: Math.max(10, sH - gDed),
        glassWidth: Math.max(10, sW - gDed),
        glassPieces: 2,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    case "66-3": {
      const hDed = customOverrides.heightDeductionMM ?? 88;
      const wAdd =
        customOverrides.widthAdditionMM ??
        (customOverrides.widthDeductionMM !== undefined
          ? -customOverrides.widthDeductionMM
          : 48);
      const gDed = getGlassDeduction(112);
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, Math.round((W + wAdd) / 3));
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 6,
        sashWidthPieces: 6,
        interlock: Math.max(0, sH - 5),
        mullion: null,
        mullionPieces: null,
        glassHeight: Math.max(10, sH - gDed),
        glassWidth: Math.max(10, sW - gDed),
        glassPieces: 3,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    // ----------------------------------------------------
    // 85mm Heavy Sliding Door Series
    // ----------------------------------------------------
    case "85-2": {
      const hDed = customOverrides.heightDeductionMM ?? 94;
      const wDed = customOverrides.widthDeductionMM ?? 2;
      const gDed = getGlassDeduction(152);
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, Math.round((W - wDed) / 2));
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 4,
        sashWidthPieces: 4,
        interlock: Math.max(0, sH - 5),
        mullion: null,
        mullionPieces: null,
        glassHeight: Math.max(10, sH - gDed),
        glassWidth: Math.max(10, sW - gDed),
        glassPieces: 2,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    case "85-2.5": {
      const hDed = customOverrides.heightDeductionMM ?? 82;
      const wAdd =
        customOverrides.widthAdditionMM ??
        (customOverrides.widthDeductionMM !== undefined
          ? -customOverrides.widthDeductionMM
          : 12);
      const gDed = getGlassDeduction(152);
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, Math.round((W + wAdd) / 2));
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 4,
        sashWidthPieces: 4,
        interlock: Math.max(0, sH - 5),
        mullion: null,
        mullionPieces: null,
        glassHeight: Math.max(10, sH - gDed),
        glassWidth: Math.max(10, sW - gDed),
        glassPieces: 2,
        meshHeight: sH, // In 85mm door, mesh has exact same H & W as sash
        meshWidth: sW,
      };
      break;
    }

    case "85-3": {
      const hDed = customOverrides.heightDeductionMM ?? 88;
      const wAdd =
        customOverrides.widthAdditionMM ??
        (customOverrides.widthDeductionMM !== undefined
          ? -customOverrides.widthDeductionMM
          : 90);
      const gDed = getGlassDeduction(152);
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, Math.round((W + wAdd) / 3));
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 6,
        sashWidthPieces: 6,
        interlock: Math.max(0, sH - 5),
        mullion: null,
        mullionPieces: null,
        glassHeight: Math.max(10, sH - gDed),
        glassWidth: Math.max(10, sW - gDed),
        glassPieces: 3,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    // ----------------------------------------------------
    // 60mm Casement / Open Windows
    // ----------------------------------------------------
    case "open-single": {
      const hDed = customOverrides.heightDeductionMM ?? 64;
      const wDed = customOverrides.widthDeductionMM ?? 64;
      const gDed = getGlassDeduction(124);
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, W - wDed);
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 2,
        sashWidthPieces: 2,
        interlock: null,
        mullion: null,
        mullionPieces: null,
        glassHeight: Math.max(10, sH - gDed),
        glassWidth: Math.max(10, sW - gDed),
        glassPieces: 1,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    case "open-double": {
      const hDed = customOverrides.heightDeductionMM ?? 64;
      const wDed = customOverrides.widthDeductionMM ?? 37;
      const mDed = customOverrides.mullionDeductionMM ?? 6;
      const gDed = getGlassDeduction(126);
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, Math.round(W / 2) - wDed);
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 4,
        sashWidthPieces: 4,
        interlock: null,
        mullion: Math.max(10, H - mDed), // Mullion is cut from Outer Frame H - 6mm
        mullionPieces: 1,
        glassHeight: Math.max(10, sH - gDed),
        glassWidth: Math.max(10, sW - gDed),
        glassPieces: 2,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    case "open-triple": {
      const hDed = customOverrides.heightDeductionMM ?? 64;
      const wDed = customOverrides.widthDeductionMM ?? 40;
      const mDed = customOverrides.mullionDeductionMM ?? 6;
      const gDed = getGlassDeduction(125);
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, Math.round(W / 3) - wDed);
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 6,
        sashWidthPieces: 6,
        interlock: null,
        mullion: Math.max(10, H - mDed), // 2 Mullions cut from Outer Frame H - 6mm
        mullionPieces: 2,
        glassHeight: Math.max(10, sH - gDed),
        glassWidth: Math.max(10, sW - gDed),
        glassPieces: 3,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    // ----------------------------------------------------
    // 108mm Open Doors (Solid / Panel Door - No Glass Cut)
    // ----------------------------------------------------
    case "door-with-bottom": {
      const hDed = customOverrides.heightDeductionMM ?? 63;
      const wDed = customOverrides.widthDeductionMM ?? 63;
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, W - wDed);
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 2,
        sashWidthPieces: 2,
        interlock: null,
        mullion: null,
        mullionPieces: null,
        glassHeight: null,
        glassWidth: null,
        glassPieces: 0,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    case "door-without-bottom": {
      const hDed = customOverrides.heightDeductionMM ?? 38;
      const wDed = customOverrides.widthDeductionMM ?? 63;
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, W - wDed);
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 2,
        sashWidthPieces: 2,
        interlock: null,
        mullion: null,
        mullionPieces: null,
        glassHeight: null,
        glassWidth: null,
        glassPieces: 0,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    case "double-door-with-bottom": {
      const hDed = customOverrides.heightDeductionMM ?? 63;
      const wDed = customOverrides.widthDeductionMM ?? 35;
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, Math.round(W / 2) - wDed);
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 4,
        sashWidthPieces: 4,
        interlock: null,
        mullion: null,
        mullionPieces: null,
        glassHeight: null,
        glassWidth: null,
        glassPieces: 0,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    case "double-door-without-bottom": {
      const hDed = customOverrides.heightDeductionMM ?? 38;
      const wDed = customOverrides.widthDeductionMM ?? 35;
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, Math.round(W / 2) - wDed);
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 4,
        sashWidthPieces: 4,
        interlock: null,
        mullion: null,
        mullionPieces: null,
        glassHeight: null,
        glassWidth: null,
        glassPieces: 0,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    // ----------------------------------------------------
    // Fixed Window (Direct Outer Frame Glazing)
    // ----------------------------------------------------
    case "fixed": {
      const gDed = getGlassDeduction(96);
      res = {
        sashHeight: null,
        sashWidth: null,
        sashHeightPieces: 0,
        sashWidthPieces: 0,
        interlock: null,
        mullion: null,
        mullionPieces: null,
        glassHeight: Math.max(10, H - gDed),
        glassWidth: Math.max(10, W - gDed),
        glassPieces: 1,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    // ----------------------------------------------------
    // Ventilators (Outer Frame Only - No Glass Cut)
    // ----------------------------------------------------
    case "ventilator-normal":
    case "ventilator-fan":
    case "ventilator-fan-left":
    case "ventilator-fan-right": {
      res = {
        sashHeight: null,
        sashWidth: null,
        sashHeightPieces: 0,
        sashWidthPieces: 0,
        interlock: null,
        mullion: null,
        mullionPieces: null,
        glassHeight: null,
        glassWidth: null,
        glassPieces: 0,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }

    default: {
      // Robust workshop fallback: default to standard 2-track sliding window deductions
      const hDed = customOverrides.heightDeductionMM ?? 94;
      const wDed = customOverrides.widthDeductionMM ?? 11;
      const gDed = getGlassDeduction(94);
      const sH = Math.max(10, H - hDed);
      const sW = Math.max(10, Math.round(W / 2) - wDed);
      res = {
        sashHeight: sH,
        sashWidth: sW,
        sashHeightPieces: 4,
        sashWidthPieces: 4,
        interlock: Math.max(10, sH - 10),
        mullion: null,
        mullionPieces: null,
        glassHeight: Math.max(10, sH - gDed),
        glassWidth: Math.max(10, sW - gDed),
        glassPieces: 2,
        meshHeight: null,
        meshWidth: null,
      };
      break;
    }
  }

  return {
    originalHeightMm,
    originalWidthMm,
    outerFrameHeight: H,
    outerFrameWidth: W,
    materialMM: modelDef.material,
    category: modelDef.category,
    shortCode: modelDef.shortCode,
    ...res,
  };
}
