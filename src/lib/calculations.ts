import {
  QUANTIZATIONS, KV_DTYPES, GPUS, BATCH_DISCOUNT, PRICING_TIERS, API_PRICING,
  type ModelVariant, type GPU,
} from '../data/constants';

//
// VRAM Calculation
//

export interface VRAMResult {
  modelVRAM: number;
  kvCache: number;
  overheadAmount: number;
  totalVRAM: number;
  breakdown: { weights: number; kv: number; overhead: number };
}

export function calculateVRAM(
  model: ModelVariant,
  quantization: string,
  kvDtype: string,
  contextLength: number,
  concurrentRequests: number,
  avgTokens?: number,
): VRAMResult {
  const q = QUANTIZATIONS.find(x => x.key === quantization) || QUANTIZATIONS[2];
  const kv = KV_DTYPES.find(x => x.key === kvDtype) || KV_DTYPES[0];

  // Use TOTAL params for VRAM — all experts must be loaded even in MoE
  const modelVRAM = model.params * 1e9 * q.bytes;

  let kvPerToken: number;
  if (model.arch === 'mla') {
    kvPerToken = 2 * model.layers * (model.kv_dim || 512) * kv.bytes;
  } else {
    const headDim = model.hidden / model.heads;
    const kvHeads = model.kv_heads || model.heads;
    kvPerToken = 2 * model.layers * kvHeads * headDim * kv.bytes;
  }

  // Size KV on actual avg session length (paged KV, not worst-case fill).
  // contextLength is the max window; avgTokens is the realistic allocation.
  const kvTokens = avgTokens != null ? Math.min(avgTokens, contextLength) : contextLength;
  const totalKV = kvPerToken * kvTokens * concurrentRequests;
  const overhead = (modelVRAM + totalKV) * 0.15;
  const totalVRAM = modelVRAM + totalKV + overhead;

  return {
    modelVRAM,
    kvCache: totalKV,
    overheadAmount: overhead,
    totalVRAM,
    breakdown: { weights: modelVRAM, kv: totalKV, overhead },
  };
}

//
// KV per token (for display and throughput)
//

export function calculateKVPerToken(model: ModelVariant, kvBytes: number): number {
  if (model.arch === 'mla') {
    return 2 * model.layers * (model.kv_dim || 512) * kvBytes;
  }
  const headDim = model.hidden / model.heads;
  const kvHeads = model.kv_heads || model.heads;
  return 2 * model.layers * kvHeads * headDim * kvBytes;
}

//
// Throughput Model
//

export interface ThroughputResult {
  prefillTps: number;
  decodeTpsAggregate: number;
  decodeTpsPerStream: number;
  weightsBytes: number;
  kvPerSeqBytes: number;
  bytesReadPerStep: number;
}

// ─── Efficiency Lookup Table ───────────────────────────────────────────────
// Per-GPU-generation, per-quantization, per-batch efficiency factors.
// Measured on L4 (Ada) and A100 40GB (Ampere) using vLLM v0.8.5.
// FP16: Qwen2.5-7B-Instruct, AWQ: Qwen2.5-7B-Instruct-AWQ.
// Hopper/Blackwell entries extrapolated from Ampere — unmeasured.
// Interpolation: piecewise linear between measured batch sizes.

type BatchEfficiency = Record<number, number>;
type Confidence = 'measured' | 'interpolated' | 'unmeasured';

const EFFICIENCY: Record<string, Record<string, { data: BatchEfficiency; confidence: Confidence; note?: string }>> = {
  Ada: {
    fp16:     { data: { 1: 0.798, 4: 0.774, 16: 0.747, 32: 0.682, 64: 0.623 }, confidence: 'measured' },
    awq_default: { data: { 1: 0.555, 4: 0.527, 16: 0.452, 32: 0.319, 64: 0.216 }, confidence: 'measured' },
    awq_marlin:  { data: {}, confidence: 'unmeasured', note: 'Marlin requires Ampere+.' },
  },
  Ampere: {
    fp16:     { data: { 1: 0.650, 16: 0.539, 64: 0.371 }, confidence: 'measured' },
    awq_default: { data: { 1: 0.157, 16: 0.129, 64: 0.086 }, confidence: 'measured' },
    awq_marlin:  { data: { 1: 0.258, 16: 0.258, 64: 0.127 }, confidence: 'measured' },
    moe_fp16:     { data: { 1: 0.457, 4: 0.259 }, confidence: 'measured', note: 'Qwen3-30B-A3B on A100 80GB. 3.3B active params, 128 experts (8/token).' },
    moe_awq_marlin: { data: { 1: 0.176, 4: 0.143, 16: 0.113 }, confidence: 'measured', note: 'Qwen3-30B-A3B-AWQ on A100 40GB. 128 experts, 8 active/token.' },
  },
  Hopper: {
    fp16:     { data: { 1: 0.650, 16: 0.539, 64: 0.371 }, confidence: 'unmeasured', note: 'Extrapolated from Ampere.' },
    awq_default: { data: { 1: 0.157, 16: 0.129, 64: 0.086 }, confidence: 'unmeasured', note: 'Extrapolated from Ampere. Use Marlin kernel.' },
    awq_marlin:  { data: { 1: 0.258, 16: 0.258, 64: 0.127 }, confidence: 'unmeasured', note: 'Extrapolated from Ampere.' },
    moe_fp16:     { data: { 1: 0.457, 4: 0.259 }, confidence: 'unmeasured', note: 'Extrapolated from Ampere (A100 80GB).' },
    moe_awq_marlin: { data: { 1: 0.176, 4: 0.143, 16: 0.113 }, confidence: 'unmeasured', note: 'Extrapolated from Ampere (A100 40GB).' },
  },
  Blackwell: {
    fp16:     { data: { 1: 0.650, 16: 0.539, 64: 0.371 }, confidence: 'unmeasured', note: 'Extrapolated from Ampere.' },
    awq_default: { data: { 1: 0.157, 16: 0.129, 64: 0.086 }, confidence: 'unmeasured', note: 'Extrapolated from Ampere. Use Marlin kernel.' },
    awq_marlin:  { data: { 1: 0.258, 16: 0.258, 64: 0.127 }, confidence: 'unmeasured', note: 'Extrapolated from Ampere.' },
    moe_fp16:     { data: { 1: 0.457, 4: 0.259 }, confidence: 'unmeasured', note: 'Extrapolated from Ampere (A100 80GB).' },
    moe_awq_marlin: { data: { 1: 0.176, 4: 0.143, 16: 0.113 }, confidence: 'unmeasured', note: 'Extrapolated from Ampere (A100 40GB).' },
  },
};

function getDecodeEfficiency(
  generation: GPU['generation'],
  quantBytes: number,
  batchSize: number,
  awqKernel: 'marlin' | 'default' = 'marlin',
  isMoE: boolean = false,
): number {
  const isAWQ = quantBytes >= 0.4 && quantBytes <= 1.0;
  let quantBucket: string;
  if (isMoE) {
    quantBucket = quantBytes >= 2 ? 'moe_fp16' : 'moe_awq_marlin';
  } else {
    quantBucket = quantBytes >= 2 ? 'fp16' :
      (isAWQ ? `awq_${awqKernel}` : (quantBytes >= 0.4 ? 'q4' : 'q2'));
  }

  const genData = EFFICIENCY[generation] || EFFICIENCY['Ampere'];
  let entry = genData[quantBucket]
    || (quantBucket.startsWith('awq_') ? genData['awq_default'] || genData['fp16'] : genData['fp16']);
  if (!entry) { entry = genData['fp16']; }

  const { data } = entry;
  const batches = Object.keys(data).map(Number).sort((a: number, b: number) => a - b);
  if (batches.length === 0) { return 0.50; }

  const bs = Math.max(1, Math.min(64, batchSize));
  if (data[bs] !== undefined) { return data[bs]; }

  // Piecewise linear interpolation between nearest measured points
  let lo = batches[0]; let hi = batches[batches.length - 1];
  for (let i = 0; i < batches.length - 1; i++) {
    if (batches[i] <= bs && batches[i + 1] >= bs) { lo = batches[i]; hi = batches[i + 1]; break; }
  }
  if (bs <= lo) { return data[lo]; }
  if (bs >= hi) { return data[hi]; }
  const t = (bs - lo) / (hi - lo);
  return data[lo] + t * (data[hi] - data[lo]);
}

export function getConfidence(
  generation: GPU['generation'],
  quantBytes: number,
  awqKernel: 'marlin' | 'default' = 'marlin',
  isMoE: boolean = false,
): Confidence {
  const isAWQ = quantBytes >= 0.4 && quantBytes <= 1.0;
  let quantBucket: string;
  if (isMoE) {
    quantBucket = quantBytes >= 2 ? 'moe_fp16' : 'moe_awq_marlin';
  } else {
    quantBucket = quantBytes >= 2 ? 'fp16' : (isAWQ ? `awq_${awqKernel}` : 'q4');
  }
  const genData = EFFICIENCY[generation];
  if (!genData) { return 'unmeasured'; }
  const entry = genData[quantBucket] || genData['fp16'];
  return entry?.confidence || 'unmeasured';
}

export function calculateThroughput(
  model: ModelVariant,
  gpu: GPU,
  quantBytes: number,
  kvBytesPerToken: number,
  avgContext: number,
  batchSize: number,
  mfu: number,
  quantizationKey: string,
  awqKernel: 'marlin' | 'default' = 'marlin',
): ThroughputResult {
  const activeParams = model.active_params || model.params;

  // Prefill: compute-bound. Quantization does NOT affect prefill
  const prefillTps = mfu * gpu.fp16_tflops * 1e12 / (2 * activeParams * 1e9);

  // Decode: memory-bandwidth-bound. Efficiency from per-GPU lookup table.
  const isMoE = model.arch === 'moe';
  const decodeEfficiency = getDecodeEfficiency(gpu.generation, quantBytes, batchSize, awqKernel, isMoE);
  const weightsBytes = activeParams * 1e9 * quantBytes;
  const kvPerSeqBytes = kvBytesPerToken * avgContext;
  const bytesReadPerStep = weightsBytes + batchSize * kvPerSeqBytes;
  const decodeTpsAggregate = batchSize * gpu.hbm_gbps * 1e9 / bytesReadPerStep * decodeEfficiency;
  const decodeTpsPerStream = decodeTpsAggregate / batchSize;

  return {
    prefillTps, decodeTpsAggregate, decodeTpsPerStream,
    weightsBytes, kvPerSeqBytes, bytesReadPerStep,
  };
}

//
// GPU Recommendation (VRAM + Throughput dual constraint)
//

export interface GpuRecommendation {
  gpu: GPU;
  count: number;
  baseCount: number;
  replicas: number;
  bottleneck: 'throughput' | 'vram' | 'both';
  throughput: ThroughputResult;
  gpusForPrefill: number;
  gpusForDecode: number;
  gpusVram: number;
  monthlyCost: number;
  inputTpsRequired: number;
  outputTpsRequired: number;
}

export function recommendGPU(
  vramData: VRAMResult,
  model: ModelVariant,
  quantization: string,
  kvDtype: string,
  avgTokens: number,
  inputRatio: number,
  dailyVolume: number,
  concurrentRequests: number,
  peakFactor: number,
  replicas: number,
  mfu: number
): GpuRecommendation {
  const q = QUANTIZATIONS.find(x => x.key === quantization) || QUANTIZATIONS[2];
  const kv = KV_DTYPES.find(x => x.key === kvDtype) || KV_DTYPES[0];
  const kvBytesPerToken = calculateKVPerToken(model, kv.bytes);

  // avgContext = avgTokens — approx; true avg during decode is inputTokens + outputTokens/2
  const avgContext = avgTokens;
  const batchSize = concurrentRequests;

  const secondsActive = 86400;
  const inputTokensPerCall = avgTokens * (inputRatio / 100);
  const outputTokensPerCall = avgTokens * ((100 - inputRatio) / 100);
  const inputTpsRequired = (dailyVolume * inputTokensPerCall) * peakFactor / secondsActive;
  const outputTpsRequired = (dailyVolume * outputTokensPerCall) * peakFactor / secondsActive;

  let best: GpuRecommendation | null = null;
  let bestCost = Infinity;

  for (const gpu of GPUS) {
    const tp = calculateThroughput(model, gpu, q.bytes, kvBytesPerToken, avgContext, batchSize, mfu, q.key, 'marlin');
    const gpusForPrefill = Math.max(1, Math.ceil(inputTpsRequired / tp.prefillTps));
    const gpusForDecode = Math.max(1, Math.ceil(outputTpsRequired / tp.decodeTpsAggregate));
    const gpusThroughput = Math.max(gpusForPrefill, gpusForDecode);
    const gpusVram = Math.max(1, Math.ceil(vramData.totalVRAM / (gpu.vram * 1e9)));

    // Key: skip non-TP GPUs when multi-GPU is required within a single replica
    const gpusNeeded = Math.max(gpusThroughput, gpusVram);
    if (gpusNeeded > 1 && !gpu.tp_capable) continue;

    const totalGpus = gpusNeeded * replicas;
    const monthlyCost = totalGpus * gpu.hourly * 730;

    if (monthlyCost < bestCost) {
      bestCost = monthlyCost;
      best = {
        gpu, count: totalGpus, baseCount: gpusNeeded, replicas,
        bottleneck: gpusThroughput > gpusVram ? 'throughput' : gpusVram > gpusThroughput ? 'vram' : 'both',
        throughput: tp, gpusForPrefill, gpusForDecode, gpusVram, monthlyCost,
        inputTpsRequired, outputTpsRequired,
      };
    }
  }

  return best!;
}

//
// Cost Calculation
//

export interface CostResult {
  selfHostedMonthly: number;
  apiMonthly: number;
  selfHostedPerTranscript: number;
  apiPerTranscript: number;
  winner: 'self' | 'api';
  savings: number;
  savingsPercent: number;
  apiPricing: typeof API_PRICING[0];
  cacheMult: number;
  batchMult: number;
  storageCost: number;
  gpuUtilization: number;
}

export function calculateCosts(
  dailyVolume: number,
  avgTokens: number,
  inputRatio: number,
  gpuRec: GpuRecommendation,
  model: ModelVariant,
  quantization: string,
  apiModelName: string,
  cacheHitRatio: number,
  gpuUtilization: number,
  batchEnabled: boolean,
  pricingTier: string
): CostResult {
  const monthlyCalls = dailyVolume * 30;
  const totalTokensMonthly = monthlyCalls * avgTokens;

  const tierMult = PRICING_TIERS[pricingTier] || 1.0;
  const util = Math.max(0.2, Math.min(1, gpuUtilization / 100));
  const selfHostedBase = gpuRec.count * gpuRec.gpu.hourly * 730 * tierMult;
  const selfHostedMonthly = selfHostedBase / util;

  // Storage: use TOTAL params (all experts on disk)
  const quantBytesForStorage = QUANTIZATIONS.find(q => q.key === quantization)?.bytes || 0.5;
  const storageGB = (model.params * 1e9 * quantBytesForStorage) / 1e9;
  const storageCost = storageGB * 0.10;

  const apiPricing = API_PRICING.find(p => p.model === apiModelName) || API_PRICING[0];
  const cacheMult = 1 - (cacheHitRatio / 100) * (apiPricing.cache || 0.5);
  const batchMult = batchEnabled ? BATCH_DISCOUNT : 1;

  const inputTokens = totalTokensMonthly * (inputRatio / 100);
  const outputTokens = totalTokensMonthly * ((100 - inputRatio) / 100);
  const apiMonthly = ((inputTokens / 1e6 * apiPricing.input * cacheMult) + (outputTokens / 1e6 * apiPricing.output)) * batchMult;

  const selfHostedPerTranscript = selfHostedMonthly / monthlyCalls;
  const apiPerTranscript = apiMonthly / monthlyCalls;

  return {
    selfHostedMonthly, apiMonthly, selfHostedPerTranscript, apiPerTranscript,
    winner: selfHostedMonthly < apiMonthly ? 'self' : 'api',
    savings: Math.abs(selfHostedMonthly - apiMonthly),
    savingsPercent: Math.abs(selfHostedMonthly - apiMonthly) / Math.max(selfHostedMonthly, apiMonthly) * 100,
    apiPricing, cacheMult, batchMult, storageCost, gpuUtilization: util * 100,
  };
}

//
// Break-Even Data
//

export interface BreakEvenPoint {
  volume: number;
  selfHosted: number;
  api: number;
  gpuCount: number;
}

export function generateBreakEvenData(
  avgTokens: number,
  inputRatio: number,
  model: ModelVariant,
  quantization: string,
  kvDtype: string,
  contextLength: number,
  concurrentRequests: number,
  peakFactor: number,
  replicas: number,
  mfu: number,
  gpuUtilization: number,
  apiModelName: string,
  cacheHitRatio: number,
  batchEnabled: boolean,
  pricingTier: string
): BreakEvenPoint[] {
  const apiPricing = API_PRICING.find(p => p.model === apiModelName) || API_PRICING[0];
  const cacheMult = 1 - (cacheHitRatio / 100) * (apiPricing.cache || 0.5);
  const batchMult = batchEnabled ? BATCH_DISCOUNT : 1;
  const tierMult = PRICING_TIERS[pricingTier] || 1.0;
  const util = Math.max(0.2, Math.min(1, gpuUtilization / 100));

  const blendedPrice = (apiPricing.input * cacheMult * (inputRatio / 100) + apiPricing.output * ((100 - inputRatio) / 100)) * batchMult;
  const baseVramData = calculateVRAM(model, quantization, kvDtype, contextLength, concurrentRequests, avgTokens);
  const baseGpuRec = recommendGPU(baseVramData, model, quantization, kvDtype, avgTokens, inputRatio, 100, concurrentRequests, peakFactor, replicas, mfu);
  const exactBreakEven = blendedPrice > 0
    ? (baseGpuRec.count * baseGpuRec.gpu.hourly * 730 * tierMult / util) / ((avgTokens * 30 / 1e6) * blendedPrice)
    : 1000;

  const maxVolume = Math.max(5000, Math.ceil(exactBreakEven * 3));
  const step = Math.max(50, Math.round(maxVolume / 60));
  const volumes: number[] = [];
  for (let vol = 0; vol <= maxVolume; vol += step) volumes.push(vol);
  if (volumes[volumes.length - 1] !== maxVolume) volumes.push(maxVolume);

  return volumes.map(vol => {
    const monthlyCalls = vol * 30;
    const totalTokens = monthlyCalls * avgTokens;
    const inputTokens = totalTokens * (inputRatio / 100);
    const outputTokens = totalTokens * ((100 - inputRatio) / 100);
    const apiCost = ((inputTokens / 1e6 * apiPricing.input * cacheMult) + (outputTokens / 1e6 * apiPricing.output)) * batchMult;

    const vramData = calculateVRAM(model, quantization, kvDtype, contextLength, concurrentRequests, avgTokens);
    const gpuRec = recommendGPU(vramData, model, quantization, kvDtype, avgTokens, inputRatio, vol, concurrentRequests, peakFactor, replicas, mfu);
    const selfHosted = (gpuRec.count * gpuRec.gpu.hourly * 730 * tierMult) / util;

    return { volume: vol, selfHosted, api: apiCost, gpuCount: gpuRec.count };
  });
}

export function findBreakEven(data: BreakEvenPoint[]): number | null {
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    if ((prev.selfHosted > prev.api && curr.selfHosted <= curr.api) ||
        (prev.selfHosted < prev.api && curr.selfHosted >= curr.api)) {
      const ratio = (prev.api - prev.selfHosted) / ((curr.selfHosted - curr.api) - (prev.selfHosted - prev.api));
      return Math.round(prev.volume + ratio * (curr.volume - prev.volume));
    }
  }
  return null;
}

//
// Archive estimation for custom models
//

export function estimateArchitecture(params: number): Pick<ModelVariant, 'layers' | 'hidden' | 'heads' | 'kv_heads' | 'arch'> {
  let hidden: number, layers: number, heads: number, kvHeads: number;

  if (params <= 1) {
    hidden = 1024; layers = 24; heads = 16; kvHeads = 4;
  } else if (params <= 4) {
    const t = (params - 1) / 3;
    hidden = Math.round((1024 + t * 1536) / 128) * 128;
    layers = Math.round(24 + t * 12);
    heads = Math.round((16 + t * 4) / 8) * 8;
    kvHeads = 4;
  } else if (params <= 14) {
    const t = (params - 4) / 10;
    hidden = Math.round((2560 + t * 2560) / 128) * 128;
    layers = Math.round(36 + t * 4);
    heads = Math.round((20 + t * 20) / 8) * 8;
    kvHeads = 8;
  } else if (params <= 32) {
    const t = (params - 14) / 18;
    hidden = Math.round((5120 + t * 0) / 128) * 128;
    layers = Math.round(40 + t * 24);
    heads = Math.round((40 + t * 0) / 8) * 8;
    kvHeads = 8;
  } else {
    const t = Math.min(1, (params - 32) / 168);
    hidden = Math.round((5120 + t * 3072) / 128) * 128;
    layers = Math.round(64 + t * 56);
    heads = Math.round((40 + t * 56) / 8) * 8;
    kvHeads = 8;
  }

  return { layers, hidden, heads, kv_heads: kvHeads, arch: 'gqa' };
}
