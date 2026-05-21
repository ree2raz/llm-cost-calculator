import React, { useState, useEffect, useMemo } from 'react';
import { MODELS, QUANTIZATIONS, KV_DTYPES, PRESETS } from './data/constants';
import type { ModelVariant, Preset } from './data/constants';
import {
  calculateVRAM, calculateKVPerToken, calculateThroughput,
  recommendGPU, calculateCosts, generateBreakEvenData,
  findBreakEven, estimateArchitecture, getConfidence,
  getGpuPriceList, calculateAllApiCosts,
} from './lib/calculations';
import Slider from './components/Slider';
import BreakEvenChart from './components/BreakEvenChart';
import PresetSelector from './components/PresetSelector';
import ThemeToggle from './components/ThemeToggle';
import ApiComparisonTable from './components/ApiComparisonTable';
import { formatCost, formatPerRequest } from './lib/format';

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
  const [opsEnabled, setOpsEnabled] = useState(false);
  const [opsFte, setOpsFte] = useState(0.5);
  const [opsCostPerFte, setOpsCostPerFte] = useState(150000);
  const [showEngineering, setShowEngineering] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const opsMonthly = opsEnabled ? (opsFte * opsCostPerFte) / 12 : 0;

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
    opsEnabled: opsEnabled ? '1' : '0', opsFte, opsCostPerFte,
  }), [family, variant, quantization, contextLength, concurrent, dailyVolume,
    avgTokens, inputRatio, customParams, apiModel, cacheHitRatio,
    gpuUtilization, batchEnabled, kvDtype, replicaCount, peakFactor, pricingTier, mfu,
    opsEnabled, opsFte, opsCostPerFte]);

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
      if (p.has('opsEnabled')) setOpsEnabled(p.get('opsEnabled') === '1');
      if (p.has('opsFte')) setOpsFte(Number(p.get('opsFte')));
      if (p.has('opsCostPerFte')) setOpsCostPerFte(Number(p.get('opsCostPerFte')));
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
    calculateVRAM(model, quantization, kvDtype, contextLength, concurrent, avgTokens),
  [model, quantization, kvDtype, contextLength, concurrent, avgTokens]);

  const gpuRec = useMemo(() =>
    recommendGPU(vramData, model, quantization, kvDtype, avgTokens, inputRatio, dailyVolume, concurrent, peakFactor, replicaCount, mfu, pricingTier),
  [vramData, model, quantization, kvDtype, avgTokens, inputRatio, dailyVolume, concurrent, peakFactor, replicaCount, mfu, pricingTier]);

  const providerQuotes = useMemo(() => getGpuPriceList(gpuRec.gpu, pricingTier), [gpuRec.gpu, pricingTier]);

  const costs = useMemo(() =>
    calculateCosts(dailyVolume, avgTokens, inputRatio, gpuRec, model, quantization, apiModel, cacheHitRatio, gpuUtilization, batchEnabled, pricingTier, opsMonthly),
  [dailyVolume, avgTokens, inputRatio, gpuRec, model, quantization, apiModel, cacheHitRatio, gpuUtilization, batchEnabled, pricingTier, opsMonthly]);

  const breakEvenData = useMemo(() =>
    generateBreakEvenData(avgTokens, inputRatio, model, quantization, kvDtype, contextLength, concurrent, peakFactor, replicaCount, mfu, gpuUtilization, apiModel, cacheHitRatio, batchEnabled, pricingTier, opsMonthly),
  [avgTokens, inputRatio, model, quantization, kvDtype, contextLength, concurrent, peakFactor, replicaCount, mfu, gpuUtilization, apiModel, cacheHitRatio, batchEnabled, pricingTier, opsMonthly]);

  const breakEvenVal = useMemo(() => findBreakEven(breakEvenData), [breakEvenData]);

  const apiCostRows = useMemo(() =>
    calculateAllApiCosts(dailyVolume, avgTokens, inputRatio, cacheHitRatio, batchEnabled),
  [dailyVolume, avgTokens, inputRatio, cacheHitRatio, batchEnabled]);

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
    const p = DEFAULT_PRESET;
    setFamily(p.family); setVariant(p.variant); setQuantization(p.quantization);
    setContextLength(p.contextLength); setConcurrent(p.concurrent); setDailyVolume(p.dailyVolume);
    setAvgTokens(p.avgTokens); setInputRatio(p.inputRatio); setCustomParams(7);
    setApiModel('GPT-4o'); setCacheHitRatio(0); setGpuUtilization(85);
    setBatchEnabled(false); setKvDtype('fp16'); setReplicaCount(p.replicaCount);
    setPeakFactor(p.peakFactor); setPricingTier(p.pricingTier); setMfu(p.mfu);
    setOpsEnabled(false); setOpsFte(0.5); setOpsCostPerFte(150000);
    setResetKey(k => k + 1);
  };

  // Formatters
  const formatBytes = (bytes: number) => {
    const gb = bytes / 1e9;
    if (gb >= 1000) return `${(gb / 1024).toFixed(2)} TB`;
    return `${gb.toFixed(2)} GB`;
  };
  const formatSmallBytes = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb < 1) return `${bytes.toFixed(0)} B`;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(2)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
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
          <div className="lg:col-span-4 space-y-4 order-last lg:order-none">

            {/* Card 1: Model */}
            <div className="gruv-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Model</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Model Family</label>
                <select value={family}
                  onChange={e => { setFamily(e.target.value); setVariant(MODELS[e.target.value].variants[0].name); }}
                  className="gruv-input">
                  {Object.entries(MODELS)
                    .sort(([a], [b]) => (a === 'custom' ? 1 : b === 'custom' ? -1 : 0))
                    .map(([key, data]) => (
                      <option key={key} value={key}>{data.family}</option>
                    ))}
                </select>
              </div>
              <div>
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
                <div className="mt-4">
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
            </div>

            {/* Card 2: Traffic */}
            <div className="gruv-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Traffic</h2>
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Requests / Day</label>
                  <span className="text-sm font-mono font-semibold" style={{ color: 'var(--accent-primary)' }}>{dailyVolume.toLocaleString()}</span>
                </div>
                <input type="number" min={1} max={100000} value={dailyVolume}
                  onChange={e => setDailyVolume(Math.max(1, Number(e.target.value)))}
                  className="gruv-input" />
              </div>
              <div className="mb-1">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Avg Request Size</label>
                  <span className="text-sm font-mono font-semibold" style={{ color: 'var(--accent-primary)' }}>{formatTokens(avgTokens)} tokens</span>
                </div>
                <input type="number" min={1} max={128000} value={avgTokens}
                  onChange={e => setAvgTokens(Math.max(1, Number(e.target.value)))}
                  className="gruv-input" />
                <div className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  short chat ≈ 500 · customer support ≈ 1,500 · doc summary ≈ 8,000
                </div>
              </div>

              {/* GPU Pricing Tier */}
              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>GPU Pricing Tier</label>
                  {pricingTier === 'reserved_1y' && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(184,187,38,0.12)', color: 'var(--accent-success)' }}>12-month commit</span>
                  )}
                  {pricingTier === 'spot' && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(251,73,52,0.12)', color: 'var(--accent-danger)' }}>interruptible</span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {([
                    { key: 'on_demand', label: 'On-demand', sub: '1.0×' },
                    { key: 'reserved_1y', label: 'Reserved 1yr', sub: '−35%' },
                    { key: 'spot', label: 'Spot', sub: '−65%' },
                  ] as const).map(t => (
                    <button key={t.key} onClick={() => setPricingTier(t.key)}
                      className="flex-1 py-1.5 rounded text-xs font-medium transition-colors text-center"
                      style={{
                        backgroundColor: pricingTier === t.key ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        color: pricingTier === t.key ? 'var(--bg-primary)' : 'var(--text-secondary)',
                        border: `1px solid ${pricingTier === t.key ? 'var(--accent-primary)' : 'var(--border)'}`,
                      }}>
                      <div>{t.label}</div>
                      <div style={{ opacity: 0.75, fontSize: '10px' }}>{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                Comparing against <span className="font-semibold" style={{ color: 'var(--accent-primary)' }}>{apiModel}</span>. Pick a different API in the comparison table →
              </div>
            </div>

            {/* Card 3: Cost Options — visible, plain-English levers */}
            <div className="gruv-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Cost Options</h2>

              {/* Batch API */}
              <div className="pb-4 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <label className="flex items-center justify-between cursor-pointer mb-1.5">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Batch API
                    {batchEnabled && <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(184,187,38,0.12)', color: 'var(--accent-success)' }}>−50%</span>}
                  </span>
                  <input type="checkbox" checked={batchEnabled}
                    onChange={e => setBatchEnabled(e.target.checked)}
                    className="w-5 h-5 rounded cursor-pointer" style={{ accentColor: 'var(--accent-primary)' }} />
                </label>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Results in up to 24 hrs — halves API cost. Best for reports, embeddings, async jobs.
                </div>
              </div>

              {/* Prompt Caching */}
              <div className="pb-4 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <Slider label="Prompt Caching" value={cacheHitRatio} min={0} max={90} step={5}
                  onChange={setCacheHitRatio} format={v => v === 0 ? 'None' : `${v}%`} />
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {cacheHitRatio === 0
                    ? 'Set above 0 if requests share a long system prompt or document.'
                    : `~${Math.round((1 - costs.cacheMult) * 100)}% discount on repeated input tokens.`}
                </div>
              </div>

              {/* Ops overhead */}
              <div>
                <label className="flex items-center justify-between cursor-pointer mb-1.5">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Add ops cost to self-hosted
                    {opsEnabled && <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(251,73,52,0.12)', color: 'var(--accent-danger)' }}>+{formatCost(opsMonthly)}/mo</span>}
                  </span>
                  <input type="checkbox" checked={opsEnabled}
                    onChange={e => setOpsEnabled(e.target.checked)}
                    className="w-5 h-5 rounded cursor-pointer" style={{ accentColor: 'var(--accent-primary)' }} />
                </label>
                <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  {opsEnabled
                    ? `Engineering time to manage infra — ${opsFte} FTE × $${(opsCostPerFte / 1000).toFixed(0)}k/yr.`
                    : 'Managing self-hosted infra takes real engineering time. Excluded by default.'}
                </div>
                {opsEnabled && (
                  <div className="space-y-3">
                    <Slider label="Engineering FTE" value={opsFte} min={0.25} max={2} step={0.25}
                      onChange={setOpsFte} format={v => `${v} FTE`} />
                    <div>
                      <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Loaded cost / FTE</label>
                      <select value={opsCostPerFte} onChange={e => setOpsCostPerFte(Number(e.target.value))} className="gruv-input">
                        <option value={100000}>Junior — $100k / yr</option>
                        <option value={150000}>Mid — $150k / yr</option>
                        <option value={200000}>Senior — $200k / yr</option>
                        <option value={300000}>Staff — $300k / yr</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 4: Technical Assumptions — always shows active values, expandable */}
            <div className="gruv-card overflow-hidden">
              <button
                onClick={() => setShowEngineering(s => !s)}
                className="w-full px-5 py-4 flex items-start justify-between gap-3 text-left transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Technical assumptions
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      quantization.toUpperCase(),
                      `${formatTokens(contextLength)} ctx`,
                      `${concurrent} concurrent`,
                      `${inputRatio}/${100 - inputRatio} in/out`,
                      gpuUtilization !== 85 ? `${gpuUtilization}% util` : null,
                      replicaCount > 1 ? `${replicaCount}× replicas` : null,
                    ].filter(Boolean).map(chip => (
                      <span key={chip as string} className="px-2 py-0.5 rounded-full text-xs font-mono"
                        style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-xs font-medium shrink-0 flex items-center gap-1 mt-0.5"
                  style={{ color: 'var(--accent-primary)' }}>
                  <span>{showEngineering ? 'collapse' : 'customize'}</span>
                  <span style={{ fontSize: '9px' }}>{showEngineering ? '▲' : '▼'}</span>
                </div>
              </button>

              {showEngineering && (
                <div className="px-5 pb-5 pt-1 space-y-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="pt-2">
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Weight Quantization</label>
                    <select value={quantization} onChange={e => setQuantization(e.target.value)} className="gruv-input">
                      {QUANTIZATIONS.map(q => (
                        <option key={q.key} value={q.key}>{q.label} ({q.bytes} bytes/param)</option>
                      ))}
                    </select>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Lower = less VRAM needed, slightly reduced quality</div>
                  </div>

                  <Slider label="Context Length" value={contextLength} min={2048} max={model.context} step={2048}
                    onChange={setContextLength} format={formatTokens} />

                  <Slider label="Concurrent Requests" value={concurrent} min={1} max={64} step={1}
                    onChange={setConcurrent} format={v => `${v} req`} />

                  <Slider label="Input / Output Ratio" value={inputRatio} min={10} max={90} step={5}
                    onChange={setInputRatio} format={v => `${v}% / ${100 - v}%`} />

                  <Slider label="Traffic Spikes (peak factor)" value={peakFactor} min={1.0} max={5.0} step={0.5}
                    onChange={setPeakFactor} format={v => `${v}×`} />
                  <div className="text-xs -mt-2" style={{ color: 'var(--text-muted)' }}>3× for 9-to-5, 1.5× for 24/7 global</div>

                  <div>
                    <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Redundancy (replicas)</label>
                    <input type="number" min={1} max={8} value={replicaCount}
                      onChange={e => setReplicaCount(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
                      className="gruv-input" />
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>GPU × replicas for zero-downtime deploys</div>
                  </div>

                  <Slider label="Model FLOPS Utilization (MFU)" value={mfu} min={0.20} max={0.50} step={0.05}
                    onChange={setMfu} format={v => `${(v * 100).toFixed(0)}%`} />
                  <div className="text-xs -mt-2" style={{ color: 'var(--text-muted)' }}>Fraction of peak FLOPS. 35% typical, lower for MoE</div>

                  <Slider label="GPU Utilization" value={gpuUtilization} min={20} max={100} step={5}
                    onChange={setGpuUtilization} format={v => `${v}%`} />
                  <div className="text-xs -mt-2" style={{ color: 'var(--text-muted)' }}>Cost inflated ×{parseFloat((1 / (gpuUtilization / 100)).toFixed(2))} at {gpuUtilization}% util</div>

                  {quantization === 'awq4' && gpuRec.gpu.generation !== 'Ada' && (
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>AWQ Kernel</label>
                      <select value={awqKernel} onChange={e => setAwqKernel(e.target.value as 'marlin' | 'default')} className="gruv-input">
                        <option value="marlin">Marlin (24-26% of theoretical on Ampere)</option>
                        <option value="default">Default AWQ (9-16% of theoretical)</option>
                      </select>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Marlin is 48-64% faster on Ampere GPUs.</div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>KV Cache Precision</label>
                    <select value={kvDtype} onChange={e => setKvDtype(e.target.value)} className="gruv-input">
                      {KV_DTYPES.map(k => (
                        <option key={k.key} value={k.key}>{k.label} ({k.bytes} bytes/elem)</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Outputs (8 cols) */}
          <div className="lg:col-span-8 space-y-5 order-first lg:order-none">
            {/* Answer-first verdict banner */}
            {(() => {
              const fmtVol = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
              const winnerLabel = costs.winner === 'self' ? 'Self-hosting' : 'API';
              const loserLabel = costs.winner === 'self' ? 'API' : 'self-hosting';
              const headline = `${winnerLabel} saves ${formatCost(costs.savings)}/mo at ${dailyVolume.toLocaleString()} req/day`;
              const sub = breakEvenVal
                ? costs.winner === 'self'
                  ? `${loserLabel} becomes cheaper below ${fmtVol(breakEvenVal)} req/day`
                  : `${loserLabel} wins above ${fmtVol(breakEvenVal)} req/day`
                : costs.winner === 'self'
                  ? 'Self-hosting wins at every volume for this model + tier'
                  : 'API wins at every volume — scale up before self-hosting';
              const accent = costs.winner === 'self' ? 'var(--accent-success)' : 'var(--accent-info)';
              return (
                <div className="gruv-card px-5 py-4" style={{ borderLeft: `3px solid ${accent}` }}>
                  <div className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    {headline}
                  </div>
                  <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {sub}
                    <span className="ml-3 text-xs font-mono px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${accent}22`, color: accent }}>
                      {costs.savingsPercent.toFixed(0)}% cheaper
                    </span>
                  </div>
                </div>
              );
            })()}

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
              {(() => {
                const qBytes = QUANTIZATIONS.find(x => x.key === quantization)?.bytes ?? 0.5;
                const confidence = getConfidence(gpuRec.gpu.generation, qBytes, quantization, awqKernel, model.arch === 'moe');
                const bottleneckLabel = gpuRec.bottleneck === 'vram'
                  ? `memory-limited (needs ${formatBytes(vramData.totalVRAM)})`
                  : gpuRec.bottleneck === 'throughput'
                  ? `speed-limited (${gpuRec.outputTpsRequired.toFixed(0)} tok/s required)`
                  : `memory + speed balanced`;
                const whyLine = `Cheapest ${pricingTier.replace('_', ' ')} option · ${bottleneckLabel}`;
                return (
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
                    {/* G2: confidence pill — measured/interpolated/unmeasured for this GPU+quant combo */}
                    <span className="badge" style={{
                      backgroundColor: confidence === 'measured' ? 'rgba(184,187,38,0.15)' : confidence === 'interpolated' ? 'rgba(250,189,47,0.12)' : 'rgba(254,128,25,0.15)',
                      color: confidence === 'measured' ? 'var(--accent-success)' : confidence === 'interpolated' ? 'var(--accent-primary)' : 'var(--accent-warning)',
                    }}>{confidence}</span>
                  </div>
                  <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {gpuRec.gpu.vram} GB VRAM · ${gpuRec.price.rate.toFixed(2)}/hr ({gpuRec.price.provider} {pricingTier.replace('_', ' ')}{gpuRec.price.fallback ? ' est.' : ''}) · {gpuRec.count} GPU{gpuRec.count > 1 ? 's' : ''}
                    {gpuRec.replicas > 1 && ` (${gpuRec.baseCount} base × ${gpuRec.replicas} replicas)`}
                  </div>
                  {/* G3: plain-English why this GPU was picked */}
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{whyLine}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold font-mono" style={{ color: 'var(--accent-primary)' }}>
                    {formatCost(gpuRec.price.rate * 730 * gpuRec.count / (gpuUtilization / 100))}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>/month ({gpuUtilization}% util · {pricingTier.replace('_', ' ')})</div>
                </div>
              </div>
                );
              })()}

              {/* Provider price comparison */}
              {providerQuotes.length > 1 && (
                <details className="mb-4">
                  <summary className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                    {providerQuotes.length} providers compared — cheapest: {providerQuotes[0].provider} @ ${providerQuotes[0].rate.toFixed(2)}/hr
                  </summary>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {providerQuotes.map((q, i) => (
                      <div key={q.provider} className="flex justify-between px-2 py-1 rounded"
                        style={{ backgroundColor: i === 0 ? 'rgba(184, 187, 38, 0.10)' : 'transparent' }}>
                        <span>{q.provider}{q.fallback ? ' (est.)' : ''}</span>
                        <span style={{ color: i === 0 ? 'var(--accent-success)' : 'var(--text-muted)' }}>${q.rate.toFixed(2)}/hr</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Sourced from provider pricing pages, May 2026. (est.) marks tiers without a published rate — fallback to on-demand × tier multiplier. Verify before committing.
                  </div>
                </details>
              )}

              {/* Divider */}
              <div className="border-t mb-4" style={{ borderColor: 'var(--border)' }} />

              {/* Cost comparison row */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--chart-self)' }}>Self-hosted</div>
                  <div className="text-xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{formatCost(costs.selfHostedMonthly)}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span></div>
                  <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }} title="Range from GPU pricing variance (±15%), continuous batching overhead (10–30%), and realized MFU vs theoretical">
                    range {formatCost(costs.selfHostedMonthlyLow)}–{formatCost(costs.selfHostedMonthlyHigh)}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{formatPerRequest(costs.selfHostedPerTranscript)}/request {costs.storageCost > 1 ? `· ${costs.storageCost.toFixed(1)} GB artifact storage` : ''}</div>
                  {costs.opsMonthly > 0 ? (
                    <div className="text-xs mt-1" style={{ color: 'var(--accent-warning)' }}>
                      includes {formatCost(costs.opsMonthly)}/mo ops ({opsFte} FTE × ${(opsCostPerFte / 1000).toFixed(0)}k/yr) · GPU alone {formatCost(costs.selfHostedGpuMonthly)}/mo
                    </div>
                  ) : (
                    /* C: ops nudge — shown when self-hosting wins but ops is excluded */
                    costs.winner === 'self' && (
                      <div className="text-xs mt-1">
                        <button onClick={() => setOpsEnabled(true)}
                          className="underline" style={{ color: 'var(--text-muted)' }}>
                          + add ops cost
                        </button>
                        <span style={{ color: 'var(--text-muted)' }}> to see true TCO</span>
                      </div>
                    )
                  )}
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--chart-api)' }}>API ({costs.apiPricing.provider})</div>
                  <div className="text-xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{formatCost(costs.apiMonthly)}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span></div>
                  <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }} title="Range from token-count estimation, cache hit-rate drift, and batch eligibility variance">
                    range {formatCost(costs.apiMonthlyLow)}–{formatCost(costs.apiMonthlyHigh)}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {formatPerRequest(costs.apiPerTranscript)}/request
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
                Decode efficiency from <a href="https://llm-bench.rituraj.info" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>benchmarks on L4 + A100</a> (vLLM 0.8.5) — badge above shows if this GPU+quant combo is measured, interpolated, or extrapolated.
              </div>

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

            {/* API Comparison Table */}
            <div className="gruv-card p-5">
              <ApiComparisonTable
                rows={apiCostRows}
                selectedModel={apiModel}
                onSelect={setApiModel}
                selfHostedMonthly={costs.selfHostedMonthly}
                dailyVolume={dailyVolume}
              />
            </div>

            {/* Break-even Chart */}
            <div className="gruv-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                  Break-even Analysis
                </h2>
              <BreakEvenChart data={breakEvenData} breakEven={breakEvenVal} currentVolume={dailyVolume} />
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
                    = <span style={{ color: 'var(--accent-success)' }}>{formatSmallBytes(calculateKVPerToken(model, kvBytes))}/token</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--accent-info)' }}>VRAM</span> = weights + KV_cache × concurrent + 15% overhead<br />
                    KV sized on avg session ({formatTokens(Math.min(avgTokens, contextLength))} tokens), not max window<br />
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
            All prices in USD. GPU costs assume 730 hrs/mo — sourced from RunPod, Lambda, Vast.ai, AWS &amp; GCP pricing pages, May 2026.
            Recommended GPU picks the cheapest provider for the selected tier. API pricing from OpenRouter as of May 2026.
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
          <p className="mt-2">
            Feedback or bugs? <a href="https://www.linkedin.com/in/ree2raz/" target="_blank" rel="noopener noreferrer"
              className="underline hover:no-underline transition-colors" style={{ color: 'var(--accent-primary)' }}>LinkedIn DM</a>
            {' '}or <a href="mailto:ree2raz@proton.me"
              className="underline hover:no-underline transition-colors" style={{ color: 'var(--accent-primary)' }}>ree2raz@proton.me</a>
          </p>
        </footer>
      </main>
    </div>
  );
}
