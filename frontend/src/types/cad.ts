// Core CAD and Export Types for LS Interiors Blueprint & PDF Engine

export type FrameType = '2-track' | '2.5-track' | '3.5-track' | '3-track' | '4-track' | 'no-track';
export type WindowType = 'sliding' | 'open' | 'fixed' | 'ventilator';
export type UnitType = 'inch' | 'cm' | 'mm';
export type UPVCSeries = '58mm' | '60mm' | '65mm' | '66mm' | '80mm' | '85mm' | '88mm' | '108mm';
export type GlassType = '5mm_single' | '6mm_toughened' | 'double_glazed';

export type CasementSubtype = 'single' | 'double' | 'triple' | 'door_with_bottom' | 'door_without_bottom';
export type OpenDoorCategory = 'with_bottom' | 'without_bottom';
export type VentilatorSubtype = 'normal' | 'fan';
export type VentilatorFanSide = 'left' | 'right';

export interface WindowInput {
  widthInch: number;
  heightInch: number;
  widthCm?: number;
  heightCm?: number;
  widthMM?: number;
  heightMM?: number;
  mirrorInch?: number | null;
  frameType: FrameType;
  windowType: WindowType;
  casementSubtype?: CasementSubtype;
  openDoorCategory?: OpenDoorCategory;
  ventilatorSubtype?: VentilatorSubtype;
  ventilatorFanSide?: VentilatorFanSide;
  unit: UnitType;
  conversionFactor?: number;
  customOffsetMM?: number;
  weldingAllowanceMM?: number;
  profileSeries?: UPVCSeries;
  reinforcementSteel?: boolean;
  glassType?: GlassType;
  windowNumber?: number;
  windowLabel?: string;
  variantLetter?: string;
  quantity?: number;
  modelId?: string;
  identificationColor?: string;
}

export interface CalculationStep {
  label: string;
  formula: string;
  calculation: string;
  result: string;
  note?: string;
}

export interface ReinforcementSteelCut {
  component: string;
  count: number;
  lengthMM: number;
  cutAngle: '90_degree';
  specification: string;
}

export interface GlassBeadOutput {
  verticalCutMM: number;
  horizontalCutMM: number;
  cutAngle: '45_degree';
  totalPcs: number;
}

export interface FrameOutput {
  widthMM: number;
  heightMM: number;
  topBottomCutMM: number;
  leftRightCutMM: number;
  cutAngle: '45_degree' | '90_degree';
  weldingAllowanceMM: number;
  profileDepthMM: number;
  trackCount: number;
  mullionCutMM?: number;
  steelCutTopBottomMM: number;
  steelCutLeftRightMM: number;
}

export interface PanelOutput {
  count: number;
  widthMM: number;
  heightMM: number;
  shutterType: string;
  cutAngle: '45_degree' | '90_degree';
  weldingAllowanceMM: number;
  interlockOverlapMM: number;
  verticalStyleCutMM: number;
  topBottomRailCutMM: number;
  steelCutVerticalMM: number;
  steelCutHorizontalMM: number;
  interlockMM?: number;
  verticalPieces?: number;
  horizontalPieces?: number;
}

export interface MirrorOutput {
  count: number;
  widthMM: number;
  heightMM: number;
  sqFeet: number;
  sqMeters: number;
  glassType?: string;
  beading?: GlassBeadOutput;
  note?: string;
}

export interface CalculationResult {
  id: string;
  timestamp: string;
  input: WindowInput;
  convertedWidthMM: number;
  convertedHeightMM: number;
  convertedMirrorMM?: number | null;
  ruleVersion: string;
  ruleProfileName: string;
  frame: FrameOutput;
  panel: PanelOutput;
  mirror: MirrorOutput;
  interlockMM?: number;
  mullionMM?: number;
  reinforcementSteel?: ReinforcementSteelCut[];
  reinforcements?: ReinforcementSteelCut[];
  glassBeads?: GlassBeadOutput;
  additionalPanels?: PanelOutput[];
  steps?: CalculationStep[];
  notes?: string[];
}

export interface ProjectWindowItem {
  id: string;
  name: string;
  label?: string;
  input: WindowInput;
  result: CalculationResult | null;
}
