import React, { useState, useMemo } from 'react';
import type { ApiCostRow } from '../lib/calculations';
import { formatCost, formatPerRequest } from '../lib/format';

interface Props {
  rows: ApiCostRow[];
  selectedModel: string;
  onSelect: (model: string) => void;
  selfHostedMonthly: number;
}

export default function ApiComparisonTable({ rows, selectedModel, onSelect, selfHostedMonthly }: Props) {
  const [showAll, setShowAll] = useState(false);
  const TOP_N = 10;

  const { visible, cheapest, currentRow, currentRank } = useMemo(() => {
    const cheapest = rows[0];
    const currentIdx = rows.findIndex(r => r.model === selectedModel);
    const currentRow = currentIdx >= 0 ? rows[currentIdx] : undefined;
    const currentRank = currentIdx >= 0 ? currentIdx + 1 : null;
    let visible = showAll ? rows : rows.slice(0, TOP_N);
    // Ensure the currently selected row is always visible even outside top-N
    if (!showAll && currentRow && currentIdx >= TOP_N) {
      visible = [...visible, currentRow];
    }
    return { visible, cheapest, currentRow, currentRank };
  }, [rows, selectedModel, showAll]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          API Cost Comparison
        </h2>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {showAll ? `all ${rows.length} models` : `top ${TOP_N} cheapest`} · click row to compare
        </div>
      </div>

      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              <th className="text-left font-medium py-2 pr-2">#</th>
              <th className="text-left font-medium py-2 pr-2">Model</th>
              <th className="text-left font-medium py-2 pr-2">Provider</th>
              <th className="text-right font-medium py-2 pr-2">$/mo</th>
              <th className="text-right font-medium py-2 pr-2" title="Per-request cost. Switches to per-1k requests when below $0.0001/req.">$/request</th>
              <th className="text-right font-medium py-2">vs self-hosted</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const isSelected = row.model === selectedModel;
              const isCheapest = row.model === cheapest.model;
              const rank = rows.findIndex(r => r.model === row.model) + 1;
              const delta = selfHostedMonthly > 0 ? (row.monthly - selfHostedMonthly) / selfHostedMonthly * 100 : 0;
              const apiWins = row.monthly < selfHostedMonthly;
              return (
                <tr key={row.model}
                  onClick={() => onSelect(row.model)}
                  className="cursor-pointer transition-colors"
                  style={{
                    backgroundColor: isSelected ? 'rgba(250, 189, 47, 0.10)' : 'transparent',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <td className="py-2 pr-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{rank}</td>
                  <td className="py-2 pr-2">
                    <span style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: isSelected ? 600 : 400 }}>
                      {row.model}
                    </span>
                    {isCheapest && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: 'rgba(184, 187, 38, 0.15)', color: 'var(--accent-success)' }}>
                        cheapest
                      </span>
                    )}
                    {isSelected && !isCheapest && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: 'rgba(250, 189, 47, 0.15)', color: 'var(--accent-primary)' }}>
                        selected
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{row.provider}</td>
                  <td className="py-2 pr-2 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{formatCost(row.monthly)}</td>
                  <td className="py-2 pr-2 text-right font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{formatPerRequest(row.perRequest)}</td>
                  <td className="py-2 text-right font-mono text-xs"
                    style={{ color: apiWins ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                    {selfHostedMonthly > 0 ? `${apiWins ? '−' : '+'}${Math.abs(delta).toFixed(0)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <div>
          {currentRow && currentRank && currentRank > TOP_N && !showAll && (
            <span>Selected <span style={{ color: 'var(--accent-primary)' }}>{selectedModel}</span> is rank #{currentRank} of {rows.length}.</span>
          )}
        </div>
        {rows.length > TOP_N && (
          <button onClick={() => setShowAll(s => !s)}
            className="px-2 py-1 rounded transition-colors"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            {showAll ? `Show top ${TOP_N}` : `Show all ${rows.length} models`}
          </button>
        )}
      </div>
    </div>
  );
}
