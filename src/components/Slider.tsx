import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  warning?: string | null;
}

export default function Slider({ label, value, min, max, step, onChange, format, warning }: SliderProps) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
        <span className="text-sm font-mono font-semibold" style={{ color: 'var(--accent-primary)' }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="gruv-slider"
      />
      {warning && (
        <div className="text-xs mt-1.5" style={{ color: 'var(--accent-danger)' }}>
          {warning}
        </div>
      )}
    </div>
  );
}
