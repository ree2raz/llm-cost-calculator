# LLM Deploy Cost Calculator

GPU sizing, cost comparison, and break-even analysis for self-hosted LLM inference.

**[llm-cost.rituraj.info](https://llm-cost.rituraj.info)** · [Read the blog post](https://www.rituraj.info/posts/on-prem-llm-deployment-cto/)

## What It Answers

1. **What GPU do I need?** Architecture-aware VRAM calculation (GQA, MLA, MoE) + throughput modeling (prefill compute-bound, decode bandwidth-bound). Not just `params × 2 bytes`.
2. **What will it cost?** Self-hosted GPU rental vs API calls with pricing tiers (on-demand, reserved-1y, spot), HA replicas, peak factor, GPU utilization, and batch discounts.
3. **When does self-hosted beat API?** Step-function break-even chart showing where GPU count jumps and the exact volume where self-hosting becomes cheaper.

## Four things I had to model carefully

Building this, I kept getting estimates that felt off. Each of these caused the GPU count to jump when I got it wrong:

1. **Total params, not active, for MoE memory.** DeepSeek V4 Pro has 49B active params and 1.6T total. Using active params for VRAM says 24 GB at Q4. The correct answer is 800 GB — a 32× gap.
2. **KV cache precision is independent of weight quantization.** On Qwen3-32B at 32K context with 4 concurrent requests, the KV cache in FP16 is 34 GB. The Q4 model weights are 16 GB. The cache is twice the model. Applying weight quantization to KV produces 8.5 GB instead of 34 GB.
3. **Fitting in VRAM is necessary but not sufficient.** Prefill is compute-bound. Decode is bandwidth-bound. GPU count = `max(gpus_for_prefill, gpus_for_decode, gpus_for_vram)`.
4. **One GPU has no redundancy.** Two RTX 3090s at reserved pricing is $547/month, not the $274/month a single-GPU estimate gives you. The bill doubles the moment you take HA seriously.

These compound. Qwen3-32B with avg 12K sessions, 64K context window, 8 concurrent, 2 replicas: naive estimate says one mid-range GPU. The correct answer is ~45 GB per replica (16 GB weights + 23 GB KV) — two A100 80GBs at ~$4,000/month on-demand. And that is before throughput requirements or peak factor. The calculator shows the exact breakdown and the formulas that produced it.

## Features

- **49 model variants** across 9 families: Qwen3, Qwen3.5, Qwen3.6, Gemma 3, Gemma 4, Phi-4, Mistral, DeepSeek, and custom model entry
- **38 API pricing models** including GPT-4o, Claude Sonnet 4.6/Opus 4.7/Haiku 4, Gemini 2.5/3, Grok-3, Kimi k1.5, GLM-4, Qwen3 API, and DeepSeek API
- **10 GPU options** (RTX 3090 through H200 141GB) with `tp_capable` flag — consumer GPUs filtered from multi-GPU configs
- **Architecture-aware VRAM**: MHA (×16 heads), GQA (×4–8 heads), MLA (~50× compression), MoE (total params for VRAM, active for compute)
- **Separate weight quantization** (FP16, Q8, Q4) and **KV cache precision** (FP16, FP8, INT4)
- **Throughput model**: prefill compute-bound (quantization invariant), decode bandwidth-bound (quantization helps)
- **Pricing tiers**: on-demand (1×), reserved-1y (0.65×), spot (0.35×)
- **5 production-tuned presets**: Customer Support Bot, Code Assistant, Enterprise RAG, Startup MVP, High-Volume API Replacement
- **Shareable URL state**: every scenario encodes to query params, shareable by link
- **Calculation formulas exposed**: "Show calculation formulas" panel renders prefill TPS, decode TPS, KV per token, and VRAM formulas with current inputs substituted

## Presets

| Preset | Model | Context | Price Tier | Self-hosted | API | API wins by |
|--------|-------|---------|-----------|-------------|-----|-------------|
| Customer Support Bot | Qwen3-14B Q4 | 8K | Reserved 1y | $547/mo (2× RTX 3090) | $107/mo (GPT-4o) | 80% |
| Code Assistant | Qwen3-32B Q4 | 32K | On-demand | ~$950/mo (1× A100 40GB) | $168/mo (GPT-4o) | 82% |
| Enterprise RAG | Qwen3-32B Q4 | 64K | On-demand | ~$4,000/mo (2× A100 80GB) | ~$1,440/mo (GPT-4o) | 64% |
| Startup MVP | Gemma 3-27B Q4 | 16K | Spot | $331/mo (1× A100 40GB) | $17/mo (GPT-4o) | 95% |
| High-Volume API Replacement | Qwen3-30B-A3B MoE Q4 | 8K | Reserved 1y | $1,200/mo (2× A100 40GB) | $3,000/mo (GPT-4o) | **self-host wins 60%** |

All prices April 2026. GPU costs from RunPod and Lambda; API costs from OpenRouter. Click any preset in the calculator to load it with full parameters.

## Tech Stack

- **Vite + TypeScript + React 18** — pre-compiled bundle, no in-browser JSX compilation
- **Tailwind CSS** with Gruvbox theme (dark/light, persisted to localStorage)
- **All math is pure TypeScript** in `src/lib/calculations.ts` — no runtime dependencies for computation
- **Static deployment** — GitHub Pages, no backend

## Development

```bash
npm install
npm run dev        # Vite dev server (localhost:5173)
npm run build      # Production build → docs/
npm run preview    # Preview production build
npm run typecheck  # TypeScript --noEmit
```

## Deployment

Build to `docs/` and push to `main`:

```bash
npm run build       # outputs to docs/ (includes CNAME)
git add docs/ && git commit -m "deploy" && git push
```

GitHub Pages serves from the `docs/` folder at `llm-cost.rituraj.info` (CNAME auto-copied during build).

## What This Is Not

- Not a model evaluation tool (no perplexity, no benchmark scores)
- Not a training cost calculator (no gradient VRAM, no backprop)
- Not a definitive procurement guide (GPU pricing fluctuates)
- Not legal advice on data privacy (self-hosting helps, but does not guarantee compliance)
- Not region-specific (all USD, 730 hrs/mo, no egress or data transfer costs)

## Known Limitations

- **No egress/data transfer costs.** GPU pricing assumes same-region.
- **No continuous batching efficiency.** Throughput model assumes ideal batching. Real deployments have 10–30% scheduling overhead.
- **No prefix caching.** Every call starts from scratch.
- **No speculative decoding.** Some models support draft-then-verify for higher throughput.
- **No serving engine overhead.** The 15% VRAM buffer covers CUDA context and allocator fragmentation, not Triton/Kubernetes/pod overhead.
- **No cold start penalty.** Model assumed already loaded.

## Maintenance

See `CONTEXT.md` for design rationale and update procedures. Key files:

| What | File | Cadence |
|------|------|---------|
| API pricing | `src/data/constants.ts` → `API_PRICING` | Monthly |
| GPU pricing | `src/data/constants.ts` → `GPUS` | Monthly |
| New models | `src/data/constants.ts` → `MODELS` | As released |
| Presets | `src/data/constants.ts` → `PRESETS` | As use cases emerge |
| Footer date | `src/App.tsx` → `<footer>` | With pricing updates |

## See Also

- **[Inference Bench](https://github.com/ree2raz/inference-bench)** — Reproducible LLM serving benchmarks (vLLM, SGLang, llama.cpp on L4 GPU). Validates this calculator's throughput predictions: FP16 achieves 64-80% of theoretical, AWQ achieves ~51%.

## License

MIT License. See [LICENSE](https://github.com/ree2raz/llm-cost-calculator/blob/main/LICENSE).