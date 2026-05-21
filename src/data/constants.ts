export interface QuantizationOption {
  key: string;
  label: string;
  bytes: number;
}

export interface KVDtype {
  key: string;
  label: string;
  bytes: number;
}

export interface GPUPricing {
  provider: string;
  on_demand: number;
  reserved_1y?: number;
  spot?: number;
  source: string;
  updated: string;
}

export interface GPU {
  name: string;
  vram: number;
  hbm_gbps: number;
  fp16_tflops: number;
  tp_capable: boolean;
  generation: 'Ampere' | 'Ada' | 'Hopper' | 'Blackwell' | 'Unknown';
  pricing: GPUPricing[];
}

export interface ModelVariant {
  name: string;
  params: number;
  active_params?: number;
  layers: number;
  hidden: number;
  heads: number;
  kv_heads?: number;
  kv_dim?: number;
  context: number;
  arch: 'gqa' | 'mha' | 'mla' | 'moe';
  moe_topk?: number;
}

export interface ModelFamily {
  family: string;
  variants: ModelVariant[];
}

export interface APIPricing {
  model: string;
  provider: string;          // actual API service, NOT model creator
  input: number;             // $/1M input tokens
  output: number;            // $/1M output tokens
  cache: number;             // cache discount factor (0–1)
  path: 'proprietary' | 'aggregator';
  notes?: string;            // e.g. "Fastest — 840 t/s" or "Cheapest"
}

export interface Preset {
  name: string;
  family: string;
  variant: string;
  quantization: string;
  contextLength: number;
  concurrent: number;
  dailyVolume: number;
  avgTokens: number;
  inputRatio: number;
  peakFactor: number;
  replicaCount: number;
  pricingTier: string;
  mfu: number;
}

export const QUANTIZATIONS: QuantizationOption[] = [
  { key: 'fp16', label: 'FP16', bytes: 2 },
  { key: 'fp8', label: 'FP8 (H100+/B200 native)', bytes: 1 },
  { key: 'q8', label: 'Q8', bytes: 1 },
  { key: 'q4_k_m', label: 'Q4_K_M', bytes: 0.5 },
  { key: 'awq4', label: 'AWQ 4-bit', bytes: 0.5 },
  { key: 'gguf_q4', label: 'GGUF Q4', bytes: 0.5 },
  { key: 'gguf_q5', label: 'GGUF Q5', bytes: 0.625 },
];

export const KV_DTYPES: KVDtype[] = [
  { key: 'fp16', label: 'FP16', bytes: 2 },
  { key: 'fp8', label: 'FP8', bytes: 1 },
  { key: 'int4', label: 'INT4', bytes: 0.5 },
];

// Multi-provider GPU pricing snapshot — May 2026.
// Sources: runpod.io/pricing, lambda.ai/pricing, vast.ai/pricing,
// aws.amazon.com/ec2/instance-types/{g5,p4,p5}, cloud.google.com/compute/gpus-pricing,
// spheron.network cross-provider comparison.
// Spot rates fluctuate; reserved/CUD where listed publicly.
const GPU_UPDATED = '2026-05';

export const GPUS: GPU[] = [
  {
    name: 'RTX 3090', vram: 24, hbm_gbps: 936, fp16_tflops: 71, tp_capable: false, generation: 'Ampere',
    pricing: [
      { provider: 'RunPod', on_demand: 0.43, spot: 0.22, source: 'runpod.io/pricing', updated: GPU_UPDATED },
      { provider: 'Vast.ai', on_demand: 0.22, spot: 0.12, source: 'vast.ai/pricing', updated: GPU_UPDATED },
    ],
  },
  {
    name: 'RTX 4090', vram: 24, hbm_gbps: 1008, fp16_tflops: 165, tp_capable: false, generation: 'Ada',
    pricing: [
      { provider: 'RunPod', on_demand: 0.69, spot: 0.34, source: 'runpod.io/pricing', updated: GPU_UPDATED },
      { provider: 'Vast.ai', on_demand: 0.29, spot: 0.16, source: 'vast.ai/pricing', updated: GPU_UPDATED },
    ],
  },
  {
    name: 'RTX 5090', vram: 32, hbm_gbps: 1792, fp16_tflops: 419, tp_capable: false, generation: 'Blackwell',
    pricing: [
      { provider: 'RunPod', on_demand: 0.99, spot: 0.69, source: 'runpod.io/pricing', updated: GPU_UPDATED },
      { provider: 'Vast.ai', on_demand: 0.95, spot: 0.55, source: 'vast.ai/pricing', updated: GPU_UPDATED },
    ],
  },
  {
    name: 'L4', vram: 24, hbm_gbps: 300, fp16_tflops: 31, tp_capable: false, generation: 'Ada',
    pricing: [
      { provider: 'GCP', on_demand: 0.71, reserved_1y: 0.65, spot: 0.62, source: 'cloud.google.com/compute/gpus-pricing', updated: GPU_UPDATED },
      { provider: 'RunPod', on_demand: 0.43, spot: 0.32, source: 'runpod.io/pricing', updated: GPU_UPDATED },
    ],
  },
  {
    name: 'A10G', vram: 24, hbm_gbps: 600, fp16_tflops: 125, tp_capable: false, generation: 'Ampere',
    pricing: [
      { provider: 'AWS', on_demand: 1.21, reserved_1y: 0.80, spot: 0.50, source: 'aws.amazon.com/ec2/instance-types/g5', updated: GPU_UPDATED },
      { provider: 'RunPod', on_demand: 0.75, spot: 0.50, source: 'runpod.io/pricing', updated: GPU_UPDATED },
    ],
  },
  {
    name: 'L40S', vram: 48, hbm_gbps: 864, fp16_tflops: 362, tp_capable: true, generation: 'Ada',
    pricing: [
      { provider: 'RunPod', on_demand: 0.79, spot: 0.59, source: 'runpod.io/pricing', updated: GPU_UPDATED },
      { provider: 'Lambda', on_demand: 1.40, source: 'lambda.ai/pricing', updated: GPU_UPDATED },
    ],
  },
  {
    name: 'A100 40GB', vram: 40, hbm_gbps: 1555, fp16_tflops: 312, tp_capable: true, generation: 'Ampere',
    pricing: [
      { provider: 'RunPod', on_demand: 1.19, spot: 0.79, source: 'runpod.io/pricing', updated: GPU_UPDATED },
      { provider: 'Lambda', on_demand: 1.29, source: 'lambda.ai/pricing', updated: GPU_UPDATED },
      { provider: 'Vast.ai', on_demand: 1.10, spot: 0.79, source: 'vast.ai/pricing', updated: GPU_UPDATED },
      { provider: 'AWS', on_demand: 4.10, reserved_1y: 2.61, spot: 1.60, source: 'aws.amazon.com/ec2/instance-types/p4', updated: GPU_UPDATED },
      { provider: 'GCP', on_demand: 3.67, reserved_1y: 2.91, spot: 1.10, source: 'cloud.google.com/compute/gpus-pricing', updated: GPU_UPDATED },
    ],
  },
  {
    name: 'A100 80GB', vram: 80, hbm_gbps: 1935, fp16_tflops: 312, tp_capable: true, generation: 'Ampere',
    pricing: [
      { provider: 'RunPod', on_demand: 1.89, spot: 1.29, source: 'runpod.io/pricing', updated: GPU_UPDATED },
      { provider: 'Lambda', on_demand: 2.49, source: 'lambda.ai/pricing', updated: GPU_UPDATED },
      { provider: 'Vast.ai', on_demand: 1.29, spot: 0.79, source: 'vast.ai/pricing', updated: GPU_UPDATED },
      { provider: 'AWS', on_demand: 4.30, reserved_1y: 2.74, spot: 1.85, source: 'aws.amazon.com/ec2/instance-types/p4', updated: GPU_UPDATED },
      { provider: 'GCP', on_demand: 3.67, reserved_1y: 2.91, spot: 1.10, source: 'cloud.google.com/compute/gpus-pricing', updated: GPU_UPDATED },
    ],
  },
  {
    name: 'H100 80GB', vram: 80, hbm_gbps: 3350, fp16_tflops: 989, tp_capable: true, generation: 'Hopper',
    pricing: [
      { provider: 'RunPod', on_demand: 2.69, spot: 1.99, source: 'runpod.io/pricing', updated: GPU_UPDATED },
      { provider: 'Lambda', on_demand: 2.99, source: 'lambda.ai/pricing', updated: GPU_UPDATED },
      { provider: 'Vast.ai', on_demand: 1.89, spot: 1.47, source: 'vast.ai/pricing', updated: GPU_UPDATED },
      { provider: 'AWS', on_demand: 4.10, reserved_1y: 2.61, spot: 2.00, source: 'aws.amazon.com/ec2/instance-types/p5', updated: GPU_UPDATED },
      { provider: 'GCP', on_demand: 10.50, reserved_1y: 6.50, source: 'cloud.google.com/compute/gpus-pricing', updated: GPU_UPDATED },
    ],
  },
  {
    name: 'H200 141GB', vram: 141, hbm_gbps: 4800, fp16_tflops: 989, tp_capable: true, generation: 'Hopper',
    pricing: [
      { provider: 'RunPod', on_demand: 3.99, spot: 3.59, source: 'runpod.io/pricing', updated: GPU_UPDATED },
      { provider: 'Lambda', on_demand: 3.79, source: 'lambda.ai/pricing', updated: GPU_UPDATED },
      { provider: 'AWS', on_demand: 4.98, reserved_1y: 3.50, source: 'aws.amazon.com/ec2/instance-types/p5', updated: GPU_UPDATED },
    ],
  },
  {
    name: 'B200', vram: 192, hbm_gbps: 8000, fp16_tflops: 2250, tp_capable: true, generation: 'Blackwell',
    pricing: [
      { provider: 'RunPod', on_demand: 5.58, spot: 4.99, source: 'runpod.io/pricing', updated: GPU_UPDATED },
      { provider: 'Lambda', on_demand: 5.29, source: 'lambda.ai/pricing', updated: GPU_UPDATED },
      { provider: 'AWS', on_demand: 14.24, spot: 3.24, source: 'aws.amazon.com/ec2/instance-types/p6', updated: GPU_UPDATED },
    ],
  },
];

export const MODELS: Record<string, ModelFamily> = {
  'qwen25': {
    family: 'Qwen2.5 (Alibaba)',
    variants: [
      { name: 'Qwen2.5-7B', params: 7, layers: 28, hidden: 4096, heads: 28, kv_heads: 4, context: 131072, arch: 'gqa' },
    ]
  },
  'qwen3': {
    family: 'Qwen3 (Alibaba)',
    variants: [
      { name: 'Qwen3-0.6B', params: 0.6, layers: 24, hidden: 1024, heads: 16, kv_heads: 4, context: 32768, arch: 'gqa' },
      { name: 'Qwen3-1.7B', params: 1.7, layers: 24, hidden: 1536, heads: 12, kv_heads: 4, context: 32768, arch: 'gqa' },
      { name: 'Qwen3-4B', params: 4, layers: 36, hidden: 2560, heads: 20, kv_heads: 4, context: 32768, arch: 'gqa' },
      { name: 'Qwen3-8B', params: 8, layers: 36, hidden: 4096, heads: 32, kv_heads: 8, context: 131072, arch: 'gqa' },
      { name: 'Qwen3-14B', params: 14, layers: 40, hidden: 5120, heads: 40, kv_heads: 8, context: 131072, arch: 'gqa' },
      { name: 'Qwen3-32B', params: 32, layers: 64, hidden: 5120, heads: 40, kv_heads: 8, context: 131072, arch: 'gqa' },
      { name: 'Qwen3-30B-A3B (MoE)', params: 30.5, active_params: 3.3, layers: 48, hidden: 2048, heads: 32, kv_heads: 4, context: 32768, arch: 'moe', moe_topk: 8 },
    ]
  },
  'qwen35': {
    family: 'Qwen3.5 (Alibaba)',
    variants: [
      { name: 'Qwen3.5-0.8B', params: 0.8, layers: 24, hidden: 1024, heads: 16, kv_heads: 4, context: 32768, arch: 'gqa' },
      { name: 'Qwen3.5-4B', params: 4, layers: 36, hidden: 2560, heads: 20, kv_heads: 4, context: 32768, arch: 'gqa' },
      { name: 'Qwen3.5-9B', params: 9, layers: 36, hidden: 4096, heads: 32, kv_heads: 8, context: 131072, arch: 'gqa' },
      { name: 'Qwen3.5-27B', params: 27, layers: 48, hidden: 6144, heads: 48, kv_heads: 8, context: 131072, arch: 'gqa' },
      { name: 'Qwen3.5-35B (MoE)', params: 36, active_params: 3, layers: 48, hidden: 5120, heads: 32, kv_heads: 8, context: 131072, arch: 'moe', moe_topk: 8 },
      { name: 'Qwen3.5-122B (MoE)', params: 125, active_params: 10, layers: 64, hidden: 8192, heads: 64, kv_heads: 8, context: 131072, arch: 'moe', moe_topk: 8 },
    ]
  },
  'qwen36': {
    family: 'Qwen3.6 (Alibaba, est.)',
    variants: [
      { name: 'Qwen3.6-27B (est.)', params: 28, layers: 48, hidden: 6144, heads: 48, kv_heads: 8, context: 131072, arch: 'gqa' },
      { name: 'Qwen3.6-35B MoE (est.)', params: 36, active_params: 3, layers: 48, hidden: 5120, heads: 32, kv_heads: 8, context: 131072, arch: 'moe', moe_topk: 8 },
    ]
  },
  'gemma3': {
    family: 'Gemma 3 (Google)',
    variants: [
      { name: 'Gemma 3-1B', params: 1, layers: 26, hidden: 1152, heads: 4, kv_heads: 1, context: 131072, arch: 'gqa' },
      { name: 'Gemma 3-4B', params: 4, layers: 34, hidden: 2560, heads: 8, kv_heads: 4, context: 131072, arch: 'gqa' },
      { name: 'Gemma 3-12B', params: 12, layers: 48, hidden: 3840, heads: 16, kv_heads: 16, context: 131072, arch: 'mha' },
      { name: 'Gemma 3-27B', params: 27, layers: 48, hidden: 5376, heads: 16, kv_heads: 8, context: 131072, arch: 'gqa' },
    ]
  },
  'gemma4': {
    family: 'Gemma 4 (Google, est.)',
    variants: [
      { name: 'Gemma 4-E2B (est.)', params: 5, layers: 36, hidden: 3072, heads: 16, kv_heads: 8, context: 131072, arch: 'gqa' },
      { name: 'Gemma 4-E4B (est.)', params: 8, layers: 40, hidden: 4096, heads: 32, kv_heads: 8, context: 131072, arch: 'gqa' },
      { name: 'Gemma 4-26B-A4B MoE (est.)', params: 27, active_params: 4, layers: 48, hidden: 5120, heads: 32, kv_heads: 8, context: 131072, arch: 'moe', moe_topk: 8 },
      { name: 'Gemma 4-31B (est.)', params: 33, layers: 64, hidden: 6144, heads: 48, kv_heads: 8, context: 131072, arch: 'gqa' },
    ]
  },
  'phi4': {
    family: 'Phi-4 (Microsoft)',
    variants: [
      { name: 'Phi-4-mini', params: 3.8, layers: 32, hidden: 3072, heads: 32, kv_heads: 8, context: 131072, arch: 'gqa' },
      { name: 'Phi-4', params: 14, layers: 40, hidden: 5120, heads: 40, kv_heads: 10, context: 16384, arch: 'gqa' },
    ]
  },
  'mistral': {
    family: 'Mistral',
    variants: [
      { name: 'Mistral Small 3.2', params: 24, layers: 40, hidden: 5120, heads: 32, kv_heads: 8, context: 128000, arch: 'gqa' },
      { name: 'Mistral Large 3', params: 123, layers: 88, hidden: 12288, heads: 96, kv_heads: 8, context: 262144, arch: 'gqa' },
    ]
  },
  'deepseek': {
    family: 'DeepSeek',
    variants: [
      { name: 'DeepSeek V4 Flash', params: 284, active_params: 13, layers: 61, hidden: 7168, heads: 128, kv_heads: 128, context: 1048576, arch: 'mla', kv_dim: 512 },
      { name: 'DeepSeek V4 Pro', params: 1600, active_params: 49, layers: 61, hidden: 7168, heads: 128, kv_heads: 128, context: 1048576, arch: 'mla', kv_dim: 512 },
      { name: 'DeepSeek R1', params: 671, active_params: 37, layers: 61, hidden: 7168, heads: 128, kv_heads: 128, context: 163840, arch: 'mla', kv_dim: 512 },
      { name: 'DeepSeek R1 Distill-Qwen 32B', params: 32, layers: 64, hidden: 5120, heads: 40, kv_heads: 8, context: 32768, arch: 'gqa' },
      { name: 'DeepSeek R1 Distill-Llama 70B', params: 70, layers: 80, hidden: 8192, heads: 64, kv_heads: 8, context: 131072, arch: 'gqa' },
    ]
  },
  'llama3': {
    family: 'Llama 3.x (Meta)',
    variants: [
      { name: 'Llama 3.1 8B', params: 8, layers: 32, hidden: 4096, heads: 32, kv_heads: 8, context: 131072, arch: 'gqa' },
      { name: 'Llama 3.3 70B', params: 70, layers: 80, hidden: 8192, heads: 64, kv_heads: 8, context: 131072, arch: 'gqa' },
    ]
  },
  'llama4': {
    family: 'Llama 4 (Meta, est.)',
    variants: [
      { name: 'Llama 4 Scout 109B (est.)', params: 109, active_params: 17, layers: 48, hidden: 5120, heads: 40, kv_heads: 8, context: 1048576, arch: 'moe', moe_topk: 1 },
      { name: 'Llama 4 Maverick 400B (est.)', params: 400, active_params: 17, layers: 48, hidden: 5120, heads: 40, kv_heads: 8, context: 1048576, arch: 'moe', moe_topk: 1 },
    ]
  },
  'custom': {
    family: 'Custom Model',
    variants: [
      { name: 'Custom Dense 7B (GQA)', params: 7, layers: 32, hidden: 4096, heads: 32, kv_heads: 8, context: 32768, arch: 'gqa' },
      { name: 'Custom Dense 13B (GQA)', params: 13, layers: 40, hidden: 5120, heads: 40, kv_heads: 8, context: 65536, arch: 'gqa' },
      { name: 'Custom Dense 34B (GQA)', params: 34, layers: 60, hidden: 6656, heads: 52, kv_heads: 8, context: 131072, arch: 'gqa' },
      { name: 'Custom Dense 70B (MHA)', params: 70, layers: 80, hidden: 8192, heads: 64, kv_heads: 64, context: 131072, arch: 'mha' },
      { name: 'Custom MoE 52B/12B', params: 52, active_params: 12, layers: 32, hidden: 4096, heads: 32, kv_heads: 8, context: 65536, arch: 'moe', moe_topk: 4 },
      { name: 'Custom MoE 136B/24B', params: 136, active_params: 24, layers: 48, hidden: 5120, heads: 40, kv_heads: 8, context: 131072, arch: 'moe', moe_topk: 8 },
      { name: 'Custom MLA 32B', params: 32, layers: 48, hidden: 5120, heads: 40, kv_heads: 40, context: 131072, arch: 'mla', kv_dim: 512 },
    ]
  }
};

export const API_PRICING: APIPricing[] = [
  // ── Proprietary models (single-source, no alternatives) ──────────────────
  // OpenAI
  { model: 'GPT-5.4',              provider: 'OpenAI',    input: 2.50,  output: 15.00, cache: 0.50, path: 'proprietary', notes: '500K context' },
  { model: 'GPT-4o',               provider: 'OpenAI',    input: 2.50,  output: 10.00, cache: 0.50, path: 'proprietary' },
  { model: 'GPT-4o-mini',          provider: 'OpenAI',    input: 0.15,  output: 0.60,  cache: 0.50, path: 'proprietary' },
  // Anthropic
  { model: 'Claude Sonnet 4.6',    provider: 'Anthropic', input: 3.00,  output: 15.00, cache: 0.90, path: 'proprietary' },
  { model: 'Claude Opus 4.7',      provider: 'Anthropic', input: 5.00,  output: 25.00, cache: 0.90, path: 'proprietary' },
  { model: 'Claude Haiku 4',       provider: 'Anthropic', input: 1.00,  output: 5.00,  cache: 0.90, path: 'proprietary' },
  // Google
  { model: 'Gemini 3.1 Flash',     provider: 'Google',    input: 0.50,  output: 3.00,  cache: 0.75, path: 'proprietary', notes: '1M context' },
  { model: 'Gemini 3.1 Flash Lite',provider: 'Google',    input: 0.25,  output: 1.50,  cache: 0.75, path: 'proprietary', notes: '1M context' },
  { model: 'Gemini 3.1 Pro',       provider: 'Google',    input: 2.00,  output: 12.00, cache: 0.75, path: 'proprietary', notes: '1M context' },
  { model: 'Gemini 2.5 Flash',     provider: 'Google',    input: 0.30,  output: 2.50,  cache: 0.75, path: 'proprietary' },
  { model: 'Gemini 2.5 Pro',       provider: 'Google',    input: 1.25,  output: 10.00, cache: 0.75, path: 'proprietary' },
  { model: 'Gemini 3 Flash (preview)', provider: 'Google', input: 0.50, output: 3.00,  cache: 0.75, path: 'proprietary', notes: 'Preview' },
  // xAI
  { model: 'Grok-3',               provider: 'xAI',       input: 3.00,  output: 15.00, cache: 0.50, path: 'proprietary' },
  { model: 'Grok-3 Mini',          provider: 'xAI',       input: 0.30,  output: 0.50,  cache: 0.50, path: 'proprietary' },
  // Xiaomi / MiniMax / Moonshot
  { model: 'MiMo-V2-Pro',          provider: 'Xiaomi',    input: 1.00,  output: 3.00,  cache: 0.50, path: 'proprietary' },
  { model: 'MiniMax M2.7',         provider: 'MiniMax',   input: 0.25,  output: 1.20,  cache: 0.50, path: 'proprietary', notes: '197K context' },
  { model: 'Kimi K2.5',            provider: 'Moonshot',  input: 0.80,  output: 3.83,  cache: 0.50, path: 'proprietary', notes: '262K context' },
  { model: 'Kimi k1.5',            provider: 'Moonshot',  input: 0.74,  output: 3.49,  cache: 0.50, path: 'proprietary' },
  // Zhipu
  { model: 'GLM-4-9B',             provider: 'Zhipu',     input: 0.10,  output: 0.50,  cache: 0.50, path: 'proprietary' },
  { model: 'GLM-4-32B',            provider: 'Zhipu',     input: 0.10,  output: 0.10,  cache: 0.50, path: 'proprietary' },
  // DeepSeek
  { model: 'DeepSeek V3.2',        provider: 'DeepSeek',  input: 0.27,  output: 0.64,  cache: 0.50, path: 'proprietary' },
  { model: 'DeepSeek V4 Pro',      provider: 'DeepSeek',  input: 0.44,  output: 0.87,  cache: 0.50, path: 'proprietary' },
  { model: 'DeepSeek V4 Flash',    provider: 'DeepSeek',  input: 0.14,  output: 0.28,  cache: 0.50, path: 'proprietary' },
  { model: 'DeepSeek R1',          provider: 'DeepSeek',  input: 0.70,  output: 2.50,  cache: 0.50, path: 'proprietary' },

  // ── Llama 4 Scout 109B (MoE, 17B active) ─────────────────────────────────
  { model: 'Llama 4 Scout 109B', provider: 'DeepInfra',  input: 0.08, output: 0.30, cache: 0.50, path: 'aggregator' },
  { model: 'Llama 4 Scout 109B', provider: 'Groq',       input: 0.11, output: 0.34, cache: 0.50, path: 'aggregator', notes: 'Fastest (594 t/s)' },

  // ── Llama 4 Maverick 400B (MoE, 17B active) ──────────────────────────────
  { model: 'Llama 4 Maverick 400B', provider: 'DeepInfra',   input: 0.15, output: 0.60, cache: 0.50, path: 'aggregator' },
  { model: 'Llama 4 Maverick 400B', provider: 'Groq',        input: 0.20, output: 0.60, cache: 0.50, path: 'aggregator', notes: 'Fastest (562 t/s)' },
  { model: 'Llama 4 Maverick 400B', provider: 'Together AI', input: 0.27, output: 0.85, cache: 0.50, path: 'aggregator' },

  // ── Llama 3.3 70B ─────────────────────────────────────────────────────────
  { model: 'Llama 3.3 70B', provider: 'DeepInfra',   input: 0.10, output: 0.32, cache: 0.50, path: 'aggregator' },
  { model: 'Llama 3.3 70B', provider: 'Groq',        input: 0.59, output: 0.79, cache: 0.50, path: 'aggregator', notes: 'Fastest (394 t/s)' },
  { model: 'Llama 3.3 70B', provider: 'Together AI', input: 0.88, output: 0.88, cache: 0.50, path: 'aggregator' },
  { model: 'Llama 3.3 70B', provider: 'Fireworks',   input: 0.90, output: 0.90, cache: 0.50, path: 'aggregator' },

  // ── Llama 3.1 8B ──────────────────────────────────────────────────────────
  { model: 'Llama 3.1 8B', provider: 'DeepInfra',   input: 0.02, output: 0.05, cache: 0.50, path: 'aggregator' },
  { model: 'Llama 3.1 8B', provider: 'Groq',        input: 0.05, output: 0.08, cache: 0.50, path: 'aggregator', notes: 'Fastest (840 t/s)' },
  { model: 'Llama 3.1 8B', provider: 'Together AI', input: 0.18, output: 0.18, cache: 0.50, path: 'aggregator' },
  { model: 'Llama 3.1 8B', provider: 'Fireworks',   input: 0.20, output: 0.20, cache: 0.50, path: 'aggregator' },

  // ── Qwen3 ─────────────────────────────────────────────────────────────────
  { model: 'Qwen3-235B',          provider: 'DeepInfra', input: 0.071, output: 0.10, cache: 0.50, path: 'aggregator' },
  { model: 'Qwen3-235B',          provider: 'Fireworks', input: 1.20,  output: 1.20, cache: 0.50, path: 'aggregator' },
  { model: 'Qwen3-32B',           provider: 'DeepInfra', input: 0.08,  output: 0.28, cache: 0.50, path: 'aggregator' },
  { model: 'Qwen3-32B',           provider: 'Groq',      input: 0.29,  output: 0.59, cache: 0.50, path: 'aggregator', notes: 'Fastest (662 t/s)' },
  { model: 'Qwen3-14B',           provider: 'DeepInfra', input: 0.12,  output: 0.24, cache: 0.50, path: 'aggregator' },
  { model: 'Qwen3-14B',           provider: 'Fireworks', input: 0.20,  output: 0.20, cache: 0.50, path: 'aggregator' },
  { model: 'Qwen3-8B',            provider: 'Fireworks', input: 0.20,  output: 0.20, cache: 0.50, path: 'aggregator' },
  { model: 'Qwen3-30B-A3B (MoE)', provider: 'DeepInfra', input: 0.09,  output: 0.45, cache: 0.50, path: 'aggregator' },

  // ── Qwen3.5 ───────────────────────────────────────────────────────────────
  { model: 'Qwen3.5-9B',          provider: 'OpenRouter',  input: 0.04, output: 0.15, cache: 0.50, path: 'aggregator' },
  { model: 'Qwen3.5-9B',          provider: 'Together AI', input: 0.10, output: 0.15, cache: 0.50, path: 'aggregator' },
  { model: 'Qwen3.5-27B',         provider: 'DeepInfra',   input: 0.26, output: 2.60, cache: 0.50, path: 'aggregator' },
  { model: 'Qwen3.5-27B',         provider: 'Fireworks',   input: 0.26, output: 2.60, cache: 0.50, path: 'aggregator' },
  { model: 'Qwen3.5-35B (MoE)',   provider: 'Fireworks',   input: 0.50, output: 0.50, cache: 0.50, path: 'aggregator' },

  // ── Gemma 3 ───────────────────────────────────────────────────────────────
  { model: 'Gemma 3-27B', provider: 'DeepInfra',   input: 0.08, output: 0.16, cache: 0.50, path: 'aggregator' },
  { model: 'Gemma 3-12B', provider: 'DeepInfra',   input: 0.04, output: 0.13, cache: 0.50, path: 'aggregator' },
  { model: 'Gemma 3-12B', provider: 'Fireworks',   input: 0.20, output: 0.20, cache: 0.50, path: 'aggregator' },
  { model: 'Gemma 3-4B',  provider: 'Together AI', input: 0.02, output: 0.04, cache: 0.50, path: 'aggregator' },
  { model: 'Gemma 3-4B',  provider: 'DeepInfra',   input: 0.04, output: 0.08, cache: 0.50, path: 'aggregator' },
  { model: 'Gemma 3-4B',  provider: 'Fireworks',   input: 0.10, output: 0.10, cache: 0.50, path: 'aggregator' },
  { model: 'Gemma 3-1B',  provider: 'Fireworks',   input: 0.10, output: 0.10, cache: 0.50, path: 'aggregator' },

  // ── Gemma 4 ───────────────────────────────────────────────────────────────
  { model: 'Gemma 4-31B',       provider: 'DeepInfra',   input: 0.12, output: 0.37, cache: 0.50, path: 'aggregator' },
  { model: 'Gemma 4-31B',       provider: 'Together AI', input: 0.20, output: 0.50, cache: 0.50, path: 'aggregator' },
  { model: 'Gemma 4-26B (MoE)', provider: 'OpenRouter',  input: 0.06, output: 0.33, cache: 0.50, path: 'aggregator' },
  { model: 'Gemma 4-26B (MoE)', provider: 'DeepInfra',   input: 0.07, output: 0.34, cache: 0.50, path: 'aggregator' },

  // ── DeepSeek (aggregator rows for open-weight models) ─────────────────────
  { model: 'DeepSeek R1',                provider: 'OpenRouter',  input: 0.45,  output: 2.15,  cache: 0.50, path: 'aggregator', notes: 'R1-0528' },
  { model: 'DeepSeek R1',                provider: 'Together AI', input: 3.00,  output: 7.00,  cache: 0.50, path: 'aggregator' },
  { model: 'DeepSeek V4 Flash',          provider: 'OpenRouter',  input: 0.126, output: 0.252, cache: 0.50, path: 'aggregator' },
  { model: 'DeepSeek V4 Flash',          provider: 'Fireworks',   input: 0.14,  output: 0.28,  cache: 0.50, path: 'aggregator' },
  { model: 'DeepSeek V4 Pro',            provider: 'OpenRouter',  input: 0.435, output: 0.87,  cache: 0.50, path: 'aggregator' },
  { model: 'DeepSeek V4 Pro',            provider: 'Fireworks',   input: 1.74,  output: 3.48,  cache: 0.50, path: 'aggregator' },
  { model: 'DeepSeek R1 Distill-Qwen 32B',  provider: 'Fireworks', input: 0.20, output: 0.20,  cache: 0.50, path: 'aggregator' },
  { model: 'DeepSeek R1 Distill-Llama 70B', provider: 'Groq',      input: 0.75, output: 0.99,  cache: 0.50, path: 'aggregator', notes: 'Fastest (LPU)' },
  { model: 'DeepSeek R1 Distill-Llama 70B', provider: 'Fireworks', input: 0.90, output: 0.90,  cache: 0.50, path: 'aggregator' },

  // ── Mistral ───────────────────────────────────────────────────────────────
  { model: 'Mistral Small 3.2', provider: 'OpenRouter',  input: 0.07,  output: 0.20, cache: 0.50, path: 'aggregator' },
  { model: 'Mistral Small 3.2', provider: 'DeepInfra',   input: 0.075, output: 0.20, cache: 0.50, path: 'aggregator' },
  { model: 'Mistral Large 3',   provider: 'OpenRouter',  input: 0.50,  output: 1.50, cache: 0.50, path: 'aggregator' },
  { model: 'Mistral Large 3',   provider: 'Fireworks',   input: 0.90,  output: 0.90, cache: 0.50, path: 'aggregator' },
  { model: 'Mistral Large 3',   provider: 'Together AI', input: 1.20,  output: 4.50, cache: 0.50, path: 'aggregator' },

  // ── Phi-4 ─────────────────────────────────────────────────────────────────
  { model: 'Phi-4-mini', provider: 'Fireworks', input: 0.10, output: 0.10, cache: 0.50, path: 'aggregator' },
  { model: 'Phi-4',      provider: 'Fireworks', input: 0.20, output: 0.20, cache: 0.50, path: 'aggregator' },
];

export const BATCH_DISCOUNT = 0.50;
export const PRICING_TIERS: Record<string, number> = { on_demand: 1.0, reserved_1y: 0.65, spot: 0.35 };

export const PRESETS: Preset[] = [
  { name: 'Customer Support Bot', family: 'qwen3', variant: 'Qwen3-14B', quantization: 'q4_k_m', contextLength: 8192, concurrent: 8, dailyVolume: 500, avgTokens: 1500, inputRatio: 70, peakFactor: 3.0, replicaCount: 2, pricingTier: 'reserved_1y', mfu: 0.35 },
  { name: 'Code Assistant', family: 'qwen3', variant: 'Qwen3-32B', quantization: 'q4_k_m', contextLength: 32768, concurrent: 4, dailyVolume: 200, avgTokens: 4000, inputRatio: 40, peakFactor: 2.0, replicaCount: 1, pricingTier: 'on_demand', mfu: 0.35 },
  { name: 'Enterprise RAG', family: 'qwen3', variant: 'Qwen3-32B', quantization: 'q4_k_m', contextLength: 65536, concurrent: 8, dailyVolume: 1000, avgTokens: 12000, inputRatio: 80, peakFactor: 2.5, replicaCount: 2, pricingTier: 'on_demand', mfu: 0.30 },
  { name: 'Startup MVP', family: 'gemma3', variant: 'Gemma 3-27B', quantization: 'q4_k_m', contextLength: 16384, concurrent: 2, dailyVolume: 100, avgTokens: 1000, inputRatio: 60, peakFactor: 3.0, replicaCount: 1, pricingTier: 'spot', mfu: 0.35 },
  { name: 'High-Volume API Replacement', family: 'qwen3', variant: 'Qwen3-30B-A3B (MoE)', quantization: 'q4_k_m', contextLength: 8192, concurrent: 32, dailyVolume: 20000, avgTokens: 800, inputRatio: 50, peakFactor: 1.5, replicaCount: 2, pricingTier: 'reserved_1y', mfu: 0.40 },
  { name: 'Llama 4 Scout — High Volume', family: 'llama4', variant: 'Llama 4 Scout 109B (est.)', quantization: 'q4_k_m', contextLength: 16384, concurrent: 16, dailyVolume: 10000, avgTokens: 1000, inputRatio: 50, peakFactor: 1.5, replicaCount: 2, pricingTier: 'reserved_1y', mfu: 0.40 },
  { name: 'Llama 3.3 70B — Enterprise Chat', family: 'llama3', variant: 'Llama 3.3 70B', quantization: 'q4_k_m', contextLength: 8192, concurrent: 8, dailyVolume: 2000, avgTokens: 1500, inputRatio: 60, peakFactor: 2.5, replicaCount: 2, pricingTier: 'reserved_1y', mfu: 0.35 },
];
