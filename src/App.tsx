import React, { useState, useEffect, useMemo } from 'react';
import { MODELS, QUANTIZATIONS, KV_DTYPES, PRICING_TIERS, API_PRICING, PRESETS } from './data/constants';
import type { ModelVariant, Preset } from './data/constants';
import {
  calculateVRAM, calculateKVPerToken, calculateThroughput,
  recommendGPU, calculateCosts, generateBreakEvenData,
  findBreakEven, estimateArchitecture, getConfidence,
} from './lib/calculations';
import Slider from './components/Slider';
import BreakEvenChart from './components/BreakEvenChart';
import PresetSelector from './components/PresetSelector';
import ThemeToggle from './components/ThemeToggle';

export default function App() {
  // Theme
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : true;
    } catch { return true; }
  });

  // State
  const DEFAULT_PRESET = PRESETS[0]; // Customer Support Bot
  const [family, setFamily] = useState(DEFAULT_PRESET.family);
  const [variant, setVariant] = useState(DEFAULT_PRESET.variant);
  const [awqKernel, setAwqKernel] = useState<'marlin' | 'default'>('marlin');
  const [quantization, setQuantization] = useState(DEFAULT_PRESET.quantization);
  const [kvDtype, setKvDtype] = useState('fp16');
  const [contextLength, setContextLength] = useState(DEFAULT_PRESET.contextLength);
  const [concurrent, setConcurrent] = useState(DEFAULT_PRESET.concurrent);
  const [dailyVolume, setDailyVolume] = useState(DEFAULT_PRESET.dailyVolume);
  const [avgTokens, setAvgTokens] = useState(DEFAULT_PRESET.avgTokens);
  const [inputRatio, setInputRatio] = useState(DEFAULT_PRESET.inputRatio);
  const [customParams, setCustomParams] = useState(7);
  const [apiModel, setApiModel] = useState('GPT-4o');
  const [cacheHitRatio, setCacheHitRatio] = useState(0);
  const [gpuUtilization, setGpuUtilization] = useState(85);
  const [batchEnabled, setBatchEnabled] = useState(false);
  const [replicaCount, setReplicaCount] = useState(DEFAULT_PRESET.replicaCount);
  const [peakFactor, setPeakFactor] = useState(DEFAULT_PRESET.peakFactor);
  const [pricingTier, setPricingTier] = useState(DEFAULT_PRESET.pricingTier);
  const [mfu, setMfu] = useState(DEFAULT_PRESET.mfu);
  const [resetKey, setResetKey] = useState(0);

  // Theme effect
  useEffect(() => {
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
    if (dark) document.documentElement.classList.remove('light');
    else document.documentElement.classList.add('light');
  }, [dark]);

  // URL state
  const urlParams = useMemo(() => ({
    family, variant, quantization, contextLength, concurrent, dailyVolume,
    avgTokens, inputRatio, customParams, apiModel, cacheHitRatio,
    gpuUtilization, batchEnabled: batchEnabled ? '1' : '0',
    kvDtype, replicaCount, peakFactor, pricingTier, mfu,
  }), [family, variant, quantization, contextLength, concurrent, dailyVolume,
    avgTokens, inputRatio, customParams, apiModel, cacheHitRatio,
    gpuUtilization, batchEnabled, kvDtype, replicaCount, peakFactor, pricingTier, mfu]);

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const presetSlug = p.get('preset')?.toLowerCase();
      if (presetSlug) {
        const preset = PRESETS.find(pr =>
          pr.name.toLowerCase().replace(/\s+/g, '-').startsWith(presetSlug)
        );
        if (preset) {
          setFamily(preset.family);
          setVariant(preset.variant);
          setQuantization(preset.quantization);
          setContextLength(preset.contextLength);
          setConcurrent(preset.concurrent);
          setDailyVolume(preset.dailyVolume);
          setAvgTokens(preset.avgTokens);
          setInputRatio(preset.inputRatio);
          setPeakFactor(preset.peakFactor);
          setReplicaCount(preset.replicaCount);
          setPricingTier(preset.pricingTier);
          setMfu(preset.mfu);
          return;
        }
      }
      if (p.has('family')) setFamily(p.get('family')!);
      if (p.has('variant')) setVariant(p.get('variant')!);
      if (p.has('quantization')) setQuantization(p.get('quantization')!);
      if (p.has('contextLength')) setContextLength(Number(p.get('contextLength')));
      if (p.has('concurrent')) setConcurrent(Number(p.get('concurrent')));
      if (p.has('dailyVolume')) setDailyVolume(Number(p.get('dailyVolume')));
      if (p.has('avgTokens')) setAvgTokens(Number(p.get('avgTokens')));
      if (p.has('inputRatio')) setInputRatio(Number(p.get('inputRatio')));
      if (p.has('customParams')) setCustomParams(Number(p.get('customParams')));
      if (p.has('apiModel')) setApiModel(p.get('apiModel')!);
      if (p.has('cacheHitRatio')) setCacheHitRatio(Number(p.get('cacheHitRatio')));
      if (p.has('gpuUtilization')) setGpuUtilization(Number(p.get('gpuUtilization')));
      if (p.has('batchEnabled')) setBatchEnabled(p.get('batchEnabled') === '1');
      if (p.has('kvDtype')) setKvDtype(p.get('kvDtype')!);
      if (p.has('replicaCount')) setReplicaCount(Number(p.get('replicaCount')));
      if (p.has('peakFactor')) setPeakFactor(Number(p.get('peakFactor')));
      if (p.has('pricingTier')) setPricingTier(p.get('pricingTier')!);
      if (p.has('mfu')) setMfu(Number(p.get('mfu')));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(urlParams)) {
        if (v !== undefined && v !== '') sp.set(k, String(v));
      }
      const qs = sp.toString();
      history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    } catch {}
  }, [urlParams]);

  // Derived model
  const model = useMemo((): ModelVariant => {
    const familyData = MODELS[family];
    const base = familyData.variants.find(v => v.name === variant) || familyData.variants[0];
    if (family === 'custom') {
      const arch = estimateArchitecture(customParams);
      return {
        ...base,
        params: customParams,
        ...arch,
        context: customParams <= 7 ? 32768 : customParams <= 32 ? 65536 : 131072,
      };
    }
    return base;
  }, [family, variant, customParams]);

  // Calculations
  const vramData = useMemo(() =>
    calculateVRAM(model, quantization, kvDtype, contextLength, concurrent),
  [model, quantization, kvDtype, contextLength, concurrent]);

  const gpuRec = useMemo(() =>
    recommendGPU(vramData, model, quantization, kvDtype, avgTokens, inputRatio, dailyVolume, concurrent, peakFactor, replicaCount, mfu),
  [vramData, model, quantization, kvDtype, avgTokens, inputRatio, dailyVolume, concurrent, peakFactor, replicaCount, mfu]);

  const costs = useMemo(() =>
    calculateCosts(dailyVolume, avgTokens, inputRatio, gpuRec, model, quantization, apiModel, cacheHitRatio, gpuUtilization, batchEnabled, pricingTier),
  [dailyVolume, avgTokens, inputRatio, gpuRec, model, quantization, apiModel, cacheHitRatio, gpuUtilization, batchEnabled, pricingTier]);

  const breakEvenData = useMemo(() =>
    generateBreakEvenData(avgTokens, inputRatio, model, quantization, kvDtype, contextLength, concurrent, peakFactor, replicaCount, mfu, gpuUtilization, apiModel, cacheHitRatio, batchEnabled, pricingTier),
  [avgTokens, inputRatio, model, quantization, kvDtype, contextLength, concurrent, peakFactor, replicaCount, mfu, gpuUtilization, apiModel, cacheHitRatio, batchEnabled, pricingTier]);

  const breakEvenVal = useMemo(() => findBreakEven(breakEvenData), [breakEvenData]);

  // Handlers
  const handlePreset = (preset: Preset) => {
    setFamily(preset.family);
    setVariant(preset.variant);
    setQuantization(preset.quantization);
    setContextLength(preset.contextLength);
    setConcurrent(preset.concurrent);
    setDailyVolume(preset.dailyVolume);
    setAvgTokens(preset.avgTokens);
    setInputRatio(preset.inputRatio);
    if (preset.peakFactor) setPeakFactor(preset.peakFactor);
    if (preset.replicaCount) setReplicaCount(preset.replicaCount);
    if (preset.pricingTier) setPricingTier(preset.pricingTier);
    if (preset.mfu) setMfu(preset.mfu);
  };

  const handleReset = () => {
    setFamily('qwen3'); setVariant('Qwen3-14B'); setQuantization('q4_k_m');
    setContextLength(8192); setConcurrent(8); setDailyVolume(500);
    setAvgTokens(1500); setInputRatio(70); setCustomParams(7);
    setApiModel('GPT-4o'); setCacheHitRatio(0); setGpuUtilization(85);
    setBatchEnabled(false); setKvDtype('fp16'); setReplicaCount(2);
    setPeakFactor(1.5); setPricingTier('on_demand'); setMfu(0.35);
    setResetKey(k => k + 1);
  };

  // Formatters
  const formatBytes = (bytes: number) => {
    const gb = bytes / 1e9;
    if (gb >= 1000) return `${(gb / 1024).toFixed(2)} TB`;
    return `${gb.toFixed(2)} GB`;
  };
  const formatTokens = (n: number) => {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toString();
  };

  const kvBytes = KV_DTYPES.find(k => k.key === kvDtype)?.bytes || 2;

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--bg-primary)' }}>
              $
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                LLM Deploy Cost Calculator
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                VRAM · GPU · Self-hosted vs API
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleReset}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Reset
            </button>
            <PresetSelector onSelect={handlePreset} resetKey={resetKey} />
            <ThemeToggle dark={dark} setDark={setDark} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Inputs (4 cols) */}
          <div className="lg:col-span-4 space-y-5 order-last lg:order-none">
            {/* Model & Deployment */}
            <div className="gruv-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                Model & Deployment
              </h2>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Model Family</label>
                <select value={family}
                  onChange={e => { setFamily(e.target.value); setVariant(MODELS[e.target.value].variants[0].name); }}
                  className="gruv-input">
                  {Object.entries(MODELS).map(([key, data]) => (
                    <option key={key} value={key}>{data.family}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Variant</label>
                <select value={variant} onChange={e => setVariant(e.target.value)} className="gruv-input">
                  {MODELS[family].variants.map(v => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.params}B){(v.arch === 'moe' || v.arch === 'mla') ? ` · ${v.arch.toUpperCase()}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {family === 'custom' && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Parameter Count (Billions)</label>
                    <span className="text-sm font-mono font-semibold" style={{ color: 'var(--accent-primary)' }}>{customParams}B</span>
                  </div>
                  <input type="number" min={0.5} max={500} step={0.5} value={customParams}
                    onChange={e => setCustomParams(Math.max(0.5, Math.min(500, Number(e.target.value))))}
                    className="gruv-input" />
                  <div className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    Architecture estimated: {model.layers} layers, {model.hidden} hidden, {model.kv_heads || model.heads} KV heads
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Weight Quantization</label>
                <select value={quantization} onChange={e => setQuantization(e.target.value)} className="gruv-input">
                  {QUANTIZATIONS.map(q => (
                    <option key={q.key} value={q.key}>{q.label} ({q.bytes} bytes/param)</option>
                  ))}
                </select>
              </div>

              {quantization === 'awq4' && gpuRec.gpu.generation !== 'Ada' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>AWQ Kernel</label>
                  <select value={awqKernel} onChange={e => setAwqKernel(e.target.value as 'marlin' | 'default')} className="gruv-input">
                    <option value="marlin">Marlin (24-26% of theoretical on Ampere)</option>
                    <option value="default">Default AWQ (9-16% of theoretical)</option>
                  </select>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Marlin is 48-64% faster on Ampere GPUs.</div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>KV Cache Precision</label>
                <select value={kvDtype} onChange={e => setKvDtype(e.target.value)} className="gruv-input">
                  {KV_DTYPES.map(k => (
                    <option key={k.key} value={k.key}>{k.label} ({k.bytes} bytes/elem)</option>
                  ))}
                </select>
              </div>

              <Slider label="Context Length" value={contextLength} min={2048} max={model.context} step={2048}
                onChange={setContextLength} format={formatTokens} />
              <Slider label="Concurrent Requests" value={concurrent} min={1} max={64} step={1}
                onChange={setConcurrent} format={v => `${v} req`} />

              <details className="mt-4 mb-2">
                <summary className="text-sm font-medium cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                  Advanced: Infrastructure
                </summary>
                <div className="mt-3 space-y-4">
                  <Slider label="Peak Factor (burst multiplier)" value={peakFactor} min={1.0} max={5.0} step={0.5}
                    onChange={setPeakFactor} format={v => `${v}×`} />
                  <div className="text-xs -mt-2" style={{ color: 'var(--text-muted)' }}>3× for 9-to-5, 1.5× for 24/7 global</div>

                  <div>
                    <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>High Availability Replicas</label>
                    <input type="number" min={1} max={8} value={replicaCount}
                      onChange={e => setReplicaCount(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
                      className="gruv-input" />
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>GPU × replicas for zero-downtime deploys</div>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>GPU Pricing Tier</label>
                    <select value={pricingTier} onChange={e => setPricingTier(e.target.value)} className="gruv-input">
                      <option value="on_demand">On-Demand (1.0×)</option>
                      <option value="reserved_1y">Reserved 1-Year (0.65×)</option>
                      <option value="spot">Spot / Community (0.35×)</option>
                    </select>
                  </div>

                  <Slider label="Model FLOPS Utilization (MFU)" value={mfu} min={0.20} max={0.50} step={0.05}
                    onChange={setMfu} format={v => `${(v * 100).toFixed(0)}%`} />
                  <div className="text-xs -mt-2" style={{ color: 'var(--text-muted)' }}>Fraction of peak FLOPS. 35% typical, lower for MoE</div>
                </div>
              </details>
            </div>

            {/* Traffic & API */}
            <div className="gruv-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                Traffic & API
              </h2>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Requests / Day</label>
                  <span className="text-sm font-mono font-semibold" style={{ color: 'var(--accent-primary)' }}>{dailyVolume.toLocaleString()}</span>
                </div>
                <input type="number" min={1} max={100000} value={dailyVolume}
                  onChange={e => setDailyVolume(Math.max(1, Number(e.target.value)))}
                  className="gruv-input" />
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Avg Tokens per Request</label>
                  <span className="text-sm font-mono font-semibold" style={{ color: 'var(--accent-primary)' }}>{formatTokens(avgTokens)}</span>
                </div>
                <input type="number" min={1} max={128000} value={avgTokens}
                  onChange={e => setAvgTokens(Math.max(1, Number(e.target.value)))}
                  className="gruv-input" />
              </div>

              <Slider label="Input / Output Ratio" value={inputRatio} min={10} max={90} step={5}
                onChange={setInputRatio} format={v => `${v}% / ${100 - v}%`} />

              <div className="mt-4 mb-4">
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>API Comparison Model</label>
                <select value={apiModel} onChange={e => setApiModel(e.target.value)} className="gruv-input">
                  {API_PRICING.map(p => (
                    <option key={p.model} value={p.model}>{p.model} — ${p.input}/${p.output} per 1M ({p.provider})</option>
                  ))}
                </select>
              </div>

              <details className="mt-2">
                <summary className="text-sm font-medium cursor-pointer" style={{ color: 'var(--text-muted)' }}>Adjustments</summary>
                <div className="mt-3 space-y-4">
                  <Slider label="API Cache Hit Ratio" value={cacheHitRatio} min={0} max={90} step={5}
                    onChange={setCacheHitRatio} format={v => `${v}%`} />
                  <div className="text-xs -mt-2" style={{ color: 'var(--text-muted)' }}>Input tokens cached at {Math.round(costs.cacheMult * 100)}% of base price</div>
                  <Slider label="GPU Utilization" value={gpuUtilization} min={20} max={100} step={5}
                    onChange={setGpuUtilization} format={v => `${v}%`} />
                  <div className="text-xs -mt-2" style={{ color: 'var(--text-muted)' }}>Cost inflated ×{parseFloat((1 / (gpuUtilization / 100)).toFixed(2))} at {gpuUtilization}% util</div>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>API Batch Processing</span>
                    <input type="checkbox" checked={batchEnabled}
                      onChange={e => setBatchEnabled(e.target.checked)}
                      className="w-5 h-5 rounded cursor-pointer" style={{ accentColor: 'var(--accent-primary)' }} />
                  </label>
                </div>
              </details>
            </div>
          </div>

          {/* RIGHT: Outputs (8 cols) */}
          <div className="lg:col-span-8 space-y-5 order-first lg:order-none">
            {/* Infrastructure & Cost */}
            <div className="gruv-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Infrastructure & Cost
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold px-2 py-1 rounded-md"
                    style={{ backgroundColor: costs.winner === 'self' ? 'rgba(184, 187, 38, 0.15)' : 'rgba(251, 73, 52, 0.15)', color: costs.winner === 'self' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                    {costs.winner === 'self' ? 'Self-hosted wins by' : 'API wins by'} {costs.savingsPercent.toFixed(0)}%
                  </span>
                  {breakEvenVal && (
                  <span className="text-sm font-semibold px-2 py-1 rounded-md"
                      style={{ backgroundColor: 'rgba(250, 189, 47, 0.12)', color: 'var(--accent-primary)' }}>
                      Break-even: {breakEvenVal >= 1000 ? `${(breakEvenVal / 1000).toFixed(1)}k` : breakEvenVal}/day
                    </span>
                  )}
                </div>
              </div>

              {/* GPU row */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold shrink-0"
                  style={{ backgroundColor: '#76B900', color: '#000' }}>
                  {gpuRec.gpu.name.split(' ')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{gpuRec.gpu.name}</span>
                    {gpuRec.count > 1 && (
                      <span className="badge" style={{ backgroundColor: gpuRec.replicas > 1 ? 'var(--accent-info)' : 'var(--accent-danger)', color: 'white' }}>{gpuRec.count}× GPU</span>
                    )}
                    <span className="badge"
                      style={{ backgroundColor: gpuRec.bottleneck === 'throughput' ? 'var(--accent-warning)' : gpuRec.bottleneck === 'vram' ? 'var(--accent-danger)' : 'var(--accent-success)', color: 'var(--bg-primary)' }}>
                      {gpuRec.bottleneck === 'throughput' ? 'Throughput-bound' : gpuRec.bottleneck === 'vram' ? 'VRAM-bound' : 'Balanced'}
                    </span>
                  </div>
                  <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {gpuRec.gpu.vram} GB VRAM · ${gpuRec.gpu.hourly}/hr · {gpuRec.count} GPU{gpuRec.count > 1 ? 's' : ''}
                    {gpuRec.replicas > 1 && ` (${gpuRec.baseCount} base × ${gpuRec.replicas} replicas)`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold font-mono" style={{ color: 'var(--accent-primary)' }}>
                    ${(gpuRec.gpu.hourly * 730 * gpuRec.count * (PRICING_TIERS[pricingTier] || 1) / (gpuUtilization / 100)).toFixed(0)}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>/month ({gpuUtilization}% util · {pricingTier.replace('_', ' ')})</div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t mb-4" style={{ borderColor: 'var(--border)' }} />

              {/* Cost comparison row */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--chart-self)' }}>Self-hosted</div>
                  <div className="text-xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>${costs.selfHostedMonthly.toFixed(0)}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span></div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>${costs.selfHostedPerTranscript.toFixed(4)}/request {costs.storageCost > 1 ? `· ${costs.storageCost.toFixed(1)} GB artifact storage` : ''}</div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--chart-api)' }}>API ({costs.apiPricing.provider})</div>
                  <div className="text-xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>${costs.apiMonthly.toFixed(0)}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span></div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    ${costs.apiPerTranscript.toFixed(4)}/request
                    {(cacheHitRatio > 0 || batchEnabled) && <span> · {cacheHitRatio > 0 && `${Math.round((1 - costs.cacheMult) * 100)}% cache`}{cacheHitRatio > 0 && batchEnabled && ' + '}{batchEnabled && 'batch 50%'}</span>}
                  </div>
                </div>
              </div>

              {/* Throughput */}
              {gpuRec.throughput && (
                <div className="text-xs mb-4 grid grid-cols-2 gap-2" style={{ color: 'var(--text-muted)' }}>
                  <div>Prefill: <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{gpuRec.throughput.prefillTps.toFixed(0)} tok/s</span>
                    {gpuRec.inputTpsRequired > 0 && <span> (need {gpuRec.inputTpsRequired.toFixed(0)})</span>}
                  </div>
                  <div>Decode: <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{gpuRec.throughput.decodeTpsAggregate.toFixed(0)} tok/s</span>
                    {gpuRec.outputTpsRequired > 0 && <span> (need {gpuRec.outputTpsRequired.toFixed(0)})</span>}
                  </div>
                </div>
              )}
              <div className="text-xs mb-4" style={{ color: 'var(--fg-muted)', lineHeight: '1.5' }}>
                Decode efficiency calibrated from benchmarks — <a href="https://llm-bench.rituraj.info" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>measured on L4 + A100</a> using vLLM 0.8.5. Per-GPU generation × quantization × batch lookup. Prefill uses MFU ({mfu}). <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: gpuRec.gpu.generation === 'Ada' || gpuRec.gpu.generation === 'Ampere' ? 'var(--accent-success)' : 'var(--accent-warning)', color: 'var(--bg-primary)' }}>{gpuRec.gpu.generation === 'Ada' || gpuRec.gpu.generation === 'Ampere' ? 'measured' : 'unmeasured'}</span>              </div>

              {gpuRec.count > gpuRec.replicas && (
                <div className="text-xs p-3 rounded-lg mb-4" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-danger)' }}>
                  Multi-GPU inference required — tensor parallelism adds communication overhead and engineering complexity.
                </div>
              )}

              {/* Divider */}
              <div className="border-t mb-3" style={{ borderColor: 'var(--border)' }} />

              {/* VRAM breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>VRAM</span>
                  <span className="text-sm font-bold font-mono" style={{ color: 'var(--accent-primary)' }}>{formatBytes(vramData.totalVRAM)}</span>
                </div>
                {[
                  { label: 'Weights', value: vramData.breakdown.weights, color: 'var(--accent-info)' },
                  { label: 'KV Cache', value: vramData.breakdown.kv, color: 'var(--accent-purple)' },
                  { label: '+15% overhead', value: vramData.breakdown.overhead, color: 'var(--accent-success)' },
                ].map(item => {
                  const pct = (item.value / vramData.totalVRAM * 100).toFixed(1);
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                        <span className="font-mono" style={{ color: item.color }}>{formatBytes(item.value)} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <div className="h-full rounded-full bar-fill" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                {model.arch.toUpperCase()}
                {model.arch === 'mla' ? ' · MLA compressed KV' :
                  model.arch === 'moe' ? ` · MoE (top-${model.moe_topk})` :
                    ` · ${model.layers} layers, ${model.hidden} hidden, ${model.kv_heads || model.heads} KV heads`}
              </div>
            </div>

            {/* Break-even Chart */}
            <div className="gruv-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                  Break-even Analysis
                </h2>
              <BreakEvenChart data={breakEvenData} breakEven={breakEvenVal} />
              <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                Self-hosted cost steps up when throughput demands an additional GPU. Hover for details.
              </div>

              <details className="mt-4">
                <summary className="text-sm font-medium cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                  Show calculation formulas
                </summary>
                <div className="mt-3 p-4 rounded-lg text-xs font-mono space-y-2" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  <div>
                    <span style={{ color: 'var(--accent-info)' }}>Prefill TPS</span> = MFU × GPU_FP16_TFLOPS ÷ (2 × active_params)<br />
                    = {(mfu * 100).toFixed(0)}% × {gpuRec.gpu.fp16_tflops} TFLOPS ÷ (2 × {(model.active_params || model.params).toFixed(1)}B)<br />
                    = <span style={{ color: 'var(--accent-success)' }}>{gpuRec.throughput?.prefillTps.toFixed(0)} tok/s</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--accent-info)' }}>Decode TPS (aggregate)</span> = B × HBM_GBW ÷ (weight_bytes + B × KV_per_seq)<br />
                    = {concurrent} × {gpuRec.gpu.hbm_gbps} GB/s ÷ ({formatBytes(gpuRec.throughput?.weightsBytes || 0)} + {concurrent} × {formatBytes(gpuRec.throughput?.kvPerSeqBytes || 0)})<br />
                    = <span style={{ color: 'var(--accent-success)' }}>{gpuRec.throughput?.decodeTpsAggregate.toFixed(0)} tok/s</span> ({gpuRec.throughput?.decodeTpsPerStream.toFixed(0)} tok/s per stream)
                  </div>
                  <div>
                    {model.arch === 'mla' ? (
                      <>
                        <span style={{ color: 'var(--accent-info)' }}>KV per token (MLA)</span> = 2 × layers × kv_dim × kv_dtype_bytes<br />
                        = 2 × {model.layers} × {model.kv_dim || 512} × {kvBytes}<br />
                      </>
                    ) : (
                      <>
                        <span style={{ color: 'var(--accent-info)' }}>KV per token ({model.arch.toUpperCase()})</span> = 2 × layers × kv_heads × head_dim × kv_dtype_bytes<br />
                        = 2 × {model.layers} × {model.kv_heads || model.heads} × {(model.hidden / model.heads).toFixed(0)} × {kvBytes}<br />
                      </>
                    )}
                    = <span style={{ color: 'var(--accent-success)' }}>{formatBytes(calculateKVPerToken(model, kvBytes))}/token</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--accent-info)' }}>VRAM</span> = weights + KV_cache × concurrent + 15% overhead<br />
                    = {formatBytes(vramData.breakdown.weights)} + {formatBytes(vramData.breakdown.kv / concurrent)} × {concurrent} + 15%<br />
                    = <span style={{ color: 'var(--accent-success)' }}>{formatBytes(vramData.totalVRAM)}</span>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 text-center text-xs" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
          <p>
            All prices in USD. GPU costs assume 730 hrs/mo — RunPod &amp; Lambda pricing, April 2026.
            API pricing from OpenRouter as of April 2026.
          </p>
          <p className="mt-2 flex items-center justify-center gap-4">
            <a href="https://www.rituraj.info/posts/on-prem-llm-deployment-cto/" target="_blank" rel="noopener noreferrer"
              className="underline hover:no-underline transition-colors" style={{ color: 'var(--accent-primary)' }}>
              Read the blog post
            </a>
            <span style={{ color: 'var(--border)' }}>|</span>
            <a href="https://github.com/ree2raz/llm-cost-calculator" target="_blank" rel="noopener noreferrer"
              className="underline hover:no-underline transition-colors" style={{ color: 'var(--accent-primary)' }}>
              GitHub repo
            </a>
            <span style={{ color: 'var(--border)' }}>|</span>
            <a href="https://github.com/ree2raz/inference-bench" target="_blank" rel="noopener noreferrer"
              className="underline hover:no-underline transition-colors" style={{ color: 'var(--accent-primary)' }}>
              Benchmark data
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
