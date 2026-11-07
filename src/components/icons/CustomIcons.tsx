import React from 'react';

/**
 * Nyquist Default Curve Icon
 * Depicts the classic EIS Nyquist plot (-Z'' vs Z') featuring the
 * characteristic semicircle (charge transfer) and Warburg diffusion tail.
 */
export const NyquistCurveIcon: React.FC<React.SVGProps<SVGSVGElement>> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Coordinate Axes */}
    <path d="M3 3v18h18" strokeWidth="1.8" />
    <path d="M1.5 5.5L3 3l1.5 2.5" strokeWidth="1.5" />
    <path d="M18.5 19.5L21 21l-2.5 1.5" strokeWidth="1.5" />
    {/* Nyquist Semicircle Arc with Warburg 45° Tail */}
    <path
      d="M6 21 A5 5 0 0 1 16 21 L20.5 16.5"
      strokeWidth="2.2"
    />
    {/* Frequency indicator apex & warburg markers */}
    <circle cx="11" cy="16" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="18.5" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * Mockup Circuit Icon
 * Depicts a clean electrical equivalent circuit model (ECM) schematic
 * showing a parallel branch with a resistor and capacitor.
 */
export const CircuitMockupIcon: React.FC<React.SVGProps<SVGSVGElement>> = ({
  className = 'w-4 h-4',
  ...props
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Input & Output Terminals */}
    <circle cx="2" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="22" cy="12" r="1" fill="currentColor" stroke="none" />
    {/* Lead in */}
    <path d="M3 12h2" strokeWidth="2" />
    {/* Node split */}
    <path d="M5 12v-5h2" strokeWidth="1.8" />
    <path d="M5 12v5h3" strokeWidth="1.8" />
    {/* Top branch: Resistor schematic (zigzag) */}
    <path
      d="M7 7l1.5-2.5 1.5 5 1.5-5 1.5 5 1-2.5h2.5"
      strokeWidth="1.8"
    />
    {/* Bottom branch: Capacitor schematic (parallel plates) */}
    <path d="M10 14.5v5" strokeWidth="2" />
    <path d="M12.5 14.5v5" strokeWidth="2" />
    <path d="M12.5 17h4" strokeWidth="1.8" />
    {/* Node rejoin */}
    <path d="M16.5 7v5" strokeWidth="1.8" />
    <path d="M16.5 17v-5" strokeWidth="1.8" />
    {/* Lead out */}
    <path d="M16.5 12h4.5" strokeWidth="2" />
  </svg>
);
