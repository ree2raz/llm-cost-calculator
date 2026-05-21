import React, { useState, useMemo } from 'react';
import type { ApiCostRow } from '../lib/calculations';
import { formatCost, formatPerRequest } from '../lib/format';

interface Props {
  rows: ApiCostRow[];
  selectedModel: string;
  selectedProvider: string;
  onSelect: (model: string, provider: string) => void;
  selfHostedMonthly: number;
  dailyVolume: number;
}

export default function ApiComparisonTable({ rows, selectedModel, selectedProvider, onSelect, selfHostedMonthly, dailyVolume }: Props) {
  const [showAll, setShowAll] = useState(false);
  const TOP_N = 10;

  const { visible, cheapest, currentRow, currentRank } = useMemo(() => {
    const cheapest = rows[0];
    const currentIdx = rows.findIndex(r => r.model === selectedModel && r.provider === selectedProvider);
    const currentRow = currentIdx >= 0 ? rows[currentIdx] : undefined;
    const currentRank = currentIdx >= 0 ? currentIdx + 1 : null;
    let visible = showAll ? rows : rows.slice(0, TOP_N);
    // Ensure the currently selected row is always visible even outside top-N
    if (!showAll && currentRow && currentIdx >= TOP_N) {
      visible = [...visible, currentRow];
    }
    return { visible, cheapest, currentRow, currentRank };
  }, [rows, selectedModel, selectedProvider, showAll]);

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
              <th className="text-right font-medium py-2" title="Daily volume at which self-hosting becomes cheaper than this API option">self-host beats at</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const isSelected = row.model === selectedModel && row.provider === selectedProvider;
              const isCheapest = row.model === cheapest.model && row.provider === cheapest.provider;
              const rank = rows.findIndex(r => r.model === row.model && r.provider === row.provider) + 1;
              // Volume at which self-hosted becomes cheaper than this API row (linear approx, no GPU stepping)
              const beVol = row.monthly > 0 && selfHostedMonthly > 0
                ? Math.round(selfHostedMonthly * dailyVolume / row.monthly)
                : null;
              const fmtBe = (v: number) => v >= 1_000_000 ? '>1M/day' : v >= 1000 ? `${(v / 1000).toFixed(1)}k/day` : `${v}/day`;
              const alreadyPast = beVol !== null && dailyVolume >= beVol;
              return (
                <tr key={`${row.model}::${row.provider}`}
                  onClick={() => onSelect(row.model, row.provider)}
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
                  <td className="py-2 pr-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {row.path === 'aggregator' && (
                      <span style={{ color: 'var(--text-muted)', marginRight: 2 }}>via </span>
                    )}
                    {row.provider}
                    {row.notes && (
                      <span className="ml-1.5" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{row.notes}</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{formatCost(row.monthly)}</td>
                  <td className="py-2 pr-2 text-right font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{formatPerRequest(row.perRequest)}</td>
                  <td className="py-2 text-right font-mono text-xs"
                    style={{ color: alreadyPast ? 'var(--accent-success)' : beVol && beVol > 1_000_000 ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                    {beVol === null ? '—' : alreadyPast ? '✓ now' : fmtBe(beVol)}
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
            <span>Selected <span style={{ color: 'var(--accent-primary)' }}>{selectedModel}</span> ({selectedProvider}) is rank #{currentRank} of {rows.length}.</span>
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
