import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RotateCcw,
  Sliders,
  Activity,
  Layers,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  Upload,
  HelpCircle,
  Terminal,
  Trash2,
} from 'lucide-react';
import { EISDataset, LinKKConfig, LinKKResult } from '../../types/impedance';
import { runLinearKramersKronig } from '../../utils/linKK';
import { tryRemoteLinKK, tryRemoteReadFile } from '../../services/apiService';
import { parseEISFile } from '../../utils/fileParser';
import { ScientificChart } from '../ScientificChart';

interface LinKKTabProps {
  datasets: EISDataset[];
  setDatasets?: React.Dispatch<React.SetStateAction<EISDataset[]>>;
  onOpenHelp?: () => void;
  onLoadSamples?: () => void;
}

export const LinKKTab: React.FC<LinKKTabProps> = ({
  datasets,
  setDatasets,
  onOpenHelp,
  onLoadSamples,
}) => {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(
    datasets[0]?.id || ''
  );
  const [fileStyle, setFileStyle] = useState<'chemistry' | 'electrical'>('chemistry');
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [config, setConfig] = useState<LinKKConfig>({
    c: 0.1,
    maxIter: 50,
    addCapacitor: true,
    verbose: true,
  });
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<LinKKResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState<boolean>(false);
  const [isTerminalEnabled, setIsTerminalEnabled] = useState<boolean>(true);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '[Lin-KK Engine] Validation console initialized.',
    '[Lin-KK Engine] Ready to test experimental impedance datasets.',
  ]);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);

  const addLog = (line: string) => {
    setTerminalLogs((prev) => [...prev, line]);
    setTimeout(() => {
      terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 40);
  };

  // Keep selectedDatasetId synchronized if datasets change
  React.useEffect(() => {
    if (datasets.length > 0 && (!selectedDatasetId || !datasets.some((d) => d.id === selectedDatasetId))) {
      setSelectedDatasetId(datasets[0].id);
    }
  }, [datasets, selectedDatasetId]);

  const activeDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0];

  // File loading handler linking with Python Flask backend + robust client fallback
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
        } else {
          // Step 2: High-precision client-side parser matching file_utils.py (UTF-16/UTF-8 & Autolab)
          const buffer = await file.arrayBuffer();
          parsed = parseEISFile(file.name, buffer, {
            style: fileStyle,
          });
        }

        if (parsed) {
          newDatasets.push(parsed);
        }
      } catch (err: any) {
        setFileError(`Error parsing "${file.name}": ${err.message}`);
      }
    }

    if (newDatasets.length > 0) {
      if (setDatasets) {
        setDatasets((prev) => [...prev, ...newDatasets]);
      }
      setSelectedDatasetId(newDatasets[0].id);
      setResult(null);
    }
  };

  const handleRunLinKK = async () => {
    if (!activeDataset || activeDataset.points.length < 3) {
      setErrorMsg('Selected dataset must contain at least 3 valid impedance frequency points.');
      addLog('[WARNING] Please select a dataset containing at least 3 impedance points.');
      return;
    }

    setIsRunning(true);
    setErrorMsg(null);
    addLog(`[Lin-KK] Starting test on "${activeDataset.name}" (${activeDataset.points.length} frequency points)...`);
    addLog(`[Lin-KK Config] c = ${config.c}, max_iter = ${config.maxIter}, series_capacitor = ${config.addCapacitor}`);

    try {
      // Step 1: Probe remote Python backend if accessible
      const remoteRes = await tryRemoteLinKK(
        activeDataset.points,
        config.c,
        config.maxIter
      );

      if (remoteRes.success && remoteRes.data) {
        setResult(remoteRes.data);
        addLog(`[Lin-KK Remote] Python backend completed validation successfully.`);
        addLog(`[STATUS] Result: ${remoteRes.data.status} | Pseudo-χ²: ${remoteRes.data.pseudoChiSquare.toExponential(3)}`);
        return;
      }

      // Step 2: High-precision client-side Lin-KK engine
      addLog('[Lin-KK Engine] Calculating Voigt circuit linear Kramers-Kronig transform...');
      const res = runLinearKramersKronig(activeDataset.points, config);
      setResult(res);
      addLog(`[COMPLETED] Lin-KK Status: ${res.status} | Pseudo-χ²: ${res.pseudoChiSquare.toExponential(4)}`);
      addLog(`[Lin-KK Residuals] Max Real: ${(res.maxResidualReal * 100).toFixed(2)}%, Max Imag: ${(res.maxResidualImag * 100).toFixed(2)}%`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lin-KK test evaluation failed');
      addLog(`[ERROR] ${err.message || 'Lin-KK test evaluation failed'}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 gap-5 max-w-[1920px] mx-auto w-full">
      {/* Unified Banner: Load Experimental Data & Lin-KK Evaluation Controls */}
      <div className="bg-[#0d111a] border border-slate-800 rounded-lg p-3.5 md:p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-sm">
        {/* Left Side: Header & Format Radio Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-cyan-400 shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Load Experimental Data
            </span>
          </div>

          <span className="hidden sm:inline text-slate-700">•</span>

          {/* Format Radio Selection */}
          <div className="flex items-center gap-3.5 text-xs text-slate-300 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-mono">
              Format:
            </span>

            <label className="flex items-center gap-1.5 cursor-pointer group">
              <input
                type="radio"
                name="linkkFileStyle"
                value="chemistry"
                checked={fileStyle === 'chemistry'}
                onChange={() => setFileStyle('chemistry')}
                className="w-3.5 h-3.5 text-cyan-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
              />
              <span className="font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                Chemistry EIS (.csv / .xlsx)
              </span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer group">
              <input
                type="radio"
                name="linkkFileStyle"
                value="electrical"
                checked={fileStyle === 'electrical'}
                onChange={() => setFileStyle('electrical')}
                className="w-3.5 h-3.5 text-cyan-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
              />
              <span className="font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                phobos EIS (.csv)
              </span>
            </label>

            {onOpenHelp && (
              <button
                onClick={onOpenHelp}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                title="Format guidelines"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Format Guide</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Data Loading (PC & Example), Dataset Dropdown, Check Data & Maximize Plot */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-start xl:justify-end">
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

          {/* Load Data from PC */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
            title="Upload EIS data from PC"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Load Data from PC</span>
          </button>

          {/* Erase all uploaded data button */}
          {datasets.length > 0 && (
            <button
              onClick={() => {
                if (setDatasets) setDatasets([]);
                setSelectedDatasetId('');
                setResult(null);
                addLog('[Lin-KK] All uploaded datasets erased.');
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
              title="Delete all uploaded experimental datasets"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Erase All Data</span>
            </button>
          )}

          <div className="hidden md:block h-5 w-px bg-slate-800 mx-0.5" />

          {/* Dropdown list of uploaded data */}
          <select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            disabled={datasets.length === 0}
            className="px-3 py-2 bg-[#090d16] border border-slate-700 rounded-lg text-xs font-medium text-cyan-400 focus:outline-none focus:border-cyan-400 disabled:text-slate-500 cursor-pointer max-w-[210px] truncate"
            title="Select dataset for Lin-KK testing"
          >
            {datasets.length === 0 ? (
              <option value="" disabled>No data loaded</option>
            ) : (
              datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.points.length} pts)
                </option>
              ))
            )}
          </select>

          {/* Check Data / Run Lin-KK Button */}
          <button
            onClick={handleRunLinKK}
            disabled={isRunning || !activeDataset || activeDataset.points.length < 3}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
            title="Validate experimental impedance data using Linear Kramers-Kronig test"
          >
            <Play className="w-3.5 h-3.5 fill-slate-900" />
            <span>{isRunning ? 'Checking...' : 'Check Data'}</span>
          </button>

          {/* Toggle controls to maximize chart space */}
          <button
            onClick={() => setIsControlsCollapsed((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              isControlsCollapsed
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 hover:bg-cyan-500/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700'
            }`}
            title={isControlsCollapsed ? 'Show test configuration' : 'Hide configuration & maximize chart space'}
          >
            {isControlsCollapsed ? (
              <>
                <PanelLeftOpen className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Show Config</span>
              </>
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Maximize</span>
              </>
            )}
          </button>
        </div>
      </div>

      {fileError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between">
          <span>{fileError}</span>
          <button onClick={() => setFileError(null)} className="text-red-400 hover:text-white font-bold ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-center gap-2 font-mono">
          <XCircle className="w-4 h-4 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Parameters on Left & Plots on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        {/* Left Column: Lin-KK Parameters & Diagnostics */}
        {!isControlsCollapsed && (
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-5">
            <div className="bg-[#0d111a] border border-slate-800 rounded-lg p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Test Configuration</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">LinKK.py</span>
            </div>

            <div className="flex flex-col gap-4 text-xs font-mono">
              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Cutoff Parameter c (0.01 - 0.5)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="0.9"
                  value={config.c}
                  onChange={(e) =>
                    setConfig({ ...config, c: parseFloat(e.target.value) || 0.1 })
                  }
                  className="w-full px-3 py-1.5 bg-[#090d16] border border-slate-700 rounded text-slate-200 tabular-nums focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Controls Voigt RC distribution density (c=0.1 default)
                </span>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Max Iterations
                </label>
                <input
                  type="number"
                  min="5"
                  max="200"
                  value={config.maxIter}
                  onChange={(e) =>
                    setConfig({ ...config, maxIter: parseInt(e.target.value) || 50 })
                  }
                  className="w-full px-3 py-1.5 bg-[#090d16] border border-slate-700 rounded text-slate-200 tabular-nums focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-800 font-sans">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-xs">
                  <input
                    type="checkbox"
                    checked={config.addCapacitor}
                    onChange={(e) =>
                      setConfig({ ...config, addCapacitor: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>series capacitor</span>
                </label>
              </div>

              {/* Terminal Enable/Disable toggle button */}
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-800">
                <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Terminal Console</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsTerminalEnabled((prev) => !prev)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                    isTerminalEnabled
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:bg-slate-700'
                  }`}
                  title={isTerminalEnabled ? 'Hide terminal console' : 'Show terminal console'}
                >
                  {isTerminalEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          </div>

          {/* Embedded Monospace Terminal Space under Test Configuration (likewise circuit fitting terminal) */}
          {isTerminalEnabled && (
            <div className="bg-[#0a0d14] border border-slate-800 rounded-lg overflow-hidden flex flex-col h-56 shadow-sm">
              <div className="px-3 py-2 bg-[#0d111a] border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] font-mono text-slate-300">
                    Lin-KK Validation Terminal
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTerminalLogs(['[Lin-KK Engine] Terminal cleared.'])}
                    className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    title="Clear terminal"
                  >
                    Clear
                  </button>
                  <span className="text-[10px] font-mono text-slate-500">stdout</span>
                </div>
              </div>

              <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1 select-text">
                {terminalLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`leading-relaxed ${
                      log.startsWith('[Lin-KK') || log.startsWith('[STATUS')
                        ? 'text-cyan-400'
                        : log.startsWith('[ERROR')
                        ? 'text-rose-400'
                        : log.startsWith('[COMPLETED')
                        ? 'text-emerald-400 font-bold'
                        : log.startsWith('[WARNING')
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {log}
                  </div>
                ))}
                <div ref={terminalBottomRef} />
              </div>
            </div>
          )}

          {/* Test Outcome Summary Card */}
          {result && (
            <div className="bg-[#0d111a] border border-slate-800 rounded-lg p-5 flex flex-col gap-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Lin-KK Compliance Status
              </div>

              {/* Status Badge */}
              <div
                className={`p-3 rounded-lg border flex items-center gap-3 ${
                  result.status === 'Consistent'
                    ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-400'
                    : result.status === 'Marginal'
                    ? 'bg-amber-950/30 border-amber-800/60 text-amber-400'
                    : 'bg-rose-950/30 border-rose-800/60 text-rose-400'
                }`}
              >
                {result.status === 'Consistent' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                {result.status === 'Marginal' && <AlertTriangle className="w-5 h-5 shrink-0" />}
                {result.status === 'Inconsistent' && <XCircle className="w-5 h-5 shrink-0" />}
                <div>
                  <div className="text-sm font-bold">{result.status}</div>
                  <div className="text-[11px] text-slate-300 leading-tight mt-0.5">
                    {result.summary}
                  </div>
                </div>
              </div>

              {/* Diagnostic Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-800">
                <div className="p-2 bg-[#090d16] rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500">Max Δ_Real</div>
                  <div className="text-sm font-bold text-cyan-400 tabular-nums">
                    {result.maxResidualReal.toFixed(2)}%
                  </div>
                </div>
                <div className="p-2 bg-[#090d16] rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500">Max Δ_Imag</div>
                  <div className="text-sm font-bold text-amber-400 tabular-nums">
                    {result.maxResidualImag.toFixed(2)}%
                  </div>
                </div>
                <div className="col-span-2 p-2 bg-[#090d16] rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500">Pseudo-χ² Statistic</div>
                  <div className="text-sm font-bold text-slate-200 tabular-nums">
                    {result.pseudoChiSquare.toExponential(3)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Right Column: Visualizations (Residuals & Overlay) */}
      <div className={`${isControlsCollapsed ? 'col-span-12' : 'lg:col-span-8 xl:col-span-9'} flex flex-col gap-6 w-full transition-all`}>
        {result ? (
          <>
            {/* Residual Error Distribution Plot (Expanded) */}
            <ScientificChart
              datasets={[]}
              plotType="nyquist"
              height={380}
              title="Linear Kramers-Kronig Relative Residuals (Δ_re % and Δ_im %)"
              residuals={{
                freqs: result.freqs,
                deltaRe: result.residualsReal,
                deltaIm: result.residualsImag,
              }}
            />

            {/* Experimental vs Lin-KK Reconstructed Nyquist Curve (Expanded) */}
            <ScientificChart
              datasets={[
                {
                  id: 'exp_data',
                  name: 'Experimental Data',
                  color: '#06b6d4',
                  points: activeDataset.points,
                },
                {
                  id: 'linkk_fit',
                  name: 'Lin-KK Voigt Model',
                  color: '#f59e0b',
                  points: result.fittedPoints,
                  dashed: true,
                  strokeWidth: 2,
                },
              ]}
              plotType="nyquist"
              height={480}
              aspectEqual={true}
              title="Experimental Spectrum vs Lin-KK Reconstructed Curve"
            />
          </>
        ) : !activeDataset ? (
            <div className="h-96 bg-[#0b0f19] border border-slate-800 rounded-xl flex flex-col items-center justify-center p-8 text-center gap-3">
              <Upload className="w-8 h-8 text-cyan-400/50 mb-1" />
              <div className="text-sm font-semibold text-slate-200">
                No Experimental Dataset Loaded
              </div>
              <div className="text-xs text-slate-500 max-w-md leading-relaxed">
                Upload your experimental impedance spectrum (.csv or .xlsx) using the loader above to test Kramers-Kronig linearity, causality, and stability.
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span>Load Data from PC</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-96 bg-[#0b0f19] border border-slate-800 rounded-xl flex flex-col items-center justify-center p-8 text-center gap-3">
              <Activity className="w-8 h-8 text-cyan-400/50" />
              <div className="text-sm font-semibold text-slate-300">
                Lin-KK Test Not Yet Executed
              </div>
              <div className="text-xs text-slate-500 max-w-md">
                Dataset <strong className="text-cyan-300">"{activeDataset.name}"</strong> is selected. Click <strong className="text-slate-300">"Check Impedance Data"</strong> in the top ribbon to test Kramers-Kronig compliance and analyze residual errors.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
