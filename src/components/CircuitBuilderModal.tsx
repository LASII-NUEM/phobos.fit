import React, { useMemo, useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  ArrowRight,
  RefreshCw,
  GitBranch,
  Split,
  Sparkles,
} from 'lucide-react';
import { CircuitMockupIcon } from './icons/CustomIcons';
import { CircuitElement, ComponentType, PresetCircuit } from '../types/impedance';
import {
  ASTNode,
  DEFAULT_SCALES,
  PRESET_CIRCUITS,
  extractComponentNames,
  formatEngineering,
  inferComponentType,
  parseCircuit,
  tokenizeCircuit,
} from '../utils/circuitEngine';

interface CircuitBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentExpression: string;
  currentElements: CircuitElement[];
  onApplyCircuit: (expression: string, elements: CircuitElement[]) => void;
  onSavePreset: (preset: PresetCircuit) => void;
}

// Visual Component schematic icons
const ResistorSymbol = () => (
  <svg viewBox="0 0 60 28" className="w-12 h-6 stroke-cyan-400 fill-none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="14" x2="12" y2="14" />
    <path d="M12 14l3.5 -8 6 16 6 -16 6 16 6 -16 3.5 8" />
    <line x1="43" y1="14" x2="58" y2="14" />
  </svg>
);

const CapacitorSymbol = () => (
  <svg viewBox="0 0 60 28" className="w-12 h-6 stroke-blue-400 fill-none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="14" x2="26" y2="14" />
    <line x1="26" y1="5" x2="26" y2="23" strokeWidth="3.2" />
    <line x1="34" y1="5" x2="34" y2="23" strokeWidth="3.2" />
    <line x1="34" y1="14" x2="58" y2="14" />
  </svg>
);

const InductorSymbol = () => (
  <svg viewBox="0 0 60 28" className="w-12 h-6 stroke-purple-400 fill-none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="16" x2="12" y2="16" />
    <path d="M12 16 A6 6 0 0 1 24 16 A6 6 0 0 1 36 16 A6 6 0 0 1 48 16" />
    <line x1="48" y1="16" x2="58" y2="16" />
  </svg>
);

const CPESymbol = () => (
  <svg viewBox="0 0 60 28" className="w-12 h-6 stroke-amber-400 fill-none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="14" x2="24" y2="14" />
    <path d="M22 6 L28 14 L22 22" strokeWidth="3" />
    <path d="M32 6 L38 14 L32 22" strokeWidth="3" />
    <line x1="36" y1="14" x2="58" y2="14" />
  </svg>
);

const WarburgSymbol = () => (
  <svg viewBox="0 0 60 28" className="w-12 h-6 stroke-emerald-400 fill-none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="14" x2="16" y2="14" />
    <rect x="16" y="5" width="28" height="18" rx="2" strokeWidth="2" className="fill-emerald-500/10" />
    <text x="30" y="18" textAnchor="middle" className="fill-emerald-400" fontSize="11" fontWeight="bold" fontFamily="monospace">W</text>
    <line x1="44" y1="14" x2="58" y2="14" />
  </svg>
);

// AST Helper Functions
function flattenSeries(node: ASTNode): ASTNode[] {
  if (node.type === 'SERIES') {
    return [...flattenSeries(node.left), ...flattenSeries(node.right)];
  }
  return [node];
}

function flattenParallel(node: ASTNode): ASTNode[] {
  if (node.type === 'PARALLEL') {
    return [...flattenParallel(node.left), ...flattenParallel(node.right)];
  }
  return [node];
}

function astToFormula(node: ASTNode): string {
  if (node.type === 'COMPONENT') return node.name;
  if (node.type === 'SERIES') {
    return `${astToFormula(node.left)} + ${astToFormula(node.right)}`;
  }
  if (node.type === 'PARALLEL') {
    const leftStr = node.left.type === 'SERIES' ? `(${astToFormula(node.left)})` : astToFormula(node.left);
    const rightStr = node.right.type === 'SERIES' ? `(${astToFormula(node.right)})` : astToFormula(node.right);
    return `(${leftStr} // ${rightStr})`;
  }
  return '';
}

function removeNodeFromAST(ast: ASTNode, targetName: string): ASTNode | null {
  if (ast.type === 'COMPONENT') {
    return ast.name === targetName ? null : ast;
  }
  const newLeft = removeNodeFromAST(ast.left, targetName);
  const newRight = removeNodeFromAST(ast.right, targetName);
  if (!newLeft && !newRight) return null;
  if (!newLeft) return newRight;
  if (!newRight) return newLeft;
  return { ...ast, left: newLeft, right: newRight };
}

function addParallelToNode(ast: ASTNode, targetName: string, newComponentName: string): ASTNode {
  if (ast.type === 'COMPONENT' && ast.name === targetName) {
    return {
      type: 'PARALLEL',
      left: ast,
      right: { type: 'COMPONENT', name: newComponentName },
    };
  }
  if (ast.type === 'SERIES' || ast.type === 'PARALLEL') {
    return {
      ...ast,
      left: addParallelToNode(ast.left, targetName, newComponentName),
      right: addParallelToNode(ast.right, targetName, newComponentName),
    };
  }
  return ast;
}

function insertSeriesNode(ast: ASTNode, targetName: string, newComponentName: string, after = true): ASTNode {
  if (ast.type === 'COMPONENT' && ast.name === targetName) {
    const newComp: ASTNode = { type: 'COMPONENT', name: newComponentName };
    return after
      ? { type: 'SERIES', left: ast, right: newComp }
      : { type: 'SERIES', left: newComp, right: ast };
  }
  if (ast.type === 'SERIES' || ast.type === 'PARALLEL') {
    return {
      ...ast,
      left: insertSeriesNode(ast.left, targetName, newComponentName, after),
      right: insertSeriesNode(ast.right, targetName, newComponentName, after),
    };
  }
  return ast;
}

function getNextComponentName(type: ComponentType, currentNames: string[]): string {
  const prefix = type === 'CPE' ? 'CPE' : type;
  let num = 1;
  while (currentNames.includes(`${prefix}${num}`)) {
    num++;
  }
  return `${prefix}${num}`;
}

export const CircuitBuilderModal: React.FC<CircuitBuilderModalProps> = ({
  isOpen,
  onClose,
  currentExpression,
  currentElements,
  onApplyCircuit,
  onSavePreset,
}) => {
  // When called, start with an empty circuit (no pre-loaded model, empty table)
  const [expression, setExpression] = useState<string>('');
  const [circuitName, setCircuitName] = useState<string>('');
  const [circuitDesc, setCircuitDesc] = useState<string>('');
  const [elements, setElements] = useState<CircuitElement[]>([]);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState<boolean>(true);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [draggedType, setDraggedType] = useState<ComponentType | null>(null);
  const [parallelTarget, setParallelTarget] = useState<string | null>(null);

  // When called/opened, reset to empty circuit and empty table
  React.useEffect(() => {
    if (isOpen) {
      setExpression('');
      setElements([]);
      setCircuitName('');
      setCircuitDesc('');
      setSyntaxError(null);
      setValidationSuccess(true);
      setParallelTarget(null);
    }
  }, [isOpen]);

  // Active AST parsed from expression
  const activeAST = useMemo<ASTNode | null>(() => {
    try {
      if (!expression.trim()) return null;
      // Handle trailing open parallel branch gracefully
      const cleanExpr = expression.trim().replace(/\/\/\s*$/, '').trim();
      if (!cleanExpr) return null;
      const tokens = tokenizeCircuit(cleanExpr);
      return parseCircuit(tokens);
    } catch {
      return null;
    }
  }, [expression]);

  if (!isOpen) return null;

  // Component palette definitions
  const PALETTE_COMPONENTS: {
    type: ComponentType;
    label: string;
    description: string;
    unit: string;
    color: string;
    badge: string;
  }[] = [
    { type: 'R', label: 'Resistance (R)', description: 'Ohmic / charge-transfer resistor', unit: 'Ω', color: '#06b6d4', badge: 'R' },
    { type: 'C', label: 'Capacitance (C)', description: 'Double layer or dielectric capacitor', unit: 'F', color: '#3b82f6', badge: 'C' },
    { type: 'L', label: 'Inductor (L)', description: 'High frequency or cable lead inductance', unit: 'H', color: '#8b5cf6', badge: 'L' },
    { type: 'CPE', label: 'Constant Phase (CPE)', description: 'Non-ideal capacitance with exponent α', unit: 'S·s^α', color: '#f59e0b', badge: 'Q' },
    { type: 'W', label: 'Warburg (W)', description: 'Semi-infinite diffusion impedance', unit: 'Ω·s^-0.5', color: '#10b981', badge: 'W' },
  ];

  // Validate expression syntax and sync elements list
  const validateExpression = (expr: string) => {
    try {
      const trimmed = expr.trim();
      if (!trimmed) {
        setSyntaxError(null);
        setValidationSuccess(true);
        setElements([]);
        return;
      }

      if (trimmed.endsWith('//')) {
        setSyntaxError('Parallel branch enabled. Click any component from the palette to define it.');
        setValidationSuccess(false);
        return;
      }

      const tokens = tokenizeCircuit(trimmed);
      const ast = parseCircuit(tokens);
      const names = extractComponentNames(ast);

      // Synchronize elements list with found component names
      const updatedElements: CircuitElement[] = names.map((name, idx) => {
        const existing = elements.find((e) => e.label === name);
        const type = inferComponentType(name);
        const def = DEFAULT_SCALES[type];

        if (existing) {
          return existing;
        }

        return {
          id: `elem_${name}_${idx}`,
          type,
          label: name,
          value: def.defaultVal,
          alpha: type === 'CPE' ? 0.9 : undefined,
          isFit: true,
          scale: def.scale,
          minBound: def.min,
          maxBound: def.max,
        };
      });

      setElements(updatedElements);
      setSyntaxError(null);
      setValidationSuccess(true);
    } catch (err: any) {
      setSyntaxError(err.message || 'Syntax error in circuit expression');
      setValidationSuccess(false);
    }
  };

  const currentNames = elements.map((e) => e.label);

  // Apply visual canvas modification to formula
  const updateFormulaFromAST = (newAST: ASTNode | null) => {
    if (!newAST) {
      setExpression('');
      validateExpression('');
      return;
    }
    const newExpr = astToFormula(newAST);
    setExpression(newExpr);
    validateExpression(newExpr);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, type: ComponentType) => {
    setDraggedType(type);
    e.dataTransfer.setData('componentType', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAppendSeries = (type: ComponentType) => {
    if (parallelTarget) {
      const nextName = getNextComponentName(type, currentNames);
      if (activeAST) {
        const newAST = addParallelToNode(activeAST, parallelTarget, nextName);
        updateFormulaFromAST(newAST);
      }
      setParallelTarget(null);
      return;
    }

    const nextName = getNextComponentName(type, currentNames);
    let newExpr = expression.trim();
    if (!newExpr) {
      newExpr = nextName;
    } else if (newExpr.endsWith('//')) {
      newExpr = `${newExpr} ${nextName}`;
    } else if (newExpr.endsWith('+') || newExpr.endsWith('(')) {
      newExpr = `${newExpr} ${nextName}`;
    } else {
      newExpr = `${newExpr} + ${nextName}`;
    }
    setExpression(newExpr);
    validateExpression(newExpr);
  };

  const handleDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    const type = (e.dataTransfer.getData('componentType') as ComponentType) || draggedType;
    if (type) {
      handleAppendSeries(type);
    }
    setDraggedType(null);
  };

  const handleDropParallelOnNode = (e: React.DragEvent, targetName: string) => {
    e.preventDefault();
    e.stopPropagation();
    const type = (e.dataTransfer.getData('componentType') as ComponentType) || draggedType;
    if (!type) return;

    const nextName = getNextComponentName(type, currentNames);
    if (activeAST) {
      const newAST = addParallelToNode(activeAST, targetName, nextName);
      updateFormulaFromAST(newAST);
    } else {
      handleAppendSeries(type);
    }
    setDraggedType(null);
  };

  const handleDropSeriesAfterNode = (e: React.DragEvent, targetName: string) => {
    e.preventDefault();
    e.stopPropagation();
    const type = (e.dataTransfer.getData('componentType') as ComponentType) || draggedType;
    if (!type) return;

    const nextName = getNextComponentName(type, currentNames);
    if (activeAST) {
      const newAST = insertSeriesNode(activeAST, targetName, nextName, true);
      updateFormulaFromAST(newAST);
    } else {
      handleAppendSeries(type);
    }
    setDraggedType(null);
  };

  // Visual modification actions
  const handleDeleteComponent = (targetName: string) => {
    if (!activeAST) return;
    const newAST = removeNodeFromAST(activeAST, targetName);
    updateFormulaFromAST(newAST);
  };

  const handleAddParallelToComponent = (targetName: string, defaultType: ComponentType = 'C') => {
    const nextName = getNextComponentName(defaultType, currentNames);
    if (!activeAST) return;
    const newAST = addParallelToNode(activeAST, targetName, nextName);
    updateFormulaFromAST(newAST);
  };

  const handleAddSeriesAfterComponent = (targetName: string, defaultType: ComponentType = 'R') => {
    const nextName = getNextComponentName(defaultType, currentNames);
    if (!activeAST) return;
    const newAST = insertSeriesNode(activeAST, targetName, nextName, true);
    updateFormulaFromAST(newAST);
  };

  // Load a preset
  const handleSelectPreset = (preset: PresetCircuit) => {
    setExpression(preset.expression);
    setCircuitName(preset.name);
    setCircuitDesc(preset.description);
    setElements([...preset.defaultElements]);
    validateExpression(preset.expression);
  };

  // Save new circuit to custom presets
  const handleSaveCircuit = () => {
    if (!validationSuccess) return;
    const newPreset: PresetCircuit = {
      id: `custom_${Date.now()}`,
      name: circuitName,
      expression: expression.trim(),
      description: circuitDesc,
      defaultElements: elements,
    };
    onSavePreset(newPreset);
    setSaveSuccessMsg(`Circuit "${circuitName}" saved successfully!`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Apply to current session and close
  const handleApply = () => {
    if (!validationSuccess) return;
    onApplyCircuit(expression.trim(), elements);
    onClose();
  };

  // Component Symbol Renderer
  const renderComponentSymbol = (type: ComponentType) => {
    switch (type) {
      case 'R':
        return <ResistorSymbol />;
      case 'C':
        return <CapacitorSymbol />;
      case 'L':
        return <InductorSymbol />;
      case 'CPE':
        return <CPESymbol />;
      case 'W':
        return <WarburgSymbol />;
    }
  };

  // Recursive Visual Node Renderer
  const renderVisualNode = (node: ASTNode, isTopLevel = false): React.ReactNode => {
    if (node.type === 'COMPONENT') {
      const type = inferComponentType(node.name);
      return (
        <div
          key={node.name}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDropParallelOnNode(e, node.name)}
          className="group relative flex flex-col items-center bg-[#0d121f] border border-slate-700/80 hover:border-cyan-400/80 rounded-lg p-2.5 transition-all shadow-md min-w-[90px] select-none"
        >
          {/* Quick Drop Zone Hint on Hover */}
          <div className="text-[10px] uppercase font-mono font-bold text-slate-400 group-hover:text-cyan-300 transition-colors">
            {type === 'CPE' ? 'CPE (Q)' : type}
          </div>

          {/* Schematic Symbol */}
          <div className="py-1">
            {renderComponentSymbol(type)}
          </div>

          {/* Component Name Badge */}
          <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-cyan-300 tracking-wide">
            {node.name}
          </div>

          {/* Quick Action Overlay (Delete & Branch) */}
          <div className="absolute -top-2.5 -right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#090d16] border border-slate-700 rounded-md p-0.5 shadow-lg z-10">
            <button
              onClick={() => setParallelTarget(parallelTarget === node.name ? null : node.name)}
              title="Enable parallel branch (//) to choose component"
              className={`p-1 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                parallelTarget === node.name
                  ? 'bg-amber-500 text-slate-900 font-extrabold'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-slate-800'
              }`}
            >
              //
            </button>
            <button
              onClick={() => handleAddSeriesAfterComponent(node.name, 'R')}
              title="Add series component (+)"
              className="p-1 text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 rounded cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleDeleteComponent(node.name)}
              title="Remove component"
              className="p-1 text-rose-400 hover:text-rose-300 hover:bg-slate-800 rounded cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Floating Parallel Component Selector if clicked */}
          {parallelTarget === node.name && (
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#090d16] border border-amber-500/80 rounded-lg p-1 shadow-2xl z-20 whitespace-nowrap">
              <span className="text-[10px] text-amber-300 font-mono px-1">Define parallel:</span>
              {(['R', 'C', 'L', 'CPE', 'W'] as ComponentType[]).map((t) => (
                <button
                  key={t}
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextName = getNextComponentName(t, currentNames);
                    if (activeAST) {
                      const newAST = addParallelToNode(activeAST, node.name, nextName);
                      updateFormulaFromAST(newAST);
                    }
                    setParallelTarget(null);
                  }}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold cursor-pointer"
                >
                  {t}
                </button>
              ))}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setParallelTarget(null);
                }}
                className="text-slate-500 hover:text-white px-1 text-[10px] cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      );
    }

    if (node.type === 'PARALLEL') {
      const rungs = flattenParallel(node);
      return (
        <div
          key={`parallel_${rungs.map((r) => (r.type === 'COMPONENT' ? r.name : 'sub')).join('_')}`}
          className="relative flex items-center px-3 py-2 bg-[#090e18]/80 border border-amber-500/30 rounded-xl"
        >
          {/* Parallel Bracket Label */}
          <span className="absolute -top-2 left-3 px-1.5 py-0.2 bg-[#090e18] text-[9px] font-mono font-semibold text-amber-400 uppercase tracking-wider rounded border border-amber-500/20">
            Parallel Group (//)
          </span>

          {/* Left Busbar */}
          <div className="w-2.5 self-stretch border-l-2 border-y-2 border-amber-400/60 rounded-l-md mr-2" />

          {/* Stacked Parallel Rungs */}
          <div className="flex flex-col gap-2.5 py-1">
            {rungs.map((rung, rIdx) => (
              <div key={rIdx} className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-amber-400/50" />
                {renderVisualNode(rung)}
                <div className="w-3 h-0.5 bg-amber-400/50" />
              </div>
            ))}
          </div>

          {/* Right Busbar */}
          <div className="w-2.5 self-stretch border-r-2 border-y-2 border-amber-400/60 rounded-r-md ml-2" />
        </div>
      );
    }

    if (node.type === 'SERIES') {
      const items = flattenSeries(node);
      return (
        <div key="series_group" className="flex items-center gap-1.5 flex-wrap">
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <div className="flex items-center">
                  <div className="w-4 h-0.5 bg-cyan-400/60" />
                  <span className="text-[10px] text-cyan-400 font-bold px-0.5 select-none">+</span>
                  <div className="w-4 h-0.5 bg-cyan-400/60" />
                </div>
              )}
              {renderVisualNode(item)}
            </React.Fragment>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-6xl max-h-[92vh] h-[850px] flex flex-col bg-[#0d111a] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#111624] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
              <CircuitMockupIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 tracking-wide">
                Electrical Circuit Builder
              </h2>
              <span className="text-[11px] text-slate-400">
                Drag and drop passive components to mount the circuit
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveCircuit}
              disabled={!validationSuccess}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5 text-amber-400" />
              <span>Save Preset</span>
            </button>
            <button
              onClick={handleApply}
              disabled={!validationSuccess}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Apply to Workspace</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Left Palette + Right Visual Canvas */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Passive Components Palette & Presets */}
          <div className="w-72 border-r border-slate-800 bg-[#0a0d14] p-4 flex flex-col gap-4 overflow-y-auto shrink-0 select-none">
            {/* Draggable Passive Components */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Passive Components</span>
                <span className="text-[10px] text-cyan-400 lowercase font-normal">drag or click</span>
              </div>
              <div className="flex flex-col gap-2">
                {PALETTE_COMPONENTS.map((comp) => (
                  <div
                    key={comp.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, comp.type)}
                    onClick={() => handleAppendSeries(comp.type)}
                    className="group flex items-center justify-between p-2.5 rounded-lg border border-slate-800 bg-[#0f1422] hover:border-cyan-500/50 hover:bg-slate-800/60 cursor-grab active:cursor-grabbing transition-all"
                    title={`Drag into canvas or click to add ${comp.label}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded flex items-center justify-center font-mono font-bold text-xs"
                        style={{
                          backgroundColor: `${comp.color}20`,
                          color: comp.color,
                          border: `1px solid ${comp.color}50`,
                        }}
                      >
                        {comp.badge}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors">
                          {comp.label}
                        </div>
                        <div className="text-[10px] text-slate-500">{comp.unit}</div>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Connection Controls */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Connection Operators
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const next = expression.trim() ? `${expression.trim()} + ` : '';
                    setExpression(next);
                  }}
                  className="flex items-center justify-center gap-1.5 p-2 bg-[#0f1422] hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-mono text-cyan-400 font-bold"
                  title="Series connection operator"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Series (+)</span>
                </button>
                <button
                  onClick={() => {
                    const trimmed = expression.trim();
                    if (!trimmed) {
                      setSyntaxError('Define a base component first, then enable the parallel branch (//).');
                      setValidationSuccess(false);
                      return;
                    }
                    // Enable parallel branch without inserting any component
                    const next = trimmed.endsWith('//') ? trimmed : `${trimmed} // `;
                    setExpression(next);
                    setSyntaxError('Parallel branch enabled. Choose a component from the palette to define it.');
                    setValidationSuccess(false);
                  }}
                  className="flex items-center justify-center gap-1.5 p-2 bg-[#0f1422] hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-mono text-amber-400 font-bold cursor-pointer"
                  title="Enable parallel branch (//)"
                >
                  <Split className="w-3.5 h-3.5" />
                  <span>Parallel (//)</span>
                </button>
              </div>
            </div>

            {/* Presets Library */}
            <div className="mt-auto pt-3 border-t border-slate-800 flex flex-col gap-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Preset Model Architectures
              </div>
              <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                {PRESET_CIRCUITS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className="text-left p-2 rounded bg-[#0f1422]/80 hover:bg-slate-800 border border-slate-800/80 transition-colors"
                  >
                    <div className="text-xs font-medium text-slate-200 truncate">{preset.name}</div>
                    <div className="text-[10px] font-mono text-cyan-400/80 truncate">
                      {preset.expression}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Main Stage: Circuit Formula Bar & Visual Mounting Canvas */}
          <div className="flex-1 flex flex-col p-5 overflow-y-auto gap-4 bg-[#07090e]">
            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* 1. Circuit Formula Bar (Bi-directional Live Input) */}
            <div className="p-3.5 bg-[#0b0f19] border border-slate-800 rounded-xl relative">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span>Circuit Equation (Zequation)</span>
                  <span className="text-[10px] font-normal text-slate-500 lowercase">
                    (syntax: + for series, // for parallel)
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setExpression('');
                      validateExpression('');
                    }}
                    className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                </div>
              </div>

              {/* Text input for formula */}
              <div className="relative">
                <input
                  type="text"
                  value={expression}
                  onChange={(e) => {
                    setExpression(e.target.value);
                    validateExpression(e.target.value);
                  }}
                  placeholder="e.g. Rs + (Rct // Cdl) + W"
                  className="w-full px-3.5 py-2.5 bg-[#06090f] border border-slate-700/80 rounded-lg font-mono text-sm text-cyan-400 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              {/* Validation Status Indicator */}
              <div className="mt-2 flex items-center justify-between text-xs">
                {validationSuccess ? (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Valid circuit AST • Compatible with ECM_utils.CircuitParams</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-rose-400 font-mono text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{syntaxError}</span>
                  </div>
                )}
                <span className="text-slate-500 font-mono text-[11px]">
                  {elements.length} components detected
                </span>
              </div>
            </div>

            {/* 2. Visual Circuit Mounting Space (Drag and Drop Board) */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropOnCanvas}
              className="flex-1 min-h-[360px] bg-[#0a0d15] border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between relative overflow-x-auto"
            >
              {/* Board Header Toolbar */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                    Visual Circuit Canvas
                  </span>
                  <span className="text-[11px] text-slate-500">
                    (Drag passive elements onto components to parallel branch, or onto canvas to append)
                  </span>
                </div>

                {/* Quick Add Series Shortcuts */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 mr-1">Quick Add:</span>
                  {(['R', 'C', 'CPE', 'W'] as ComponentType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleAppendSeries(t)}
                      className="px-2 py-1 text-[11px] font-mono font-semibold rounded bg-[#101626] border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 transition-colors"
                    >
                      +{t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Mounting Schematic Area */}
              <div className="flex-1 flex items-center justify-center py-6 px-4">
                {!activeAST || elements.length === 0 ? (
                  /* Empty state drop zone */
                  <div className="flex flex-col items-center justify-center p-8 text-center max-w-md border border-dashed border-slate-700/80 rounded-xl bg-[#0e1320]/50">
                    <CircuitMockupIcon className="w-12 h-12 text-slate-600 mb-3" />
                    <h3 className="text-sm font-bold text-slate-200 mb-1">
                      Circuit Canvas is Empty
                    </h3>
                    <p className="text-xs text-slate-400">
                      Drag passive components from the left palette and drop them here to start mounting the circuit.
                    </p>
                  </div>
                ) : (
                  /* Rendered Interactive Circuit Schematic */
                  <div className="flex items-center gap-3 py-4 overflow-x-auto max-w-full">
                    {/* Input Lead Terminal */}
                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                      <div className="flex flex-col items-center">
                        <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-slate-900 shadow-md" />
                        <span className="text-[9px] font-mono font-bold text-cyan-400 mt-0.5">IN</span>
                      </div>
                      <div className="w-6 h-0.5 bg-cyan-400/80" />
                    </div>

                    {/* Circuit Tree Root */}
                    <div className="flex items-center gap-2">
                      {renderVisualNode(activeAST, true)}
                    </div>

                    {/* Output Lead Terminal */}
                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                      <div className="w-6 h-0.5 bg-cyan-400/80" />
                      <div className="flex flex-col items-center">
                        <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-slate-900 shadow-md" />
                        <span className="text-[9px] font-mono font-bold text-cyan-400 mt-0.5">OUT</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Canvas Footer Bar */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">●</span>
                  <span>Active Model:</span>
                  <span className="font-mono text-cyan-300 font-bold">{expression || '(empty)'}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Initial parameter values & bounds remain directly editable on the main workspace.
                </div>
              </div>
            </div>

            {/* Mounted Components Table */}
            <div className="bg-[#0b0f19] border border-slate-800 rounded-xl overflow-hidden shrink-0">
              <div className="px-4 py-2.5 border-b border-slate-800 bg-[#0f1422] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Mounted Components Table
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {elements.length === 0 ? 'Table empty (no circuit pre-loaded)' : `${elements.length} components`}
                </span>
              </div>

              {elements.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-500">
                  Table is empty. Drag components from the left palette or enter a formula to define circuit components.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-44 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#090d16] text-[11px] text-slate-400 font-mono uppercase border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Label</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Initial Guess</th>
                        <th className="px-3 py-2">Unit</th>
                        <th className="px-3 py-2">Scale</th>
                        <th className="px-3 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                      {elements.map((el) => (
                        <tr key={el.id} className="hover:bg-slate-800/30">
                          <td className="px-3 py-2 font-bold text-cyan-400">{el.label}</td>
                          <td className="px-3 py-2 text-slate-400">{el.type}</td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              defaultValue={formatEngineering(el.value)}
                              key={`${el.id}_${el.value}`}
                              onBlur={(e) => {
                                const clean = e.target.value.trim().replace(',', '.');
                                const val = parseFloat(clean);
                                if (!isNaN(val) && val > 0) {
                                  setElements((prev) =>
                                    prev.map((item) => (item.id === el.id ? { ...item, value: val } : item))
                                  );
                                  e.target.value = formatEngineering(val);
                                } else {
                                  e.target.value = formatEngineering(el.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-24 px-1.5 py-0.5 bg-[#06090f] border border-slate-700 rounded text-xs text-right font-mono text-slate-200 tabular-nums focus:outline-none focus:border-cyan-400"
                              placeholder="1e-3"
                              title="Engineering style parameter (e.g. 1e-3)"
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-400">{DEFAULT_SCALES[el.type]?.unit || ''}</td>
                          <td className="px-3 py-2 text-slate-400">{el.scale}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleDeleteComponent(el.label)}
                              className="text-slate-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                              title="Remove component"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. Circuit Metadata (for saving preset) */}
            <div className="grid grid-cols-2 gap-4 bg-[#0b0f19] p-3 rounded-lg border border-slate-800 shrink-0">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Preset Name
                </label>
                <input
                  type="text"
                  value={circuitName}
                  onChange={(e) => setCircuitName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#06090f] border border-slate-800 rounded-md text-xs text-slate-200 font-medium focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Application Description
                </label>
                <input
                  type="text"
                  value={circuitDesc}
                  onChange={(e) => setCircuitDesc(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#06090f] border border-slate-800 rounded-md text-xs text-slate-200 font-medium focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
