export interface EISPoint {
  freq: number;
  omega: number;
  zReal: number;
  zImag: number;      // Imaginary part (typically negative for capacitive systems)
  zImagNeg: number;   // -Z'' (standard positive representation in Nyquist plots)
  zMag: number;
  phaseDeg: number;
  cp?: number;
  rp?: number;
  epsReal?: number;
  epsImag?: number;
  sigmaReal?: number;
}

export interface EISDataset {
  id: string;
  name: string;
  originalFilename: string;
  color: string;
  visible: boolean;
  points: EISPoint[];
  style: 'chemistry' | 'electrical';
  c0?: number;          // Reference geometric capacitance (e.g. air cell C0 in Farads)
  cellConstant?: number;// d / A (cm^-1)
  description?: string;
}

export type ComponentType = 'R' | 'C' | 'L' | 'CPE' | 'W';

export interface CircuitElement {
  id: string;
  type: ComponentType;
  label: string;
  value: number;        // Primary value (Ohms for R, Farads for C, Henries for L, Q0 for CPE, Aw for W)
  alpha?: number;       // Alpha / n exponent for CPE (0 to 1)
  isFit: boolean;       // Included in fitting process
  scale: number;        // Default scaling factor
  minBound: number;
  maxBound: number;
}

export interface PresetCircuit {
  id: string;
  name: string;
  expression: string;
  description: string;
  defaultElements: CircuitElement[];
}

export interface LinKKConfig {
  c: number;             // Cutoff parameter (default 0.1)
  maxIter: number;       // Max iterations (default 50)
  addCapacitor: boolean; // Add series capacitor C0
  verbose: boolean;
}

export interface LinKKResult {
  freqs: number[];
  residualsReal: number[];
  residualsImag: number[];
  fittedPoints: EISPoint[];
  chiSquare: number;
  pseudoChiSquare: number;
  status: 'Consistent' | 'Marginal' | 'Inconsistent';
  summary: string;
  maxResidualReal: number;
  maxResidualImag: number;
}

export type FittingAlgorithm = 'BFGS' | 'NLLS' | 'Nelder-Mead' | 'PSO' | 'BFGS-classic';

export interface FitIterationLog {
  iteration: number;
  loss: number;
  stepSize?: number;
  params: Record<string, number>;
  message?: string;
}

export interface FitResult {
  algorithm: FittingAlgorithm;
  circuitExpression: string;
  converged: boolean;
  iterations: number;
  finalLoss: number;
  chiSquare: number;
  parameters: Record<string, {
    value: number;
    initialValue: number;
    error: number;
    unit: string;
    isFixed: boolean;
  }>;
  fittedPoints: EISPoint[];
  evolution: FitIterationLog[];
  terminalLogs: string[];
}

export type PlotType = 
  | 'nyquist'
  | 'bode_mag'
  | 'bode_phase'
  | 'z_real_vs_f'
  | 'z_imag_vs_f'
  | 'cprp'
  | 'permittivity'
  | 'conductivity'
  | 'plot_3d';

export interface SubplotItem {
  id: string;
  title?: string;
  plotType: PlotType;
  logScale: boolean;
  aspectEqual: boolean;
  height?: number;
  colSpan?: 1 | 2;
  disabledDatasetIds?: string[];
}
