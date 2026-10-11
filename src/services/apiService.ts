import { RENDER_BACKEND_URL, API_ENDPOINTS } from '../config/api';
import { CircuitElement, EISPoint, FitResult, FittingAlgorithm, LinKKResult } from '../types/impedance';

export interface BackendHealthResponse {
  service?: string;
  status?: string;
  endpoints?: string[];
  online: boolean;
  latencyMs?: number;
}

/**
 * Checks connectivity to the live Render Flask API.
 */
export async function checkBackendHealth(): Promise<BackendHealthResponse> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout for cold starts

    const response = await fetch(API_ENDPOINTS.HEALTH, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { online: false };
    }

    const data = await response.json();
    const latencyMs = Math.round(performance.now() - start);

    return {
      service: data.service || 'PHOBOS_Zfit API',
      status: data.status || 'online',
      endpoints: data.endpoints || [],
      online: true,
      latencyMs,
    };
  } catch (error) {
    return { online: false };
  }
}

/**
 * Attempts remote fitting via Render API, returning null if offline or errored so fallback runs.
 */
export async function tryRemoteFitting(
  expression: string,
  elements: CircuitElement[],
  points: EISPoint[],
  algorithm: FittingAlgorithm,
  maxIterations: number
): Promise<{ success: boolean; data?: FitResult; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const payload = {
      expression,
      algorithm,
      max_iterations: maxIterations,
      frequencies: points.map((p) => p.freq),
      z_real: points.map((p) => p.zReal),
      z_imag: points.map((p) => p.zImag),
      elements: elements.map((e) => ({
        id: e.id,
        label: e.label,
        type: e.type,
        value: e.value,
        alpha: e.alpha,
        is_fit: e.isFit,
      })),
    };

    const response = await fetch(API_ENDPOINTS.FIT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const json = await response.json();
    if (!response.ok || !json.success) {
      return {
        success: false,
        error: json.error || `HTTP ${response.status}`,
      };
    }

    if (json.data && json.data.parameters) {
      return { success: true, data: json.data };
    }

    // Adapt flat response from Python fit endpoint
    const rawParams = json.fitted_params || json.parameters || {};
    const chiSquare = typeof json.chi_squared === 'number' ? json.chi_squared : (json.chiSquare || 0);
    const fitZr: number[] = json.fitted_z_real || [];
    const fitZi: number[] = json.fitted_z_imag || [];

    const formattedParams: Record<string, {
      value: number;
      initialValue: number;
      error: number;
      unit: string;
      isFixed: boolean;
    }> = {};

    for (const el of elements) {
      const val = typeof rawParams[el.label] === 'number' ? rawParams[el.label] : el.value;
      formattedParams[el.label] = {
        value: val,
        initialValue: el.value,
        error: 0.01,
        unit: el.type === 'R' ? 'Ω' : el.type === 'C' ? 'F' : '',
        isFixed: !el.isFit,
      };
    }

    const fittedPoints: EISPoint[] = points.map((p, idx) => {
      const zr = fitZr[idx] !== undefined ? fitZr[idx] : p.zReal;
      const zi = fitZi[idx] !== undefined ? fitZi[idx] : p.zImag;
      return {
        freq: p.freq,
        omega: 2 * Math.PI * p.freq,
        zReal: zr,
        zImag: zi,
        zImagNeg: -zi,
        zMag: Math.sqrt(zr * zr + zi * zi),
        phaseDeg: (Math.atan2(zi, zr) * 180) / Math.PI,
      };
    });

    return {
      success: true,
      data: {
        algorithm,
        circuitExpression: expression,
        converged: true,
        iterations: json.iterations || 1,
        finalLoss: chiSquare,
        chiSquare,
        parameters: formattedParams,
        fittedPoints,
        evolution: [],
        terminalLogs: [`[Python Fit] Completed via method: ${algorithm}, chi_sq: ${chiSquare.toExponential(4)}`],
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Connection timed out' : err.message,
    };
  }
}

/**
 * Attempts remote Lin-KK calculation via Render API.
 */
export async function tryRemoteLinKK(
  points: EISPoint[],
  c = 0.1,
  maxIter = 50
): Promise<{ success: boolean; data?: LinKKResult; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const payload = {
      frequencies: points.map((p) => p.freq),
      z_real: points.map((p) => p.zReal),
      z_imag: points.map((p) => p.zImag),
      c,
      max_iterations: maxIter,
      max_iter: maxIter,
    };

    const response = await fetch(API_ENDPOINTS.LINKK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const json = await response.json();
    if (!response.ok || !json.success) {
      return {
        success: false,
        error: json.error || `HTTP ${response.status}`,
      };
    }

    if (json.data && json.data.status && json.data.residualsReal) {
      return { success: true, data: json.data };
    }

    // Adapt flat response from Python linkk endpoint
    const resReal: number[] = json.residuals_real || json.residualsReal || [];
    const resImag: number[] = json.residuals_imag || json.residualsImag || [];
    const chiSquare = typeof json.chi_squared === 'number' ? json.chi_squared : 0;
    const isValid = json.is_valid !== undefined ? json.is_valid : chiSquare < 1e-4;

    const maxResReal = resReal.length > 0 ? Math.max(...resReal.map(Math.abs)) : 0;
    const maxResImag = resImag.length > 0 ? Math.max(...resImag.map(Math.abs)) : 0;

    const fittedPoints: EISPoint[] = points.map((p, idx) => {
      const zr = p.zReal * (1 - (resReal[idx] || 0));
      const zi = p.zImag * (1 - (resImag[idx] || 0));
      return {
        freq: p.freq,
        omega: p.omega,
        zReal: zr,
        zImag: zi,
        zImagNeg: -zi,
        zMag: Math.sqrt(zr * zr + zi * zi),
        phaseDeg: (Math.atan2(zi, zr) * 180) / Math.PI,
      };
    });

    const status: 'Consistent' | 'Marginal' | 'Inconsistent' = isValid
      ? 'Consistent'
      : maxResReal < 0.05 && maxResImag < 0.05
      ? 'Marginal'
      : 'Inconsistent';

    return {
      success: true,
      data: {
        freqs: points.map((p) => p.freq),
        residualsReal: resReal,
        residualsImag: resImag,
        fittedPoints,
        chiSquare,
        pseudoChiSquare: chiSquare,
        status,
        summary: `Residuals max real: ${(maxResReal * 100).toFixed(2)}%, max imag: ${(maxResImag * 100).toFixed(2)}%`,
        maxResidualReal: maxResReal,
        maxResidualImag: maxResImag,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Connection timed out' : err.message,
    };
  }
}

/**
 * Uploads and parses an EIS/PHOBOS file using the Python Flask backend (/api/read_file)
 * which runs file_utils.read(filename, type=type).
 */
export async function tryRemoteReadFile(
  file: File,
  fileStyle: 'chemistry' | 'electrical' = 'chemistry',
  c0?: number
): Promise<{
  success: boolean;
  data?: {
    name: string;
    points: EISPoint[];
    originalFilename: string;
  };
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', fileStyle === 'electrical' ? 'PHOBOS' : 'EIS');

    const response = await fetch(API_ENDPOINTS.READ_FILE, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `Remote API returned HTTP ${response.status}: ${errText.slice(0, 100)}`,
      };
    }

    const json = await response.json();
    if (!json.success) {
      return {
        success: false,
        error: json.error || 'Backend failed to parse file',
      };
    }

    // Handle flexible format returned by backend
    const freqs: number[] = json.frequencies || json.freq || [];
    const zReal: number[] = json.z_real || json.Z_real || [];
    const zImag: number[] = json.z_imag || json.Z_imag || [];
    const cpArr: (number | null)[] = json.cp || json.Cp || [];
    const rpArr: (number | null)[] = json.rp || json.Rp || [];

    if (freqs.length === 0 || zReal.length === 0 || zImag.length === 0) {
      return {
        success: false,
        error: 'Backend did not return valid frequency and impedance vectors',
      };
    }

    const c0Val = c0 || 2.5e-11;
    const vacuumPerm = 8.8541878128e-12;

    const points: EISPoint[] = freqs.map((f, i) => {
      const zr = Number(zReal[i]);
      const zi = Number(zImag[i]);
      const omega = 2 * Math.PI * f;
      const zMag = Math.sqrt(zr * zr + zi * zi);
      const phaseDeg = (Math.atan2(zi, zr) * 180) / Math.PI;

      let cp: number | undefined = cpArr[i] != null && !isNaN(Number(cpArr[i])) ? Number(cpArr[i]) : undefined;
      let rp: number | undefined = rpArr[i] != null && !isNaN(Number(rpArr[i])) ? Number(rpArr[i]) : undefined;

      const denom = zr * zr + zi * zi;
      if (denom > 0) {
        const g = zr / denom;
        const b = -zi / denom;
        if (rp === undefined) rp = g !== 0 ? 1 / g : undefined;
        if (cp === undefined) cp = omega > 0 ? b / omega : undefined;
      }

      let epsReal: number | undefined;
      let epsImag: number | undefined;
      let sigmaReal: number | undefined;

      if (cp !== undefined && rp !== undefined && c0Val > 0) {
        epsReal = cp / c0Val;
        epsImag = 1 / (omega * rp * c0Val);
        sigmaReal = omega * vacuumPerm * epsImag;
      }

      return {
        freq: f,
        omega,
        zReal: zr,
        zImag: zi,
        zImagNeg: -zi,
        zMag,
        phaseDeg,
        cp,
        rp,
        epsReal,
        epsImag,
        sigmaReal,
      };
    });

    return {
      success: true,
      data: {
        name: file.name.replace(/\.[^/.]+$/, ''),
        originalFilename: file.name,
        points,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Connection timed out' : err.message,
    };
  }
}
