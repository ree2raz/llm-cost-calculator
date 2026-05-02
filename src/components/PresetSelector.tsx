import React, { useState, useEffect } from 'react';
import { PRESETS, type Preset } from '../data/constants';

interface PresetSelectorProps {
  onSelect: (p: Preset) => void;
  resetKey: number;
}

export default function PresetSelector({ onSelect, resetKey }: PresetSelectorProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [resetKey]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all"
        style={{
          backgroundColor: 'var(--accent-primary)',
          color: 'var(--bg-primary)',
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        Load Preset
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full right-0 mt-2 w-64 rounded-lg shadow-xl z-50 overflow-hidden"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            {PRESETS.map((preset, i) => (
              <button
                key={i}
                onClick={() => {
                  onSelect(preset);
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-sm hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: i === 0 ? 'transparent' : 'transparent',
                  color: 'var(--text-primary)',
                  borderBottom: i < PRESETS.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div className="font-medium">{preset.name}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {preset.variant} · Q4 · {preset.contextLength >= 1000 ? `${(preset.contextLength / 1000).toFixed(0)}K` : preset.contextLength} ctx
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
