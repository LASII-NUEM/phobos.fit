import { EISPoint, LinKKConfig, LinKKResult } from '../types/impedance';

/**
 * Solves standard non-negative / regularized least squares for Voigt element distribution:
 * A * x = b
 * Regularized with Tikhonov ridge lambda to ensure well-conditioned inverse
 */
function solveRidge(A: number[][], b: number[], lambda = 1e-5): number[] {
  const m = A.length;
  const n = A[0].length;

  // Compute A^T * A + lambda * I
  const AtA: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const Atb: number[] = Array(n).fill(0);

  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      let sum = 0;
      for (let i = 0; i < m; i++) {
        sum += A[i][j] * A[i][k];
      }
      AtA[j][k] = sum + (j === k ? lambda : 0);
    }
    let sumB = 0;
    for (let i = 0; i < m; i++) {
      sumB += A[i][j] * b[i];
    }
    Atb[j] = sumB;
  }

  // Gaussian elimination with partial pivoting to solve AtA * x = Atb
  const M = AtA.map((row, i) => [...row, Atb[i]]);

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    const pivot = M[i][i];
    if (Math.abs(pivot) < 1e-18) continue;

    for (let j = i; j <= n; j++) {
      M[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = M[k][i];
        for (let j = i; j <= n; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }
  }

  return M.map((row) => row[n]);
}

export function runLinearKramersKronig(
  points: EISPoint[],
  config: LinKKConfig = { c: 0.1, maxIter: 50, addCapacitor: true, verbose: true }
): LinKKResult {
  const N = points.length;
  if (N < 3) {
    throw new Error('Lin-KK test requires at least 3 impedance frequency points.');
  }

  const freqs = points.map((p) => p.freq);
  const omegas = points.map((p) => p.omega);

  // Time constants distributed across frequency range
  const wMin = Math.min(...omegas);
  const wMax = Math.max(...omegas);

  // Number of Voigt RC elements scaled by cutoff factor c
  const M = Math.max(3, Math.min(Math.round(N * (1 - config.c * 0.5)), 40));

  const logTauMin = Math.log10(1 / wMax);
  const logTauMax = Math.log10(1 / wMin);
  const taus: number[] = [];
  const tauStep = (logTauMax - logTauMin) / (M - 1);
  for (let k = 0; k < M; k++) {
    taus.push(Math.pow(10, logTauMin + k * tauStep));
  }

  // Parameter vector x: [ R0, (1/C0 if addCapacitor), R_1, R_2, ..., R_M ]
  const numParams = 1 + (config.addCapacitor ? 1 : 0) + M;

  // Build matrix A (size 2N x numParams) and vector b (size 2N)
  // Stack Real equations: Z'_i = R0 + sum_k [ R_k / (1 + (w_i * tau_k)^2) ]
  // Stack Imag equations: Z''_i = - (1 / (w_i * C0)) - sum_k [ (w_i * tau_k * R_k) / (1 + (w_i * tau_k)^2) ]
  const A: number[][] = [];
  const b: number[] = [];

  // Real rows
  for (let i = 0; i < N; i++) {
    const w = omegas[i];
    const weight = 1 / Math.max(points[i].zMag, 1e-9);
    const row: number[] = [];

    // Col 0: R0
    row.push(1 * weight);

    // Col 1: 1/C0 if present (imaginary only, so 0 for real)
    if (config.addCapacitor) {
      row.push(0);
    }

    // Col 2..M+1: Voigt resistances
    for (let k = 0; k < M; k++) {
      const term = 1 / (1 + Math.pow(w * taus[k], 2));
      row.push(term * weight);
    }

    A.push(row);
    b.push(points[i].zReal * weight);
  }

  // Imag rows
  for (let i = 0; i < N; i++) {
    const w = omegas[i];
    const weight = 1 / Math.max(points[i].zMag, 1e-9);
    const row: number[] = [];

    // Col 0: R0 has no imaginary part
    row.push(0);

    // Col 1: 1/C0 has term -1 / w
    if (config.addCapacitor) {
      row.push((-1 / w) * weight);
    }

    // Col 2..M+1: Voigt elements
    for (let k = 0; k < M; k++) {
      const term = -(w * taus[k]) / (1 + Math.pow(w * taus[k], 2));
      row.push(term * weight);
    }

    A.push(row);
    b.push(points[i].zImag * weight);
  }

  // Solve regularized system
  const x = solveRidge(A, b, 1e-4);

  const R0 = Math.max(0, x[0]);
  const invC0 = config.addCapacitor ? Math.max(0, x[1]) : 0;
  const C0 = invC0 > 0 ? 1 / invC0 : undefined;
  const Rk = x.slice(config.addCapacitor ? 2 : 1).map((v) => Math.max(0, v));

  // Compute fitted values and residuals
  const fittedPoints: EISPoint[] = [];
  const residualsReal: number[] = [];
  const residualsImag: number[] = [];
  let sumSqReal = 0;
  let sumSqImag = 0;

  for (let i = 0; i < N; i++) {
    const w = omegas[i];
    const p = points[i];

    let fitRe = R0;
    let fitIm = C0 && C0 > 0 ? -1 / (w * C0) : 0;

    for (let k = 0; k < M; k++) {
      const wt = w * taus[k];
      const denom = 1 + wt * wt;
      fitRe += Rk[k] / denom;
      fitIm -= (wt * Rk[k]) / denom;
    }

    const zMag = p.zMag;
    // Relative residual %
    const deltaRe = ((p.zReal - fitRe) / zMag) * 100;
    const deltaIm = ((p.zImag - fitIm) / zMag) * 100;

    residualsReal.push(deltaRe);
    residualsImag.push(deltaIm);

    sumSqReal += Math.pow(deltaRe, 2);
    sumSqImag += Math.pow(deltaIm, 2);

    fittedPoints.push({
      freq: p.freq,
      omega: w,
      zReal: fitRe,
      zImag: fitIm,
      zImagNeg: -fitIm,
      zMag: Math.sqrt(fitRe * fitRe + fitIm * fitIm),
      phaseDeg: (Math.atan2(fitIm, fitRe) * 180) / Math.PI,
    });
  }

  const chiSquare = (sumSqReal + sumSqImag) / (2 * N);
  const pseudoChiSquare = (sumSqReal + sumSqImag) / 10000;
  const maxResidualReal = Math.max(...residualsReal.map((r) => Math.abs(r)));
  const maxResidualImag = Math.max(...residualsImag.map((r) => Math.abs(r)));
  const maxOverall = Math.max(maxResidualReal, maxResidualImag);

  let status: 'Consistent' | 'Marginal' | 'Inconsistent' = 'Consistent';
  let summary = '';

  if (maxOverall <= 1.0) {
    status = 'Consistent';
    summary = `Data complies with Kramers-Kronig conditions with max residual of ${maxOverall.toFixed(2)}% (within ±1.0%). The system demonstrates high linearity, causality, and steady-state stability.`;
  } else if (maxOverall <= 3.0) {
    status = 'Marginal';
    summary = `Marginal Kramers-Kronig compliance with peak residual ${maxOverall.toFixed(2)}%. Mild non-stationarity or slight high-frequency inductive dispersion observed.`;
  } else {
    status = 'Inconsistent';
    summary = `Data deviates significantly from Kramers-Kronig relations (max residual ${maxOverall.toFixed(2)}% > 3.0%). System likely experienced non-linear perturbations, electrode drifting, or non-stationary conditions during testing.`;
  }

  return {
    freqs,
    residualsReal,
    residualsImag,
    fittedPoints,
    chiSquare,
    pseudoChiSquare,
    status,
    summary,
    maxResidualReal,
    maxResidualImag,
  };
}
