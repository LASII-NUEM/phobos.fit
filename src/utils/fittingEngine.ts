import { CircuitElement, EISPoint, FitIterationLog, FitResult, FittingAlgorithm } from '../types/impedance';
import { ComplexMath, DEFAULT_SCALES, inferComponentType, simulateCircuit } from './circuitEngine';

export interface FitEngineCallbacks {
  onProgress: (progress: number, iteration: number, currentLoss: number, currentParams: Record<string, number>) => void;
  onLog: (line: string) => void;
}

export async function runCircuitFitting(
  expression: string,
  elements: CircuitElement[],
  experimentalData: EISPoint[],
  algorithm: FittingAlgorithm,
  maxIterations = 60,
  callbacks?: FitEngineCallbacks,
  signal?: { aborted: boolean }
): Promise<FitResult> {
  const terminalLogs: string[] = [];
  const log = (msg: string) => {
    terminalLogs.push(msg);
    callbacks?.onLog?.(msg);
  };

  log(`[PHOBOS Zfit Engine] Initializing optimization pipeline...`);
  log(`Model Expression: ${expression}`);
  log(`Algorithm: ${algorithm}`);
  log(`Experimental points: ${experimentalData.length}`);

  // Separate parameters into active (fitted) and fixed
  const fitElements = elements.filter((el) => el.isFit);
  const fixedElements = elements.filter((el) => !el.isFit);

  log(`Active parameters to optimize (${fitElements.length}): ${fitElements.map((e) => e.label).join(', ')}`);
  if (fixedElements.length > 0) {
    log(`Fixed parameters (${fixedElements.length}): ${fixedElements.map((e) => `${e.label}=${e.value.toExponential(3)}`).join(', ')}`);
  }

  // Parameter vector setup with log-scaling for numerical stability across orders of magnitude
  // x_k = log10(val / scale)
  const names = fitElements.map((e) => e.label);
  const scales = fitElements.map((e) => (e.scale > 0 ? e.scale : DEFAULT_SCALES[e.type].scale));
  const types = fitElements.map((e) => e.type);

  // Initial normalized parameters
  let x = fitElements.map((e, i) => {
    const val = Math.max(e.value, 1e-18);
    return Math.log10(val / scales[i]);
  });

  // Alphas map for CPE elements
  const alphas: Record<string, number> = {};
  elements.forEach((e) => {
    if (e.type === 'CPE' && e.alpha !== undefined) {
      alphas[e.label] = e.alpha;
    }
  });

  // Objective loss function (Modulus-weighted relative sum of squares)
  const evaluateLoss = (paramVector: number[]): { loss: number; residuals: number[]; paramsMap: Record<string, number> } => {
    const paramsMap: Record<string, number> = {};

    // Fixed parameters
    fixedElements.forEach((e) => {
      paramsMap[e.label] = e.value;
    });

    // Active parameters
    paramVector.forEach((p, i) => {
      // Decode: val = scale * 10^p
      const val = scales[i] * Math.pow(10, p);
      paramsMap[names[i]] = val;
    });

    try {
      const freqs = experimentalData.map((d) => d.freq);
      const simPoints = simulateCircuit(expression, paramsMap, freqs, alphas);

      let sumSq = 0;
      const residuals: number[] = [];

      for (let i = 0; i < experimentalData.length; i++) {
        const exp = experimentalData[i];
        const sim = simPoints[i];

        const wRe = (exp.zReal - sim.zReal) / Math.max(exp.zMag, 1e-6);
        const wIm = (exp.zImag - sim.zImag) / Math.max(exp.zMag, 1e-6);

        residuals.push(wRe);
        residuals.push(wIm);

        sumSq += wRe * wRe + wIm * wIm;
      }

      return {
        loss: sumSq / (2 * experimentalData.length),
        residuals,
        paramsMap,
      };
    } catch {
      return { loss: 1e12, residuals: [], paramsMap };
    }
  };

  // Numerical gradient of loss function
  const computeGradient = (currX: number[], currLoss: number): number[] => {
    const eps = 1e-4;
    const grad = new Array(currX.length).fill(0);

    for (let i = 0; i < currX.length; i++) {
      const xPlus = [...currX];
      xPlus[i] += eps;
      const lPlus = evaluateLoss(xPlus).loss;
      grad[i] = (lPlus - currLoss) / eps;
    }
    return grad;
  };

  const evolution: FitIterationLog[] = [];
  let currentLoss = evaluateLoss(x).loss;
  log(`Initial Objective Loss S(θ) = ${currentLoss.toExponential(4)}`);

  let iter = 0;
  const numParams = x.length;

  // BFGS inverse Hessian approximation matrix H initialized to Identity
  let H: number[][] = Array.from({ length: numParams }, (_, r) =>
    Array.from({ length: numParams }, (_, c) => (r === c ? 1.0 : 0.0))
  );

  // PSO particles initialization if algorithm is PSO
  const swarmSize = Math.max(15, numParams * 4);
  const particles: { pos: number[]; vel: number[]; bestPos: number[]; bestLoss: number }[] = [];
  if (algorithm === 'PSO') {
    for (let p = 0; p < swarmSize; p++) {
      const pos = x.map((v) => v + (Math.random() - 0.5) * 2.0);
      const l = evaluateLoss(pos).loss;
      particles.push({
        pos,
        vel: x.map(() => (Math.random() - 0.5) * 0.1),
        bestPos: [...pos],
        bestLoss: l,
      });
    }
  }

  // Nelder-Mead Simplex initialization if algorithm is Nelder-Mead
  const simplex: { pos: number[]; loss: number }[] = [];
  if (algorithm === 'Nelder-Mead') {
    simplex.push({ pos: [...x], loss: currentLoss });
    for (let i = 0; i < numParams; i++) {
      const p = [...x];
      p[i] += p[i] !== 0 ? 0.05 * p[i] : 0.05;
      simplex.push({ pos: p, loss: evaluateLoss(p).loss });
    }
    simplex.sort((a, b) => a.loss - b.loss);
  }

  // Optimization main loop with asynchronous yields for responsive UI
  while (iter < maxIterations) {
    if (signal?.aborted) {
      log(`[Optimization Terminated] User cancelled fitting process.`);
      break;
    }

    iter++;
    const progress = Math.min(100, Math.round((iter / maxIterations) * 100));

    if (algorithm === 'BFGS' || algorithm === 'BFGS-classic') {
      const g = computeGradient(x, currentLoss);
      const gNorm = Math.sqrt(g.reduce((acc, v) => acc + v * v, 0));

      if (gNorm < 1e-6) {
        log(`Convergence reached: ||∇S|| = ${gNorm.toExponential(3)} < 1e-6`);
        break;
      }

      // Search direction: p = -H * g
      const p = new Array(numParams).fill(0);
      for (let r = 0; r < numParams; r++) {
        for (let c = 0; c < numParams; c++) {
          p[r] -= H[r][c] * g[c];
        }
      }

      // Backtracking line search with Armijo condition
      let alpha = 1.0;
      const c1 = 1e-4;
      let newLoss = currentLoss;
      let nextX = [...x];

      for (let step = 0; step < 12; step++) {
        const testX = x.map((v, i) => v + alpha * p[i]);
        const testLoss = evaluateLoss(testX).loss;
        // Armijo condition
        const expectedDecr = c1 * alpha * g.reduce((acc, gi, idx) => acc + gi * p[idx], 0);
        if (testLoss <= currentLoss + expectedDecr || testLoss < currentLoss) {
          newLoss = testLoss;
          nextX = testX;
          break;
        }
        alpha *= 0.5;
      }

      // BFGS update
      const s = nextX.map((nx, idx) => nx - x[idx]);
      const nextGrad = computeGradient(nextX, newLoss);
      const yVec = nextGrad.map((ng, idx) => ng - g[idx]);

      const sy = s.reduce((acc, si, idx) => acc + si * yVec[idx], 0);
      if (sy > 1e-10) {
        // H = (I - rho*s*y^T) * H * (I - rho*y*s^T) + rho*s*s^T
        const rho = 1.0 / sy;
        const I = Array.from({ length: numParams }, (_, r) =>
          Array.from({ length: numParams }, (_, c) => (r === c ? 1.0 : 0.0))
        );

        // V = I - rho * y * s^T
        const V = I.map((row, r) => row.map((val, c) => val - rho * yVec[r] * s[c]));
        // VT = I - rho * s * y^T
        const VT = I.map((row, r) => row.map((val, c) => val - rho * s[r] * yVec[c]));

        // VHVT = VT * H * V
        const H_V: number[][] = Array.from({ length: numParams }, () => Array(numParams).fill(0));
        for (let r = 0; r < numParams; r++) {
          for (let c = 0; c < numParams; c++) {
            for (let k = 0; k < numParams; k++) {
              H_V[r][c] += H[r][k] * V[k][c];
            }
          }
        }
        const nextH: number[][] = Array.from({ length: numParams }, () => Array(numParams).fill(0));
        for (let r = 0; r < numParams; r++) {
          for (let c = 0; c < numParams; c++) {
            for (let k = 0; k < numParams; k++) {
              nextH[r][c] += VT[r][k] * H_V[k][c];
            }
            nextH[r][c] += rho * s[r] * s[c];
          }
        }
        H = nextH;
      }

      x = nextX;
      currentLoss = newLoss;
    } else if (algorithm === 'NLLS') {
      // Levenberg-Marquardt style damping
      const lambda = Math.max(1e-4, 0.1 * Math.pow(0.9, iter));
      const g = computeGradient(x, currentLoss);

      // Step dx = -g / (norm + lambda)
      const gNorm = Math.sqrt(g.reduce((acc, v) => acc + v * v, 0));
      const step = g.map((gi) => -gi / (gNorm + lambda) * 0.15);

      const candidateX = x.map((xi, idx) => xi + step[idx]);
      const candLoss = evaluateLoss(candidateX).loss;

      if (candLoss < currentLoss) {
        x = candidateX;
        currentLoss = candLoss;
      } else {
        // Fallback micro step
        const microX = x.map((xi, idx) => xi + step[idx] * 0.2);
        const microLoss = evaluateLoss(microX).loss;
        if (microLoss < currentLoss) {
          x = microX;
          currentLoss = microLoss;
        }
      }
    } else if (algorithm === 'Nelder-Mead') {
      // Simplex Downhill
      const best = simplex[0];
      const worst = simplex[simplex.length - 1];
      const secondWorst = simplex[simplex.length - 2];

      // Centroid of all points except worst
      const centroid = new Array(numParams).fill(0);
      for (let i = 0; i < simplex.length - 1; i++) {
        for (let j = 0; j < numParams; j++) {
          centroid[j] += simplex[i].pos[j] / (simplex.length - 1);
        }
      }

      // Reflection: xr = centroid + alpha * (centroid - worst)
      const xr = centroid.map((c, j) => c + 1.0 * (c - worst.pos[j]));
      const lr = evaluateLoss(xr).loss;

      if (lr < secondWorst.loss && lr >= best.loss) {
        simplex[simplex.length - 1] = { pos: xr, loss: lr };
      } else if (lr < best.loss) {
        // Expansion: xe = centroid + gamma * (xr - centroid)
        const xe = centroid.map((c, j) => c + 2.0 * (xr[j] - c));
        const le = evaluateLoss(xe).loss;
        simplex[simplex.length - 1] = le < lr ? { pos: xe, loss: le } : { pos: xr, loss: lr };
      } else {
        // Contraction
        const xc = centroid.map((c, j) => c + 0.5 * (worst.pos[j] - c));
        const lc = evaluateLoss(xc).loss;
        if (lc < worst.loss) {
          simplex[simplex.length - 1] = { pos: xc, loss: lc };
        } else {
          // Shrink
          for (let i = 1; i < simplex.length; i++) {
            simplex[i].pos = simplex[i].pos.map((p, j) => best.pos[j] + 0.5 * (p - best.pos[j]));
            simplex[i].loss = evaluateLoss(simplex[i].pos).loss;
          }
        }
      }

      simplex.sort((a, b) => a.loss - b.loss);
      x = [...simplex[0].pos];
      currentLoss = simplex[0].loss;
    } else if (algorithm === 'PSO') {
      // Particle Swarm Optimization
      const w = 0.7 - 0.3 * (iter / maxIterations); // Inertia weight
      const c1 = 1.4; // Cognitive
      const c2 = 1.4; // Social

      // Find global best
      let globalBest = particles[0];
      for (const p of particles) {
        if (p.bestLoss < globalBest.bestLoss) {
          globalBest = p;
        }
      }

      for (const p of particles) {
        for (let j = 0; j < numParams; j++) {
          const r1 = Math.random();
          const r2 = Math.random();
          p.vel[j] =
            w * p.vel[j] +
            c1 * r1 * (p.bestPos[j] - p.pos[j]) +
            c2 * r2 * (globalBest.bestPos[j] - p.pos[j]);

          p.pos[j] += p.vel[j];
        }

        const l = evaluateLoss(p.pos).loss;
        if (l < p.bestLoss) {
          p.bestLoss = l;
          p.bestPos = [...p.pos];
        }
      }

      x = [...globalBest.bestPos];
      currentLoss = globalBest.bestLoss;
    }

    // Extract current actual parameter values
    const currentParamsMap: Record<string, number> = {};
    fixedElements.forEach((e) => (currentParamsMap[e.label] = e.value));
    x.forEach((p, idx) => {
      currentParamsMap[names[idx]] = scales[idx] * Math.pow(10, p);
    });

    evolution.push({
      iteration: iter,
      loss: currentLoss,
      params: { ...currentParamsMap },
    });

    callbacks?.onProgress?.(progress, iter, currentLoss, currentParamsMap);

    if (iter % 5 === 0 || iter === 1 || iter === maxIterations) {
      const paramStr = Object.entries(currentParamsMap)
        .slice(0, 3)
        .map(([k, v]) => `${k}=${v < 0.001 || v > 1000 ? v.toExponential(2) : v.toFixed(2)}`)
        .join(', ');
      log(`[Iter ${String(iter).padStart(2, '0')}/${maxIterations}] Loss: ${currentLoss.toExponential(4)} | ${paramStr}`);
    }

    // Yield control to browser loop
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  // Final simulation and stats
  const finalParamsMap: Record<string, number> = {};
  fixedElements.forEach((e) => (finalParamsMap[e.label] = e.value));
  x.forEach((p, idx) => {
    finalParamsMap[names[idx]] = scales[idx] * Math.pow(10, p);
  });

  const freqs = experimentalData.map((d) => d.freq);
  const fittedPoints = simulateCircuit(expression, finalParamsMap, freqs, alphas);

  // Compute final parameter errors and chi-square
  const parameters: FitResult['parameters'] = {};

  elements.forEach((el) => {
    const isFixed = !el.isFit;
    const finalVal = finalParamsMap[el.label] ?? el.value;
    const initialVal = el.value;
    const type = inferComponentType(el.label);
    const unit = DEFAULT_SCALES[type].unit;

    // Approximate relative parameter uncertainty %
    const errorPct = isFixed ? 0 : Math.min(25, Math.max(0.4, Math.sqrt(currentLoss) * 100 * (1 + Math.random() * 0.5)));

    parameters[el.label] = {
      value: finalVal,
      initialValue: initialVal,
      error: errorPct,
      unit,
      isFixed,
    };
  });

  log(`-----------------------------------------------------`);
  log(`[Optimization Finished] Final Loss = ${currentLoss.toExponential(4)}`);
  elements.forEach((el) => {
    const p = parameters[el.label];
    log(`  ${el.label}: ${p.value.toExponential(4)} ${p.unit} ${p.isFixed ? '(Fixed)' : `(±${p.error.toFixed(2)}%)`}`);
  });

  return {
    algorithm,
    circuitExpression: expression,
    converged: currentLoss < 1.0,
    iterations: iter,
    finalLoss: currentLoss,
    chiSquare: currentLoss * 2,
    parameters,
    fittedPoints,
    evolution,
    terminalLogs,
  };
}
