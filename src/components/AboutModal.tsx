import React from 'react';
import {
  X,
  GitBranch,
  ExternalLink,
  Server,
  Globe,
  Cpu,
  ArrowRight,
  Database,
  CheckCircle2,
  Layers,
  Code2,
  Workflow,
  Sparkles,
} from 'lucide-react';
import { RENDER_BACKEND_URL, FRONTEND_URL, GITHUB_FRONTEND_REPO, GITHUB_BACKEND_REPO } from '../config/api';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  isBackendOnline: boolean | null;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  isBackendOnline,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0b0f19] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0f1422] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Workflow className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 tracking-wide flex items-center gap-2">
                <span>About PHOBOS Zfit</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono">
                  Architecture Flowchart
                </span>
              </h2>
              <span className="text-[11px] text-slate-400">
                Full-stack decoupled infrastructure & operational data flow
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Executive Summary */}
          <div className="p-4 rounded-xl bg-[#07090e] border border-slate-800/80 flex flex-col gap-2">
            <div className="text-xs font-semibold text-slate-200">
              System Architecture Overview
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              PHOBOS Zfit is an advanced scientific web service for Electrochemical Impedance Spectroscopy (EIS). 
              The application uses a <strong className="text-cyan-300">modern decoupled cloud architecture</strong>: 
              a high-speed static frontend hosted on <strong className="text-slate-200">GitHub Pages</strong> with custom domain (<strong className="text-cyan-400">phobos.fit</strong>), 
              connected through secure HTTPS asynchronous REST calls to a high-precision <strong className="text-emerald-400">Python Flask API</strong> deployed on <strong className="text-slate-200">Render</strong>.
            </p>
          </div>

          {/* Interactive Flowchart Diagram */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-cyan-400" />
                <span>Service Interaction Flowchart</span>
              </span>
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-slate-500">Live Status:</span>
                <span className={`px-2 py-0.5 rounded border ${
                  isBackendOnline === true
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : isBackendOnline === false
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                  {isBackendOnline === true
                    ? 'Render Flask Online'
                    : isBackendOnline === false
                    ? 'Render Flask Standby'
                    : 'Probing...'}
                </span>
              </div>
            </div>

            {/* Visual Nodes Pipeline */}
            <div className="p-5 rounded-xl bg-[#080c14] border border-slate-800 flex flex-col md:flex-row items-stretch justify-between gap-3 relative">
              {/* Node 1: Client Browser */}
              <div className="flex-1 p-4 rounded-lg bg-[#0e1320] border border-slate-700/70 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-7 h-7 rounded bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">Step 1</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">Scientist Browser</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">User Interface & Local AST</div>
                </div>
                <div className="text-[10px] font-mono text-slate-500 bg-[#07090e] p-2 rounded border border-slate-800/80 mt-auto">
                  • File parsing (.csv/.xlsx)<br />
                  • 2D/3D Canvas rendering<br />
                  • Circuit syntax validation
                </div>
              </div>

              {/* Connecting Arrow 1 */}
              <div className="hidden md:flex flex-col items-center justify-center text-cyan-400 px-1">
                <ArrowRight className="w-5 h-5 animate-pulse" />
                <span className="text-[9px] font-mono text-slate-500 mt-1">HTTPS</span>
              </div>

              {/* Node 2: GitHub Pages (Host) */}
              <div className="flex-1 p-4 rounded-lg bg-[#0e1320] border border-cyan-500/40 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-7 h-7 rounded bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">Static Host</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-cyan-300">GitHub Pages</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">https://phobos.fit</div>
                </div>
                <div className="text-[10px] font-mono text-slate-400 bg-[#07090e] p-2 rounded border border-slate-800/80 mt-auto">
                  • React 19 + Vite SPA<br />
                  • CI/CD via GitHub Actions<br />
                  • Custom Domain & CNAME
                </div>
              </div>

              {/* Connecting Arrow 2 */}
              <div className="hidden md:flex flex-col items-center justify-center text-emerald-400 px-1">
                <ArrowRight className="w-5 h-5 animate-pulse" />
                <span className="text-[9px] font-mono text-slate-500 mt-1">REST API</span>
              </div>

              {/* Node 3: Render (Flask Backend) */}
              <div className="flex-1 p-4 rounded-lg bg-[#0e1320] border border-emerald-500/40 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-7 h-7 rounded bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Server className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">Compute API</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-300">Render Cloud Web Service</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[200px]" title={RENDER_BACKEND_URL}>
                    phobos-zfit-api.onrender.com
                  </div>
                </div>
                <div className="text-[10px] font-mono text-slate-400 bg-[#07090e] p-2 rounded border border-slate-800/80 mt-auto">
                  • Python Flask Engine<br />
                  • SciPy & Impedance.py<br />
                  • LM, BFGS, Nelder-Mead
                </div>
              </div>
            </div>
          </div>

          {/* Infrastructure Details Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Frontend Info */}
            <div className="p-4 rounded-xl bg-[#080c14] border border-slate-800 flex flex-col justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-200 flex items-center gap-2 mb-1">
                  <Code2 className="w-4 h-4 text-cyan-400" />
                  <span>Frontend Client Repository</span>
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Contains the modern React UI, visual circuit mounting canvas, multi-subplot scientific charting, and Lin-KK validation test.
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 font-mono">LASII-NUEM / phobos.fit</span>
                <a
                  href={GITHUB_FRONTEND_REPO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  <span>View GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Backend Info */}
            <div className="p-4 rounded-xl bg-[#080c14] border border-slate-800 flex flex-col justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-200 flex items-center gap-2 mb-1">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Python Flask Backend Repository</span>
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Houses the Python core (<code className="text-emerald-400 font-mono text-[10px]">ECM_utils</code>, <code className="text-emerald-400 font-mono text-[10px]">app.py</code>) running on Render, performing numerical optimizations and validations.
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 font-mono">LASII-NUEM / PHOBOS_Zfit</span>
                <a
                  href={GITHUB_BACKEND_REPO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  <span>View GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Institutional Credit */}
          <div className="p-3.5 rounded-lg bg-[#070a12] border border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <div>
              <span className="font-semibold text-slate-200">Developed by LASII - NUEM - UTFPR</span>
              <span className="text-slate-500 ml-2">Federal University of Technology - Paraná</span>
            </div>
            <div className="text-slate-500 font-mono text-[10px]">
              Host: GitHub Pages • API: Render
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#0f1422] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
