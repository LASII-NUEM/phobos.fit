import * as XLSX from 'xlsx';
import { EISDataset, EISPoint } from '../types/impedance';

const VACUUM_PERMITTIVITY = 8.8541878128e-12; // Farads / meter (F/m)

export interface ParseOptions {
  style: 'chemistry' | 'electrical';
  c0?: number;          // Air reference capacitance in Farads
  cellConstant?: number;// d/A in cm^-1
  customName?: string;
}

/**
 * Auto-detects encoding (UTF-16LE, UTF-16BE, UTF-8) and decodes ArrayBuffer into text.
 * Autolab / Metrohm / NOVA EIS exports are encoded in UTF-16LE.
 */
export function decodeBufferToText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2) {
    // Check UTF-16LE BOM: 0xFF, 0xFE
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder('utf-16le').decode(buffer);
    }
    // Check UTF-16BE BOM: 0xFE, 0xFF
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder('utf-16be').decode(buffer);
    }
    // Check for UTF-16LE without BOM (every odd byte is 0x00 for ASCII text)
    let nullOdd = 0;
    let nullEven = 0;
    const len = Math.min(bytes.length, 120);
    for (let i = 0; i < len; i++) {
      if (bytes[i] === 0) {
        if (i % 2 === 1) nullOdd++;
        else nullEven++;
      }
    }
    if (nullOdd > 10 && nullEven === 0) {
      return new TextDecoder('utf-16le').decode(buffer);
    }
    if (nullEven > 10 && nullOdd === 0) {
      return new TextDecoder('utf-16be').decode(buffer);
    }
  }
  return new TextDecoder('utf-8').decode(buffer);
}

export function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  // Strip BOM character if present
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter: semicolon, tab, comma, or multiple whitespace
  const detectDelimiter = (sampleLines: string[]): string | RegExp => {
    let semiCount = 0;
    let tabCount = 0;
    let commaCount = 0;
    for (const line of sampleLines) {
      semiCount += (line.match(/;/g) || []).length;
      tabCount += (line.match(/\t/g) || []).length;
      commaCount += (line.match(/,/g) || []).length;
    }
    // Semicolons and tabs are never used as decimal separators in scientific data.
    // In European/Brazilian formats (e.g. 5,0e-6; 1,2e3), semicolons are column delimiters and commas are decimals.
    if (semiCount > 0 && semiCount >= sampleLines.length) return ';';
    if (tabCount > 0 && tabCount >= sampleLines.length) return '\t';
    if (semiCount > 0 && semiCount * 2 >= commaCount) return ';';
    if (tabCount > 0) return '\t';
    if (commaCount > 0) return ',';

    // If no commas, tabs, or semicolons, test if columns are whitespace-separated
    const hasWhitespaceCols = sampleLines.some((l) => /\S+\s{2,}\S+/.test(l) || /^\s*\S+(\s+\S+){2,}\s*$/.test(l));
    if (hasWhitespaceCols) return /\s+/;

    return ',';
  };

  // Find genuine header row (skipping metadata lines like File date:, 77 freqs, #, *, etc.)
  let headerIndex = -1;
  const isMetadataLine = (l: string): boolean => {
    const lower = l.toLowerCase();
    return (
      l.startsWith('#') ||
      l.startsWith('*') ||
      l.startsWith('//') ||
      lower.startsWith('file date:') ||
      lower.startsWith('measurement:') ||
      lower.startsWith('notes:') ||
      lower.startsWith('date and time:') ||
      lower.startsWith('instrument:') ||
      /^\d+\s*freqs$/i.test(l)
    );
  };

  // Scan up to 40 lines for header candidate
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = lines[i];
    if (isMetadataLine(line)) continue;

    const lower = line.toLowerCase();
    // Look for impedance or frequency keywords
    const isHeaderMatch =
      (lower.includes('freq') || lower.includes('hz') || lower.includes('f /') || /\bf\b/.test(lower)) &&
      (lower.includes('z') || lower.includes('ohm') || lower.includes('phase') || lower.includes('re') || lower.includes('im') || lower.includes('cp') || lower.includes('rp') || lower.includes('real'));

    // Check for PHOBOS header format (e.g. timestamp, mode, 40 Cp, 40 Rp)
    const isPhobosMatch = lower.includes('cp') && lower.includes('rp') && (lower.includes('timestamp') || /\d+\s*cp/.test(lower));

    if (isHeaderMatch || isPhobosMatch) {
      headerIndex = i;
      break;
    }
  }

  // Fallback: If no keyword header found, search for first line containing letters
  if (headerIndex === -1) {
    for (let i = 0; i < Math.min(lines.length, 25); i++) {
      const line = lines[i];
      if (isMetadataLine(line)) continue;
      if (/[a-zA-Z]/.test(line)) {
        headerIndex = i;
        break;
      }
    }
  }

  const sampleRows = lines.slice(Math.max(0, headerIndex), Math.max(1, headerIndex + 5));
  const delimiter = detectDelimiter(sampleRows.length > 0 ? sampleRows : lines.slice(0, 5));

  let rawHeaders: string[] = [];
  const rows: string[][] = [];

  const splitLine = (l: string): string[] => {
    if (delimiter instanceof RegExp) {
      return l.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));
    }
    return l.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));
  };

  if (headerIndex !== -1) {
    rawHeaders = splitLine(lines[headerIndex]);
    // Check if what looked like a header row is actually all numbers (headerless file)
    const isActuallyNumeric = rawHeaders.length >= 2 && rawHeaders.every((h) => {
      const clean = h.replace(',', '.');
      return !isNaN(parseFloat(clean)) && isFinite(Number(clean));
    });

    if (isActuallyNumeric) {
      // First row is data, not header!
      rows.push(rawHeaders);
      rawHeaders = rawHeaders.map((_, idx) => `Col_${idx + 1}`);
      headerIndex = -1;
    }
  } else {
    // Completely headerless data
    const firstLineParts = splitLine(lines[0]);
    rawHeaders = firstLineParts.map((_, idx) => `Col_${idx + 1}`);
  }

  const startDataIdx = headerIndex === -1 ? (rows.length > 0 ? 1 : 0) : headerIndex + 1;
  for (let i = startDataIdx; i < lines.length; i++) {
    const line = lines[i];
    if (isMetadataLine(line)) continue;
    const parts = splitLine(line);
    if (parts.length >= 2) {
      rows.push(parts);
    }
  }

  return { headers: rawHeaders, rows };
}

export function parseExcelBuffer(buffer: ArrayBuffer): { headers: string[]; rows: string[][] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

  if (json.length === 0) return { headers: [], rows: [] };

  let headerIndex = -1;
  for (let i = 0; i < Math.min(json.length, 25); i++) {
    const row = json[i];
    if (!Array.isArray(row)) continue;
    const rowText = row.map((cell) => String(cell || '').toLowerCase()).join(' ');
    if (
      (rowText.includes('freq') || rowText.includes('hz')) &&
      (rowText.includes('z') || rowText.includes('ohm') || rowText.includes('re') || rowText.includes('phase'))
    ) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    for (let i = 0; i < Math.min(json.length, 20); i++) {
      const row = json[i];
      if (Array.isArray(row) && row.some((cell) => typeof cell === 'string' && /[a-zA-Z]/.test(cell))) {
        headerIndex = i;
        break;
      }
    }
  }

  if (headerIndex === -1) headerIndex = 0;

  const rawHeaders = (json[headerIndex] || []).map((h) => String(h || '').trim());
  const rows: string[][] = [];

  for (let i = headerIndex + 1; i < json.length; i++) {
    const row = json[i];
    if (Array.isArray(row) && row.length >= 2) {
      rows.push(row.map((cell) => String(cell ?? '').trim()));
    }
  }

  return { headers: rawHeaders, rows };
}

export function buildEISPoints(
  headers: string[],
  rows: string[][],
  options: ParseOptions
): EISPoint[] {
  // Check for PHOBOS Swept Multielectrode format (e.g. timestamp, mode, 40 Cp, 40 Rp, ...)
  const isPhobosFormat = headers.some((h) => /\b\d+(\.\d+)?\s*(Cp|Rp|Z)\b/i.test(h));
  if (isPhobosFormat) {
    return parsePhobosMultiSweep(headers, rows, options);
  }

  // Flexible Regex-based column matching
  const findCol = (regex: RegExp) => headers.findIndex((h) => regex.test(h.trim()));

  // Match frequency
  let fIdx = findCol(/^freq|frequency|\bf\s*[\/\[\(]|\bhz\b|^f$|freq\.|frequency\s*\(hz\)/i);
  if (fIdx === -1) {
    fIdx = headers.findIndex((h) => /^f\b/i.test(h.trim()));
  }

  // Match Z_real (Z', Zre, Re(Z), Real, R)
  let zRealIdx = findCol(/z'|zprime|z_re|zre|zreal|re\(z\)|re_z|\breal\b|re'|\br\b|r\(ohm\)|r\s*[\/\[\(]|z1/i);

  // Match Z_imag (-Z'', Z'', Zim, Im(Z), Imag, -X, X)
  let zImagIdx = findCol(/-?z''|-?z"|zdoubleprime|z_im|zim|zimag|im\(z\)|im_z|\bimag\b|im'|-?x\b|x\(ohm\)|x\s*[\/\[\(]|z2/i);

  // Match |Z| Magnitude
  let zMagIdx = findCol(/\|z\||^z\s*[\/\[\(]ohm|^z\b|magnitude|zmag|mod_z|modulus/i);

  // Match Phase
  let phaseIdx = findCol(/phase|deg|theta|angle|phi/i);

  // Match Cp and Rp
  let cpIdx = findCol(/\bcp\b|capacitance|c_p/i);
  let rpIdx = findCol(/\brp\b|resistance|r_p/i);

  // Autolab / NOVA / file_utils.py standard positional mapping:
  // Col 0: freq / Hz, Col 4: Z / Ohm, Col 5: Z' / Ohm, Col 6: -Z'' / Ohm
  if (headers.length >= 7 && (zRealIdx === -1 || zImagIdx === -1)) {
    const h0 = headers[0]?.toLowerCase() || '';
    const h5 = headers[5]?.toLowerCase() || '';
    const h6 = headers[6]?.toLowerCase() || '';
    if ((h0.includes('freq') || h0.includes('hz')) && (h5.includes('z') || h5.includes('re')) && (h6.includes('z') || h6.includes('im'))) {
      fIdx = 0;
      zRealIdx = 5;
      zImagIdx = 6;
      if (headers[4]?.toLowerCase().includes('z')) zMagIdx = 4;
      if (headers[2]?.toLowerCase().includes('phase')) phaseIdx = 2;
    }
  }

  // Fallback positional mapping for standard 3-column EIS exports (mineral, lab potentiostat, headerless data, etc.)
  if (fIdx === -1 || (zRealIdx === -1 && zImagIdx === -1 && zMagIdx === -1 && (cpIdx === -1 || rpIdx === -1))) {
    const colCount = headers.length > 0 ? headers.length : (rows[0]?.length || 0);
    if (colCount >= 3) {
      if (fIdx === -1) fIdx = 0;
      if (zRealIdx === -1) zRealIdx = 1;
      if (zImagIdx === -1) zImagIdx = 2;
    }
  }

  const points: EISPoint[] = [];

  for (const row of rows) {
    if (row.length === 0) continue;

    const parseNum = (idx: number): number | undefined => {
      if (idx < 0 || idx >= row.length) return undefined;
      let str = row[idx].trim().replace(/^["']|["']$/g, '');
      // Handle scientific notation with comma: e.g. "5,0e-6" -> "5.0e-6"
      str = str.replace(',', '.');
      const val = parseFloat(str);
      return isNaN(val) ? undefined : val;
    };

    const freq = fIdx !== -1 ? parseNum(fIdx) : undefined;
    if (freq === undefined || freq <= 0) continue;

    const omega = 2 * Math.PI * freq;
    let zReal: number | undefined = zRealIdx !== -1 ? parseNum(zRealIdx) : undefined;
    let zImag: number | undefined = zImagIdx !== -1 ? parseNum(zImagIdx) : undefined;
    let zMag: number | undefined = zMagIdx !== -1 ? parseNum(zMagIdx) : undefined;
    let phaseDeg: number | undefined = phaseIdx !== -1 ? parseNum(phaseIdx) : undefined;
    let cp: number | undefined = cpIdx !== -1 ? parseNum(cpIdx) : undefined;
    let rp: number | undefined = rpIdx !== -1 ? parseNum(rpIdx) : undefined;

    // Case 1: phobos EIS style with Cp & Rp
    if (cp !== undefined && rp !== undefined && (zReal === undefined || zImag === undefined)) {
      const g = 1 / Math.max(rp, 1e-9);
      const b = omega * cp;
      const denom = g * g + b * b;
      if (denom > 0) {
        zReal = g / denom;
        zImag = -b / denom;
        zMag = Math.sqrt(zReal * zReal + zImag * zImag);
        phaseDeg = (Math.atan2(zImag, zReal) * 180) / Math.PI;
      }
    }

    // Case 2: Chemistry EIS with |Z| and Phase
    if (zMag !== undefined && phaseDeg !== undefined && (zReal === undefined || zImag === undefined)) {
      const rad = (phaseDeg * Math.PI) / 180;
      zReal = zMag * Math.cos(rad);
      zImag = zMag * Math.sin(rad);
    }

    // Case 3: Chemistry EIS with ZReal and ZImag
    if (zReal !== undefined && zImag !== undefined) {
      // In chemistry EIS, capacitive reactance is negative: Z = Z' - j*Z''
      // Many instruments export -Z'' as a positive number.
      let trueImag = zImag;
      const headerText = zImagIdx >= 0 ? headers[zImagIdx].toLowerCase() : '';
      if (headerText.includes("-z''") || headerText.includes('-zim')) {
        // file_utils.py: self.Z_imag = -eis_data[:, 6]
        trueImag = -zImag;
      } else if (trueImag > 0 && Math.abs(phaseDeg ?? -45) < 0) {
        trueImag = -Math.abs(trueImag);
      }

      if (zMag === undefined) {
        zMag = Math.sqrt(zReal * zReal + trueImag * trueImag);
      }
      if (phaseDeg === undefined) {
        phaseDeg = (Math.atan2(trueImag, zReal) * 180) / Math.PI;
      }

      // Compute Cp & Rp if not given
      if (cp === undefined || rp === undefined) {
        const denom = zReal * zReal + trueImag * trueImag;
        if (denom > 0) {
          const g = zReal / denom;
          const b = -trueImag / denom;
          rp = g !== 0 ? 1 / g : undefined;
          cp = omega > 0 ? b / omega : undefined;
        }
      }

      let epsReal: number | undefined;
      let epsImag: number | undefined;
      let sigmaReal: number | undefined;

      const c0 = options.c0 && options.c0 > 0 ? options.c0 : undefined;
      if (c0 && cp !== undefined && rp !== undefined) {
        epsReal = cp / c0;
        epsImag = 1 / (omega * rp * c0);
        sigmaReal = omega * VACUUM_PERMITTIVITY * epsImag;
      }

      points.push({
        freq,
        omega,
        zReal,
        zImag: trueImag,
        zImagNeg: -trueImag,
        zMag,
        phaseDeg,
        cp,
        rp,
        epsReal,
        epsImag,
        sigmaReal,
      });
    }
  }

  // Sort by frequency
  return points.sort((a, b) => a.freq - b.freq);
}

/**
 * Handles PHOBOS Swept Multielectrode acquisition files (matching SpectroscopyData in PHOBOS_Zfit).
 */
function parsePhobosMultiSweep(
  headers: string[],
  rows: string[][],
  options: ParseOptions
): EISPoint[] {
  // Extract frequency columns
  const freqMap = new Map<number, { cpIdx?: number; rpIdx?: number }>();
  headers.forEach((h, idx) => {
    const match = h.match(/([\d.]+)\s*(Cp|Rp)/i);
    if (match) {
      const f = parseFloat(match[1]);
      const kind = match[2].toLowerCase();
      const entry = freqMap.get(f) || {};
      if (kind === 'cp') entry.cpIdx = idx;
      if (kind === 'rp') entry.rpIdx = idx;
      freqMap.set(f, entry);
    }
  });

  const sortedFreqs = Array.from(freqMap.keys()).sort((a, b) => a - b);
  const points: EISPoint[] = [];

  for (const f of sortedFreqs) {
    const { cpIdx, rpIdx } = freqMap.get(f)!;
    if (cpIdx === undefined || rpIdx === undefined) continue;

    // Average across rows (or take first row)
    let sumCp = 0;
    let sumRp = 0;
    let validCount = 0;

    for (const r of rows) {
      const cpVal = parseFloat(r[cpIdx]?.replace(',', '.') || '');
      const rpVal = parseFloat(r[rpIdx]?.replace(',', '.') || '');
      if (!isNaN(cpVal) && !isNaN(rpVal) && rpVal > 0) {
        sumCp += cpVal;
        sumRp += rpVal;
        validCount++;
      }
    }

    if (validCount === 0) continue;
    const cp = sumCp / validCount;
    const rp = sumRp / validCount;
    const omega = 2 * Math.PI * f;

    // Parallel RC admittance -> impedance
    const g = 1 / rp;
    const b = omega * cp;
    const denom = g * g + b * b;
    if (denom <= 0) continue;

    const zReal = g / denom;
    const zImag = -b / denom;
    const zMag = Math.sqrt(zReal * zReal + zImag * zImag);
    const phaseDeg = (Math.atan2(zImag, zReal) * 180) / Math.PI;

    points.push({
      freq: f,
      omega,
      zReal,
      zImag,
      zImagNeg: -zImag,
      zMag,
      phaseDeg,
      cp,
      rp,
    });
  }

  return points;
}

export function parseEISFile(
  filename: string,
  content: string | ArrayBuffer,
  options: ParseOptions
): EISDataset {
  let headers: string[] = [];
  let rows: string[][] = [];

  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    if (typeof content === 'string') {
      throw new Error('Excel files must be parsed from binary buffer');
    }
    const parsed = parseExcelBuffer(content);
    headers = parsed.headers;
    rows = parsed.rows;
  } else {
    // Auto-decode UTF-16LE, UTF-16BE or UTF-8
    const text = typeof content === 'string' ? content : decodeBufferToText(content);
    const parsed = parseCSVText(text);
    headers = parsed.headers;
    rows = parsed.rows;
  }

  const points = buildEISPoints(headers, rows, options);
  if (points.length === 0) {
    throw new Error(
      `Could not detect valid frequency and impedance columns in "${filename}". Please check file format.`
    );
  }

  const colorPalettes = [
    '#06b6d4', // laser cyan
    '#f59e0b', // amber
    '#10b981', // emerald
    '#a855f7', // purple
    '#3b82f6', // cobalt blue
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
  ];
  const randomColor = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];

  return {
    id: `dataset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: options.customName || filename.replace(/\.[^/.]+$/, ''),
    originalFilename: filename,
    color: randomColor,
    visible: true,
    points,
    style: options.style,
    c0: options.c0,
    cellConstant: options.cellConstant,
  };
}

export function generateSampleDatasets(): EISDataset[] {
  // 1. Chemistry EIS: Lithium battery anode at 50% SoC
  const chemFreqs: number[] = [];
  for (let p = 5; p >= -2; p -= 0.1) {
    chemFreqs.push(Math.pow(10, p));
  }
  const chemPoints: EISPoint[] = chemFreqs.map((f) => {
    const w = 2 * Math.PI * f;
    const rs = 1.8;
    const rsei = 8.5;
    const csei = 1.5e-5;
    const rct = 32.0;
    const cdl = 4.2e-4;
    const aw = 18.0;

    // Rs + (Rsei // Csei) + (Rct // Cdl) + Warburg
    // Rsei // Csei
    const d1 = 1 + Math.pow(w * rsei * csei, 2);
    const z1_re = rsei / d1;
    const z1_im = -(w * rsei * rsei * csei) / d1;

    // Rct // Cdl
    const d2 = 1 + Math.pow(w * rct * cdl, 2);
    const z2_re = rct / d2;
    const z2_im = -(w * rct * rct * cdl) / d2;

    // Warburg
    const zw_re = aw / Math.sqrt(w);
    const zw_im = -aw / Math.sqrt(w);

    // Add tiny experimental noise
    const noiseRe = (Math.random() - 0.5) * 0.08;
    const noiseIm = (Math.random() - 0.5) * 0.08;

    const zReal = rs + z1_re + z2_re + zw_re + noiseRe;
    const zImag = z1_im + z2_im + zw_im + noiseIm;
    const zMag = Math.sqrt(zReal * zReal + zImag * zImag);
    const phaseDeg = (Math.atan2(zImag, zReal) * 180) / Math.PI;

    return {
      freq: f,
      omega: w,
      zReal,
      zImag,
      zImagNeg: -zImag,
      zMag,
      phaseDeg,
      rp: zReal > 0 ? (zReal * zReal + zImag * zImag) / zReal : undefined,
      cp: zImag < 0 ? -zImag / (w * (zReal * zReal + zImag * zImag)) : undefined,
    };
  });

  // 2. phobos EIS: BaTiO3 Electroceramic Dielectric Sample
  const elecFreqs: number[] = [];
  for (let p = 6; p >= 1; p -= 0.1) {
    elecFreqs.push(Math.pow(10, p));
  }
  const c0_air = 2.5e-11; // 25 pF geometric air capacitance
  const elecPoints: EISPoint[] = elecFreqs.map((f) => {
    const w = 2 * Math.PI * f;
    const rBulk = 45000;
    const cBulk = 8.5e-9;
    const d = 1 + Math.pow(w * rBulk * cBulk, 2);
    const zReal = 15 + rBulk / d + (Math.random() - 0.5) * 5;
    const zImag = -(w * rBulk * rBulk * cBulk) / d + (Math.random() - 0.5) * 5;
    const zMag = Math.sqrt(zReal * zReal + zImag * zImag);
    const phaseDeg = (Math.atan2(zImag, zReal) * 180) / Math.PI;

    const denom = zReal * zReal + zImag * zImag;
    const g = zReal / denom;
    const b = -zImag / denom;
    const rp = 1 / g;
    const cp = b / w;
    const epsReal = cp / c0_air;
    const epsImag = 1 / (w * rp * c0_air);

    return {
      freq: f,
      omega: w,
      zReal,
      zImag,
      zImagNeg: -zImag,
      zMag,
      phaseDeg,
      cp,
      rp,
      epsReal,
      epsImag,
      sigmaReal: w * VACUUM_PERMITTIVITY * epsImag,
    };
  });

  return [
    {
      id: 'sample_chem_01',
      name: 'Li-ion Battery EIS (Chemistry)',
      originalFilename: 'battery_anode_50pct_soc.csv',
      color: '#06b6d4',
      visible: true,
      points: chemPoints,
      style: 'chemistry',
      description: 'Standard Li-ion battery full spectrum with SEI formation and diffusion tail.',
    },
    {
      id: 'sample_elec_02',
      name: 'BaTiO3 Ceramic (phobos EIS)',
      originalFilename: 'batio3_dielectric_roomtemp.csv',
      color: '#f59e0b',
      visible: true,
      points: elecPoints,
      style: 'electrical',
      c0: c0_air,
      description: 'Electroceramic dielectric relaxation with Cp, Rp, and permittivity curves.',
    },
  ];
}
