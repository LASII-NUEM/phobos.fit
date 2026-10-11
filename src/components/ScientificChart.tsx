import React, { useMemo, useState } from 'react';
import { Download, Maximize2, RotateCcw, ZoomIn } from 'lucide-react';
import { EISDataset, EISPoint, PlotType } from '../types/impedance';

interface ScientificChartProps {
  datasets: {
    id: string;
    name: string;
    color: string;
    points: EISPoint[];
    dashed?: boolean;
    strokeWidth?: number;
  }[];
  plotType: PlotType;
  logScale?: boolean;
  aspectEqual?: boolean;
  height?: number;
  title?: string;
  residuals?: { freqs: number[]; deltaRe: number[]; deltaIm: number[] };
  disabledSeriesIds?: string[];
  onToggleSeries?: (seriesId: string) => void;
}

export const ScientificChart: React.FC<ScientificChartProps> = ({
  datasets,
  plotType,
  logScale = true,
  aspectEqual = false,
  height = 540,
  title,
  residuals,
  disabledSeriesIds,
  onToggleSeries,
}) => {
  const [localDisabled, setLocalDisabled] = useState<Set<string>>(new Set());

  const handleToggleSeries = (id: string) => {
    if (onToggleSeries) {
      onToggleSeries(id);
    } else {
      setLocalDisabled((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  const isSeriesDisabled = (id: string) => {
    if (disabledSeriesIds) {
      return disabledSeriesIds.includes(id);
    }
    return localDisabled.has(id);
  };

  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    datasetName: string;
    color: string;
    freq: number;
    valX: number;
    valY: number;
    labelX: string;
    labelY: string;
  } | null>(null);

  // SVG dimensions expanded for bigger, high-resolution scientific plots
  const width = 1100;
  const padding = { top: 35, right: 30, bottom: 50, left: 75 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  // Extract all series info for legend
  const allSeriesLegend = useMemo(() => {
    if (residuals) {
      return [
        { id: 'res_re', name: 'Δ_re (%)', color: '#06b6d4', disabled: isSeriesDisabled('res_re') },
        { id: 'res_im', name: 'Δ_im (%)', color: '#f59e0b', disabled: isSeriesDisabled('res_im') },
      ];
    }
    return datasets.map((ds) => ({
      id: ds.id,
      name: ds.name,
      color: ds.color,
      disabled: isSeriesDisabled(ds.id),
    }));
  }, [datasets, residuals, disabledSeriesIds, localDisabled]);

  // Extract active (X, Y) points depending on plotType
  const seriesData = useMemo(() => {
    if (residuals) {
      const items = [];
      if (!isSeriesDisabled('res_re')) {
        const rePts = residuals.freqs.map((f, i) => ({
          x: Math.log10(Math.max(f, 1e-9)),
          y: residuals.deltaRe[i],
          rawX: f,
          rawY: residuals.deltaRe[i],
          freq: f,
        }));
        items.push({ id: 'res_re', name: 'Δ_re (%)', color: '#06b6d4', points: rePts, dashed: false, strokeWidth: 2 });
      }
      if (!isSeriesDisabled('res_im')) {
        const imPts = residuals.freqs.map((f, i) => ({
          x: Math.log10(Math.max(f, 1e-9)),
          y: residuals.deltaIm[i],
          rawX: f,
          rawY: residuals.deltaIm[i],
          freq: f,
        }));
        items.push({ id: 'res_im', name: 'Δ_im (%)', color: '#f59e0b', points: imPts, dashed: true, strokeWidth: 2 });
      }
      return items;
    }

    return datasets
      .filter((ds) => !isSeriesDisabled(ds.id))
      .map((ds) => {
        const pts = ds.points
          .map((p) => {
            let rawX = 0;
            let rawY = 0;

            switch (plotType) {
              case 'nyquist':
                rawX = p.zReal;
                rawY = p.zImagNeg;
                break;
              case 'bode_mag':
                rawX = logScale ? Math.log10(Math.max(p.freq, 1e-9)) : p.freq;
                rawY = logScale ? Math.log10(Math.max(p.zMag, 1e-9)) : p.zMag;
                break;
              case 'bode_phase':
                rawX = logScale ? Math.log10(Math.max(p.freq, 1e-9)) : p.freq;
                rawY = p.phaseDeg;
                break;
              case 'z_real_vs_f':
                rawX = logScale ? Math.log10(Math.max(p.freq, 1e-9)) : p.freq;
                rawY = logScale ? Math.log10(Math.max(p.zReal, 1e-3)) : p.zReal;
                break;
              case 'z_imag_vs_f':
                rawX = logScale ? Math.log10(Math.max(p.freq, 1e-9)) : p.freq;
                rawY = logScale ? Math.log10(Math.max(p.zImagNeg, 1e-3)) : p.zImagNeg;
                break;
              case 'cprp':
                rawX = logScale ? Math.log10(Math.max(p.freq, 1e-9)) : p.freq;
                rawY = p.cp ? (logScale ? Math.log10(Math.max(p.cp, 1e-15)) : p.cp) : 0;
                break;
              case 'permittivity':
                rawX = logScale ? Math.log10(Math.max(p.freq, 1e-9)) : p.freq;
                rawY = p.epsReal ? (logScale ? Math.log10(Math.max(p.epsReal, 1e-3)) : p.epsReal) : 0;
                break;
              case 'conductivity':
                rawX = logScale ? Math.log10(Math.max(p.freq, 1e-9)) : p.freq;
                rawY = p.sigmaReal ? (logScale ? Math.log10(Math.max(p.sigmaReal, 1e-12)) : p.sigmaReal) : 0;
                break;
              default:
                rawX = p.zReal;
                rawY = p.zImagNeg;
            }

            return {
              x: isNaN(rawX) ? 0 : rawX,
              y: isNaN(rawY) ? 0 : rawY,
              rawX: plotType === 'nyquist' ? p.zReal : p.freq,
              rawY: plotType === 'nyquist' ? p.zImagNeg : p.zMag,
              freq: p.freq,
            };
          })
          .filter((pt) => !isNaN(pt.x) && !isNaN(pt.y) && isFinite(pt.x) && isFinite(pt.y));

        return {
          id: ds.id,
          name: ds.name,
          color: ds.color,
          points: pts,
          dashed: ds.dashed || false,
          strokeWidth: ds.strokeWidth || 2,
        };
      });
  }, [datasets, plotType, logScale, residuals, disabledSeriesIds, localDisabled]);

  // Compute bounding box
  const bounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    seriesData.forEach((s) => {
      s.points.forEach((pt) => {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      });
    });

    if (residuals) {
      minY = -3.5;
      maxY = 3.5;
    }

    if (minX === Infinity) {
      minX = 0;
      maxX = 1000;
      minY = 0;
      maxY = 1000;
    }

    // Add 8% margin
    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;

    let adjMinX = minX - dx * 0.05;
    let adjMaxX = maxX + dx * 0.05;
    let adjMinY = minY - dy * 0.05;
    let adjMaxY = maxY + dy * 0.05;

    // For Nyquist, anchor minimums near 0 if values are positive
    if (plotType === 'nyquist') {
      if (adjMinX > -10) adjMinX = 0;
      if (adjMinY > -10) adjMinY = 0;
      if (aspectEqual) {
        const span = Math.max(adjMaxX - adjMinX, adjMaxY - adjMinY);
        adjMaxX = adjMinX + span;
        adjMaxY = adjMinY + span;
      }
    }

    return { minX: adjMinX, maxX: adjMaxX, minY: adjMinY, maxY: adjMaxY };
  }, [seriesData, plotType, aspectEqual, residuals]);

  // Coordinate scales
  const scaleX = (val: number) => {
    const span = bounds.maxX - bounds.minX || 1;
    return padding.left + ((val - bounds.minX) / span) * plotW;
  };

  const scaleY = (val: number) => {
    const span = bounds.maxY - bounds.minY || 1;
    return padding.top + plotH - ((val - bounds.minY) / span) * plotH;
  };

  // Generate grid lines
  const gridTicks = useMemo(() => {
    const xTicks: { val: number; label: string; pos: number }[] = [];
    const yTicks: { val: number; label: string; pos: number }[] = [];

    const numTicks = 6;
    for (let i = 0; i <= numTicks; i++) {
      const vx = bounds.minX + (i / numTicks) * (bounds.maxX - bounds.minX);
      const vy = bounds.minY + (i / numTicks) * (bounds.maxY - bounds.minY);

      let lx = '';
      let ly = '';

      if (residuals) {
        lx = `10^${vx.toFixed(1)}`;
        ly = `${vy.toFixed(1)}%`;
      } else if (plotType === 'nyquist') {
        lx = vx >= 1000 ? `${(vx / 1000).toFixed(1)}k` : vx.toFixed(0);
        ly = vy >= 1000 ? `${(vy / 1000).toFixed(1)}k` : vy.toFixed(0);
      } else if (logScale && plotType !== 'bode_phase') {
        lx = `10^${vx.toFixed(1)}`;
        ly = `10^${vy.toFixed(1)}`;
      } else {
        lx = Math.abs(vx) >= 1000 ? `${(vx / 1000).toFixed(1)}k` : vx.toFixed(1);
        ly = Math.abs(vy) >= 1000 ? `${(vy / 1000).toFixed(1)}k` : vy.toFixed(1);
      }

      xTicks.push({ val: vx, label: lx, pos: scaleX(vx) });
      yTicks.push({ val: vy, label: ly, pos: scaleY(vy) });
    }

    return { xTicks, yTicks };
  }, [bounds, plotType, logScale, residuals]);

  // Axis Labels
  const axisLabels = useMemo(() => {
    if (residuals) {
      return { x: 'Frequency f (Hz) [Log Scale]', y: 'Residual Error Δ (%)' };
    }
    switch (plotType) {
      case 'nyquist':
        return { x: "Real Impedance Z' (Ω)", y: "-Z'' Imaginary Impedance (Ω)" };
      case 'bode_mag':
        return {
          x: logScale ? 'Frequency log10(f / Hz)' : 'Frequency f (Hz)',
          y: logScale ? '|Z| Magnitude log10(Ω)' : '|Z| Magnitude (Ω)',
        };
      case 'bode_phase':
        return {
          x: logScale ? 'Frequency log10(f / Hz)' : 'Frequency f (Hz)',
          y: 'Phase Angle -Φ (deg)',
        };
      case 'z_real_vs_f':
        return { x: 'Frequency (Hz)', y: "Real Part Z' (Ω)" };
      case 'z_imag_vs_f':
        return { x: 'Frequency (Hz)', y: "-Z'' Imaginary Part (Ω)" };
      case 'cprp':
        return { x: 'Frequency (Hz)', y: 'Equivalent Capacitance Cp (F)' };
      case 'permittivity':
        return { x: 'Frequency (Hz)', y: "Dielectric Permittivity ε'" };
      case 'conductivity':
        return { x: 'Frequency (Hz)', y: "AC Conductivity σ' (S/m)" };
      default:
        return { x: "Z' (Ω)", y: "-Z'' (Ω)" };
    }
  }, [plotType, logScale, residuals]);

  // Export CSV
  const handleExportCSV = () => {
    let csv = `Dataset,Freq_Hz,Z_Real_Ohm,Z_Imag_Ohm,Z_Mag_Ohm,Phase_Deg\n`;
    datasets.forEach((ds) => {
      ds.points.forEach((p) => {
        csv += `"${ds.name}",${p.freq},${p.zReal},${p.zImag},${p.zMag},${p.phaseDeg}\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phobos_export_${plotType}_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="relative flex flex-col bg-[#0d111a] border border-slate-800 rounded-lg overflow-hidden">
      {/* Chart Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-[#111624]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-200 tracking-wide">
            {title || axisLabels.y}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {plotType === 'nyquist' ? 'Nyquist Complex Plane' : 'Spectroscopic Trace'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Interactive Legend with toggle enable/disable */}
          <div className="flex items-center gap-2 text-xs font-medium flex-wrap max-w-md">
            {allSeriesLegend.map((s) => (
              <button
                key={s.id}
                onClick={() => handleToggleSeries(s.id)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer ${
                  s.disabled
                    ? 'opacity-40 hover:opacity-75 bg-slate-900/60 line-through text-slate-500 border border-transparent'
                    : 'bg-[#151c2d] hover:bg-slate-800 text-slate-200 border border-slate-700/60'
                }`}
                title={s.disabled ? `Click to enable ${s.name}` : `Click to disable ${s.name}`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 transition-transform"
                  style={{
                    backgroundColor: s.disabled ? 'transparent' : s.color,
                    border: `1.5px solid ${s.color}`,
                  }}
                />
                <span className="font-mono text-[11px] truncate max-w-[120px]">
                  {s.name}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors whitespace-nowrap shrink-0"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative p-3 flex items-center justify-center bg-[#0a0d14]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible"
          style={{ minHeight: `${Math.min(height, 460)}px`, maxHeight: `${Math.max(height * 1.3, 850)}px` }}
        >
          <defs>
            <clipPath id="plot-area-clip">
              <rect x={padding.left} y={padding.top} width={plotW} height={plotH} />
            </clipPath>
          </defs>

          {/* Plot Background */}
          <rect
            x={padding.left}
            y={padding.top}
            width={plotW}
            height={plotH}
            fill="#0d111a"
            stroke="#1c2436"
            strokeWidth="1"
          />

          {/* Horizontal Grid lines */}
          {gridTicks.yTicks.map((t, idx) => (
            <g key={`y-${idx}`}>
              <line
                x1={padding.left}
                y1={t.pos}
                x2={padding.left + plotW}
                y2={t.pos}
                stroke="#1e293b"
                strokeWidth="1"
                strokeDasharray={t.val === 0 ? 'none' : '3 3'}
                strokeOpacity={t.val === 0 ? 0.8 : 0.4}
              />
              <text
                x={padding.left - 10}
                y={t.pos + 4}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-mono tabular-nums"
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* Vertical Grid lines */}
          {gridTicks.xTicks.map((t, idx) => (
            <g key={`x-${idx}`}>
              <line
                x1={t.pos}
                y1={padding.top}
                x2={t.pos}
                y2={padding.top + plotH}
                stroke="#1e293b"
                strokeWidth="1"
                strokeDasharray="3 3"
                strokeOpacity="0.4"
              />
              <text
                x={t.pos}
                y={padding.top + plotH + 18}
                textAnchor="middle"
                className="fill-slate-400 text-[10px] font-mono tabular-nums"
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* Lin-KK Residual Acceptance Bands (±1%) */}
          {residuals && (
            <g clipPath="url(#plot-area-clip)">
              <rect
                x={padding.left}
                y={scaleY(1.0)}
                width={plotW}
                height={scaleY(-1.0) - scaleY(1.0)}
                fill="#10b981"
                fillOpacity="0.06"
              />
              <line
                x1={padding.left}
                y1={scaleY(1.0)}
                x2={padding.left + plotW}
                y2={scaleY(1.0)}
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="4 2"
                strokeOpacity="0.6"
              />
              <line
                x1={padding.left}
                y1={scaleY(-1.0)}
                x2={padding.left + plotW}
                y2={scaleY(-1.0)}
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="4 2"
                strokeOpacity="0.6"
              />
              <text
                x={padding.left + plotW - 10}
                y={scaleY(1.0) - 5}
                textAnchor="end"
                className="fill-emerald-400 text-[9px] font-mono"
              >
                +1.0% Threshold
              </text>
              <text
                x={padding.left + plotW - 10}
                y={scaleY(-1.0) + 12}
                textAnchor="end"
                className="fill-emerald-400 text-[9px] font-mono"
              >
                -1.0% Threshold
              </text>
            </g>
          )}

          {/* Plot Curves & Points */}
          <g clipPath="url(#plot-area-clip)">
            {seriesData.length === 0 && (
              <text
                x={padding.left + plotW / 2}
                y={padding.top + plotH / 2}
                textAnchor="middle"
                className="fill-slate-500 text-xs font-mono"
              >
                All series disabled for this chart. Click legend above to enable.
              </text>
            )}

            {seriesData.map((s, sIdx) => {
              if (s.points.length === 0) return null;

              // Build SVG Path
              let pathStr = '';
              s.points.forEach((pt, idx) => {
                const sx = scaleX(pt.x);
                const sy = scaleY(pt.y);
                if (idx === 0) pathStr += `M ${sx} ${sy} `;
                else pathStr += `L ${sx} ${sy} `;
              });

              return (
                <g key={sIdx}>
                  {/* Connecting trace */}
                  <path
                    d={pathStr}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.strokeWidth || 2}
                    strokeDasharray={s.dashed ? '4 3' : 'none'}
                    strokeOpacity={s.dashed ? 0.8 : 0.9}
                  />

                  {/* Scatter markers */}
                  {s.points.map((pt, pIdx) => {
                    const sx = scaleX(pt.x);
                    const sy = scaleY(pt.y);

                    return (
                      <circle
                        key={pIdx}
                        cx={sx}
                        cy={sy}
                        r={s.dashed ? 2.5 : 3.5}
                        fill="#090d16"
                        stroke={s.color}
                        strokeWidth="1.5"
                        className="cursor-crosshair transition-all hover:scale-150"
                        onMouseEnter={() => {
                          setHoveredPoint({
                            x: sx,
                            y: sy,
                            datasetName: s.name,
                            color: s.color,
                            freq: pt.freq ?? pt.rawX,
                            valX: pt.rawX,
                            valY: pt.rawY,
                            labelX: axisLabels.x,
                            labelY: axisLabels.y,
                          });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>

          {/* Axis Titles */}
          <text
            x={padding.left + plotW / 2}
            y={height - 10}
            textAnchor="middle"
            className="fill-slate-300 text-xs font-medium tracking-wider"
          >
            {axisLabels.x}
          </text>

          <text
            x={-padding.top - plotH / 2}
            y={20}
            transform="rotate(-90)"
            textAnchor="middle"
            className="fill-slate-300 text-xs font-medium tracking-wider"
          >
            {axisLabels.y}
          </text>
        </svg>

        {/* HUD Hover Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute pointer-events-none z-30 px-3 py-2 bg-[#0f172a]/95 border border-cyan-500/40 rounded-lg shadow-xl backdrop-blur-md text-[11px] font-mono tabular-nums text-slate-200"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${Math.max(10, (hoveredPoint.y / height) * 100 - 25)}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="flex items-center gap-1.5 font-bold mb-1" style={{ color: hoveredPoint.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hoveredPoint.color }} />
              <span>{hoveredPoint.datasetName}</span>
            </div>
            {hoveredPoint.freq !== undefined && (
              <div>
                <span className="text-slate-400">Freq: </span>
                {hoveredPoint.freq >= 1000 ? `${(hoveredPoint.freq / 1000).toFixed(2)} kHz` : `${hoveredPoint.freq.toFixed(2)} Hz`}
              </div>
            )}
            <div>
              <span className="text-slate-400">X: </span>
              {hoveredPoint.valX.toExponential(3)}
            </div>
            <div>
              <span className="text-slate-400">Y: </span>
              {hoveredPoint.valY.toExponential(3)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
