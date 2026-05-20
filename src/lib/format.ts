// Shared money formatters. Keep these adaptive so a single column never
// silently rounds a meaningful dollar amount to $0 or $1.

export function formatCost(n: number): string {
  if (!isFinite(n)) return '—';
  if (n === 0) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `$${(n / 1000).toFixed(1)}k`;
  if (abs >= 100) return `$${n.toFixed(0)}`;
  if (abs >= 10) return `$${n.toFixed(1)}`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  if (abs >= 0.01) return `$${n.toFixed(3)}`;
  if (abs >= 0.0001) return `$${n.toFixed(5)}`;
  // Below a hundredth of a cent — keep significant figures via scientific only as a last resort
  return `$${n.toFixed(7)}`;
}

export function formatPerRequest(n: number): string {
  if (!isFinite(n)) return '—';
  if (n === 0) return '$0';
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  // Below $0.0001/request — switch unit to per 1k requests for readability
  return `$${(n * 1000).toFixed(4)}/1k`;
}
