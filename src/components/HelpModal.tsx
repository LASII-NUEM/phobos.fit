import React from 'react';
import { X, FileSpreadsheet, Cpu, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-[#0d111a] border border-slate-800 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#111624]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                PHOBOS Zfit Specifications & File Format Guide
              </h2>
              <span className="text-[11px] text-slate-400">
                Electrochemical Impedance Spectroscopy (EIS) Data Structure
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Privacy & Local Processing Notice */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-200 mb-0.5">
                Strict Local Processing Guarantee
              </div>
              <div className="text-[11px] text-slate-400 leading-relaxed">
                All data parsing, impedance simulation, Lin-KK tests, and ECM fitting run 100% locally in your browser memory. No experimental files or sensitive measurement data are transmitted externally.
              </div>
            </div>
          </div>

          {/* Section 1: Chemistry EIS Data Structure */}
          <div>
            <h3 className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-1.5">
              <span>01. Chemistry EIS File Structure (.csv or .xlsx)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mb-2">
              Chemistry EIS files contain frequency and either Cartesian coordinates (Real & Imaginary) or polar coordinates (Magnitude & Phase).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
              <div className="p-3 bg-[#06090f] border border-slate-800 rounded-lg">
                <div className="text-slate-400 font-bold mb-1.5 text-[10px] uppercase">
                  Option A: Cartesian (Z' and -Z'')
                </div>
                <pre className="text-cyan-400">
{`Freq(Hz),Z_real(ohm),Z_imag(ohm)
100000, 105.2, -12.4
10000,  128.5, -45.1
1000,   180.2, -92.6
100,    240.1, -140.8
10,     310.4, -180.3
1,      390.6, -210.5`}
                </pre>
              </div>

              <div className="p-3 bg-[#06090f] border border-slate-800 rounded-lg">
                <div className="text-slate-400 font-bold mb-1.5 text-[10px] uppercase">
                  Option B: Polar (|Z| and Phase)
                </div>
                <pre className="text-amber-400">
{`Freq(Hz),Z_mag(ohm),Phase(deg)
100000, 105.9, -6.7
10000,  136.2, -19.3
1000,   202.5, -27.2
100,    278.4, -30.4
10,     359.1, -30.1
1,      443.5, -28.3`}
                </pre>
              </div>
            </div>
          </div>

          {/* Section 2: phobos EIS Data Structure */}
          <div>
            <h3 className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-1.5">
              <span>02. phobos EIS File Structure (.csv)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mb-2">
              phobos impedance spectroscopy files measure equivalent parallel capacitance (<code className="text-cyan-400 font-mono">Cp</code>) and resistance (<code className="text-cyan-400 font-mono">Rp</code>).
            </p>

            <div className="p-3 bg-[#06090f] border border-slate-800 rounded-lg font-mono text-[11px]">
              <div className="text-slate-400 font-bold mb-1.5 text-[10px] uppercase">
                Format: Freq, Cp, Rp
              </div>
              <pre className="text-emerald-400">
{`Freq(Hz),Cp(F),Rp(ohm)
100000, 8.24e-10, 42000
10000,  8.55e-10, 45200
1000,   8.80e-10, 48100
100,    9.10e-10, 50200`}
              </pre>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 leading-relaxed">
              Impedance is automatically computed via admittance relations: <span className="font-mono text-slate-200">Y = 1/Rp + j·ω·Cp</span>, allowing full Nyquist, Bode, and 3D plotting. Supplying reference air capacitance <span className="font-mono text-cyan-400">C0</span> calculates dielectric permittivity <span className="font-mono text-cyan-400">ε' = Cp / C0</span> and conductivity <span className="font-mono text-cyan-400">σ'</span>.
            </div>
          </div>

          {/* Section 3: Equivalent Circuit Syntax */}
          <div>
            <h3 className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-1.5">
              <span>03. Circuit Syntax (ECM_utils.CircuitParams)</span>
            </h3>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-cyan-400 font-bold">+</span>
                <span>Series connection, e.g. <code className="font-mono text-slate-200">Rs + Rct</code></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-amber-400 font-bold">//</span>
                <span>Parallel connection, e.g. <code className="font-mono text-slate-200">(Rct // Cdl)</code></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-emerald-400 font-bold">((C+R) // R)</span>
                <span>User specification parallel branch template</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-purple-400 font-bold">CPE</span>
                <span>Constant Phase Element with non-ideal exponent <code className="font-mono text-slate-200">α (0 &lt; α ≤ 1)</code></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-cyan-400 font-bold">W</span>
                <span>Warburg diffusion impedance (<code className="font-mono text-slate-200">Aw / √ω · (1 - j)</code>)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#0f1422] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
