import React, { useState } from 'react';
import {
  GripVertical,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
  LayoutGrid,
  Columns,
  Rows,
  Layers,
  Sparkles,
} from 'lucide-react';
import { EISDataset, EISPoint, PlotType, SubplotItem } from '../types/impedance';
import { ScientificChart } from './ScientificChart';
import { Chart3DViewer } from './Chart3DViewer';

interface SubplotGridProps {
  datasets: (EISDataset | { id: string; name: string; color: string; points: EISPoint[]; dashed?: boolean })[];
  initialSubplots?: SubplotItem[];
  defaultPlotType?: PlotType;
  allowedPlotTypes?: PlotType[];
  title?: string;
}

export type PlotHeightMode = 'standard' | 'large' | 'ultra';

export const SubplotGrid: React.FC<SubplotGridProps> = ({
  datasets,
  initialSubplots = [
    {
      id: 'sub_1',
      title: "Nyquist Complex Plane ( -Z'' vs Z' )",
      plotType: 'nyquist',
      logScale: true,
      aspectEqual: true,
      colSpan: 1,
    },
    {
      id: 'sub_2',
      title: 'Bode Magnitude ( |Z| vs f )',
      plotType: 'bode_mag',
      logScale: true,
      aspectEqual: false,
      colSpan: 1,
    },
  ],
  allowedPlotTypes = [
    'nyquist',
    'bode_mag',
    'bode_phase',
    'z_real_vs_f',
    'z_imag_vs_f',
    'cprp',
    'permittivity',
    'conductivity',
    'plot_3d',
  ],
}) => {
  const [subplots, setSubplots] = useState<SubplotItem[]>(initialSubplots);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Standard default height for scientific subplots
  const getHeight = (isFullWidth: boolean) => (isFullWidth ? 560 : 480);

  // Add new subplot
  const handleAddSubplot = (type: PlotType = 'nyquist') => {
    const newId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const newSub: SubplotItem = {
      id: newId,
      title: getPlotLabel(type),
      plotType: type,
      logScale: true,
      aspectEqual: type === 'nyquist',
      colSpan: 1,
      disabledDatasetIds: [],
    };
    setSubplots((prev) => [...prev, newSub]);
  };

  // Remove subplot
  const handleRemoveSubplot = (id: string) => {
    if (subplots.length <= 1) return;
    setSubplots((prev) => prev.filter((s) => s.id !== id));
  };

  // Update subplot properties
  const handleUpdateSubplot = (id: string, updates: Partial<SubplotItem>) => {
    setSubplots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  // Toggle dataset visibility on a specific subplot
  const handleToggleDatasetOnSubplot = (subplotId: string, datasetId: string) => {
    setSubplots((prev) =>
      prev.map((s) => {
        if (s.id !== subplotId) return s;
        const currentDisabled = s.disabledDatasetIds || [];
        const nextDisabled = currentDisabled.includes(datasetId)
          ? currentDisabled.filter((id) => id !== datasetId)
          : [...currentDisabled, datasetId];
        return { ...s, disabledDatasetIds: nextDisabled };
      })
    );
  };

  // Drag and Drop reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent drag ghost
    const dragIcon = document.createElement('div');
    dragIcon.style.opacity = '0';
    document.body.appendChild(dragIcon);
    e.dataTransfer.setDragImage(dragIcon, 0, 0);
    setTimeout(() => document.body.removeChild(dragIcon), 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    setSubplots((prev) => {
      const copy = [...prev];
      const [draggedItem] = copy.splice(draggedIndex, 1);
      copy.splice(dropIndex, 0, draggedItem);
      return copy;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Layout presets
  const applyPresetLayout = (layout: 'single' | 'dual_horiz' | 'dual_vert' | 'triple' | 'quad') => {
    switch (layout) {
      case 'single':
        setSubplots([
          { id: 'sub_1', plotType: 'nyquist', logScale: true, aspectEqual: true, colSpan: 2 },
        ]);
        break;
      case 'dual_horiz':
        setSubplots([
          { id: 'sub_1', plotType: 'nyquist', logScale: true, aspectEqual: true, colSpan: 1 },
          { id: 'sub_2', plotType: 'bode_mag', logScale: true, aspectEqual: false, colSpan: 1 },
        ]);
        break;
      case 'dual_vert':
        setSubplots([
          { id: 'sub_1', plotType: 'nyquist', logScale: true, aspectEqual: true, colSpan: 2 },
          { id: 'sub_2', plotType: 'bode_mag', logScale: true, aspectEqual: false, colSpan: 2 },
        ]);
        break;
      case 'triple':
        setSubplots([
          { id: 'sub_1', plotType: 'nyquist', logScale: true, aspectEqual: true, colSpan: 2 },
          { id: 'sub_2', plotType: 'bode_mag', logScale: true, aspectEqual: false, colSpan: 1 },
          { id: 'sub_3', plotType: 'bode_phase', logScale: true, aspectEqual: false, colSpan: 1 },
        ]);
        break;
      case 'quad':
        setSubplots([
          { id: 'sub_1', plotType: 'nyquist', logScale: true, aspectEqual: true, colSpan: 1 },
          { id: 'sub_2', plotType: 'bode_mag', logScale: true, aspectEqual: false, colSpan: 1 },
          { id: 'sub_3', plotType: 'bode_phase', logScale: true, aspectEqual: false, colSpan: 1 },
          { id: 'sub_4', plotType: 'plot_3d', logScale: true, aspectEqual: false, colSpan: 1 },
        ]);
        break;
    }
  };

  function getPlotLabel(t: PlotType) {
    switch (t) {
      case 'nyquist': return "Nyquist Complex Plane ( -Z'' vs Z' )";
      case 'bode_mag': return 'Bode Magnitude ( |Z| vs f )';
      case 'bode_phase': return 'Bode Phase ( -Φ vs f )';
      case 'z_real_vs_f': return "Real Impedance ( Z' vs f )";
      case 'z_imag_vs_f': return "Imaginary Impedance ( -Z'' vs f )";
      case 'cprp': return 'Capacitance Cp vs Frequency';
      case 'permittivity': return "Dielectric Permittivity ( ε' vs f )";
      case 'conductivity': return "AC Conductivity ( σ' vs f )";
      case 'plot_3d': return '3D Space ( Nyquist + Freq )';
      default: return 'Impedance Trace';
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Subplot Manager Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0d111a] border border-slate-800 rounded-lg">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <LayoutGrid className="w-4 h-4 text-cyan-400" />
            <span>Subplots ({subplots.length})</span>
          </span>

          {/* Quick Preset Layouts */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-3">
            <button
              onClick={() => applyPresetLayout('single')}
              className="px-2 py-1 text-[11px] font-mono rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
              title="Single Full Chart"
            >
              1x1
            </button>
            <button
              onClick={() => applyPresetLayout('dual_horiz')}
              className="px-2 py-1 text-[11px] font-mono rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
              title="Dual Side-by-Side (1x2)"
            >
              1x2
            </button>
            <button
              onClick={() => applyPresetLayout('dual_vert')}
              className="px-2 py-1 text-[11px] font-mono rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
              title="Dual Stacked (2x1)"
            >
              2x1
            </button>
            <button
              onClick={() => applyPresetLayout('triple')}
              className="px-2 py-1 text-[11px] font-mono rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
              title="Triple View (Nyquist + Bode Mag + Phase)"
            >
              Triple
            </button>
            <button
              onClick={() => applyPresetLayout('quad')}
              className="px-2 py-1 text-[11px] font-mono rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
              title="Quad Grid (2x2)"
            >
              2x2
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            Drag handle to reposition
          </span>
          <button
            onClick={() => handleAddSubplot('nyquist')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Subplot</span>
          </button>
        </div>
      </div>

      {/* Subplots Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {subplots.map((sub, index) => {
          const isDraggingThis = draggedIndex === index;
          const isDropTarget = dragOverIndex === index;
          const isFullWidth = sub.colSpan === 2 || subplots.length === 1;

          // Datasets for this specific subplot (respecting disabled list)
          const validSubplotDatasets = datasets.map((d) => ({
            id: d.id,
            name: d.name,
            color: d.color,
            points: (d as any).points || [],
            dashed: (d as any).dashed || false,
          }));

          const firstActiveDataset = validSubplotDatasets.find(
            (d) => !(sub.disabledDatasetIds || []).includes(d.id)
          ) || validSubplotDatasets[0];

          return (
            <div
              key={sub.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex flex-col bg-[#0d111a] border rounded-lg overflow-hidden transition-all duration-150 ${
                isFullWidth ? 'md:col-span-2' : 'md:col-span-1'
              } ${
                isDropTarget
                  ? 'border-cyan-400 ring-2 ring-cyan-500/20'
                  : 'border-slate-800'
              } ${isDraggingThis ? 'opacity-40 scale-[0.98]' : 'opacity-100'}`}
            >
              {/* Subplot Header & Toolbar */}
              <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-[#111624] border-b border-slate-800 gap-2">
                {/* Drag Handle & Title / Plot Type Dropdown */}
                <div className="flex items-center gap-2">
                  <div
                    className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-slate-300 transition-colors"
                    title="Drag to reposition this subplot"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <select
                    value={sub.plotType}
                    onChange={(e) =>
                      handleUpdateSubplot(sub.id, {
                        plotType: e.target.value as PlotType,
                        aspectEqual: e.target.value === 'nyquist',
                      })
                    }
                    className="px-2.5 py-1 bg-[#090d16] border border-slate-700 rounded text-xs font-semibold text-cyan-400 focus:outline-none focus:border-cyan-400"
                  >
                    {allowedPlotTypes.map((type) => (
                      <option key={type} value={type}>
                        {getPlotLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subplot Controls */}
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  {sub.plotType === 'nyquist' && (
                    <label className="flex items-center gap-1 cursor-pointer text-[11px]">
                      <input
                        type="checkbox"
                        checked={sub.aspectEqual}
                        onChange={(e) =>
                          handleUpdateSubplot(sub.id, { aspectEqual: e.target.checked })
                        }
                        className="w-3 h-3 rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>1:1</span>
                    </label>
                  )}

                  {/* Width toggle (1 col vs 2 col) */}
                  <button
                    onClick={() =>
                      handleUpdateSubplot(sub.id, {
                        colSpan: sub.colSpan === 2 ? 1 : 2,
                      })
                    }
                    className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
                    title={sub.colSpan === 2 ? 'Make half width' : 'Make full width'}
                  >
                    {sub.colSpan === 2 ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Delete Subplot button (if more than 1) */}
                  {subplots.length > 1 && (
                    <button
                      onClick={() => handleRemoveSubplot(sub.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                      title="Remove this subplot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Subplot Body with expanded space */}
              <div className="flex-1 min-h-[480px] bg-[#0a0d14]">
                {validSubplotDatasets.length === 0 ? (
                  <div className="h-72 flex items-center justify-center p-8 text-center text-xs text-slate-500">
                    No active datasets available to display.
                  </div>
                ) : sub.plotType === 'plot_3d' ? (
                  <Chart3DViewer
                    dataset={firstActiveDataset}
                    height={getHeight(isFullWidth)}
                  />
                ) : (
                  <ScientificChart
                    datasets={validSubplotDatasets}
                    plotType={sub.plotType}
                    logScale={sub.logScale}
                    aspectEqual={sub.aspectEqual}
                    height={getHeight(isFullWidth)}
                    disabledSeriesIds={sub.disabledDatasetIds}
                    onToggleSeries={(dsId) =>
                      handleToggleDatasetOnSubplot(sub.id, dsId)
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
