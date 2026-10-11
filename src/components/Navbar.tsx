import React from 'react';
import { HelpCircle, BarChart3, Activity, TrendingUp, Waves, FolderOpen } from 'lucide-react';
import { NyquistCurveIcon, CircuitMockupIcon } from './icons/CustomIcons';

export type AppTabType = 'simulation' | 'dataviz' | 'linkk' | 'fitting' | 'sensitivity' | 'drt';

interface NavbarProps {
  activeTab: AppTabType;
  setActiveTab: (tab: AppTabType) => void;
  onOpenHelp: () => void;
  onOpenAbout?: () => void;
  onLoadSamples?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenHelp,
  onLoadSamples,
}) => {
  return (
    <header className="h-14 bg-[#090d16] border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Zone 1: Single text element wordmark in display face */}
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          setActiveTab('simulation');
        }}
        className="text-base font-bold tracking-tight text-white flex items-center gap-1.5 hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
      >
        <span className="text-cyan-400 font-mono text-lg font-extrabold tracking-wider">PHOBOS</span>
        <span className="text-slate-400 font-sans font-medium text-sm">Zfit</span>
      </a>

      {/* Zone 2: Navigation links with specialized scientific icons */}
      <nav className="flex items-center gap-4 lg:gap-6 text-xs font-semibold overflow-x-auto no-scrollbar py-2">
        <button
          onClick={() => setActiveTab('simulation')}
          className={`relative py-1 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'simulation'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <NyquistCurveIcon className="w-4 h-4" />
          <span>Z Simulation</span>
          {activeTab === 'simulation' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('dataviz')}
          className={`relative py-1 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'dataviz'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Data Visualization</span>
          {activeTab === 'dataviz' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('linkk')}
          className={`relative py-1 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'linkk'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Lin-KK Test</span>
          {activeTab === 'linkk' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('fitting')}
          className={`relative py-1 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'fitting'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CircuitMockupIcon className="w-4 h-4" />
          <span>Circuit Fitting</span>
          {activeTab === 'fitting' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('sensitivity')}
          className={`relative py-1 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'sensitivity'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Sensitivity & Bias</span>
          {activeTab === 'sensitivity' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('drt')}
          className={`relative py-1 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'drt'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Waves className="w-3.5 h-3.5" />
          <span>DRT Analysis</span>
          {activeTab === 'drt' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
          )}
        </button>
      </nav>

      {/* Zone 3: Primary action (Example Data & Guide) */}
      <div className="flex items-center gap-2.5 shrink-0 justify-end">
        {onLoadSamples && (
          <button
            onClick={onLoadSamples}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
            title="Load demonstration EIS datasets"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Example Data</span>
          </button>
        )}
        <button
          onClick={onOpenHelp}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Guide</span>
        </button>
      </div>
    </header>
  );
};

