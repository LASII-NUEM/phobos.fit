import React, { useEffect, useRef, useState } from 'react';
import { Rotate3d, Play, Pause, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { EISDataset, EISPoint } from '../types/impedance';

interface Chart3DViewerProps {
  dataset: EISDataset | { name: string; points: EISPoint[]; color: string };
  height?: number;
}

export const Chart3DViewer: React.FC<Chart3DViewerProps> = ({ dataset, height = 560 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 3D rotation angles
  const [rotX, setRotX] = useState<number>(25); // Pitch (degrees)
  const [rotY, setRotY] = useState<number>(-45); // Yaw (degrees)
  const [zoom, setZoom] = useState<number>(1.1);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  const isDragging = useRef<boolean>(false);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Normalization bounds
  const points = dataset.points || [];
  const minFreq = Math.min(...points.map((p) => p.freq), 1e-3);
  const maxFreq = Math.max(...points.map((p) => p.freq), 1e5);
  const minZre = Math.min(...points.map((p) => p.zReal), 0);
  const maxZre = Math.max(...points.map((p) => p.zReal), 1000);
  const minZim = Math.min(...points.map((p) => p.zImagNeg), 0);
  const maxZim = Math.max(...points.map((p) => p.zImagNeg), 1000);

  const logMinF = Math.log10(Math.max(minFreq, 1e-6));
  const logMaxF = Math.log10(Math.max(maxFreq, 1e-6));

  // Render loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2 + 15;

      ctx.clearRect(0, 0, w, h);

      // Flat matte scientific background
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, w, h);

      // Trig for rotation
      const radX = (rotX * Math.PI) / 180;
      const radY = (rotY * Math.PI) / 180;
      const cosX = Math.cos(radX);
      const sinX = Math.sin(radX);
      const cosY = Math.cos(radY);
      const sinY = Math.sin(radY);

      // Box scale in canvas pixels expanded for bigger plots
      const boxSize = Math.min(w, h) * 0.44 * zoom;

      // Project 3D normalized coordinates ([-1, 1] on each axis) to 2D screen
      const project = (nx: number, ny: number, nz: number) => {
        // nx: Z' (Real, Left-Right)
        // ny: -Z'' (Imag, Forward-Back)
        // nz: log(f) (Frequency, Up-Down)
        const x1 = nx * cosY - ny * sinY;
        const y1 = nx * sinY + ny * cosY;
        const z1 = nz;

        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        // Isometric perspective projection
        const fov = 1200;
        const scale = fov / (fov + z2 * 150);

        return {
          sx: cx + x2 * boxSize * scale,
          sy: cy - y2 * boxSize * scale,
          depth: z2,
        };
      };

      // Draw 3D Bounding Grid Box & Axis Planes
      // Base plane: nz = -1 (XY plane, representing Nyquist at lowest freq)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;

      // Floor grid lines (Nyquist plane)
      for (let g = -1; g <= 1; g += 0.5) {
        // Lines along X
        const p1 = project(-1, g, -1);
        const p2 = project(1, g, -1);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();

        // Lines along Y
        const p3 = project(g, -1, -1);
        const p4 = project(g, 1, -1);
        ctx.beginPath();
        ctx.moveTo(p3.sx, p3.sy);
        ctx.lineTo(p4.sx, p4.sy);
        ctx.stroke();
      }

      // Back vertical walls
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      const c1 = project(-1, 1, -1);
      const c2 = project(-1, 1, 1);
      ctx.beginPath();
      ctx.moveTo(c1.sx, c1.sy);
      ctx.lineTo(c2.sx, c2.sy);
      ctx.stroke();

      const c3 = project(1, 1, -1);
      const c4 = project(1, 1, 1);
      ctx.beginPath();
      ctx.moveTo(c3.sx, c3.sy);
      ctx.lineTo(c4.sx, c4.sy);
      ctx.stroke();

      // Axis labels in 3D
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748b';

      const xLabelPos = project(1.15, -1, -1);
      ctx.fillText("Z' Real (Ω)", xLabelPos.sx, xLabelPos.sy);

      const yLabelPos = project(-1, 1.15, -1);
      ctx.fillText("-Z'' Imag (Ω)", yLabelPos.sx, yLabelPos.sy);

      const zLabelPos = project(-1, -1, 1.15);
      ctx.fillText('log10(f / Hz)', zLabelPos.sx, zLabelPos.sy);

      // Project data points
      if (points.length > 0) {
        const spanZre = maxZre - minZre || 1;
        const spanZim = maxZim - minZim || 1;
        const spanF = logMaxF - logMinF || 1;

        const projPoints = points.map((p) => {
          const nx = ((p.zReal - minZre) / spanZre) * 2 - 1;
          const ny = ((p.zImagNeg - minZim) / spanZim) * 2 - 1;
          const logF = Math.log10(Math.max(p.freq, 1e-6));
          const nz = ((logF - logMinF) / spanF) * 2 - 1;

          const proj3D = project(nx, ny, nz);
          const projFloor = project(nx, ny, -1); // 2D projection on Nyquist floor

          return {
            ...proj3D,
            floorSx: projFloor.sx,
            floorSy: projFloor.sy,
            freq: p.freq,
            zReal: p.zReal,
            zImagNeg: p.zImagNeg,
          };
        });

        // 1. Draw floor shadow / 2D Nyquist trace on bottom plane
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        projPoints.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.floorSx, pt.floorSy);
          else ctx.lineTo(pt.floorSx, pt.floorSy);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. Draw vertical projection drop lines from 3D points down to Nyquist floor
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
        ctx.lineWidth = 1;
        projPoints.forEach((pt, i) => {
          if (i % 3 === 0) {
            ctx.beginPath();
            ctx.moveTo(pt.sx, pt.sy);
            ctx.lineTo(pt.floorSx, pt.floorSy);
            ctx.stroke();
          }
        });

        // 3. Draw main 3D trajectory curve with color gradient
        ctx.lineWidth = 2.5;
        for (let i = 0; i < projPoints.length - 1; i++) {
          const pA = projPoints[i];
          const pB = projPoints[i + 1];

          // Color gradient along frequency (High freq = cyan/blue, Low freq = amber/red)
          const t = i / (projPoints.length - 1);
          const r = Math.round(6 + (245 - 6) * t);
          const g = Math.round(182 + (158 - 182) * t);
          const b = Math.round(212 + (11 - 212) * t);

          ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.beginPath();
          ctx.moveTo(pA.sx, pA.sy);
          ctx.lineTo(pB.sx, pB.sy);
          ctx.stroke();
        }

        // 4. Draw 3D scatter node spheres
        projPoints.forEach((pt, i) => {
          const t = i / (projPoints.length - 1);
          const r = Math.round(6 + (245 - 6) * t);
          const g = Math.round(182 + (158 - 182) * t);
          const b = Math.round(212 + (11 - 212) * t);

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.beginPath();
          ctx.arc(pt.sx, pt.sy, 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#090d16';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }

      // Auto rotate step
      if (autoRotate && !isDragging.current) {
        setRotY((prev) => (prev + 0.3) % 360);
      }
    };

    render();
  }, [rotX, rotY, zoom, autoRotate, points]);

  // Mouse interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    setRotY((prev) => prev + dx * 0.6);
    setRotX((prev) => Math.max(-80, Math.min(80, prev - dy * 0.6)));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <div className="flex flex-col bg-[#0d111a] border border-slate-800 rounded-lg overflow-hidden">
      {/* 3D Viewer Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#111624] border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Rotate3d className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-200">
            3D Impedance Spectroscopy Space (Z' vs -Z'' vs log f)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Frequency color legend */}
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mr-3">
            <span className="text-cyan-400">High Freq</span>
            <div className="w-16 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-amber-500" />
            <span className="text-amber-400">Low Freq</span>
          </div>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
            title={autoRotate ? 'Pause Rotation' : 'Auto Rotate'}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-cyan-400" />}
            <span className="text-[11px]">{autoRotate ? 'Pause' : 'Rotate'}</span>
          </button>

          <button
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
            className="p-1 text-slate-300 hover:text-white bg-slate-800 rounded border border-slate-700"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
            className="p-1 text-slate-300 hover:text-white bg-slate-800 rounded border border-slate-700"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setRotX(25);
              setRotY(-45);
              setZoom(1.1);
            }}
            className="p-1 text-slate-300 hover:text-white bg-slate-800 rounded border border-slate-700"
            title="Reset 3D View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive 3D Canvas */}
      <div
        className="relative cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          width={1200}
          height={height}
          className="w-full h-auto block"
        />

        <div className="absolute bottom-3 left-4 text-[10px] font-mono text-slate-500 pointer-events-none">
          Click & drag to orbit • Scroll/buttons to zoom • Projection drops to Nyquist plane (XY)
        </div>
      </div>
    </div>
  );
};
