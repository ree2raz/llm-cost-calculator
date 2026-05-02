import React from 'react';

interface ThemeToggleProps {
  dark: boolean;
  setDark: (d: boolean) => void;
}

export default function ThemeToggle({ dark, setDark }: ThemeToggleProps) {
  return (
    <button
      onClick={() => setDark(!dark)}
      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors"
      style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? '☀' : '☾'}
    </button>
  );
}
