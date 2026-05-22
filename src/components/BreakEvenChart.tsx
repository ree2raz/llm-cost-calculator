import React, { useState } from 'react';
import type { BreakEvenPoint } from '../lib/calculations';

interface BreakEvenChartProps {
  data: BreakEvenPoint[];
  breakEven: number | null;
  currentVolume: number;
}

export default function BreakEvenChart({ data, breakEven, currentVolume }: BreakEvenChartProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; visible: boolean; data: BreakEvenPoint | null }>({
    x: 0, y: 0, visible: false, data: null,
  });

  const width = 600;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 55, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxCost = Math.max(...data.map(d => Math.max(d.selfHosted, d.api)), 1);
  const maxVolume = data.length > 0 ? data[data.length - 1].volume : 5000;

  const xScale = (vol: number) => padding.left + (vol / maxVolume) * chartWidth;
  const yScale = (cost: number) => padding.top + chartHeight - (cost / maxCost) * chartHeight;

  // Step-function path for self-hosted cost
  const selfHostedStepPath = data.map((d, i) => {
    const x = xScale(d.volume);
    const y = yScale(d.selfHosted);
    if (i === 0) return `M ${x} ${y}`;
    const prevX = xScale(data[i - 1].volume);
    return `L ${prevX + (x - prevX)} ${yScale(data[i - 1].selfHosted)} L ${x} ${y}`;
  }).join(' ');

  const apiPath = data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(d.volume)} ${yScale(d.api)}`
  ).join(' ');

  // GPU config segments — group consecutive identical (gpuName, gpuCount).
  // The recommender can switch GPU type as volume grows, so count alone is
  // not monotonic; key on the full config tuple instead.
  type Segment = { volume: number; endVolume: number; gpuCount: number; gpuName: string; cost: number };
  const segments: Segment[] = [];
  if (data.length > 0) {
    const keyOf = (d: BreakEvenPoint) => `${d.gpuName}|${d.gpuCount}`;
    let prevKey = keyOf(data[0]);
    let startVol = data[0].volume;
    for (let i = 1; i < data.length; i++) {
      const k = keyOf(data[i]);
      if (k !== prevKey) {
        segments.push({
          volume: startVol, endVolume: data[i].volume,
          gpuCount: data[i - 1].gpuCount, gpuName: data[i - 1].gpuName,
          cost: data[i - 1].selfHosted,
        });
        prevKey = k;
        startVol = data[i].volume;
      }
    }
    const last = data[data.length - 1];
    segments.push({
      volume: startVol, endVolume: last.volume,
      gpuCount: last.gpuCount, gpuName: last.gpuName, cost: last.selfHosted,
    });
  }

  // Suppress labels whose midpoint is closer than this (in viewBox units) to
  // the previously shown label, so they don't overlap into a soup.
  const MIN_LABEL_GAP = 55;
  // Shorten GPU names for tight badges.
  const shortName = (n: string) => n
    .replace(/^RTX /, '')
    .replace(/^NVIDIA /, '')
    .replace(/ 80GB$/, '')
    .replace(/ 40GB$/, '')
    .replace(/ 141GB$/, '');
  const labeledSegments: (Segment & { midX: number })[] = [];
  let lastLabelX = -Infinity;
  for (const s of segments) {
    const midX = (xScale(s.volume) + xScale(s.endVolume)) / 2;
    if (midX - lastLabelX >= MIN_LABEL_GAP) {
      labeledSegments.push({ ...s, midX });
      lastLabelX = midX;
    }
  }

  // If every segment uses the same GPU, drop the name from each badge and
  // surface it once as a legend chip — cuts visual noise dramatically when
  // the recommender picks a single card type across the whole volume range.
  const uniqueGpuNames = Array.from(new Set(segments.map(s => s.gpuName)));
  const singleGpu = uniqueGpuNames.length === 1 ? uniqueGpuNames[0] : null;

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // SVG is rendered responsively (w-full) but coordinates inside use the
    // fixed viewBox (0..width). Map mouse position from CSS pixels back into
    // viewBox units before comparing to xScale outputs.
    const scale = rect.width > 0 ? width / rect.width : 1;
    const x = (e.clientX - rect.left) * scale;

    let closest = data[0];
    let minDist = Infinity;
    for (const d of data) {
      const dx = xScale(d.volume) - x;
      if (Math.abs(dx) < minDist) {
        minDist = Math.abs(dx);
        closest = d;
      }
    }

    // Snap radius is in viewBox units (chart is `width` wide in those units).
    if (minDist < width / 20) {
      setTooltip({
        x: xScale(closest.volume),
        y: Math.min(yScale(closest.selfHosted), yScale(closest.api)) - 10,
        visible: true,
        data: closest,
      });
    } else {
      setTooltip(prev => ({ ...prev, visible: false }));
    }
  };

  const formatCost = (v: number) => v < 1000 ? `$${v.toFixed(0)}` : `$${(v / 1000).toFixed(1)}k`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxHeight: '340px' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(prev => ({ ...prev, visible: false }))}
      >
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(tick => {
          const y = padding.top + chartHeight * tick;
          return (
            <line key={tick} x1={padding.left} y1={y} x2={width - padding.right} y2={y}
              stroke="var(--border)" strokeWidth={0.5} strokeDasharray="4 4" />
          );
        })}

        {/* Axes */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom}
          stroke="var(--text-muted)" strokeWidth={1} />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom}
          stroke="var(--text-muted)" strokeWidth={1} />

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(tick => {
          const value = maxCost * (1 - tick);
          const y = padding.top + chartHeight * tick;
          return (
            <text key={tick} x={padding.left - 8} y={y + 4} textAnchor="end"
              fontSize="10" fill="var(--text-muted)">
              {formatCost(value)}
            </text>
          );
        })}

        {/* X-axis labels */}
        {(() => {
          const ticks: number[] = [];
          const step = Math.max(500, Math.round(maxVolume / 5));
          for (let v = 0; v <= maxVolume; v += step) ticks.push(v);
          if (ticks[ticks.length - 1] !== maxVolume) ticks.push(maxVolume);
          return ticks.map(vol => (
            <text key={vol} x={xScale(vol)} y={height - padding.bottom + 18} textAnchor="middle"
              fontSize="10" fill="var(--text-muted)">
              {vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : vol}
            </text>
          ));
        })()}

        <text x={padding.left + chartWidth / 2} y={height - 5} textAnchor="middle"
          fontSize="10" fill="var(--text-muted)">
          Requests / day
        </text>

        {/* Lines */}
        <path d={selfHostedStepPath} fill="none" stroke="var(--chart-self)" strokeWidth={2.5} />
        <path d={apiPath} fill="none" stroke="var(--chart-api)" strokeWidth={2.5} />

        {/* GPU config annotations — deduped + spaced to avoid overlap.
            When all segments share one GPU, badges drop the name. */}
        {labeledSegments.map((step, i) => {
          const label = singleGpu
            ? `${step.gpuCount}×`
            : `${step.gpuCount}× ${shortName(step.gpuName)}`;
          const charW = 5.2;
          const w = Math.max(28, label.length * charW + 8);
          const y = yScale(step.cost) - 10;
          return (
            <g key={i}>
              <rect x={step.midX - w / 2} y={y - 10} width={w} height={14} rx={3}
                fill="var(--bg-primary)" fillOpacity={0.9} stroke="var(--border)" strokeWidth={0.5} />
              <text x={step.midX} y={y} textAnchor="middle" fontSize="9" fontWeight="600"
                fill="var(--chart-self)">
                {label}
              </text>
            </g>
          );
        })}

        {/* Break-even marker */}
        {breakEven && (
          <>
            <line
              x1={xScale(breakEven)} y1={padding.top}
              x2={xScale(breakEven)} y2={height - padding.bottom}
              stroke="var(--accent-primary)" strokeWidth={1.5} strokeDasharray="6 4"
            />
            <circle cx={xScale(breakEven)} cy={yScale(data.find(d => d.volume >= breakEven)?.selfHosted || 0)}
              r={5} fill="var(--accent-primary)" stroke="var(--bg-primary)" strokeWidth={2} />
            <text x={xScale(breakEven)} y={padding.top - 6} textAnchor="middle"
              fontSize="11" fontWeight="600" fill="var(--accent-primary)">
              Break-even: {breakEven >= 1000 ? `${(breakEven / 1000).toFixed(1)}k` : breakEven}/day
            </text>
          </>
        )}

        {/* "You are here" marker for current daily volume */}
        {currentVolume > 0 && currentVolume <= maxVolume && (() => {
          const cx = xScale(currentVolume);
          // Offset label if too close to break-even line
          const tooClose = breakEven && Math.abs(cx - xScale(breakEven)) < 40;
          const labelX = tooClose ? cx - 18 : cx;
          return (
            <g>
              <line x1={cx} y1={padding.top} x2={cx} y2={height - padding.bottom}
                stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
              <polygon
                points={`${cx},${height - padding.bottom + 3} ${cx - 5},${height - padding.bottom + 10} ${cx + 5},${height - padding.bottom + 10}`}
                fill="var(--text-muted)" opacity={0.7}
              />
              <text x={labelX} y={height - padding.bottom + 20} textAnchor="middle"
                fontSize="9" fill="var(--text-muted)" opacity={0.9}>
                you
              </text>
            </g>
          );
        })()}

        {/* Legend */}
        <g transform={`translate(${width - padding.right - 140}, ${padding.top})`}>
          <line x1={0} y1={0} x2={20} y2={0} stroke="var(--chart-self)" strokeWidth={2.5} />
          <text x={26} y={4} fontSize="11" fill="var(--text-secondary)">Self-hosted</text>
          <line x1={0} y1={18} x2={20} y2={18} stroke="var(--chart-api)" strokeWidth={2.5} />
          <text x={26} y={22} fontSize="11" fill="var(--text-secondary)">API</text>
          {singleGpu && (
            <>
              <rect x={0} y={32} width={20} height={12} rx={2}
                fill="var(--bg-primary)" stroke="var(--border)" strokeWidth={0.5} />
              <text x={26} y={42} fontSize="11" fill="var(--text-secondary)">
                GPU: {shortName(singleGpu)}
              </text>
            </>
          )}
        </g>
      </svg>

      {/* Tooltip */}
      <div
        className={`chart-tooltip ${tooltip.visible ? 'visible' : ''}`}
        style={{
          left: `${(tooltip.x / width) * 100}%`,
          top: `${(tooltip.y / height) * 100}%`,
          transform: 'translate(-50%, -100%)',
        }}
      >
        {tooltip.data && (
          <div>
            <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {tooltip.data.volume >= 1000 ? `${(tooltip.data.volume / 1000).toFixed(1)}k` : tooltip.data.volume} requests/day
            </div>
            <div style={{ color: 'var(--chart-self)' }}>
              Self-hosted: ${tooltip.data.selfHosted.toFixed(0)}/mo ({tooltip.data.gpuCount}× {shortName(tooltip.data.gpuName)})
            </div>
            <div style={{ color: 'var(--chart-api)' }}>
              API: ${tooltip.data.api.toFixed(0)}/mo
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
