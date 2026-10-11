import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Sliders,
  CheckCircle2,
  HelpCircle,
  FolderOpen,
  Sparkles,
  GitBranch,
  TrendingUp,
  Waves,
  Workflow,
} from 'lucide-react';
import { NyquistCurveIcon, CircuitMockupIcon } from './components/icons/CustomIcons';
import { Navbar, AppTabType } from './components/Navbar';
import { SimulationTab } from './components/tabs/SimulationTab';
import { DataVizTab } from './components/tabs/DataVizTab';
import { LinKKTab } from './components/tabs/LinKKTab';
import { FittingTab } from './components/tabs/FittingTab';
import { SensitivityTab } from './components/tabs/SensitivityTab';
import { DRTTab } from './components/tabs/DRTTab';
import { CircuitBuilderModal } from './components/CircuitBuilderModal';
import { HelpModal } from './components/HelpModal';
import { AboutModal } from './components/AboutModal';
import { CircuitElement, EISDataset, PresetCircuit } from './types/impedance';
import { PRESET_CIRCUITS } from './utils/circuitEngine';
import { generateSampleDatasets } from './utils/fileParser';
import { checkBackendHealth } from './services/apiService';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTabType>('simulation');
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    checkBackendHealth().then((res) => {
      if (mounted) {
        setIsBackendOnline(res.online);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Shared state: Active Circuit Expression & Elements
  const defaultPreset = PRESET_CIRCUITS[0]; // Randles
  const [currentExpression, setCurrentExpression] = useState<string>(defaultPreset.expression);
  const [currentElements, setCurrentElements] = useState<CircuitElement[]>(defaultPreset.defaultElements);
  const [customPresets, setCustomPresets] = useState<PresetCircuit[]>(PRESET_CIRCUITS);

  // Shared state: Experimental Datasets - startup begins empty without pre-loading example data
  const [datasets, setDatasets] = useState<EISDataset[]>([]);

  // Modal states
  const [isBuilderOpen, setIsBuilderOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);

  // Circuit builder handlers
  const handleApplyCircuit = (newExpression: string, newElements: CircuitElement[]) => {
    setCurrentExpression(newExpression);
    setCurrentElements(newElements);
  };

  const handleSavePreset = (newPreset: PresetCircuit) => {
    setCustomPresets((prev) => [newPreset, ...prev]);
  };

  const handleSelectPreset = (preset: PresetCircuit) => {
    setCurrentExpression(preset.expression);
    setCurrentElements([...preset.defaultElements]);
  };

  const handleUpdateElement = (id: string, updates: Partial<CircuitElement>) => {
    setCurrentElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
    );
  };

  const handleLoadSamples = () => {
    setDatasets(generateSampleDatasets());
  };

  const TABS_CONFIG = [
    {
      id: 'simulation',
      title: 'Z Simulation',
      desc: 'Mount electrical circuits & simulate spectra',
      icon: NyquistCurveIcon,
    },
    {
      id: 'dataviz',
      title: 'Data Visualization',
      desc: 'Import & inspect 2D/3D experimental EIS data',
      icon: BarChart3,
    },
    {
      id: 'linkk',
      title: 'Lin-KK Test',
      desc: 'Linear Kramers-Kronig data validation',
      icon: Activity,
    },
    {
      id: 'fitting',
      title: 'Circuit Fitting',
      desc: 'Multi-algorithm ECM parameter optimization',
      icon: CircuitMockupIcon,
    },
    {
      id: 'sensitivity',
      title: 'Sensitivity & Bias',
      desc: 'Parametric gradients & DC bias drift analysis',
      icon: TrendingUp,
    },
    {
      id: 'drt',
      title: 'DRT Analysis',
      desc: 'Distribution of Relaxation Times deconvolution',
      icon: Waves,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Bar following Top Bar Contract */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenHelp={() => setIsHelpOpen(true)}
        onLoadSamples={handleLoadSamples}
      />

      {/* Main Layout: Left Tab Sidebar + Right Page Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Tab Selections Sidebar */}
        <aside className="w-64 bg-[#0c101a] border-r border-slate-800/80 flex flex-col justify-between p-4 shrink-0 hidden md:flex select-none">
          <div className="flex flex-col gap-1.5 overflow-y-auto pr-0.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-3 py-1">
              Modules & Workbenches
            </div>

            {TABS_CONFIG.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left p-2.5 rounded-lg transition-colors flex items-start gap-3 border cursor-pointer ${
                    isActive
                      ? 'bg-[#151c2d] border-cyan-500/40 text-white'
                      : 'bg-transparent border-transparent hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div
                    className={`p-2 rounded-md mt-0.5 shrink-0 ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-400'
                        : 'bg-slate-800/60 text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold ${isActive ? 'text-cyan-300' : 'text-slate-200'}`}>
                      {tab.title}
                    </div>
                    <div className="text-[11px] text-slate-400 leading-snug truncate mt-0.5">
                      {tab.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom Left Control Area: About Button + Laboratory Card */}
          <div className="flex flex-col gap-2 pt-3 border-t border-slate-800/80">
            {/* About Button on the bottom left */}
            <button
              onClick={() => setIsAboutOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#101726] hover:bg-[#162035] border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 transition-all cursor-pointer group shadow-sm"
              title="About PHOBOS Zfit architecture & web service"
            >
              <Workflow className="w-4 h-4 text-cyan-400 group-hover:rotate-12 transition-transform" />
              <span className="text-xs font-bold tracking-wide">About</span>
            </button>

            {/* Institutional Attribution Footer */}
            <div className="p-2.5 bg-[#0f1422] border border-slate-800/80 rounded-lg flex flex-col gap-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                  Laboratory
                </div>
                <div className={`flex items-center gap-1.5 text-[10px] font-mono ${
                  isBackendOnline === true
                    ? 'text-emerald-400'
                    : isBackendOnline === false
                    ? 'text-cyan-400'
                    : 'text-slate-400'
                }`}>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isBackendOnline === true
                        ? 'bg-emerald-400 animate-pulse'
                        : isBackendOnline === false
                        ? 'bg-cyan-400'
                        : 'bg-slate-500 animate-pulse'
                    }`}
                  />
                  <span>
                    {isBackendOnline === true
                      ? 'Render Online'
                      : isBackendOnline === false
                      ? 'Core Standby'
                      : 'Connecting...'}
                  </span>
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-200 tracking-tight">
                Powered by LASII - NUEM - UTFPR
              </div>
              <div className="text-[10px] text-slate-500 leading-tight">
                Hybrid Architecture • Python Flask & High-Precision Core
              </div>
            </div>
          </div>
        </aside>

        {/* Right Dynamic Page Viewport */}
        <main className="flex-1 overflow-y-auto bg-grid-pattern flex flex-col">
          {activeTab === 'simulation' && (
            <SimulationTab
              currentExpression={currentExpression}
              currentElements={currentElements}
              onOpenCircuitBuilder={() => setIsBuilderOpen(true)}
              onSelectPreset={handleSelectPreset}
              onUpdateElement={handleUpdateElement}
            />
          )}

          {activeTab === 'dataviz' && (
            <DataVizTab
              datasets={datasets}
              setDatasets={setDatasets}
              onOpenHelp={() => setIsHelpOpen(true)}
              onLoadSamples={handleLoadSamples}
              onGoToLinKK={() => setActiveTab('linkk')}
              onGoToFitting={() => setActiveTab('fitting')}
            />
          )}

          {activeTab === 'linkk' && (
            <LinKKTab
              datasets={datasets}
              setDatasets={setDatasets}
              onOpenHelp={() => setIsHelpOpen(true)}
              onLoadSamples={handleLoadSamples}
            />
          )}

          {activeTab === 'fitting' && (
            <FittingTab
              currentExpression={currentExpression}
              currentElements={currentElements}
              datasets={datasets}
              setDatasets={setDatasets}
              onOpenCircuitBuilder={() => setIsBuilderOpen(true)}
              onUpdateElement={handleUpdateElement}
              onLoadSamples={handleLoadSamples}
              onOpenHelp={() => setIsHelpOpen(true)}
            />
          )}

          {activeTab === 'sensitivity' && (
            <SensitivityTab datasets={datasets} />
          )}

          {activeTab === 'drt' && (
            <DRTTab datasets={datasets} />
          )}
        </main>
      </div>

      {/* Circuit Builder Popup Modal */}
      <CircuitBuilderModal
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        currentExpression={currentExpression}
        currentElements={currentElements}
        onApplyCircuit={handleApplyCircuit}
        onSavePreset={handleSavePreset}
      />

      {/* Specifications & File Format Guide Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* About Architecture & Flowchart Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        isBackendOnline={isBackendOnline}
      />
    </div>
  );
}
