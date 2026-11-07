import React from 'react';
import {
  Activity,
  AlertTriangle,
  Sliders,
  TrendingUp,
  Clock,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { EISDataset } from '../../types/impedance';

interface SensitivityTabProps {
  datasets?: EISDataset[];
}

export const SensitivityTab: React.FC<SensitivityTabProps> = ({ datasets = [] }) => {
  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 gap-6 max-w-[1920px] mx-auto w-full select-none">
      {/* Top Header */}
      <div className="bg-[#0d111a] border border-slate-800 rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Advanced Module
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono font-semibold">
                Under Development
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-100 tracking-wide mt-0.5">
              Sensitivity & Bias Analysis
            </h1>
          </div>
        </div>

        {/* Warning Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
          <Clock className="w-4 h-4 text-amber-400 animate-spin" />
          <span>Coming Soon</span>
        </div>
      </div>

      {/* Main Notice Box */}
      <div className="p-8 rounded-xl bg-[#090d16] border border-amber-500/20 flex flex-col items-center justify-center text-center gap-4 my-auto min-h-[380px]">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-mono tracking-widest px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
            Under Development
          </span>
          <span className="text-xs uppercase font-mono tracking-widest px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold">
            Coming Soon
          </span>
        </div>

        <h2 className="text-xl font-bold text-slate-100 mt-1 max-w-md">
          Sensitivity & Bias Analysis Workbench
        </h2>

        <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
          This module is currently being finalized in the PHOBOS scientific pipeline. 
          It will provide rigorous parametric sensitivity gradients (<span className="font-mono text-cyan-300">∂Z/∂θ</span>), 
          Fisher Information Matrix (FIM) parameter unidentifiability screening, and systematic experimental DC bias/drift error estimation for electrochemical impedance data.
        </p>

        {/* Roadmap Feature Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mt-4 text-left">
          <div className="p-3.5 rounded-lg bg-[#0d1220] border border-slate-800">
            <div className="text-xs font-bold text-slate-200 mb-1">Local & Global Sensitivity</div>
            <div className="text-[11px] text-slate-500 leading-snug">
              Normalized sensitivity coefficients across all frequency decades.
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0d1220] border border-slate-800">
            <div className="text-xs font-bold text-slate-200 mb-1">Parameter Identifiability</div>
            <div className="text-[11px] text-slate-500 leading-snug">
              Hessian conditioning & correlation detection to prevent ECM overfitting.
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0d1220] border border-slate-800">
            <div className="text-xs font-bold text-slate-200 mb-1">DC Bias & Drift Metrics</div>
            <div className="text-[11px] text-slate-500 leading-snug">
              Non-stationary baseline shift compensation for dynamic battery cells.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
