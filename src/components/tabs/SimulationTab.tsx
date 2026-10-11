import React, { useEffect, useMemo, useState } from 'react';
import {
  Layers,
  Sliders,
  Settings2,
  Download,
  Plus,
  RotateCcw,
  Sparkles,
  BarChart3,
  List,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { NyquistCurveIcon } from '../icons/CustomIcons';
import { CircuitElement, EISPoint, PlotType, PresetCircuit } from '../../types/impedance';
import { generateFrequencyList, PRESET_CIRCUITS, simulateCircuit, DEFAULT_SCALES, formatEngineering } from '../../utils/circuitEngine';
import { SubplotGrid } from '../SubplotGrid';

interface EngineeringParamInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
}

const EngineeringParamInput: React.FC<EngineeringParamInputProps> = ({ value, onChange, className }) => {
  const [localText, setLocalText] = useState<string>(() => formatEngineering(value));
  const [isFocused, setIsFocused] = useState<boolean>(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalText(formatEngineering(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setLocalText(text);

    const clean = text.trim().replace(',', '.');
    const parsed = parseFloat(clean);
    if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const clean = localText.trim().replace(',', '.');
    const parsed = parseFloat(clean);
    if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
      onChange(parsed);
      setLocalText(formatEngineering(parsed));
    } else {
      setLocalText(formatEngineering(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text"
      value={localText}
      onFocus={() => setIsFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder="1e-3"
      title="Engineering style parameter (e.g. 1e-3, 10e-6, 100)"
      spellCheck={false}
    />
  );
};

interface SimulationTabProps {
  currentExpression: string;
  currentElements: CircuitElement[];
  onOpenCircuitBuilder: () => void;
  onSelectPreset: (preset: PresetCircuit) => void;
  onUpdateElement: (id: string, updates: Partial<CircuitElement>) => void;
}

export const SimulationTab: React.FC<SimulationTabProps> = ({
  currentExpression,
  currentElements,
  onOpenCircuitBuilder,
  onSelectPreset,
  onUpdateElement,
}) => {
  const [isControlsCollapsed, setIsControlsCollapsed] = useState<boolean>(false);

  // Frequency spectrum parameters
  const [fMin, setFMin] = useState<number>(0.01);
  const [fMax, setFMax] = useState<number>(100000);
  const [pointsCount, setPointsCount] = useState<number>(60);
  const [freqMode, setFreqMode] = useState<'log' | 'linear' | 'manual'>('log');
  const [manualFreqText, setManualFreqText] = useState<string>('100000, 10000, 1000, 100, 10, 1, 0.1, 0.01');

  // Frequency generation
  const frequencies = useMemo(() => {
    if (freqMode === 'manual') {
      const parts = manualFreqText.split(/[\s,;]+/).map((s) => parseFloat(s)).filter((n) => !isNaN(n) && n > 0);
      return parts.length > 0 ? parts.sort((a, b) => b - a) : [1000, 100, 10, 1, 0.1];
    }
    return generateFrequencyList(fMin, fMax, pointsCount, freqMode === 'log');
  }, [fMin, fMax, pointsCount, freqMode, manualFreqText]);

  // Simulate impedance points
  const simulatedPoints: EISPoint[] = useMemo(() => {
    const paramsMap: Record<string, number> = {};
    const alphasMap: Record<string, number> = {};

    currentElements.forEach((el) => {
      paramsMap[el.label] = el.value;
      if (el.type === 'CPE' && el.alpha !== undefined) {
        alphasMap[el.label] = el.alpha;
      }
    });

    try {
      return simulateCircuit(currentExpression, paramsMap, frequencies, alphasMap);
    } catch {
      return [];
    }
  }, [currentExpression, currentElements, frequencies]);

  const simulatedDataset = useMemo(() => {
    return {
      id: 'simulated_circuit_dataset',
      name: `Sim: ${currentExpression}`,
      color: '#06b6d4',
      points: simulatedPoints,
    };
  }, [currentExpression, simulatedPoints]);

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 gap-5 max-w-[1920px] mx-auto w-full">
      {/* Circuit Definition & Formula Bar */}
      <div className="bg-[#0d111a] border border-slate-800 rounded-lg p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-cyan-400 shrink-0">
            <NyquistCurveIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Active Equivalent Circuit Model (ECM)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700 font-mono">
                {currentElements.length} elements
              </span>
            </div>
            <div className="text-lg font-mono font-bold text-cyan-400 tracking-wide mt-0.5">
              {currentExpression}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Preset quick picker */}
          <select
            onChange={(e) => {
              const p = PRESET_CIRCUITS.find((item) => item.id === e.target.value);
              if (p) onSelectPreset(p);
            }}
            className="px-3 py-2 bg-[#090d16] border border-slate-700 rounded-lg text-xs font-medium text-slate-300 focus:outline-none focus:border-cyan-400"
            defaultValue=""
          >
            <option value="" disabled>Load Preset Circuit...</option>
            {PRESET_CIRCUITS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>

          <button
            onClick={onOpenCircuitBuilder}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap"
          >
            <Layers className="w-4 h-4" />
            <span>Mount Circuit</span>
          </button>

          {/* Toggle controls to maximize chart space */}
          <button
            onClick={() => setIsControlsCollapsed((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              isControlsCollapsed
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 hover:bg-cyan-500/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700'
            }`}
            title={isControlsCollapsed ? 'Show parameter panel' : 'Hide parameters & maximize chart space'}
          >
            {isControlsCollapsed ? (
              <>
                <PanelLeftOpen className="w-4 h-4 text-cyan-400" />
                <span>Show Controls</span>
              </>
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 text-slate-400" />
                <span>Maximize Plot</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Left Controls (Spectrum & Element Sliders) & Right Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        {/* Left Column: Frequency Spectrum & Live Element Sliders */}
        {!isControlsCollapsed && (
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-5">
            {/* Frequency Spectrum Card */}
            <div className="bg-[#0d111a] border border-slate-800 rounded-lg p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Frequency Spectrum</span>
                </span>

                {/* Mode segmented control */}
                <div className="flex items-center p-0.5 bg-[#090d16] rounded-md border border-slate-800 text-[11px] font-mono">
                  <button
                    onClick={() => setFreqMode('log')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      freqMode === 'log' ? 'bg-cyan-500/20 text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Log
                  </button>
                  <button
                    onClick={() => setFreqMode('linear')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      freqMode === 'linear' ? 'bg-cyan-500/20 text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Lin
                  </button>
                  <button
                    onClick={() => setFreqMode('manual')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      freqMode === 'manual' ? 'bg-cyan-500/20 text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {freqMode !== 'manual' ? (
                <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase mb-1">
                      f_init (Hz)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fMin}
                      onChange={(e) => setFMin(parseFloat(e.target.value) || 0.01)}
                      className="w-full px-2 py-1 bg-[#090d16] border border-slate-700/80 rounded text-slate-200 tabular-nums focus:outline-none focus:border-cyan-400 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase mb-1">
                      f_stop (Hz)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={fMax}
                      onChange={(e) => setFMax(parseFloat(e.target.value) || 100000)}
                      className="w-full px-2 py-1 bg-[#090d16] border border-slate-700/80 rounded text-slate-200 tabular-nums focus:outline-none focus:border-cyan-400 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase mb-1">
                      Samples
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="500"
                      value={pointsCount}
                      onChange={(e) => setPointsCount(parseInt(e.target.value) || 50)}
                      className="w-full px-2 py-1 bg-[#090d16] border border-slate-700/80 rounded text-slate-200 tabular-nums focus:outline-none focus:border-cyan-400 text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">
                    Comma-separated Frequency List (Hz)
                  </label>
                  <textarea
                    value={manualFreqText}
                    onChange={(e) => setManualFreqText(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-[#090d16] border border-slate-700/80 rounded text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
                <span>Steps: {frequencies.length}</span>
                <span>{frequencies[0]?.toExponential(1)} Hz → {frequencies[frequencies.length - 1]?.toExponential(1)} Hz</span>
              </div>
            </div>

            {/* Circuit Components Interactive Parameter Panel */}
            <div className="bg-[#0d111a] border border-slate-800 rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Element Parameters</span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">Live Simulation</span>
              </div>

              <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-1">
                {currentElements.map((el) => (
                  <div
                    key={el.id}
                    className="p-3 bg-[#0a0d14] border border-slate-800 rounded-lg flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-cyan-400">
                          {el.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({el.type}{DEFAULT_SCALES[el.type]?.unit ? ` · ${DEFAULT_SCALES[el.type].unit}` : ''})
                        </span>
                      </div>
                      <EngineeringParamInput
                        value={el.value}
                        onChange={(val) => onUpdateElement(el.id, { value: val })}
                        className="w-28 px-2 py-0.5 bg-[#0d111a] border border-slate-700 rounded text-xs font-mono text-right text-slate-200 tabular-nums focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    {/* Range scrubber slider */}
                    <input
                      type="range"
                      min={Math.log10(Math.max(el.minBound, 1e-12))}
                      max={Math.log10(Math.max(el.maxBound, 1e4))}
                      step="0.05"
                      value={Math.log10(Math.max(el.value, 1e-15))}
                      onChange={(e) => {
                        const logV = parseFloat(e.target.value);
                        const rawVal = Math.pow(10, logV);
                        const cleanVal = parseFloat(rawVal.toPrecision(3));
                        onUpdateElement(el.id, { value: cleanVal });
                      }}
                      className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
                    />

                    {el.type === 'CPE' && (
                      <div className="flex items-center justify-between text-xs font-mono text-amber-400 pt-1">
                        <span>CPE Exponent α (0.1 - 1.0):</span>
                        <input
                          type="number"
                          min="0.1"
                          max="1.0"
                          step="0.01"
                          value={el.alpha ?? 1.0}
                          onChange={(e) =>
                            onUpdateElement(el.id, { alpha: parseFloat(e.target.value) || 1.0 })
                          }
                          className="w-16 px-1.5 py-0.5 bg-[#0d111a] border border-slate-700 rounded text-amber-400 text-right tabular-nums text-xs"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Right Column: SubplotGrid Viewport */}
        <div className={`${isControlsCollapsed ? 'col-span-12' : 'lg:col-span-8 xl:col-span-9'} flex flex-col gap-4 w-full transition-all`}>
          <SubplotGrid
            datasets={[simulatedDataset]}
            initialSubplots={[
              {
                id: 'sub_sim_1',
                title: "Nyquist Complex Plane ( -Z'' vs Z' )",
                plotType: 'nyquist',
                logScale: true,
                aspectEqual: true,
                colSpan: 1,
              },
              {
                id: 'sub_sim_2',
                title: 'Bode Magnitude ( |Z| vs f )',
                plotType: 'bode_mag',
                logScale: true,
                aspectEqual: false,
                colSpan: 1,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
};
