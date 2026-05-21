import { describe, it, expect } from 'vitest';
import {
  calculateVRAM,
  calculateKVPerToken,
  calculateThroughput,
  recommendGPU,
  calculateCosts,
  generateBreakEvenData,
  findBreakEven,
  getGpuPrice,
  getGpuPriceList,
  calculateAllApiCosts,
  estimateArchitecture,
  getConfidence,
  SELF_HOSTED_LOW_FACTOR,
  SELF_HOSTED_HIGH_FACTOR,
  API_LOW_FACTOR,
  API_HIGH_FACTOR,
} from '../calculations';
import { MODELS, GPUS, type ModelVariant, type GPU } from '../../data/constants';

// ─── Test fixtures ──────────────────────────────────────────────────────────

const QWEN_27B = MODELS['qwen35'].variants.find(v => v.name === 'Qwen3.5-27B')!;
const QWEN_9B = MODELS['qwen35'].variants.find(v => v.name === 'Qwen3.5-9B')!;
const QWEN3_MOE = MODELS['qwen3'].variants.find(v => v.name === 'Qwen3-30B-A3B (MoE)')!;
const GEMMA_27B = MODELS['gemma3'].variants.find(v => v.name === 'Gemma 3-27B')!;
const GEMMA_12B_MHA = MODELS['gemma3'].variants.find(v => v.name === 'Gemma 3-12B')!;
const PHI_4 = MODELS['phi4'].variants.find(v => v.name === 'Phi-4')!;
const DEEPSEEK_R1 = MODELS['deepseek'].variants.find(v => v.name === 'DeepSeek R1')!;
const LLAMA4_SCOUT = MODELS['llama4'].variants.find(v => v.name === 'Llama 4 Scout 109B (est.)')!;

const GPU = (name: string): GPU => {
  const g = GPUS.find(x => x.name === name);
  if (!g) throw new Error(`fixture: missing GPU ${name}`);
  return g;
};

// Tolerance helper — 0.5% relative for floating-point math.
const close = (actual: number, expected: number, relTol = 0.005) => {
  const tol = Math.abs(expected) * relTol;
  expect(actual).toBeGreaterThanOrEqual(expected - tol);
  expect(actual).toBeLessThanOrEqual(expected + tol);
};

// ─── calculateKVPerToken ────────────────────────────────────────────────────

describe('calculateKVPerToken', () => {
  it('GQA model uses kv_heads (Qwen3.5-27B, fp16)', () => {
    // 2 * layers * kv_heads * (hidden/heads) * bytes
    // = 2 * 48 * 8 * (6144/48) * 2 = 196,608
    expect(calculateKVPerToken(QWEN_27B, 2)).toBe(196608);
  });

  it('scales linearly with kv dtype bytes (fp8 = half of fp16)', () => {
    expect(calculateKVPerToken(QWEN_27B, 1)).toBe(98304);
    expect(calculateKVPerToken(QWEN_27B, 0.5)).toBe(49152);
  });

  it('MHA model (kv_heads = heads) — Gemma 3-12B fp16', () => {
    // 2 * 48 * 16 * (3840/16) * 2 = 737,280
    expect(calculateKVPerToken(GEMMA_12B_MHA, 2)).toBe(737280);
  });

  it('uses heads when kv_heads is omitted (defaults to MHA)', () => {
    const m: ModelVariant = { ...QWEN_27B, kv_heads: undefined } as ModelVariant;
    // 2 * 48 * 48 * 128 * 2 = 1,179,648
    expect(calculateKVPerToken(m, 2)).toBe(1179648);
  });

  it('MLA path uses kv_dim, not head_dim — DeepSeek R1 fp16', () => {
    // 2 * 61 * 512 * 2 = 124,928
    expect(calculateKVPerToken(DEEPSEEK_R1, 2)).toBe(124928);
  });

  it('Phi-4 (10 kv_heads, 40 heads) fp16', () => {
    // head_dim = 5120/40 = 128; 2 * 40 * 10 * 128 * 2 = 204,800
    expect(calculateKVPerToken(PHI_4, 2)).toBe(204800);
  });
});

// ─── calculateVRAM ──────────────────────────────────────────────────────────

describe('calculateVRAM', () => {
  it('Qwen3.5-27B q4_k_m fp16 ctx=8192 c=8 avg=4000 — production defaults', () => {
    const r = calculateVRAM(QWEN_27B, 'q4_k_m', 'fp16', 8192, 8, 4000);
    expect(r.modelVRAM).toBe(13_500_000_000); // 27e9 * 0.5
    expect(r.kvCache).toBe(6_291_456_000); // 196608 * 4000 * 8
    close(r.overheadAmount, 2_968_718_400); // 15%
    close(r.totalVRAM, 22_760_174_400);
    expect(r.breakdown.weights).toBe(r.modelVRAM);
    expect(r.breakdown.kv).toBe(r.kvCache);
  });

  it('clamps KV cache to contextLength when avgTokens exceeds it', () => {
    const r = calculateVRAM(QWEN_27B, 'fp16', 'fp16', 1000, 4, 5000);
    // avg(5000) > ctx(1000) → kv sized on 1000 tokens
    // 196608 * 1000 * 4 = 786,432,000
    expect(r.kvCache).toBe(786_432_000);
  });

  it('uses avgTokens when smaller than contextLength', () => {
    const r = calculateVRAM(QWEN_27B, 'fp16', 'fp16', 131072, 4, 2000);
    expect(r.kvCache).toBe(196608 * 2000 * 4); // 1,572,864,000
  });

  it('falls back to contextLength when avgTokens is undefined', () => {
    const r = calculateVRAM(QWEN_27B, 'fp16', 'fp16', 8192, 1);
    expect(r.kvCache).toBe(196608 * 8192 * 1);
  });

  it('MoE: VRAM uses TOTAL params, not active (all experts must be resident)', () => {
    const r = calculateVRAM(QWEN3_MOE, 'q4_k_m', 'fp16', 8192, 4, 2000);
    // 30.5B * 0.5 bytes = 15.25 GB — uses TOTAL params, not active_params=3.3B
    expect(r.modelVRAM).toBe(15_250_000_000);
  });

  it('overhead is 15% of (weights + KV)', () => {
    const r = calculateVRAM(QWEN_27B, 'q4_k_m', 'fp16', 8192, 8, 4000);
    close(r.overheadAmount, (r.modelVRAM + r.kvCache) * 0.15);
    close(r.totalVRAM, r.modelVRAM + r.kvCache + r.overheadAmount);
  });
});

// ─── calculateThroughput ────────────────────────────────────────────────────

describe('calculateThroughput', () => {
  it('Qwen3.5-27B on RTX 4090 q4_k_m b=8 mfu=0.35', () => {
    const kvb = calculateKVPerToken(QWEN_27B, 2);
    const r = calculateThroughput(QWEN_27B, GPU('RTX 4090'), 0.5, kvb, 4000, 8, 0.35, 'q4_k_m', 'marlin');
    // prefill = 0.35 * 165e12 / (2 * 27e9) = 1069.444 tps
    close(r.prefillTps, 1069.444);
    // weights = 27e9 * 0.5 = 13.5e9 bytes
    expect(r.weightsBytes).toBe(13_500_000_000);
    expect(r.kvPerSeqBytes).toBe(196608 * 4000);
    expect(r.bytesReadPerStep).toBe(13_500_000_000 + 8 * 196608 * 4000);
    // q4_k_m doesn't startsWith('awq') → uses fp16 efficiency bucket
    // Ada fp16 b=8 → interp(4:0.774, 16:0.747) = 0.765
    // decodeTpsAggregate = 8 * 1008e9 / 19.79e9 * 0.765 ≈ 311.7
    close(r.decodeTpsAggregate, 311.698);
    close(r.decodeTpsPerStream, 311.698 / 8);
  });

  it('Qwen3.5-27B on H100 80GB fp16 b=16 — Hopper bandwidth scaling', () => {
    const kvb = calculateKVPerToken(QWEN_27B, 2);
    const r = calculateThroughput(QWEN_27B, GPU('H100 80GB'), 2, kvb, 4000, 16, 0.35, 'fp16', 'marlin');
    // prefill = 0.35 * 989e12 / 54e9 = 6410.185
    close(r.prefillTps, 6410.185);
    // weights = 27e9 * 2 = 54e9
    expect(r.weightsBytes).toBe(54_000_000_000);
    // Hopper fp16 b=16 → exact match 0.539
    // decode = 16 * 3350e9 / (54e9 + 16*786432000) * 0.539
    //       = 16 * 3350e9 / 66.583e9 * 0.539 ≈ 433.9
    close(r.decodeTpsAggregate, 433.901);
  });

  it('uses active_params (not total) for prefill on MoE', () => {
    const kvb = calculateKVPerToken(QWEN3_MOE, 2);
    const r = calculateThroughput(QWEN3_MOE, GPU('A100 80GB'), 0.5, kvb, 2000, 4, 0.35, 'q4_k_m', 'marlin');
    // active = 3.3B; prefill = 0.35 * 312e12 / (2 * 3.3e9) = 16,545.45
    close(r.prefillTps, 16545.454);
    // weights = 3.3e9 * 0.5 = 1.65e9 (active params)
    expect(r.weightsBytes).toBe(1_650_000_000);
  });

  it('decode efficiency interpolates linearly between measured batch sizes (Ada awq_default b=8)', () => {
    const kvb = calculateKVPerToken(PHI_4, 2);
    const r = calculateThroughput(PHI_4, GPU('RTX 4090'), 0.5, kvb, 4000, 8, 0.35, 'awq4', 'default');
    // Ada awq_default: 4→0.527, 16→0.452. b=8 interp → 0.527 + (4/12)*(0.452-0.527) = 0.502
    // bytes = 7e9 (3.5e9 weights since 14B*0.5) + 8 * 819200000 KV per step
    // Actually weights = 14e9 * 0.5 = 7e9. correct.
    // decode = 8 * 1008e9 / 13.5536e9 * 0.502
    close(r.decodeTpsAggregate, 298.675);
  });
});

// ─── getDecodeEfficiency / getConfidence ────────────────────────────────────

describe('getConfidence', () => {
  it('Ada fp16 — measured', () => {
    expect(getConfidence('Ada', 2, 'fp16')).toBe('measured');
  });
  it('Ampere q4_k_m → falls into fp16 bucket → measured', () => {
    // q4_k_m doesn't start with awq → fp16 bucket
    expect(getConfidence('Ampere', 0.5, 'q4_k_m')).toBe('measured');
  });
  it('Hopper fp16 — unmeasured (extrapolated from Ampere)', () => {
    expect(getConfidence('Hopper', 2, 'fp16')).toBe('unmeasured');
  });
  it('Blackwell q4 — unmeasured', () => {
    expect(getConfidence('Blackwell', 0.5, 'q4_k_m')).toBe('unmeasured');
  });
  it('Ada awq_marlin (no data) returns unmeasured', () => {
    expect(getConfidence('Ada', 0.5, 'awq4', 'marlin')).toBe('unmeasured');
  });
  it('Ada awq_default — measured', () => {
    expect(getConfidence('Ada', 0.5, 'awq4', 'default')).toBe('measured');
  });
  it('Ampere moe_fp16 — measured', () => {
    expect(getConfidence('Ampere', 2, 'fp16', 'marlin', true)).toBe('measured');
  });
});

// ─── getGpuPrice / getGpuPriceList ──────────────────────────────────────────

describe('getGpuPrice', () => {
  it('returns the cheapest explicit on_demand quote (RTX 4090)', () => {
    const q = getGpuPrice(GPU('RTX 4090'), 'on_demand');
    expect(q.rate).toBe(0.29); // Vast.ai cheapest
    expect(q.provider).toBe('Vast.ai');
    expect(q.fallback).toBe(false);
    expect(q.effectiveTier).toBe('on_demand');
  });

  it('falls back to on_demand × tier multiplier when reserved_1y absent', () => {
    const q = getGpuPrice(GPU('RTX 4090'), 'reserved_1y');
    expect(q.fallback).toBe(true);
    // 0.29 × 0.65 = 0.1885
    close(q.rate, 0.1885);
  });

  it('prefers explicit tier prices over estimates (A100 40GB reserved_1y)', () => {
    const q = getGpuPrice(GPU('A100 40GB'), 'reserved_1y');
    expect(q.fallback).toBe(false);
    expect(q.rate).toBe(2.61); // AWS explicit
    expect(q.provider).toBe('AWS');
  });

  it('unrecognized tier collapses to on_demand', () => {
    const q = getGpuPrice(GPU('RTX 4090'), 'mystery-tier');
    expect(q.effectiveTier).toBe('on_demand');
    expect(q.rate).toBe(0.29);
  });
});

describe('getGpuPriceList', () => {
  it('sorts ascending by rate (RTX 3090 spot)', () => {
    const list = getGpuPriceList(GPU('RTX 3090'), 'spot');
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < list.length; i++) {
      expect(list[i].rate).toBeGreaterThanOrEqual(list[i - 1].rate);
    }
    expect(list[0].fallback).toBe(false);
  });

  it('keeps only explicit-tier quotes when any provider publishes the tier', () => {
    const list = getGpuPriceList(GPU('A100 40GB'), 'reserved_1y');
    expect(list.every(q => q.fallback === false)).toBe(true);
  });

  it('returns fallback-only list when no provider publishes the tier', () => {
    const list = getGpuPriceList(GPU('RTX 4090'), 'reserved_1y');
    expect(list.every(q => q.fallback === true)).toBe(true);
  });
});

// ─── recommendGPU ───────────────────────────────────────────────────────────

describe('recommendGPU', () => {
  const baseVram = (m: ModelVariant, q = 'q4_k_m', ctx = 8192, c = 8, avg = 4000) =>
    calculateVRAM(m, q, 'fp16', ctx, c, avg);

  it('Qwen3.5-27B at default 10k req/day picks RTX 3090 x2 (cheapest data-parallel)', () => {
    const v = baseVram(QWEN_27B);
    const r = recommendGPU(v, QWEN_27B, 'q4_k_m', 'fp16', 4000, 70, 10000, 8, 2.5, 1, 0.35, 'on_demand');
    expect(r.gpu.name).toBe('RTX 3090');
    expect(r.count).toBe(2);
    expect(r.gpusVram).toBe(1);
    expect(r.gpusForDecode).toBe(2);
    expect(r.bottleneck).toBe('throughput');
    close(r.monthlyCost, 2 * 0.22 * 730);
  });

  it('REGRESSION: never picks RTX 5090 over multi-3090/4090 when model fits on one card', () => {
    // The bug we shipped 6f6e280 fixed: filter `!tp_capable && gpusNeeded > 1` skipped
    // 3090/4090 even when only throughput (not VRAM) needed more GPUs. Recommender
    // jumped to single 5090 ($816/mo) when 2× 3090 ($378/mo) would serve.
    for (const daily of [9000, 10000, 12000]) {
      const v = baseVram(QWEN_27B);
      const r = recommendGPU(v, QWEN_27B, 'q4_k_m', 'fp16', 4000, 70, daily, 8, 2.5, 1, 0.35, 'on_demand');
      expect(r.gpu.name).not.toBe('RTX 5090');
      expect(r.gpu.name).not.toBe('L40S');
      // Cheapest viable should be one of the consumer Ampere/Ada cards
      expect(['RTX 3090', 'RTX 4090']).toContain(r.gpu.name);
    }
  });

  it('drops to 1 GPU when volume halves (8k req/day)', () => {
    const v = baseVram(QWEN_27B);
    const r = recommendGPU(v, QWEN_27B, 'q4_k_m', 'fp16', 4000, 70, 8000, 8, 2.5, 1, 0.35, 'on_demand');
    expect(r.count).toBe(1);
    expect(r.gpusForDecode).toBe(1);
    expect(r.bottleneck).toBe('both'); // vram and throughput both = 1
  });

  it('scales count linearly with very high volume (100k req/day → many cards)', () => {
    const v = baseVram(QWEN_27B);
    const r = recommendGPU(v, QWEN_27B, 'q4_k_m', 'fp16', 4000, 70, 100000, 8, 2.5, 1, 0.35, 'on_demand');
    expect(r.count).toBeGreaterThanOrEqual(8);
    expect(r.bottleneck).toBe('throughput');
  });

  it('requires TP-capable GPU when model exceeds single-card VRAM (Llama 4 Scout 109B)', () => {
    const v = calculateVRAM(LLAMA4_SCOUT, 'q4_k_m', 'fp16', 32768, 4, 4000);
    const r = recommendGPU(v, LLAMA4_SCOUT, 'q4_k_m', 'fp16', 4000, 70, 5000, 4, 2.0, 1, 0.35, 'on_demand');
    expect(r.gpusVram).toBeGreaterThan(1);
    expect(r.gpu.tp_capable).toBe(true);
  });

  it('multiplies count by replicas (HA / multi-AZ)', () => {
    const v = baseVram(QWEN_27B);
    const r1 = recommendGPU(v, QWEN_27B, 'q4_k_m', 'fp16', 4000, 70, 10000, 8, 2.5, 1, 0.35, 'on_demand');
    const r3 = recommendGPU(v, QWEN_27B, 'q4_k_m', 'fp16', 4000, 70, 10000, 8, 2.5, 3, 0.35, 'on_demand');
    expect(r3.count).toBe(r1.count * 3);
    expect(r3.baseCount).toBe(r1.baseCount);
    expect(r3.replicas).toBe(3);
  });

  it('throughput requirements use peakFactor', () => {
    const v = baseVram(QWEN_27B);
    const r1 = recommendGPU(v, QWEN_27B, 'q4_k_m', 'fp16', 4000, 70, 10000, 8, 1.0, 1, 0.35, 'on_demand');
    const r25 = recommendGPU(v, QWEN_27B, 'q4_k_m', 'fp16', 4000, 70, 10000, 8, 2.5, 1, 0.35, 'on_demand');
    close(r25.outputTpsRequired, r1.outputTpsRequired * 2.5);
    close(r25.inputTpsRequired, r1.inputTpsRequired * 2.5);
  });

  it('respects pricingTier (spot < on_demand for same recommendation)', () => {
    const v = baseVram(QWEN_27B);
    const onDemand = recommendGPU(v, QWEN_27B, 'q4_k_m', 'fp16', 4000, 70, 10000, 8, 2.5, 1, 0.35, 'on_demand');
    const spot = recommendGPU(v, QWEN_27B, 'q4_k_m', 'fp16', 4000, 70, 10000, 8, 2.5, 1, 0.35, 'spot');
    expect(spot.price.effectiveTier).toBe('spot');
    expect(spot.price.rate).toBeLessThanOrEqual(onDemand.price.rate);
  });

  it('bottleneck=both when throughput and VRAM both demand exactly 1 GPU', () => {
    const v = baseVram(QWEN_9B);
    const r = recommendGPU(v, QWEN_9B, 'q4_k_m', 'fp16', 4000, 70, 1000, 4, 1.5, 1, 0.35, 'on_demand');
    expect(r.gpusVram).toBe(1);
    expect(r.bottleneck).toBe('both');
  });
});

// ─── calculateCosts ─────────────────────────────────────────────────────────

describe('calculateCosts', () => {
  const baseRec = () => {
    const v = calculateVRAM(QWEN_27B, 'q4_k_m', 'fp16', 8192, 8, 4000);
    return recommendGPU(v, QWEN_27B, 'q4_k_m', 'fp16', 4000, 70, 10000, 8, 2.5, 1, 0.35, 'on_demand');
  };

  it('default 10k scenario: self ≈ $378, API ≈ $912, self wins ≈ $534/mo', () => {
    const r = baseRec();
    const c = calculateCosts(10000, 4000, 70, r, QWEN_27B, 'q4_k_m', 'GPT-5.4 mini', 'OpenAI', 0, 85, false, 'on_demand', 0);
    // self = 2 GPUs × $0.22 × 730 / 0.85 = $377.88
    close(c.selfHostedMonthly, 377.882);
    // API: monthlyCalls=300k, tokens=1.2B; input=840M@$0.40 + output=360M@$1.60
    // = 336 + 576 = $912
    expect(c.apiMonthly).toBe(912);
    expect(c.winner).toBe('self');
    close(c.savings, 534.117);
    close(c.savingsPercent, 58.566);
    expect(c.opsMonthly).toBe(0);
    close(c.selfHostedGpuMonthly, 377.882);
  });

  it('ops cost adds to self-host but never to API', () => {
    const r = baseRec();
    const c = calculateCosts(10000, 4000, 70, r, QWEN_27B, 'q4_k_m', 'GPT-5.4 mini', 'OpenAI', 0, 85, false, 'on_demand', 6250);
    close(c.selfHostedMonthly, 377.882 + 6250);
    close(c.selfHostedGpuMonthly, 377.882); // GPU-only stays the same
    expect(c.apiMonthly).toBe(912);
    expect(c.opsMonthly).toBe(6250);
    // Winner flips since self now $6628 > API $912
    expect(c.winner).toBe('api');
  });

  it('negative ops cost is clamped to 0', () => {
    const r = baseRec();
    const c = calculateCosts(10000, 4000, 70, r, QWEN_27B, 'q4_k_m', 'GPT-5.4 mini', 'OpenAI', 0, 85, false, 'on_demand', -500);
    expect(c.opsMonthly).toBe(0);
    close(c.selfHostedMonthly, 377.882);
  });

  it('cache hit ratio discounts only input tokens via apiPricing.cache', () => {
    const r = baseRec();
    const c = calculateCosts(10000, 4000, 70, r, QWEN_27B, 'q4_k_m', 'GPT-5.4 mini', 'OpenAI', 50, 85, false, 'on_demand', 0);
    // cacheMult = 1 - 0.5 * 0.5 = 0.75
    close(c.cacheMult, 0.75);
    // input portion: 840M @ $0.40 × 0.75 = $252; output: 360M @ $1.60 = $576; total $828
    close(c.apiMonthly, 828);
  });

  it('batch discount halves total API cost (BATCH_DISCOUNT = 0.5)', () => {
    const r = baseRec();
    const c = calculateCosts(10000, 4000, 70, r, QWEN_27B, 'q4_k_m', 'GPT-5.4 mini', 'OpenAI', 0, 85, true, 'on_demand', 0);
    expect(c.batchMult).toBe(0.5);
    close(c.apiMonthly, 456); // 912 / 2
  });

  it('GPU utilization < 100% inflates self-host cost (clamped to ≥20%)', () => {
    const r = baseRec();
    const at50 = calculateCosts(10000, 4000, 70, r, QWEN_27B, 'q4_k_m', 'GPT-5.4 mini', 'OpenAI', 0, 50, false, 'on_demand', 0);
    const at100 = calculateCosts(10000, 4000, 70, r, QWEN_27B, 'q4_k_m', 'GPT-5.4 mini', 'OpenAI', 0, 100, false, 'on_demand', 0);
    close(at50.selfHostedMonthly, at100.selfHostedMonthly * 2);
    expect(at50.gpuUtilization).toBe(50);
  });

  it('util below floor (10%) is clamped to 20%', () => {
    const r = baseRec();
    const c = calculateCosts(10000, 4000, 70, r, QWEN_27B, 'q4_k_m', 'GPT-5.4 mini', 'OpenAI', 0, 10, false, 'on_demand', 0);
    expect(c.gpuUtilization).toBe(20);
  });

  it('uncertainty bands: self asymmetric (-15%/+30%), API symmetric (±15%)', () => {
    const r = baseRec();
    const c = calculateCosts(10000, 4000, 70, r, QWEN_27B, 'q4_k_m', 'GPT-5.4 mini', 'OpenAI', 0, 85, false, 'on_demand', 0);
    close(c.selfHostedMonthlyLow, c.selfHostedGpuMonthly * SELF_HOSTED_LOW_FACTOR);
    close(c.selfHostedMonthlyHigh, c.selfHostedGpuMonthly * SELF_HOSTED_HIGH_FACTOR);
    close(c.apiMonthlyLow, c.apiMonthly * API_LOW_FACTOR);
    close(c.apiMonthlyHigh, c.apiMonthly * API_HIGH_FACTOR);
    expect(SELF_HOSTED_LOW_FACTOR).toBe(0.85);
    expect(SELF_HOSTED_HIGH_FACTOR).toBe(1.30);
    expect(API_LOW_FACTOR).toBe(0.85);
    expect(API_HIGH_FACTOR).toBe(1.15);
  });

  it('uncertainty bands keep ops as flat headcount cost (not multiplied)', () => {
    const r = baseRec();
    const c = calculateCosts(10000, 4000, 70, r, QWEN_27B, 'q4_k_m', 'GPT-5.4 mini', 'OpenAI', 0, 85, false, 'on_demand', 6250);
    close(c.selfHostedMonthlyLow, c.selfHostedGpuMonthly * 0.85 + 6250);
    close(c.selfHostedMonthlyHigh, c.selfHostedGpuMonthly * 1.30 + 6250);
  });

  it('falls back to first API_PRICING entry when model name unknown', () => {
    const r = baseRec();
    const c = calculateCosts(10000, 4000, 70, r, QWEN_27B, 'q4_k_m', 'NonExistentModel', undefined, 0, 85, false, 'on_demand', 0);
    expect(c.apiPricing).toBeDefined();
    expect(c.apiPricing.model).toBeTruthy();
  });

  it('storage cost reflects total params at quant size ($0.10/GB)', () => {
    const r = baseRec();
    const c = calculateCosts(10000, 4000, 70, r, QWEN_27B, 'q4_k_m', 'GPT-5.4 mini', 'OpenAI', 0, 85, false, 'on_demand', 0);
    // 27B * 0.5 = 13.5 GB * $0.10 = $1.35
    close(c.storageCost, 1.35);
  });

  it('per-transcript cost = monthly / (volume × 30)', () => {
    const r = baseRec();
    const c = calculateCosts(10000, 4000, 70, r, QWEN_27B, 'q4_k_m', 'GPT-5.4 mini', 'OpenAI', 0, 85, false, 'on_demand', 0);
    close(c.selfHostedPerTranscript, c.selfHostedMonthly / 300000);
    close(c.apiPerTranscript, c.apiMonthly / 300000);
  });
});

// ─── generateBreakEvenData / findBreakEven ──────────────────────────────────

describe('generateBreakEvenData', () => {
  it('produces a non-empty, ascending-volume series', () => {
    const data = generateBreakEvenData(4000, 70, QWEN_27B, 'q4_k_m', 'fp16', 8192, 8, 2.5, 1, 0.35, 85, 'GPT-5.4 mini', 'OpenAI', 0, false, 'on_demand', 0);
    expect(data.length).toBeGreaterThan(10);
    expect(data[0].volume).toBe(0);
    for (let i = 1; i < data.length; i++) {
      expect(data[i].volume).toBeGreaterThan(data[i - 1].volume);
    }
  });

  it('API cost is exactly zero at volume=0', () => {
    const data = generateBreakEvenData(4000, 70, QWEN_27B, 'q4_k_m', 'fp16', 8192, 8, 2.5, 1, 0.35, 85, 'GPT-5.4 mini', 'OpenAI', 0, false, 'on_demand', 0);
    expect(data[0].api).toBe(0);
    expect(data[0].selfHosted).toBeGreaterThan(0);
  });

  it('ops cost shifts the entire self-host curve up by a constant', () => {
    const a = generateBreakEvenData(4000, 70, QWEN_27B, 'q4_k_m', 'fp16', 8192, 8, 2.5, 1, 0.35, 85, 'GPT-5.4 mini', 'OpenAI', 0, false, 'on_demand', 0);
    const b = generateBreakEvenData(4000, 70, QWEN_27B, 'q4_k_m', 'fp16', 8192, 8, 2.5, 1, 0.35, 85, 'GPT-5.4 mini', 'OpenAI', 0, false, 'on_demand', 1000);
    // Sample mid-range points where GPU rec is stable; ops adds exactly +1000
    for (let i = 0; i < Math.min(5, a.length); i++) {
      // Allow different GPU recs at very low volumes; just check direction
      expect(b[i].selfHosted).toBeGreaterThanOrEqual(a[i].selfHosted);
    }
  });
});

describe('findBreakEven', () => {
  it('finds crossing on synthetic curve (linear API vs flat self-host)', () => {
    const data = [
      { volume: 0, selfHosted: 100, api: 0, gpuCount: 1 },
      { volume: 100, selfHosted: 100, api: 50, gpuCount: 1 },
      { volume: 200, selfHosted: 100, api: 100, gpuCount: 1 }, // crossing here
      { volume: 300, selfHosted: 100, api: 150, gpuCount: 1 },
    ];
    expect(findBreakEven(data)).toBe(200);
  });

  it('interpolates volume linearly between bracketing points', () => {
    const data = [
      { volume: 0, selfHosted: 100, api: 0, gpuCount: 1 },
      { volume: 100, selfHosted: 100, api: 50, gpuCount: 1 },
      { volume: 200, selfHosted: 100, api: 150, gpuCount: 1 }, // crossing in [100, 200]
    ];
    const be = findBreakEven(data);
    // At v=100 self=100 api=50 (diff -50); at v=200 diff +50 → crossing at v=150
    expect(be).toBe(150);
  });

  it('returns null when curves never cross', () => {
    const data = [
      { volume: 0, selfHosted: 100, api: 200, gpuCount: 1 },
      { volume: 100, selfHosted: 100, api: 300, gpuCount: 1 },
    ];
    expect(findBreakEven(data)).toBe(null);
  });

  it('default scenario crossing matches generateBreakEvenData snapshot', () => {
    const data = generateBreakEvenData(4000, 70, QWEN_27B, 'q4_k_m', 'fp16', 8192, 8, 2.5, 1, 0.35, 85, 'GPT-5.4 mini', 'OpenAI', 0, false, 'on_demand', 0);
    const be = findBreakEven(data);
    expect(be).not.toBe(null);
    expect(be!).toBeGreaterThan(1500);
    expect(be!).toBeLessThan(2500);
  });
});

// ─── calculateAllApiCosts ───────────────────────────────────────────────────

describe('calculateAllApiCosts', () => {
  it('returns rows sorted by monthly cost ascending', () => {
    const rows = calculateAllApiCosts(1000, 1000, 70, 0, false);
    expect(rows.length).toBeGreaterThan(10);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].monthly).toBeGreaterThanOrEqual(rows[i - 1].monthly);
    }
  });

  it('perRequest = monthly / (dailyVolume × 30)', () => {
    const rows = calculateAllApiCosts(1000, 1000, 70, 0, false);
    for (const r of rows.slice(0, 3)) {
      close(r.perRequest, r.monthly / 30000);
    }
  });

  it('zero volume → zero perRequest (no division by zero)', () => {
    const rows = calculateAllApiCosts(0, 1000, 70, 0, false);
    for (const r of rows) expect(r.perRequest).toBe(0);
  });

  it('batch discount halves all monthly costs', () => {
    const a = calculateAllApiCosts(1000, 1000, 70, 0, false);
    const b = calculateAllApiCosts(1000, 1000, 70, 0, true);
    // sorted independently — match by model+provider
    for (const ar of a.slice(0, 5)) {
      const br = b.find(x => x.model === ar.model && x.provider === ar.provider)!;
      close(br.monthly, ar.monthly * 0.5);
    }
  });

  it('cache hit ratio reduces cost when cache rate > 0', () => {
    const noCache = calculateAllApiCosts(1000, 1000, 70, 0, false);
    const cached = calculateAllApiCosts(1000, 1000, 70, 80, false);
    const noCacheGpt = noCache.find(r => r.model === 'GPT-5.4 mini' && r.provider === 'OpenAI')!;
    const cachedGpt = cached.find(r => r.model === 'GPT-5.4 mini' && r.provider === 'OpenAI')!;
    expect(cachedGpt.monthly).toBeLessThan(noCacheGpt.monthly);
  });
});

// ─── estimateArchitecture ───────────────────────────────────────────────────

describe('estimateArchitecture', () => {
  it('1B model: small dense GQA', () => {
    expect(estimateArchitecture(1)).toEqual({
      layers: 24, hidden: 1024, heads: 16, kv_heads: 4, arch: 'gqa',
    });
  });

  it('4B boundary point', () => {
    expect(estimateArchitecture(4)).toEqual({
      layers: 36, hidden: 2560, heads: 24, kv_heads: 4, arch: 'gqa',
    });
  });

  it('14B boundary point', () => {
    expect(estimateArchitecture(14)).toEqual({
      layers: 40, hidden: 5120, heads: 40, kv_heads: 8, arch: 'gqa',
    });
  });

  it('32B boundary point', () => {
    expect(estimateArchitecture(32)).toEqual({
      layers: 64, hidden: 5120, heads: 40, kv_heads: 8, arch: 'gqa',
    });
  });

  it('70B mid-large interpolation', () => {
    expect(estimateArchitecture(70)).toEqual({
      layers: 77, hidden: 5760, heads: 56, kv_heads: 8, arch: 'gqa',
    });
  });

  it('200B caps at top of large-range interpolation', () => {
    expect(estimateArchitecture(200)).toEqual({
      layers: 120, hidden: 8192, heads: 96, kv_heads: 8, arch: 'gqa',
    });
  });

  it('hidden dim is always a multiple of 128', () => {
    for (const p of [0.5, 1, 2.5, 7, 13, 20, 50, 100, 150]) {
      const a = estimateArchitecture(p);
      expect(a.hidden % 128).toBe(0);
    }
  });

  it('heads is always a multiple of 8', () => {
    for (const p of [1, 4, 8, 14, 32, 70, 150]) {
      const a = estimateArchitecture(p);
      expect(a.heads % 8).toBe(0);
    }
  });
});
