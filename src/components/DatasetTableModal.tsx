import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Table,
  Download,
  Copy,
  Check,
  Search,
  FileSpreadsheet,
  Layers,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { EISDataset, EISPoint } from '../types/impedance';

interface DatasetTableModalProps {
  dataset: EISDataset | null;
  isOpen: boolean;
  onClose: () => void;
  allDatasets?: EISDataset[];
  onSelectDataset?: (ds: EISDataset) => void;
}

export const DatasetTableModal: React.FC<DatasetTableModalProps> = ({
  dataset,
  isOpen,
  onClose,
  allDatasets = [],
  onSelectDataset,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [formatMode, setFormatMode] = useState<'scientific' | 'standard'>('scientific');
  const [sortField, setSortField] = useState<keyof EISPoint>('freq');
  const [sortAsc, setSortAsc] = useState(true);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Check if dataset has Phobos or valid Cp/Rp measurements
  const hasCpRp = useMemo(() => {
    if (!dataset) return false;
    if (dataset.sourceType === 'example') return false;
    return (
      dataset.sourceType === 'phobos' ||
      dataset.style === 'electrical' ||
      dataset.points.some((p) => (p.cp !== undefined && p.cp > 0) || (p.rp !== undefined && p.rp > 0))
    );
  }, [dataset]);

  // Formatter helper
  const formatNum = (val: number | undefined, decimals = 4): string => {
    if (val === undefined || isNaN(val)) return '—';
    if (val === 0) return '0.000';
    if (formatMode === 'scientific') {
      const absVal = Math.abs(val);
      if (absVal < 0.01 || absVal >= 10000) {
        return val.toExponential(decimals);
      }
      return val.toFixed(decimals);
    } else {
      if (Math.abs(val) < 1e-4) return val.toExponential(decimals);
      return val.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: decimals,
      });
    }
  };

  // Filtered and sorted points
  const processedPoints = useMemo(() => {
    if (!dataset) return [];

    let list = dataset.points.map((p, idx) => ({ ...p, originalIndex: idx + 1 }));

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((p) => {
        return (
          p.originalIndex.toString().includes(term) ||
          p.freq.toString().includes(term) ||
          p.freq.toExponential(3).toLowerCase().includes(term) ||
          p.zReal.toString().includes(term) ||
          p.zImagNeg.toString().includes(term) ||
          p.zMag.toString().includes(term) ||
          (p.cp !== undefined && p.cp.toString().includes(term)) ||
          (p.rp !== undefined && p.rp.toString().includes(term))
        );
      });
    }

    list.sort((a, b) => {
      const valA = (a as any)[sortField] ?? 0;
      const valB = (b as any)[sortField] ?? 0;
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [dataset, searchTerm, sortField, sortAsc]);

  // Statistics
  const stats = useMemo(() => {
    if (!dataset || dataset.points.length === 0) return null;
    const pts = dataset.points;
    const freqs = pts.map((p) => p.freq);
    const zMags = pts.map((p) => p.zMag);
    const cps = pts.map((p) => p.cp).filter((c): c is number => c !== undefined && c > 0);

    return {
      count: pts.length,
      minFreq: Math.min(...freqs),
      maxFreq: Math.max(...freqs),
      minZMag: Math.min(...zMags),
      maxZMag: Math.max(...zMags),
      avgCp: cps.length > 0 ? cps.reduce((a, b) => a + b, 0) / cps.length : null,
    };
  }, [dataset]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!dataset) return;
    let headers = ['#', 'Frequency_Hz', 'Z_Real_Ohm', 'Z_Imag_Ohm', 'Neg_Z_Imag_Ohm', 'Z_Mag_Ohm', 'Phase_Deg'];
    if (hasCpRp) {
      headers.push('Cp_Farads', 'Rp_Ohm');
    }

    const rows = dataset.points.map((p, idx) => {
      const row: (number | string)[] = [
        idx + 1,
        p.freq,
        p.zReal,
        p.zImag,
        p.zImagNeg,
        p.zMag,
        p.phaseDeg,
      ];
      if (hasCpRp) {
        row.push(p.cp ?? '', p.rp ?? '');
      }
      return row.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataset.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_data_table.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy to clipboard
  const handleCopyClipboard = async () => {
    if (!dataset) return;
    let headers = ['#', 'Freq (Hz)', "Z' Real (Ω)", "Z'' Imag (Ω)", "-Z'' (Ω)", '|Z| Mag (Ω)', 'Phase (deg)'];
    if (hasCpRp) {
      headers.push('Cp (F)', 'Rp (Ω)');
    }

    const rows = processedPoints.map((p) => {
      const row: (number | string)[] = [
        p.originalIndex,
        p.freq,
        p.zReal,
        p.zImag,
        p.zImagNeg,
        p.zMag,
        p.phaseDeg,
      ];
      if (hasCpRp) {
        row.push(p.cp ?? '', p.rp ?? '');
      }
      return row.join('\t');
    });

    const tsvContent = [headers.join('\t'), ...rows].join('\n');
    try {
      await navigator.clipboard.writeText(tsvContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleSort = (field: keyof EISPoint) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  if (!isOpen || !dataset) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-table-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-[#0d111a] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#111624] border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
              style={{ backgroundColor: dataset.color }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="data-table-modal-title" className="text-sm sm:text-base font-bold text-slate-100 truncate">
                  {dataset.name}
                </h3>
                {dataset.sourceType === 'example' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    Example Data
                  </span>
                ) : dataset.sourceType === 'phobos' || dataset.style === 'electrical' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Phobos EIS
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    Chemistry EIS
                  </span>
                )}
                {dataset.mode && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    Mode: {dataset.mode}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                Source: {dataset.originalFilename || 'Manual / Imported'}
              </p>
            </div>
          </div>

          {/* Quick dataset switcher if multiple datasets exist */}
          {allDatasets.length > 1 && onSelectDataset && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium hidden md:inline">Series:</span>
              <select
                value={dataset.id}
                onChange={(e) => {
                  const target = allDatasets.find((d) => d.id === e.target.value);
                  if (target) onSelectDataset(target);
                }}
                className="px-2.5 py-1 bg-[#090d16] border border-slate-700 rounded text-xs font-semibold text-cyan-400 focus:outline-none focus:border-cyan-400"
              >
                {allDatasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.points.length} pts)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyClipboard}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Copy table to clipboard as TSV (pasteable in Excel / Origin)"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy TSV</span>
                </>
              )}
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg transition-colors cursor-pointer shadow-sm"
              title="Download full series data as .csv file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
              title="Close modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dataset Summary & Metrics Bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 px-5 py-2.5 bg-[#090d16] border-b border-slate-800 text-xs font-mono">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Points Count</span>
              <span className="text-slate-200 font-bold">{stats.count}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Freq Range</span>
              <span className="text-slate-200 truncate">
                {formatNum(stats.minFreq, 1)} Hz → {formatNum(stats.maxFreq, 1)} Hz
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">|Z| Range</span>
              <span className="text-cyan-300 truncate">
                {formatNum(stats.minZMag, 2)} → {formatNum(stats.maxZMag, 2)} Ω
              </span>
            </div>
            {hasCpRp && stats.avgCp !== null && (
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Avg Cp</span>
                <span className="text-amber-300 truncate">{formatNum(stats.avgCp, 3)} F</span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Format</span>
              <span className="text-slate-400">
                {dataset.sourceType === 'example'
                  ? 'Example Data'
                  : dataset.sourceType === 'phobos'
                  ? 'Phobos Swept'
                  : 'Chemistry EIS'}
              </span>
            </div>
          </div>
        )}

        {/* Toolbar: Search & Notation Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#0c101a] border-b border-slate-800">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search points by freq or value..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-[#070a10] border border-slate-700/80 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
              {processedPoints.length} / {dataset.points.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Notation:</span>
            <div className="flex items-center border border-slate-700 rounded-md p-0.5 bg-[#070a10]">
              <button
                onClick={() => setFormatMode('scientific')}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                  formatMode === 'scientific'
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                1.23e+4
              </button>
              <button
                onClick={() => setFormatMode('standard')}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                  formatMode === 'standard'
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                12,340.00
              </button>
            </div>
          </div>
        </div>

        {/* Tabular Viewport */}
        <div className="flex-1 overflow-auto max-h-[62vh] relative">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead className="sticky top-0 z-10 bg-[#121726] border-b border-slate-700 shadow-sm text-slate-300">
              <tr>
                <th
                  onClick={() => handleSort('freq')}
                  className="py-2.5 px-3 text-slate-400 font-semibold cursor-pointer hover:text-cyan-400 transition-colors w-14"
                >
                  <div className="flex items-center gap-1">
                    <span>#</span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('freq')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Freq (Hz)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('zReal')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Z' Real (Ω)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('zImag')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Z'' Imag (Ω)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('zImagNeg')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>-Z'' (Ω)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('zMag')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>|Z| Mag (Ω)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('phaseDeg')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Phase (°)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                {hasCpRp && (
                  <>
                    <th
                      onClick={() => handleSort('cp')}
                      className="py-2.5 px-3 font-semibold text-amber-300 cursor-pointer hover:text-amber-200 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Cp (F)</span>
                        <ArrowUpDown className="w-3 h-3 text-amber-500" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('rp')}
                      className="py-2.5 px-3 font-semibold text-amber-300 cursor-pointer hover:text-amber-200 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Rp (Ω)</span>
                        <ArrowUpDown className="w-3 h-3 text-amber-500" />
                      </div>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-[#0a0e17]">
              {processedPoints.length === 0 ? (
                <tr>
                  <td
                    colSpan={hasCpRp ? 9 : 7}
                    className="py-8 text-center text-slate-500 italic font-sans"
                  >
                    No impedance points match search "{searchTerm}".
                  </td>
                </tr>
              ) : (
                processedPoints.map((p) => (
                  <tr
                    key={p.originalIndex}
                    className="hover:bg-cyan-500/5 transition-colors group"
                  >
                    <td className="py-2 px-3 text-slate-500 group-hover:text-slate-300">
                      {p.originalIndex}
                    </td>
                    <td className="py-2 px-3 text-cyan-300 font-semibold">
                      {formatNum(p.freq, 3)}
                    </td>
                    <td className="py-2 px-3 text-slate-200">
                      {formatNum(p.zReal, 4)}
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      {formatNum(p.zImag, 4)}
                    </td>
                    <td className="py-2 px-3 text-slate-200 font-semibold">
                      {formatNum(p.zImagNeg, 4)}
                    </td>
                    <td className="py-2 px-3 text-slate-200">
                      {formatNum(p.zMag, 4)}
                    </td>
                    <td className="py-2 px-3 text-slate-300">
                      {p.phaseDeg !== undefined ? p.phaseDeg.toFixed(2) : '—'}
                    </td>
                    {hasCpRp && (
                      <>
                        <td className="py-2 px-3 text-amber-300">
                          {p.cp !== undefined ? formatNum(p.cp, 4) : '—'}
                        </td>
                        <td className="py-2 px-3 text-amber-200">
                          {p.rp !== undefined ? formatNum(p.rp, 4) : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#111624] border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                Displaying {processedPoints.length} of {dataset.points.length} measurements
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500">
              Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Esc</kbd> to exit
            </span>
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
