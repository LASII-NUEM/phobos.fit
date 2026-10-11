import React, { useRef, useState } from 'react';
import {
  Play,
  Square,
  Layers,
  Terminal,
  Activity,
  CheckCircle2,
  TrendingDown,
  Download,
  Sliders,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Upload,
  Trash2,
} from 'lucide-react';
import { CircuitMockupIcon } from '../icons/CustomIcons';
import {
  CircuitElement,
  EISDataset,
  FitResult,
  FittingAlgorithm,
  PlotType,
} from '../../types/impedance';
import { runCircuitFitting } from '../../utils/fittingEngine';
import { tryRemoteFitting, tryRemoteReadFile } from '../../services/apiService';
import { parseEISFile } from '../../utils/fileParser';
import { RENDER_BACKEND_URL } from '../../config/api';
import { ScientificChart } from '../ScientificChart';

interface FittingTabProps {
  currentExpression: string;
  currentElements: CircuitElement[];
  datasets: EISDataset[];
  setDatasets?: React.Dispatch<React.SetStateAction<EISDataset[]>>;
  onOpenCircuitBuilder: () => void;
  onUpdateElement: (id: string, updates: Partial<CircuitElement>) => void;
  onLoadSamples?: () => void;
  onOpenHelp?: () => void;
}

export const FittingTab: React.FC<FittingTabProps> = ({
  currentExpression,
  currentElements,
  datasets,
  setDatasets,
  onOpenCircuitBuilder,
  onUpdateElement,
  onLoadSamples,
  onOpenHelp,
}) => {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(
    datasets[0]?.id || ''
  );
  const [algorithm, setAlgorithm] = useState<FittingAlgorithm>('BFGS');
  const [maxIterations, setMaxIterations] = useState<number>(50);
  const [plotType, setPlotType] = useState<PlotType>('nyquist');
  const [isControlsCollapsed, setIsControlsCollapsed] = useState<boolean>(false);
  const [showFittedCurve, setShowFittedCurve] = useState<boolean>(true);
  const [showEvolutionPlot, setShowEvolutionPlot] = useState<boolean>(false);
  const [fileStyle, setFileStyle] = useState<'chemistry' | 'electrical'>('chemistry');
  const [fileError, setFileError] = useState<string | null>(null);

  // Optimization state
  const [isFitting, setIsFitting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'PHOBOS Zfit ECM Optimization Console initialized.',
    'Select a circuit, configure parameters, and click "Start Fitting Process".',
  ]);
  const [fitResult, setFitResult] = useState<FitResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortSignalRef = useRef<{ aborted: boolean }>({ aborted: false });
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);

  // Keep selectedDatasetId synchronized if datasets change
  React.useEffect(() => {
    if (datasets.length > 0 && (!selectedDatasetId || !datasets.some((d) => d.id === selectedDatasetId))) {
      setSelectedDatasetId(datasets[0].id);
    }
  }, [datasets, selectedDatasetId]);

  const activeDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0];

  const appendLog = (line: string) => {
    setTerminalLogs((prev) => [...prev, line]);
    setTimeout(() => {
      terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 10);
  };

  // Upload handler from PC
  const handleFiles = async (files: FileList | File[]) => {
    const newDatasets: EISDataset[] = [];
    setFileError(null);

    const colorPalettes = [
      '#06b6d4',
      '#f59e0b',
      '#10b981',
      '#a855f7',
      '#3b82f6',
      '#ec4899',
      '#14b8a6',
      '#f97316',
    ];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let parsed: EISDataset | null = null;

        // Step 1: Probe remote Python backend file_utils.read via Render API
        const remoteRes = await tryRemoteReadFile(file, fileStyle);

        if (remoteRes.success && remoteRes.data) {
          const randomColor = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
          parsed = {
            id: `dataset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: remoteRes.data.name,
            originalFilename: remoteRes.data.originalFilename,
            color: randomColor,
            visible: true,
            style: fileStyle,
            c0: 2.5e-11,
            points: remoteRes.data.points,
          };
          appendLog(`[Upload] Loaded "${file.name}" via backend parser (${remoteRes.data.points.length} points).`);
        } else {
          // Step 2: High-precision client-side parser fallback
          const buffer = await file.arrayBuffer();
          parsed = parseEISFile(file.name, buffer, {
            style: fileStyle,
          });
          if (parsed) {
            appendLog(`[Upload] Loaded "${file.name}" via local parser (${parsed.points.length} points).`);
          }
        }

        if (parsed) {
          newDatasets.push(parsed);
        }
      } catch (err: any) {
        setFileError(`Error parsing "${file.name}": ${err.message}`);
        appendLog(`[Upload Error] "${file.name}": ${err.message}`);
      }
    }

    if (newDatasets.length > 0) {
      if (setDatasets) {
        setDatasets((prev) => [...prev, ...newDatasets]);
      }
      setSelectedDatasetId(newDatasets[0].id);
      setFitResult(null);
    }
  };

  const handleStartFitting = async () => {
    if (!activeDataset || activeDataset.points.length === 0) {
      appendLog('[Warning] Please load and select an experimental dataset first.');
      return;
    }

    setIsFitting(true);
    setProgress(0);
    abortSignalRef.current.aborted = false;
    setFitResult(null);

    appendLog(`--------------------------------------------------`);
    appendLog(`Starting ${algorithm} optimization on "${activeDataset.name}"`);
    appendLog(`[Pipeline] Connected backend endpoint: ${RENDER_BACKEND_URL}`);

    try {
      // Step 1: Probe remote Python backend if accessible
      appendLog(`[Remote Check] Dispatching fitting job to Render Flask API...`);
      const remoteRes = await tryRemoteFitting(
        currentExpression,
        currentElements,
        activeDataset.points,
        algorithm,
        maxIterations
      );

      if (remoteRes.success && remoteRes.data) {
        appendLog(`[Remote Success] Optimization converged via Python server.`);
        setFitResult(remoteRes.data);
        setProgress(100);
        return;
      }

      if (remoteRes.error) {
        appendLog(`[Remote Note] Server replied: "${remoteRes.error}". Executing high-precision client engine...`);
      }

      // Step 2: High-precision client-side optimization engine
      const result = await runCircuitFitting(
        currentExpression,
        currentElements,
        activeDataset.points,
        algorithm,
        maxIterations,
        {
          onProgress: (prog, iter, loss) => {
            setProgress(prog);
          },
          onLog: (line) => {
            appendLog(line);
          },
        },
        abortSignalRef.current
      );

      setFitResult(result);
      setProgress(100);
    } catch (err: any) {
      appendLog(`[ERROR] Optimization failed: ${err.message}`);
    } finally {
      setIsFitting(false);
    }
  };

  const handleStopFitting = () => {
    abortSignalRef.current.aborted = true;
    setIsFitting(false);
    appendLog(`[ABORT] Optimization cancelled by user.`);
  };

  // Build chart datasets
  const chartDatasets = [];
  if (activeDataset) {
    chartDatasets.push({
      id: 'raw_exp',
      name: `Exp: ${activeDataset.name}`,
      color: '#06b6d4',
      points: activeDataset.points,
    });
  }

  if (fitResult && showFittedCurve) {
    chartDatasets.push({
      id: 'fitted_model',
      name: `Fitted: ${currentExpression}`,
      color: '#f59e0b',
      points: fitResult.fittedPoints,
      dashed: true,
      strokeWidth: 2.5,
    });
  }

  // Export fitted parameters JSON
  const handleExportFitReport = () => {
    if (!fitResult) return;
    const report = {
      model: fitResult.circuitExpression,
      algorithm: fitResult.algorithm,
      finalLoss: fitResult.finalLoss,
      iterations: fitResult.iterations,
      parameters: fitResult.parameters,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phobos_fit_report_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 gap-5 max-w-[1920px] mx-auto w-full">
      {/* Top Banner: Circuit & Optimization Algorithm Selection */}
      <div className="bg-[#0d111a] border border-slate-800 rounded-lg p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Circuit Identification & Builder */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-cyan-400 shrink-0">
            <CircuitMockupIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Equivalent Circuit Model (ECM) Fitting
            </div>
            <div className="text-sm md:text-base font-mono font-bold text-cyan-400 mt-0.5">
              {currentExpression}
            </div>
          </div>

          <button
            onClick={onOpenCircuitBuilder}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Select/Define Circuit</span>
          </button>
        </div>

        {/* Right: Method selector, Execution Button, and Maximize Plot */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
          {/* Method selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              Method:
            </span>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as FittingAlgorithm)}
              className="px-3 py-2 bg-[#090d16] border border-slate-700 rounded-lg text-xs font-medium text-amber-400 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="BFGS">BFGS (Quasi-Newton)</option>
              <option value="NLLS">NLLS (Levenberg-Marquardt)</option>
              <option value="Nelder-Mead">Nelder-Mead (Simplex)</option>
              <option value="PSO">PSO (Particle Swarm)</option>
              <option value="BFGS-classic">BFGS-classic</option>
            </select>
          </div>

          {/* Execution Button */}
          {!isFitting ? (
            <button
              onClick={handleStartFitting}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-md"
            >
              <Play className="w-4 h-4 fill-slate-900" />
              <span>Start Fitting Process</span>
            </button>
          ) : (
            <button
              onClick={handleStopFitting}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-md"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>Stop Optimization</span>
            </button>
          )}

          {/* Maximize Plot toggle */}
          <button
            onClick={() => setIsControlsCollapsed((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              isControlsCollapsed
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 hover:bg-cyan-500/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700'
            }`}
            title={isControlsCollapsed ? 'Show fitting parameters & console' : 'Hide configuration & maximize chart space'}
          >
            {isControlsCollapsed ? (
              <>
                <PanelLeftOpen className="w-4 h-4 text-cyan-400" />
                <span>Show Config</span>
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

      {/* Real-Time Animated Progress Bar */}
      <div className="bg-[#0d111a] border border-slate-800 rounded-lg p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-300 font-semibold flex items-center gap-2">
            <Activity className={`w-3.5 h-3.5 ${isFitting ? 'text-cyan-400 animate-spin' : 'text-slate-500'}`} />
            <span>Optimization Progress: {progress}%</span>
          </span>
          <span className="text-slate-400">
            Algorithm: {algorithm} • Max Iterations: {maxIterations}
          </span>
        </div>

        {/* Bar */}
        <div className="w-full h-2 bg-[#090d16] rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-cyan-500 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main Grid: Left Load Data & Parameters & Right Visualizer + Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        {/* Left Column: Data Loading & Parameter Configuration */}
        {!isControlsCollapsed && (
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
            {/* 1. Load Experimental Data Panel on the Left Side */}
            <div className="bg-[#0d111a] border border-slate-800 rounded-lg p-4 flex flex-col gap-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Load Experimental Data
                  </span>
                </div>
                {datasets.length > 0 && (
                  <button
                    onClick={() => {
                      if (setDatasets) setDatasets([]);
                      setSelectedDatasetId('');
                      setFitResult(null);
                      appendLog('[System] All uploaded experimental datasets erased.');
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded transition-colors cursor-pointer"
                    title="Erase all uploaded experimental datasets"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                    <span>Erase All</span>
                  </button>
                )}
              </div>

              {/* Format Radio Selection */}
              <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap">
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-mono">
                  Format:
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer group">
                  <input
                    type="radio"
                    name="fittingFileStyle"
                    value="chemistry"
                    checked={fileStyle === 'chemistry'}
                    onChange={() => setFileStyle('chemistry')}
                    className="w-3.5 h-3.5 text-cyan-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                    Chemistry EIS
                  </span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer group">
                  <input
                    type="radio"
                    name="fittingFileStyle"
                    value="electrical"
                    checked={fileStyle === 'electrical'}
                    onChange={() => setFileStyle('electrical')}
                    className="w-3.5 h-3.5 text-cyan-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                    phobos EIS
                  </span>
                </label>
              </div>

              {/* Hidden file input & Load Button */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".csv,.xlsx,.xls,.txt,.dat"
                onChange={(e) => {
                  if (e.target.files) handleFiles(e.target.files);
                }}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer shadow-sm"
                title="Upload EIS data from PC (.csv / .xlsx)"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Load Data from PC</span>
              </button>

              {fileError && (
                <div className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/30 rounded text-[11px] text-red-300 flex items-center justify-between">
                  <span className="truncate">{fileError}</span>
                  <button onClick={() => setFileError(null)} className="text-red-400 hover:text-red-200 ml-1">✕</button>
                </div>
              )}

              {/* Target Dataset Selector */}
              <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono uppercase tracking-wider text-slate-400 font-semibold">
                    Target Dataset
                  </span>
                  <span className="font-mono text-cyan-400">
                    {activeDataset ? `${activeDataset.points.length} points` : '0 points'}
                  </span>
                </div>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  disabled={datasets.length === 0}
                  className="w-full px-3 py-2 bg-[#090d16] border border-slate-700 rounded-lg text-xs font-medium text-cyan-400 focus:outline-none focus:border-cyan-400 disabled:text-slate-500 cursor-pointer truncate"
                >
                  {datasets.length === 0 ? (
                    <option value="" disabled>No data loaded (Load from PC or Example Data in header)</option>
                  ) : (
                    datasets.map((ds) => (
                      <option key={ds.id} value={ds.id}>
                        {ds.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* 2. Parameter Scaling & Active Toggles */}
            <div className="bg-[#0d111a] border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 bg-[#0f1422] flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Parameter Scaling & Active Toggles</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {currentElements.filter((e) => e.isFit).length}/{currentElements.length} active
                </span>
              </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090d16] text-[11px] text-slate-400 font-mono uppercase border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5">Param</th>
                    <th className="px-3 py-2.5">Initial Guess</th>
                    <th className="px-3 py-2.5">Scale</th>
                    <th className="px-3 py-2.5 text-center">Fit / Fix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {currentElements.map((el) => (
                    <tr key={el.id} className="hover:bg-slate-800/20">
                      <td className="px-3 py-2.5 font-bold text-cyan-400">
                        {el.label}
                        <span className="text-[10px] text-slate-500 ml-1">({el.type})</span>
                      </td>

                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          step="any"
                          value={el.value}
                          onChange={(e) =>
                            onUpdateElement(el.id, { value: parseFloat(e.target.value) || 0 })
                          }
                          className="w-24 px-2 py-1 bg-[#06090f] border border-slate-700 rounded text-xs text-slate-200 tabular-nums focus:outline-none focus:border-cyan-400"
                        />
                      </td>

                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          step="any"
                          value={el.scale}
                          onChange={(e) =>
                            onUpdateElement(el.id, { scale: parseFloat(e.target.value) || 1 })
                          }
                          className="w-20 px-2 py-1 bg-[#06090f] border border-slate-700 rounded text-xs text-slate-400 tabular-nums focus:outline-none focus:border-cyan-400"
                        />
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => onUpdateElement(el.id, { isFit: !el.isFit })}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                            el.isFit
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {el.isFit ? 'FIT' : 'FIX'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fitted Results Card */}
          {fitResult && (
            <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Converged Parameters Report</span>
                </span>
                <button
                  onClick={handleExportFitReport}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"
                >
                  <Download className="w-3 h-3 text-cyan-400" />
                  <span>Report JSON</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 bg-[#090d16] rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500">Objective Loss</div>
                  <div className="text-sm font-bold text-emerald-400 tabular-nums">
                    {fitResult.finalLoss.toExponential(4)}
                  </div>
                </div>
                <div className="p-2 bg-[#090d16] rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500">Iterations</div>
                  <div className="text-sm font-bold text-slate-200 tabular-nums">
                    {fitResult.iterations}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-2 font-mono text-xs">
                {Object.entries(fitResult.parameters).map(([name, info]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between p-2 bg-[#090d16] rounded border border-slate-800/80"
                  >
                    <span className="font-bold text-cyan-400">{name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-200 tabular-nums font-semibold">
                        {info.value < 0.001 || info.value > 1000
                          ? info.value.toExponential(3)
                          : info.value.toFixed(2)}{' '}
                        {info.unit}
                      </span>
                      <span
                        className={`text-[10px] ${
                          info.isFixed ? 'text-slate-500' : 'text-emerald-400'
                        }`}
                      >
                        {info.isFixed ? '[Fixed]' : `±${info.error.toFixed(1)}%`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Embedded Monospace Terminal */}
          <div className="bg-[#0a0d14] border border-slate-800 rounded-lg overflow-hidden flex flex-col h-64">
            <div className="px-3 py-2 bg-[#0d111a] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[11px] font-mono text-slate-300">
                  PHOBOS Engine Console
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">stdout</span>
            </div>

            <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1 select-text">
              {terminalLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`leading-relaxed ${
                    log.startsWith('[Iter')
                      ? 'text-cyan-400'
                      : log.startsWith('[ERROR')
                      ? 'text-rose-400'
                      : log.startsWith('[Optimization Finished')
                      ? 'text-emerald-400 font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  {log}
                </div>
              ))}
              <div ref={terminalBottomRef} />
            </div>
          </div>
        </div>
      )}

      {/* Right Column: Visualization Viewport */}
      <div className={`${isControlsCollapsed ? 'col-span-12' : 'lg:col-span-7 xl:col-span-8'} flex flex-col gap-4 w-full transition-all`}>
          {/* Plot Controls Bar */}
          <div className="bg-[#0d111a] border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                Plot View:
              </label>
              <select
                value={plotType}
                onChange={(e) => setPlotType(e.target.value as PlotType)}
                className="px-3 py-1.5 bg-[#090d16] border border-slate-700 rounded-lg text-xs font-medium text-cyan-400 focus:outline-none focus:border-cyan-400"
              >
                <option value="nyquist">Nyquist Complex Plane ( -Z'' vs Z' )</option>
                <option value="bode_mag">Bode Magnitude ( |Z| vs f )</option>
                <option value="bode_phase">Bode Phase ( -Φ vs f )</option>
                <option value="z_real_vs_f">Real Impedance ( Z' vs f )</option>
                <option value="z_imag_vs_f">Imaginary Impedance ( -Z'' vs f )</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFittedCurve}
                  onChange={(e) => setShowFittedCurve(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span>Overlay Fitted Model</span>
              </label>

              {fitResult && (
                <label className="flex items-center gap-1.5 text-xs text-slate-300 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEvolutionPlot}
                    onChange={(e) => setShowEvolutionPlot(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0"
                  />
                  <span>Show Parameter Evolution</span>
                </label>
              )}
            </div>
          </div>

          {/* Overlaid Chart Display or Empty Prompt */}
          {!activeDataset ? (
            <div className="h-96 bg-[#0b0f19] border border-slate-800 rounded-xl flex flex-col items-center justify-center p-8 text-center gap-3">
              <CircuitMockupIcon className="w-8 h-8 text-cyan-400/50 mb-1" />
              <div className="text-sm font-semibold text-slate-200">
                No Experimental Dataset Loaded for Fitting
              </div>
              <div className="text-xs text-slate-500 max-w-md leading-relaxed">
                Circuit optimization requires target experimental impedance data. Use <strong className="text-cyan-400">"Load Data from PC"</strong> on the left panel or click <strong className="text-amber-400">"Example Data"</strong> in the top header.
              </div>
            </div>
          ) : (
            <ScientificChart
              datasets={chartDatasets}
              plotType={plotType}
              height={isControlsCollapsed ? 680 : 580}
              aspectEqual={plotType === 'nyquist'}
              title={`Experimental Data vs Fitted Model: ${currentExpression}`}
            />
          )}

          {/* Parameter Evolution Convergence Strip if toggled */}
          {fitResult && showEvolutionPlot && (
            <div className="bg-[#0b0f19] border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                Convergence History S(θ) across {fitResult.evolution.length} Iterations
              </span>
              <div className="h-32 flex items-end gap-1 pt-2">
                {fitResult.evolution.map((ev, i) => {
                  const maxL = Math.max(...fitResult.evolution.map((e) => e.loss), 1);
                  const minL = Math.min(...fitResult.evolution.map((e) => e.loss), 1e-4);
                  const logH = (Math.log10(ev.loss) - Math.log10(minL)) / (Math.log10(maxL) - Math.log10(minL) || 1);
                  const heightPct = Math.max(8, Math.min(100, (1 - logH) * 100));

                  return (
                    <div
                      key={i}
                      className="flex-1 bg-cyan-500/70 hover:bg-cyan-400 rounded-t transition-all group relative cursor-pointer"
                      style={{ height: `${heightPct}%` }}
                    >
                      <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-cyan-400 whitespace-nowrap shadow-xl">
                        Iter {ev.iteration}: {ev.loss.toExponential(3)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Iter 1 (Loss: {fitResult.evolution[0]?.loss.toExponential(2)})</span>
                <span>Iter {fitResult.iterations} (Final: {fitResult.finalLoss.toExponential(2)})</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
