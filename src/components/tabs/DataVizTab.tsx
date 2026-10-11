import React, { useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  HelpCircle,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Sliders,
  Maximize2,
  RotateCcw,
  Zap,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { CircuitMockupIcon } from '../icons/CustomIcons';
import { EISDataset, PlotType } from '../../types/impedance';
import { parseEISFile } from '../../utils/fileParser';
import { tryRemoteReadFile } from '../../services/apiService';
import { SubplotGrid } from '../SubplotGrid';

interface DataVizTabProps {
  datasets: EISDataset[];
  setDatasets: React.Dispatch<React.SetStateAction<EISDataset[]>>;
  onOpenHelp: () => void;
  onLoadSamples?: () => void;
  onGoToLinKK?: () => void;
  onGoToFitting?: () => void;
}

export const DataVizTab: React.FC<DataVizTabProps> = ({
  datasets,
  setDatasets,
  onOpenHelp,
  onLoadSamples,
  onGoToLinKK,
  onGoToFitting,
}) => {
  const [fileStyle, setFileStyle] = useState<'chemistry' | 'electrical'>('chemistry');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [c0Input, setC0Input] = useState<string>('2.5e-11'); // 25 pF default for air
  const [isControlsCollapsed, setIsControlsCollapsed] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        const remoteRes = await tryRemoteReadFile(
          file,
          fileStyle,
          parseFloat(c0Input) || undefined
        );

        if (remoteRes.success && remoteRes.data) {
          const randomColor = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
          parsed = {
            id: `dataset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: remoteRes.data.name,
            originalFilename: remoteRes.data.originalFilename,
            color: randomColor,
            visible: true,
            style: fileStyle,
            c0: parseFloat(c0Input) || 2.5e-11,
            points: remoteRes.data.points,
          };
        } else {
          // Step 2: High-precision client-side parser matching file_utils.py (UTF-16/UTF-8 & Autolab)
          const buffer = await file.arrayBuffer();
          parsed = parseEISFile(file.name, buffer, {
            style: fileStyle,
            c0: parseFloat(c0Input) || undefined,
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
      setDatasets((prev) => [...prev, ...newDatasets]);
    }
  };

  const handleToggleVisible = (id: string) => {
    setDatasets((prev) =>
      prev.map((d) => (d.id === id ? { ...d, visible: !d.visible } : d))
    );
  };

  const handleRename = (id: string, newName: string) => {
    setDatasets((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name: newName } : d))
    );
  };

  const handleDelete = (id: string) => {
    setDatasets((prev) => prev.filter((d) => d.id !== id));
  };

  const handleChangeColor = (id: string, color: string) => {
    setDatasets((prev) =>
      prev.map((d) => (d.id === id ? { ...d, color } : d))
    );
  };

  const handleApplyC0 = (id: string, c0Val: number) => {
    setDatasets((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const updatedPoints = d.points.map((p) => {
          const cp = p.cp;
          const rp = p.rp;
          if (cp !== undefined && rp !== undefined && c0Val > 0) {
            const epsReal = cp / c0Val;
            const epsImag = 1 / (p.omega * rp * c0Val);
            const sigmaReal = p.omega * 8.8541878128e-12 * epsImag;
            return { ...p, epsReal, epsImag, sigmaReal };
          }
          return p;
        });
        return { ...d, c0: c0Val, points: updatedPoints };
      })
    );
  };

  // Visible datasets for plotting
  const visibleDatasets = datasets.filter((d) => d.visible);

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 gap-5 max-w-[1920px] mx-auto w-full">
      {/* Top Controls Ribbon: File format radio buttons & PC File Loader */}
      <div className="bg-[#0d111a] border border-slate-800 rounded-lg p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Experimental Data Format (file_utils.read):
            </span>
            <button
              onClick={onOpenHelp}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Format Guide</span>
            </button>
          </div>

          {/* Radio Buttons for File Style */}
          <div className="flex items-center gap-5 text-xs text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="fileStyle"
                value="chemistry"
                checked={fileStyle === 'chemistry'}
                onChange={() => setFileStyle('chemistry')}
                className="w-4 h-4 text-cyan-500 bg-slate-900 border-slate-700 focus:ring-0"
              />
              <span className="font-semibold text-slate-200">
                Chemistry EIS (.csv / .xlsx)
              </span>
              <span className="text-slate-500 text-[11px]">(Freq, Z', -Z'' or |Z|, Phase)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="fileStyle"
                value="electrical"
                checked={fileStyle === 'electrical'}
                onChange={() => setFileStyle('electrical')}
                className="w-4 h-4 text-cyan-500 bg-slate-900 border-slate-700 focus:ring-0"
              />
              <span className="font-semibold text-slate-200">
                phobos EIS (.csv)
              </span>
              <span className="text-slate-500 text-[11px]">(Freq, Cp, Rp)</span>
            </label>
          </div>
        </div>

        {/* Load From PC Drop Zone & Button */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
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
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>Load Data from PC</span>
          </button>

          {datasets.length > 0 && onGoToLinKK && (
            <button
              onClick={onGoToLinKK}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
              title="Validate experimental impedance data using Linear Kramers-Kronig (Lin-KK) test"
            >
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Check Lin-KK</span>
            </button>
          )}

          {datasets.length > 0 && onGoToFitting && (
            <button
              onClick={onGoToFitting}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
              title="Fit equivalent electrical circuit models to experimental data"
            >
              <CircuitMockupIcon className="w-4 h-4 text-amber-400" />
              <span>Circuit Fitting</span>
            </button>
          )}

          {/* Toggle datasets manager to maximize plot space */}
          <button
            onClick={() => setIsControlsCollapsed((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              isControlsCollapsed
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 hover:bg-cyan-500/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700'
            }`}
            title={isControlsCollapsed ? 'Show datasets manager' : 'Hide datasets manager & maximize chart space'}
          >
            {isControlsCollapsed ? (
              <>
                <PanelLeftOpen className="w-4 h-4 text-cyan-400" />
                <span>Show Datasets</span>
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

      {fileError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between">
          <span>{fileError}</span>
          <button onClick={() => setFileError(null)} className="text-red-400 hover:text-white font-bold ml-2">✕</button>
        </div>
      )}

      {/* Main Workspace: Left Datasets Manager & Right Subplots Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        {/* Left Column: Multi-dataset Manager */}
        {!isControlsCollapsed && (
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-5">
            <div className="bg-[#0d111a] border border-slate-800 rounded-lg p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Imported Datasets ({datasets.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {datasets.length > 0 && (
                  <button
                    onClick={() => setDatasets([])}
                    className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-md transition-colors cursor-pointer"
                    title="Erase all imported datasets"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                    <span>Clear All</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-500 font-mono">
                  {visibleDatasets.length} visible
                </span>
              </div>
            </div>

            {/* Drop target card */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : 'border-slate-800 hover:border-slate-700 bg-[#090d16]'
              }`}
            >
              <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
              <div className="text-xs text-slate-300 font-medium">
                Drag & drop .csv / .xlsx files here
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                or click to browse local files
              </div>
            </div>

            {/* Multi-Dataset List */}
            {datasets.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No experimental data loaded yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1">
                {datasets.map((ds) => (
                  <div
                    key={ds.id}
                    className={`p-3 rounded-lg border transition-all ${
                      ds.visible
                        ? 'bg-[#0f1422] border-slate-700/80'
                        : 'bg-[#090d16]/70 border-slate-800/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Eye visibility toggle */}
                        <button
                          onClick={() => handleToggleVisible(ds.id)}
                          className="text-slate-400 hover:text-cyan-400"
                        >
                          {ds.visible ? (
                            <Eye className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-slate-600" />
                          )}
                        </button>

                        {/* Color swatch picker */}
                        <input
                          type="color"
                          value={ds.color}
                          onChange={(e) => handleChangeColor(ds.id, e.target.value)}
                          className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                          title="Change dataset color"
                        />

                        {/* Masked / Display Name */}
                        {editingId === ds.id ? (
                          <input
                            type="text"
                            value={ds.name}
                            autoFocus
                            onBlur={() => setEditingId(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                            onChange={(e) => handleRename(ds.id, e.target.value)}
                            className="flex-1 px-1.5 py-0.5 bg-[#06090f] border border-cyan-400 rounded text-xs font-medium text-slate-200"
                          />
                        ) : (
                          <span
                            onDoubleClick={() => setEditingId(ds.id)}
                            className="text-xs font-semibold text-slate-200 truncate cursor-pointer hover:text-cyan-300"
                            title="Double click to rename/mask"
                          >
                            {ds.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onGoToLinKK && (
                          <button
                            onClick={onGoToLinKK}
                            className="text-slate-500 hover:text-cyan-400 p-1 transition-colors cursor-pointer"
                            title="Validate this dataset with Lin-KK test"
                          >
                            <Activity className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingId(editingId === ds.id ? null : ds.id)}
                          className="text-slate-500 hover:text-slate-300 p-1"
                          title="Edit name mask"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(ds.id)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                          title="Delete dataset"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>{ds.points.length} points</span>
                      <span>{ds.style}</span>
                      <span className="truncate max-w-[120px]">{ds.originalFilename}</span>
                    </div>

                    {/* C0 reference capacitance input for permittivity calculation */}
                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">C0 / Air Cap (F):</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          defaultValue={ds.c0 || 2.5e-11}
                          onBlur={(e) =>
                            handleApplyC0(ds.id, parseFloat(e.target.value) || 2.5e-11)
                          }
                          className="w-24 px-1.5 py-0.5 bg-[#06090f] border border-slate-700 rounded text-[11px] text-slate-300 text-right tabular-nums focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right Column: Visualization Viewport with SubplotGrid */}
      <div className={`${isControlsCollapsed ? 'col-span-12' : 'lg:col-span-8 xl:col-span-9'} flex flex-col gap-4 w-full transition-all`}>
        {visibleDatasets.length === 0 ? (
            <div className="h-96 bg-[#0d111a] border border-slate-800 rounded-lg flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs gap-3">
              <FileSpreadsheet className="w-10 h-10 text-slate-600 mb-1" />
              <div className="text-sm font-semibold text-slate-200">
                {datasets.length === 0 ? 'No Experimental Data Loaded' : 'No Datasets Enabled for Display'}
              </div>
              <p className="max-w-md text-slate-500 text-[11px] leading-relaxed">
                {datasets.length === 0
                  ? 'Import .csv or .xlsx EIS files from your computer using the "Load Data from PC" button above or drag files into the dataset manager.'
                  : 'All loaded datasets are currently hidden. Toggle the eye icon on the left manager to display data.'}
              </p>
              {datasets.length === 0 && (
                <div className="flex items-center gap-3 mt-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Load Data from PC</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <SubplotGrid
              datasets={visibleDatasets}
              initialSubplots={[
                {
                  id: 'sub_viz_1',
                  title: "Nyquist Complex Plane ( -Z'' vs Z' )",
                  plotType: 'nyquist',
                  logScale: true,
                  aspectEqual: true,
                  colSpan: 1,
                },
                {
                  id: 'sub_viz_2',
                  title: 'Bode Magnitude ( |Z| vs f )',
                  plotType: 'bode_mag',
                  logScale: true,
                  aspectEqual: false,
                  colSpan: 1,
                },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
};
