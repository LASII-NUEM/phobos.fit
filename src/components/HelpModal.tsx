import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  FileText,
  Copy,
  Check,
  Table,
  Cpu,
  Layers,
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const chemistryCsvHeader =
    "freq / Hz,Log(f / Hz),neg. Phase / °,Idc / uA,Z / Ohm,Z' / Ohm,-Z'' / Ohm,Y' / S,Y'' / S,Log(Y / S),Cs / F,";

  const chemistryCsvSample = `freq / Hz,Log(f / Hz),neg. Phase / °,Idc / uA,Z / Ohm,Z' / Ohm,-Z'' / Ohm,Y' / S,Y'' / S,Log(Y / S),Cs / F,
100000,5.0000,12.45,0.0125,124.8,121.9,26.9,0.0078,0.0017,-2.099,5.92e-8,
50000,4.6989,18.32,0.0118,152.3,144.6,47.8,0.0062,0.0021,-2.183,6.66e-8,
10000,4.0000,35.18,0.0094,248.5,203.1,143.2,0.0033,0.0023,-2.395,1.11e-7,
1000,3.0000,52.84,0.0041,894.2,539.8,712.3,0.00067,0.00089,-2.951,2.23e-7,
100,2.0000,58.91,0.0012,4120.5,2127.3,3528.1,0.00012,0.00021,-3.615,4.51e-7,
10,1.0000,47.20,0.0003,12450.0,8450.2,9140.7,0.000054,0.000059,-4.095,1.74e-6,`;

  const chemistryXlsxHeader = "freq / Hz\tneg. Phase / °\tZ' / Ohm\tZ'' / Ohm";

  const phobosCsvHeader =
    "unix timestamp / mode / freq1 Cp / freq1 Rp / ..../ freq n Cp / freq n Rp";

  const phobosCsvSample = `timestamp,mode,100000 Cp,100000 Rp,50000 Cp,50000 Rp,10000 Cp,10000 Rp,1000 Cp,1000 Rp,100 Cp,100 Rp,10 Cp,10 Rp
1709283600,swept,8.24e-10,42000,8.38e-10,43100,8.55e-10,45200,8.80e-10,48100,9.10e-10,50200,9.45e-10,51800
1709283660,swept,8.23e-10,42050,8.37e-10,43120,8.54e-10,45230,8.79e-10,48150,9.09e-10,50220,9.44e-10,51850
1709283720,swept,8.22e-10,42100,8.36e-10,43150,8.53e-10,45260,8.78e-10,48190,9.08e-10,50250,9.43e-10,51900`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-4xl max-h-[88vh] flex flex-col bg-[#0b0f19] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0f1422] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>PHOBOS Zfit Specifications & File Format Guide</span>
              </h2>
              <span className="text-[11px] text-slate-400">
                Standard format guidelines for Chemistry EIS (.csv / .xlsx) & Phobos EIS (.csv)
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Close guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Section 1: Chemistry Data Format */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>01. Chemistry Data (.csv & .xlsx)</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-500 uppercase">
                Potentiostat / Autolab Standard
              </span>
            </div>

            {/* 1A: Chemistry .csv */}
            <div className="p-4 bg-[#070a13] border border-slate-800/90 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 rounded">
                    .CSV FORMAT
                  </span>
                  <span className="text-xs font-semibold text-slate-200">
                    Standard Multi-Parameter CSV
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(chemistryCsvHeader, 'chemCsvHeader')}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-cyan-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition-colors cursor-pointer"
                  title="Copy CSV Header"
                >
                  {copiedKey === 'chemCsvHeader' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Header</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed">
                Expected column headers for Chemistry EIS CSV files:
              </div>

              {/* Exact CSV header display */}
              <div className="p-2.5 bg-[#05070c] border border-slate-800 rounded-lg overflow-x-auto">
                <code className="text-cyan-300 font-mono text-[11px] whitespace-nowrap block">
                  {chemistryCsvHeader}
                </code>
              </div>

              {/* Example Data Block */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] uppercase font-mono text-slate-500">
                  <span>Example CSV Content</span>
                  <button
                    onClick={() => handleCopy(chemistryCsvSample, 'chemCsvSample')}
                    className="hover:text-cyan-300 cursor-pointer flex items-center gap-1"
                  >
                    {copiedKey === 'chemCsvSample' ? 'Copied Full Sample' : 'Copy Sample'}
                  </button>
                </div>
                <pre className="p-3 bg-[#05070c] border border-slate-800/80 rounded-lg overflow-x-auto text-[11px] font-mono text-slate-300 leading-relaxed">
                  {chemistryCsvSample}
                </pre>
              </div>

              <div className="text-[10px] font-mono text-slate-500 grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                <div>• <span className="text-slate-400">freq / Hz:</span> Frequency (Hz)</div>
                <div>• <span className="text-slate-400">neg. Phase / °:</span> Negative phase angle (deg)</div>
                <div>• <span className="text-slate-400">Z' / Ohm:</span> Real resistance part $Z'$ (Ω)</div>
                <div>• <span className="text-slate-400">-Z'' / Ohm:</span> Imaginary reactance $-Z''$ (Ω)</div>
                <div>• <span className="text-slate-400">Z / Ohm:</span> Total impedance magnitude $|Z|$ (Ω)</div>
                <div>• <span className="text-slate-400">Y', Y'', Cs:</span> Admittance and series capacitance</div>
              </div>
            </div>

            {/* 1B: Chemistry .xlsx */}
            <div className="p-4 bg-[#070a13] border border-slate-800/90 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 rounded">
                    .XLSX FORMAT
                  </span>
                  <span className="text-xs font-semibold text-slate-200">
                    Excel Spreadsheet Structure
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(chemistryXlsxHeader, 'chemXlsxHeader')}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-emerald-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition-colors cursor-pointer"
                  title="Copy XLSX Columns"
                >
                  {copiedKey === 'chemXlsxHeader' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Columns</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-[11px] text-slate-400">
                In Excel spreadsheets (<code className="text-emerald-400 font-mono">.xlsx</code>), four primary columns define the spectra:
              </div>

              {/* Exact XLSX columns representation */}
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px] border border-slate-800 rounded-lg overflow-hidden">
                  <thead className="bg-[#0e1424] text-emerald-300">
                    <tr>
                      <th className="p-2 border-b border-slate-800">freq / Hz</th>
                      <th className="p-2 border-b border-slate-800">neg. Phase / °</th>
                      <th className="p-2 border-b border-slate-800">Z' / Ohm</th>
                      <th className="p-2 border-b border-slate-800">Z'' / Ohm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 bg-[#05070c]">
                    <tr>
                      <td className="p-2 text-slate-400">100000</td>
                      <td className="p-2">12.45</td>
                      <td className="p-2 text-cyan-300">121.9</td>
                      <td className="p-2 text-amber-300">-26.9</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-slate-400">10000</td>
                      <td className="p-2">35.18</td>
                      <td className="p-2 text-cyan-300">203.1</td>
                      <td className="p-2 text-amber-300">-143.2</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-slate-400">1000</td>
                      <td className="p-2">52.84</td>
                      <td className="p-2 text-cyan-300">539.8</td>
                      <td className="p-2 text-amber-300">-712.3</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-slate-400">100</td>
                      <td className="p-2">58.91</td>
                      <td className="p-2 text-cyan-300">2127.3</td>
                      <td className="p-2 text-amber-300">-3528.1</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-slate-400">10</td>
                      <td className="p-2">47.20</td>
                      <td className="p-2 text-cyan-300">8450.2</td>
                      <td className="p-2 text-amber-300">-9140.7</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 2: Phobos Data Format */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                <Table className="w-4 h-4 text-cyan-400" />
                <span>02. Phobos Data (.csv file)</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-500 uppercase">
                Swept Multielectrode Format
              </span>
            </div>

            <div className="p-4 bg-[#070a13] border border-slate-800/90 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800/50 rounded">
                    PHOBOS MULTI-FREQ CSV
                  </span>
                  <span className="text-xs font-semibold text-slate-200">
                    Timestamp & Multi-Frequency Sweep Array
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(phobosCsvHeader, 'phobosHeader')}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-amber-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition-colors cursor-pointer"
                  title="Copy Phobos Specification"
                >
                  {copiedKey === 'phobosHeader' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Style</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed">
                Phobos impedance hardware exports time-series swept data according to this format:
              </div>

              {/* Exact Phobos format style string */}
              <div className="p-2.5 bg-[#05070c] border border-slate-800 rounded-lg overflow-x-auto">
                <code className="text-amber-300 font-mono text-[11px] whitespace-nowrap block">
                  {phobosCsvHeader}
                </code>
              </div>

              {/* Sample Data */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] uppercase font-mono text-slate-500">
                  <span>Example Multi-Sweep CSV File</span>
                  <button
                    onClick={() => handleCopy(phobosCsvSample, 'phobosSample')}
                    className="hover:text-amber-300 cursor-pointer flex items-center gap-1"
                  >
                    {copiedKey === 'phobosSample' ? 'Copied Full Sample' : 'Copy Sample'}
                  </button>
                </div>
                <pre className="p-3 bg-[#05070c] border border-slate-800/80 rounded-lg overflow-x-auto text-[11px] font-mono text-slate-300 leading-relaxed">
                  {phobosCsvSample}
                </pre>
              </div>

              {/* Physical Calculation Details */}
              <div className="p-3 bg-[#05070c] border border-slate-800/80 rounded-lg space-y-2 text-[11px] text-slate-400">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Automated Admittance & Permittivity Transformation:</span>
                </div>
                <p className="leading-relaxed">
                  For each frequency <span className="font-mono text-cyan-300">f</span>, the complex admittance is reconstructed from equivalent parallel resistance (<span className="font-mono text-cyan-300">Rp</span>) and capacitance (<span className="font-mono text-cyan-300">Cp</span>):
                </p>
                <div className="p-2 bg-[#0a0f1c] rounded font-mono text-cyan-300 text-[11px] text-center border border-slate-800/60">
                  Y = (1 / Rp) + j · ω · Cp &nbsp;&nbsp;⟹&nbsp;&nbsp; Z' = Rp / (1 + (ω·Rp·Cp)²) &nbsp;,&nbsp; Z'' = -(ω·Rp²·Cp) / (1 + (ω·Rp·Cp)²)
                </div>
                <p className="leading-relaxed">
                  If an air reference capacitance <span className="font-mono text-slate-200">C0</span> is specified in the workbench, PHOBOS Zfit also automatically derives relative permittivity <span className="font-mono text-slate-200">ε' = Cp / C0</span>, dielectric loss <span className="font-mono text-slate-200">tan(δ)</span>, and AC conductivity <span className="font-mono text-slate-200">σ'</span>.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Equivalent Circuit Syntax */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>03. Equivalent Circuit Syntax (ECM_utils)</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-500 uppercase">
                Circuit Model Notation
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
              <div className="p-2.5 bg-[#070a13] border border-slate-800 rounded-lg flex items-start gap-2.5">
                <span className="font-mono text-cyan-400 font-bold text-sm bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                  +
                </span>
                <div>
                  <div className="font-semibold text-slate-200">Series Connection</div>
                  <div className="text-slate-400 text-[10px] mt-0.5">e.g. <code className="font-mono text-cyan-300">Rs + Rct</code></div>
                </div>
              </div>

              <div className="p-2.5 bg-[#070a13] border border-slate-800 rounded-lg flex items-start gap-2.5">
                <span className="font-mono text-amber-400 font-bold text-sm bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                  //
                </span>
                <div>
                  <div className="font-semibold text-slate-200">Parallel Connection</div>
                  <div className="text-slate-400 text-[10px] mt-0.5">e.g. <code className="font-mono text-amber-300">(Rct // Cdl)</code></div>
                </div>
              </div>

              <div className="p-2.5 bg-[#070a13] border border-slate-800 rounded-lg flex items-start gap-2.5">
                <span className="font-mono text-purple-400 font-bold text-xs bg-purple-950/60 px-1.5 py-1 rounded border border-purple-800/40">
                  CPE
                </span>
                <div>
                  <div className="font-semibold text-slate-200">Constant Phase Element</div>
                  <div className="text-slate-400 text-[10px] mt-0.5">Non-ideal dispersion: <code className="font-mono text-purple-300">Z_cpe = 1 / [Q·(jω)^α]</code></div>
                </div>
              </div>

              <div className="p-2.5 bg-[#070a13] border border-slate-800 rounded-lg flex items-start gap-2.5">
                <span className="font-mono text-cyan-400 font-bold text-xs bg-cyan-950/60 px-2 py-1 rounded border border-cyan-800/40">
                  W
                </span>
                <div>
                  <div className="font-semibold text-slate-200">Warburg Diffusion</div>
                  <div className="text-slate-400 text-[10px] mt-0.5">Semi-infinite diffusion: <code className="font-mono text-cyan-300">Aw / √ω · (1 - j)</code></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#0f1422] flex justify-between items-center shrink-0">
          <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
            LASII • NUEM • UTFPR • Specifications Guide
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
