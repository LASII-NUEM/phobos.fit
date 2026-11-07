import { CircuitElement, ComponentType, EISPoint, PresetCircuit } from '../types/impedance';

export interface Complex {
  re: number;
  im: number;
}

export const ComplexMath = {
  add: (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im }),
  sub: (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im }),
  mul: (a: Complex, b: Complex): Complex => ({
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  }),
  div: (a: Complex, b: Complex): Complex => {
    const denom = b.re * b.re + b.im * b.im;
    if (denom === 0) return { re: 1e12, im: 1e12 };
    return {
      re: (a.re * b.re + a.im * b.im) / denom,
      im: (a.im * b.re - a.re * b.im) / denom,
    };
  },
  parallel: (a: Complex, b: Complex): Complex => {
    // (a * b) / (a + b)
    const num = ComplexMath.mul(a, b);
    const den = ComplexMath.add(a, b);
    return ComplexMath.div(num, den);
  },
  mag: (c: Complex): number => Math.sqrt(c.re * c.re + c.im * c.im),
  phaseDeg: (c: Complex): number => (Math.atan2(c.im, c.re) * 180) / Math.PI,
};

export const DEFAULT_SCALES: Record<ComponentType, { scale: number; unit: string; defaultVal: number; min: number; max: number }> = {
  R: { scale: 10000, unit: 'Ω', defaultVal: 10000, min: 1e-3, max: 1e9 },
  C: { scale: 1e-9, unit: 'F', defaultVal: 1e-9, min: 1e-15, max: 1 },
  L: { scale: 1e-3, unit: 'H', defaultVal: 1e-3, min: 1e-9, max: 100 },
  CPE: { scale: 1e-6, unit: 'S·s^α', defaultVal: 1e-6, min: 1e-12, max: 1 },
  W: { scale: 1e-6, unit: 'Ω·s^-0.5', defaultVal: 1e-6, min: 1e-12, max: 1e6 },
};

/**
 * Formats a numeric value into engineering style notation (e.g. 1e-3, 10e-6, 100, 10e3).
 * Engineering notation uses exponents that are multiples of 3.
 */
export function formatEngineering(val: number): string {
  if (val === 0 || !isFinite(val) || isNaN(val)) return '0';

  const absVal = Math.abs(val);
  const sign = val < 0 ? '-' : '';

  // Base 10 exponent
  const exp = Math.floor(Math.log10(absVal));
  // Engineering exponent is the nearest lower multiple of 3
  const engExp = Math.floor(exp / 3) * 3;
  const mantissa = absVal / Math.pow(10, engExp);

  // Round mantissa cleanly up to 4 significant digits without trailing float noise
  const roundedMantissa = parseFloat(mantissa.toPrecision(4));

  if (engExp === 0) {
    return `${sign}${roundedMantissa}`;
  }

  return `${sign}${roundedMantissa}e${engExp}`;
}

export function computeComponentZ(type: ComponentType, omega: number, val: number, alpha = 1.0): Complex {
  const safeOmega = Math.max(omega, 1e-9);
  switch (type) {
    case 'R':
      return { re: Math.max(val, 1e-9), im: 0 };
    case 'C': {
      const c = Math.max(val, 1e-15);
      return { re: 0, im: -1 / (safeOmega * c) };
    }
    case 'L': {
      const l = Math.max(val, 1e-12);
      return { re: 0, im: safeOmega * l };
    }
    case 'CPE': {
      // Z_CPE = 1 / [Q0 * (j * w)^alpha]
      // = 1 / [Q0 * w^alpha * (cos(alpha*pi/2) + j*sin(alpha*pi/2))]
      // = [cos(alpha*pi/2) - j*sin(alpha*pi/2)] / [Q0 * w^alpha]
      const q0 = Math.max(val, 1e-15);
      const a = Math.min(Math.max(alpha, 0.01), 1.0);
      const wA = Math.pow(safeOmega, a);
      const theta = a * (Math.PI / 2);
      const denom = q0 * wA;
      if (denom === 0) return { re: 1e10, im: -1e10 };
      return {
        re: Math.cos(theta) / denom,
        im: -Math.sin(theta) / denom,
      };
    }
    case 'W': {
      // Warburg semi-infinite diffusion:
      // Z_W = Aw / sqrt(w) - j * Aw / sqrt(w)
      const aw = Math.max(val, 1e-15);
      const factor = aw / Math.sqrt(safeOmega);
      return { re: factor, im: -factor };
    }
  }
}

// Tokenizer & Parser for ECM circuits with series (+) and parallel (//)
type Token = 
  | { type: 'NAME'; value: string }
  | { type: 'PLUS' }
  | { type: 'PARALLEL' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' };

export function tokenizeCircuit(str: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = str.trim();

  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i++;
      continue;
    }
    if (ch === '+') {
      tokens.push({ type: 'PLUS' });
      i++;
      continue;
    }
    if (ch === '/' && s[i + 1] === '/') {
      tokens.push({ type: 'PARALLEL' });
      i += 2;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN' });
      i++;
      continue;
    }
    // Component name (alphanumeric and underscore)
    if (/[a-zA-Z0-9_]/.test(ch)) {
      let name = '';
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) {
        name += s[i];
        i++;
      }
      tokens.push({ type: 'NAME', value: name });
      continue;
    }
    // Ignore invalid characters
    i++;
  }
  return tokens;
}

export type ASTNode =
  | { type: 'COMPONENT'; name: string }
  | { type: 'SERIES'; left: ASTNode; right: ASTNode }
  | { type: 'PARALLEL'; left: ASTNode; right: ASTNode };

/**
 * Grammar:
 * Expression -> SeriesExpr
 * SeriesExpr -> ParallelExpr ('+' ParallelExpr)*
 * ParallelExpr -> Primary ('//' Primary)*
 * Primary -> '(' Expression ')' | NAME
 */
export function parseCircuit(tokens: Token[]): ASTNode {
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(): Token {
    return tokens[pos++];
  }

  function parseExpression(): ASTNode {
    return parseSeries();
  }

  function parseSeries(): ASTNode {
    let node = parseParallel();
    while (peek() && peek()!.type === 'PLUS') {
      consume(); // eat '+'
      const right = parseParallel();
      node = { type: 'SERIES', left: node, right };
    }
    return node;
  }

  function parseParallel(): ASTNode {
    let node = parsePrimary();
    while (peek() && peek()!.type === 'PARALLEL') {
      consume(); // eat '//'
      const right = parsePrimary();
      node = { type: 'PARALLEL', left: node, right };
    }
    return node;
  }

  function parsePrimary(): ASTNode {
    const t = peek();
    if (!t) {
      throw new Error('Unexpected end of circuit formula');
    }
    if (t.type === 'LPAREN') {
      consume();
      const node = parseExpression();
      const next = peek();
      if (!next || next.type !== 'RPAREN') {
        throw new Error('Mismatched parenthesis: missing closing ")"');
      }
      consume();
      return node;
    }
    if (t.type === 'NAME') {
      consume();
      return { type: 'COMPONENT', name: t.value };
    }
    throw new Error(`Unexpected token: ${t.type}`);
  }

  const ast = parseExpression();
  if (pos < tokens.length) {
    throw new Error(`Trailing syntax after circuit expression`);
  }
  return ast;
}

export function extractComponentNames(ast: ASTNode): string[] {
  const names = new Set<string>();
  function traverse(n: ASTNode) {
    if (n.type === 'COMPONENT') {
      names.add(n.name);
    } else {
      traverse(n.left);
      traverse(n.right);
    }
  }
  traverse(ast);
  return Array.from(names);
}

export function inferComponentType(name: string): ComponentType {
  const upper = name.toUpperCase();
  if (upper.startsWith('CPE')) return 'CPE';
  if (upper.startsWith('C')) return 'C';
  if (upper.startsWith('R')) return 'R';
  if (upper.startsWith('L')) return 'L';
  if (upper.startsWith('W')) return 'W';
  return 'R';
}

export function evaluateAST(
  ast: ASTNode,
  omega: number,
  params: Record<string, number>,
  alphas: Record<string, number> = {}
): Complex {
  switch (ast.type) {
    case 'COMPONENT': {
      const type = inferComponentType(ast.name);
      const val = params[ast.name] ?? DEFAULT_SCALES[type].defaultVal;
      const alpha = alphas[ast.name] ?? 1.0;
      return computeComponentZ(type, omega, val, alpha);
    }
    case 'SERIES': {
      const z1 = evaluateAST(ast.left, omega, params, alphas);
      const z2 = evaluateAST(ast.right, omega, params, alphas);
      return ComplexMath.add(z1, z2);
    }
    case 'PARALLEL': {
      const z1 = evaluateAST(ast.left, omega, params, alphas);
      const z2 = evaluateAST(ast.right, omega, params, alphas);
      return ComplexMath.parallel(z1, z2);
    }
  }
}

export function simulateCircuit(
  expression: string,
  params: Record<string, number>,
  frequencies: number[],
  alphas: Record<string, number> = {}
): EISPoint[] {
  const tokens = tokenizeCircuit(expression);
  const ast = parseCircuit(tokens);

  return frequencies.map((freq) => {
    const omega = 2 * Math.PI * freq;
    const z = evaluateAST(ast, omega, params, alphas);
    const zMag = ComplexMath.mag(z);
    const phaseDeg = ComplexMath.phaseDeg(z);
    const zImagNeg = -z.im;

    // Optional equivalent parallel Cp & Rp:
    // Y = 1 / Z = G + j * B = 1/Rp + j * omega * Cp
    const y = ComplexMath.div({ re: 1, im: 0 }, z);
    const rp = y.re !== 0 ? 1 / y.re : undefined;
    const cp = omega !== 0 ? y.im / omega : undefined;

    return {
      freq,
      omega,
      zReal: z.re,
      zImag: z.im,
      zImagNeg,
      zMag,
      phaseDeg,
      rp,
      cp,
    };
  });
}

export function generateFrequencyList(
  fMin: number,
  fMax: number,
  points: number,
  isLog = true
): number[] {
  const safeMin = Math.max(fMin, 1e-6);
  const safeMax = Math.max(fMax, safeMin * 1.1);
  const n = Math.max(points, 2);

  if (isLog) {
    const logMin = Math.log10(safeMin);
    const logMax = Math.log10(safeMax);
    const step = (logMax - logMin) / (n - 1);
    const freqs: number[] = [];
    for (let i = 0; i < n; i++) {
      freqs.push(Math.pow(10, logMin + i * step));
    }
    return freqs;
  } else {
    const step = (safeMax - safeMin) / (n - 1);
    const freqs: number[] = [];
    for (let i = 0; i < n; i++) {
      freqs.push(safeMin + i * step);
    }
    return freqs;
  }
}

export const PRESET_CIRCUITS: PresetCircuit[] = [
  {
    id: 'randles',
    name: 'Randle (R + (R // C))',
    expression: 'Rs + (Rct // Cdl)',
    description: 'Randle circuit model R+(R//C) with solution resistance and parallel charge-transfer and capacitance.',
    defaultElements: [
      { id: '1', type: 'R', label: 'Rs', value: 100, isFit: true, scale: 100, minBound: 0.1, maxBound: 1e5 },
      { id: '2', type: 'R', label: 'Rct', value: 5000, isFit: true, scale: 10000, minBound: 1, maxBound: 1e8 },
      { id: '3', type: 'C', label: 'Cdl', value: 1e-6, isFit: true, scale: 1e-6, minBound: 1e-12, maxBound: 1e-2 },
    ],
  },
  {
    id: 'rp_cp',
    name: 'Rp // Cp',
    expression: 'Rp // Cp',
    description: 'Parallel resistance and capacitance.',
    defaultElements: [
      { id: '1', type: 'R', label: 'Rp', value: 10000, isFit: true, scale: 10000, minBound: 0.1, maxBound: 1e8 },
      { id: '2', type: 'C', label: 'Cp', value: 1e-6, isFit: true, scale: 1e-6, minBound: 1e-12, maxBound: 1e-2 },
    ],
  },
  {
    id: 'rp_cpe',
    name: 'Rp // CPE',
    expression: 'Rp // CPE1',
    description: 'Parallel resistance and Constant Phase Element.',
    defaultElements: [
      { id: '1', type: 'R', label: 'Rp', value: 10000, isFit: true, scale: 10000, minBound: 0.1, maxBound: 1e8 },
      { id: '2', type: 'CPE', label: 'CPE1', value: 1e-6, alpha: 0.9, isFit: true, scale: 1e-6, minBound: 1e-12, maxBound: 1 },
    ],
  },
];
