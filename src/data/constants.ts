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

export interface GPU {
  name: string;
  vram: number;
  hourly: number;
  hbm_gbps: number;
  fp16_tflops: number;
  tp_capable: boolean;
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
  provider: string;
  input: number;
  output: number;
  cache: number;
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

export const GPUS: GPU[] = [
  { name: 'RTX 3090', vram: 24, hourly: 0.49, hbm_gbps: 936, fp16_tflops: 71, tp_capable: false },
  { name: 'RTX 4090', vram: 24, hourly: 0.59, hbm_gbps: 1008, fp16_tflops: 165, tp_capable: false },
  { name: 'RTX 5090', vram: 32, hourly: 1.58, hbm_gbps: 1792, fp16_tflops: 419, tp_capable: false },
  { name: 'L4', vram: 24, hourly: 0.49, hbm_gbps: 300, fp16_tflops: 31, tp_capable: false },
  { name: 'A10G', vram: 24, hourly: 1.10, hbm_gbps: 600, fp16_tflops: 125, tp_capable: false },
  { name: 'L40S', vram: 48, hourly: 1.34, hbm_gbps: 864, fp16_tflops: 362, tp_capable: true },
  { name: 'A100 40GB', vram: 40, hourly: 1.10, hbm_gbps: 1555, fp16_tflops: 312, tp_capable: true },
  { name: 'A100 80GB', vram: 80, hourly: 2.31, hbm_gbps: 1935, fp16_tflops: 312, tp_capable: true },
  { name: 'H100 80GB', vram: 80, hourly: 3.39, hbm_gbps: 3350, fp16_tflops: 989, tp_capable: true },
  { name: 'H200 141GB', vram: 141, hourly: 4.31, hbm_gbps: 4800, fp16_tflops: 989, tp_capable: true },
];

export const MODELS: Record<string, ModelFamily> = {
  'qwen3': {
    family: 'Qwen3 (Alibaba)',
    variants: [
      { name: 'Qwen3-0.6B', params: 0.6, layers: 24, hidden: 1024, heads: 16, kv_heads: 4, context: 32768, arch: 'gqa' },
      { name: 'Qwen3-1.7B', params: 1.7, layers: 24, hidden: 1536, heads: 12, kv_heads: 4, context: 32768, arch: 'gqa' },
      { name: 'Qwen3-4B', params: 4, layers: 36, hidden: 2560, heads: 20, kv_heads: 4, context: 32768, arch: 'gqa' },
      { name: 'Qwen3-8B', params: 8, layers: 36, hidden: 4096, heads: 32, kv_heads: 8, context: 131072, arch: 'gqa' },
      { name: 'Qwen3-14B', params: 14, layers: 40, hidden: 5120, heads: 40, kv_heads: 8, context: 131072, arch: 'gqa' },
      { name: 'Qwen3-32B', params: 32, layers: 64, hidden: 5120, heads: 40, kv_heads: 8, context: 131072, arch: 'gqa' },
      { name: 'Qwen3-235B (MoE)', params: 235, active_params: 32, layers: 64, hidden: 8192, heads: 64, kv_heads: 8, context: 131072, arch: 'moe', moe_topk: 8 },
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
      { name: 'DeepSeek V4 Pro', params: 284, active_params: 49, layers: 61, hidden: 7168, heads: 128, kv_heads: 128, context: 1048576, arch: 'mla', kv_dim: 512 },
      { name: 'DeepSeek R1', params: 671, active_params: 37, layers: 61, hidden: 7168, heads: 128, kv_heads: 128, context: 163840, arch: 'mla', kv_dim: 512 },
      { name: 'DeepSeek R1 Distill-Qwen 32B', params: 32, layers: 64, hidden: 5120, heads: 40, kv_heads: 8, context: 32768, arch: 'gqa' },
      { name: 'DeepSeek R1 Distill-Llama 70B', params: 70, layers: 80, hidden: 8192, heads: 64, kv_heads: 8, context: 131072, arch: 'gqa' },
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
  { model: 'GPT-4o', provider: 'OpenAI', input: 2.50, output: 10.00, cache: 0.50 },
  { model: 'GPT-4o-mini', provider: 'OpenAI', input: 0.15, output: 0.60, cache: 0.50 },
  { model: 'Claude Sonnet 4.6', provider: 'Anthropic', input: 3.00, output: 15.00, cache: 0.90 },
  { model: 'Claude Opus 4.7', provider: 'Anthropic', input: 5.00, output: 25.00, cache: 0.90 },
  { model: 'Claude Haiku 4', provider: 'Anthropic', input: 1.00, output: 5.00, cache: 0.90 },
  { model: 'Gemini 2.5 Flash', provider: 'Google', input: 0.30, output: 2.50, cache: 0.75 },
  { model: 'Gemini 2.5 Pro', provider: 'Google', input: 1.25, output: 10.00, cache: 0.75 },
  { model: 'Gemini 3 (est.)', provider: 'Google', input: 2.00, output: 8.00, cache: 0.75 },
  { model: 'Gemini 3 Flash (preview)', provider: 'Google', input: 0.50, output: 3.00, cache: 0.75 },
  { model: 'Grok-3', provider: 'xAI', input: 3.00, output: 15.00, cache: 0.50 },
  { model: 'Grok-3 Mini', provider: 'xAI', input: 0.30, output: 0.50, cache: 0.50 },
  { model: 'Kimi k1.5', provider: 'Moonshot', input: 0.74, output: 3.49, cache: 0.50 },
  { model: 'GLM-4-9B', provider: 'Zhipu', input: 0.10, output: 0.50, cache: 0.50 },
  { model: 'GLM-4-32B', provider: 'Zhipu', input: 0.10, output: 0.10, cache: 0.50 },
  { model: 'Qwen3-235B', provider: 'Alibaba', input: 0.071, output: 0.10, cache: 0.50 },
  { model: 'Qwen3-32B', provider: 'Alibaba', input: 0.08, output: 0.24, cache: 0.50 },
  { model: 'Qwen3-14B', provider: 'Alibaba', input: 0.06, output: 0.24, cache: 0.50 },
  { model: 'Qwen3-8B', provider: 'Alibaba', input: 0.05, output: 0.40, cache: 0.50 },
  { model: 'Qwen3.5-9B', provider: 'Alibaba', input: 0.06, output: 0.24, cache: 0.50 },
  { model: 'Qwen3.5-4B', provider: 'Alibaba', input: 0.04, output: 0.12, cache: 0.50 },
  { model: 'Qwen3.5-27B', provider: 'Alibaba', input: 0.10, output: 0.30, cache: 0.50 },
  { model: 'Qwen3.5-35B (MoE)', provider: 'Alibaba', input: 0.15, output: 0.40, cache: 0.50 },
  { model: 'Qwen3.6-27B', provider: 'Alibaba', input: 0.12, output: 0.35, cache: 0.50 },
  { model: 'Qwen3.6-35B (MoE)', provider: 'Alibaba', input: 0.18, output: 0.45, cache: 0.50 },
  { model: 'DeepSeek V4 Pro', provider: 'DeepSeek', input: 0.44, output: 0.87, cache: 0.50 },
  { model: 'DeepSeek V4 Flash', provider: 'DeepSeek', input: 0.14, output: 0.28, cache: 0.50 },
  { model: 'DeepSeek R1', provider: 'DeepSeek', input: 0.70, output: 2.50, cache: 0.50 },
  { model: 'DeepSeek R1 Distill-Qwen 32B', provider: 'DeepSeek', input: 0.29, output: 0.29, cache: 0.50 },
  { model: 'DeepSeek R1 Distill-Llama 70B', provider: 'DeepSeek', input: 0.70, output: 0.80, cache: 0.50 },
  { model: 'Gemma 3-27B', provider: 'Google', input: 0.08, output: 0.16, cache: 0.50 },
  { model: 'Gemma 3-12B', provider: 'Google', input: 0.04, output: 0.13, cache: 0.50 },
  { model: 'Gemma 3-4B', provider: 'Google', input: 0.04, output: 0.08, cache: 0.50 },
  { model: 'Gemma 4-31B', provider: 'Google', input: 0.12, output: 0.24, cache: 0.50 },
  { model: 'Gemma 4-26B (MoE)', provider: 'Google', input: 0.08, output: 0.18, cache: 0.50 },
  { model: 'Gemma 4-E4B', provider: 'Google', input: 0.05, output: 0.10, cache: 0.50 },
  { model: 'Gemma 4-E2B', provider: 'Google', input: 0.03, output: 0.06, cache: 0.50 },
  { model: 'Mistral Large 3', provider: 'Mistral', input: 2.00, output: 6.00, cache: 0.50 },
  { model: 'Mistral Small 3.2', provider: 'Mistral', input: 0.075, output: 0.20, cache: 0.50 },
];

export const BATCH_DISCOUNT = 0.50;
export const PRICING_TIERS: Record<string, number> = { on_demand: 1.0, reserved_1y: 0.65, spot: 0.35 };

export const PRESETS: Preset[] = [
  { name: 'Customer Support Bot', family: 'qwen3', variant: 'Qwen3-14B', quantization: 'q4_k_m', contextLength: 8192, concurrent: 8, dailyVolume: 500, avgTokens: 1500, inputRatio: 70, peakFactor: 3.0, replicaCount: 2, pricingTier: 'reserved_1y', mfu: 0.35 },
  { name: 'Code Assistant', family: 'qwen3', variant: 'Qwen3-32B', quantization: 'q4_k_m', contextLength: 32768, concurrent: 4, dailyVolume: 200, avgTokens: 4000, inputRatio: 40, peakFactor: 2.0, replicaCount: 1, pricingTier: 'on_demand', mfu: 0.35 },
  { name: 'Enterprise RAG', family: 'deepseek', variant: 'DeepSeek V4 Pro', quantization: 'q4_k_m', contextLength: 65536, concurrent: 16, dailyVolume: 1000, avgTokens: 3000, inputRatio: 80, peakFactor: 2.5, replicaCount: 2, pricingTier: 'reserved_1y', mfu: 0.30 },
  { name: 'Startup MVP', family: 'gemma3', variant: 'Gemma 3-27B', quantization: 'q4_k_m', contextLength: 16384, concurrent: 2, dailyVolume: 100, avgTokens: 1000, inputRatio: 60, peakFactor: 3.0, replicaCount: 1, pricingTier: 'spot', mfu: 0.35 },
  { name: 'High-Volume API Replacement', family: 'deepseek', variant: 'DeepSeek V4 Flash', quantization: 'q4_k_m', contextLength: 8192, concurrent: 32, dailyVolume: 5000, avgTokens: 800, inputRatio: 50, peakFactor: 1.5, replicaCount: 2, pricingTier: 'reserved_1y', mfu: 0.40 },
];
