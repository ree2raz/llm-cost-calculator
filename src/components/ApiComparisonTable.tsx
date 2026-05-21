import React, { useState, useMemo, useRef } from 'react';
import type { ApiCostRow } from '../lib/calculations';
import { formatCost, formatPerRequest } from '../lib/format';

interface Props {
  rows: ApiCostRow[];
  selectedModel: string;
  selectedProvider: string;
  onSelect: (model: string, provider: string) => void;
  selfHostedMonthly: number;
  dailyVolume: number;
  opsEnabled: boolean;
  opsMonthly: number;
  onToggleOps: () => void;
}

const TOP_N = 15;

export default function ApiComparisonTable({ rows, selectedModel, selectedProvider, onSelect, selfHostedMonthly, dailyVolume, opsEnabled, opsMonthly, onToggleOps }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { displayRows, cheapest, currentRow, currentRank } = useMemo(() => {
    const cheapest = rows[0];
    const currentIdx = rows.findIndex(r => r.model === selectedModel && r.provider === selectedProvider);
    const currentRow = currentIdx >= 0 ? rows[currentIdx] : undefined;
    const currentRank = currentIdx >= 0 ? currentIdx + 1 : null;

    const q = search.trim().toLowerCase();
    if (q) {
      const filtered = rows.filter(r =>
        r.model.toLowerCase().includes(q) ||
        r.provider.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
      return { displayRows: filtered, cheapest, currentRow, currentRank };
    }

    let visible = showAll ? rows : rows.slice(0, TOP_N);
    if (!showAll && currentRow && currentIdx >= TOP_N) {
      visible = [...visible, currentRow];
    }
    return { displayRows: visible, cheapest, currentRow, currentRank };
  }, [rows, selectedModel, selectedProvider, showAll, search]);

  const isSearching = search.trim().length > 0;

  const fmtBe = (v: number) =>
    v >= 1_000_000 ? '>1M/day' : v >= 1000 ? `${(v / 1000).toFixed(1)}k/day` : `${v}/day`;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          API Cost Comparison
        </h2>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {isSearching
            ? `${displayRows.length} result${displayRows.length !== 1 ? 's' : ''}`
            : showAll
              ? `all ${rows.length} options`
              : `top ${TOP_N} cheapest`
          }
          {' · '}click to compare
        </div>
      </div>

      {/* TCO baseline + ops toggle */}
      <div className="flex items-center justify-between mb-2 text-xs">
        <span style={{ color: 'var(--text-muted)' }}>
          Self-hosted:{' '}
          <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
            {formatCost(selfHostedMonthly)}/mo
          </span>
          {opsEnabled && opsMonthly > 0 && (
            <span style={{ color: 'var(--accent-warning)' }}>
              {' '}(+{formatCost(opsMonthly)} ops)
            </span>
          )}
        </span>
        {opsEnabled ? (
          <button
            onClick={onToggleOps}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'rgba(254,128,25,0.18)',
              border: '1px solid rgba(254,128,25,0.55)',
              color: 'var(--accent-secondary)',
            }}
            title="Click to remove ops overhead"
          >
            ops included
            <span style={{ fontSize: '11px', fontWeight: 700 }}>✕</span>
          </button>
        ) : (
          <button
            onClick={onToggleOps}
            className="px-2 py-0.5 rounded text-xs transition-colors"
            style={{
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              backgroundColor: 'transparent',
            }}
          >
            + add ops cost
          </button>
        )}
      </div>

      {/* Search box */}
      <div className="relative mb-2">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          width="13" height="13" viewBox="0 0 16 16" fill="none"
          style={{ color: 'var(--text-muted)' }}
        >
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search model or provider…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-7 pr-7 py-1.5 text-sm rounded"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
        {search && (
          <button
            onClick={() => { setSearch(''); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs leading-none"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Scrollable table */}
      <div
        style={{ maxHeight: '360px', overflowY: 'auto', overflowX: 'auto' }}
        className="-mx-2 px-2"
      >
        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr
              className="text-xs uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {(['#', 'Model', 'Provider', '$/mo', '$/req', 'Beats at'] as const).map((label, ci) => (
                <th
                  key={label}
                  title={
                    label === '$/req' ? 'Per-request cost (switches to per-1k when < $0.0001)' :
                    label === 'Beats at' ? 'Daily volume where self-hosting costs less than this API' :
                    undefined
                  }
                  className={`font-medium py-2 ${ci < 4 ? 'pr-2' : ''} ${ci >= 3 ? 'text-right' : 'text-left'}`}
                  style={{
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'var(--bg-secondary)',
                    boxShadow: 'inset 0 -1px 0 var(--border)',
                    zIndex: 2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  No results for &ldquo;{search}&rdquo;
                </td>
              </tr>
            )}
            {displayRows.map((row, i) => {
              const isSelected = row.model === selectedModel && row.provider === selectedProvider;
              const isCheapest = !isSearching && i === 0 && row.model === cheapest.model && row.provider === cheapest.provider;
              const rank = rows.findIndex(r => r.model === row.model && r.provider === row.provider) + 1;
              const beVol = row.monthly > 0 && selfHostedMonthly > 0
                ? Math.round(selfHostedMonthly * dailyVolume / row.monthly)
                : null;
              const alreadyPast = beVol !== null && dailyVolume >= beVol;
              return (
                <tr
                  key={`${row.model}::${row.provider}`}
                  onClick={() => onSelect(row.model, row.provider)}
                  className="cursor-pointer"
                  style={{
                    backgroundColor: isSelected ? 'rgba(250, 189, 47, 0.10)' : 'transparent',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                    transition: 'background-color 80ms',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-tertiary)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  {/* Rank */}
                  <td className="py-1.5 pr-2 font-mono text-xs" style={{ color: 'var(--text-muted)', verticalAlign: 'top', paddingTop: '10px' }}>
                    {rank}
                  </td>

                  {/* Model + badges */}
                  <td className="py-1.5 pr-3" style={{ maxWidth: '160px' }}>
                    <div style={{
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: '13px',
                      lineHeight: 1.3,
                      wordBreak: 'break-word',
                    }}>
                      {row.model}
                    </div>
                    {(isCheapest || isSelected) && (
                      <div className="mt-0.5">
                        {isCheapest && (
                          <span className="inline-block text-xs px-1 rounded font-medium mr-1"
                            style={{ backgroundColor: 'rgba(184,187,38,0.15)', color: 'var(--accent-success)', fontSize: '10px' }}>
                            cheapest
                          </span>
                        )}
                        {isSelected && !isCheapest && (
                          <span className="inline-block text-xs px-1 rounded font-medium"
                            style={{ backgroundColor: 'rgba(250,189,47,0.15)', color: 'var(--accent-primary)', fontSize: '10px' }}>
                            selected
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Provider + notes */}
                  <td className="py-1.5 pr-2 text-xs" style={{ color: 'var(--text-secondary)', maxWidth: '130px' }}>
                    <div>
                      {row.path === 'aggregator' && (
                        <span style={{ color: 'var(--text-muted)' }}>via </span>
                      )}
                      <span>{row.provider}</span>
                    </div>
                    {row.notes && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.3, marginTop: '1px' }}>
                        {row.notes}
                      </div>
                    )}
                  </td>

                  {/* $/mo */}
                  <td className="py-1.5 pr-2 text-right font-mono" style={{ color: 'var(--text-primary)', verticalAlign: 'top', paddingTop: '10px', whiteSpace: 'nowrap' }}>
                    {formatCost(row.monthly)}
                  </td>

                  {/* $/req */}
                  <td className="py-1.5 pr-2 text-right font-mono text-xs" style={{ color: 'var(--text-secondary)', verticalAlign: 'top', paddingTop: '10px', whiteSpace: 'nowrap' }}>
                    {formatPerRequest(row.perRequest)}
                  </td>

                  {/* Beats at */}
                  <td className="py-1.5 text-right font-mono text-xs" style={{
                    color: alreadyPast ? 'var(--accent-success)' : beVol && beVol > 1_000_000 ? 'var(--text-muted)' : 'var(--text-secondary)',
                    verticalAlign: 'top', paddingTop: '10px', whiteSpace: 'nowrap',
                  }}>
                    {beVol === null ? '—' : alreadyPast ? '✓ now' : fmtBe(beVol)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <div>
          {!isSearching && currentRow && currentRank && currentRank > TOP_N && !showAll && (
            <span>
              Selected{' '}
              <span style={{ color: 'var(--accent-primary)' }}>{selectedModel}</span>
              {' '}({selectedProvider}) is rank #{currentRank} of {rows.length}.
            </span>
          )}
        </div>
        {!isSearching && rows.length > TOP_N && (
          <button
            onClick={() => setShowAll(s => !s)}
            className="px-2 py-1 rounded transition-colors"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            {showAll ? `Show top ${TOP_N}` : `Show all ${rows.length} options`}
          </button>
        )}
      </div>
    </div>
  );
}
