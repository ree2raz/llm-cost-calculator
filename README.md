# LLM Deploy Cost Calculator

**Production-grade GPU sizing, cost comparison, and break-even analysis for LLM deployment.**

**[llm-cost.rituraj.info](https://llm-cost.rituraj.info)**

## What It Answers

1. **What GPU do I need?** Architecture-aware VRAM calculation (GQA, MLA, MoE) + throughput modeling (prefill compute-bound, decode bandwidth-bound). Not just `params × 2 bytes`.
2. **What will it cost?** Self-hosted GPU rental vs API calls with pricing tiers (on-demand, reserved-1y, spot), HA replicas, peak factor, GPU utilization, cache hit ratios, and batch discounts.
3. **When does self-hosted beat API?** Step-function break-even chart showing where GPU count jumps and the exact volume where self-hosting becomes cheaper.

## UX

- **Answer-first layout** — sticky decision bar at the top always shows self-hosted $/mo vs API $/mo with the winner callout and break-even point. No scrolling to find the answer.
- **Two-column inputs** — Model & Deployment and Traffic & API. Advanced controls (peak factor, HA replicas, MFU, cache ratio) are collapsed in `<details>` panels to reduce noise.
- **Right column ordered for decision flow** — GPU recommendation → break-even chart → VRAM breakdown (engineering detail last).
- **Shareable URL state** — every scenario is a link encoded in query params. CTOs can share with Finance, eng leads, or their CEO.
- **Calculation formulas exposed** — "Show calculation formulas" disclosure panel shows prefill TPS, decode TPS, KV per token, and VRAM formulas with the user's current inputs substituted in.

## Tech Stack

- **Vite + TypeScript + React 18** — pre-compiled (57KB gzipped JS), no browser JIT
- **Tailwind CSS** with Gruvbox theme (dark/light) — no CDN, all bundled
- **Zero runtime dependencies beyond React** — all math is pure TypeScript

## Features

- 30+ model variants across Qwen3, Gemma 3/4, Phi-4, Mistral, DeepSeek (+ custom model)
- 10 GPU options (L4 to H200) with `tp_capable` flag — consumer GPUs filtered out for multi-GPU
- Separate weight quantization (FP16, Q8, Q4) and KV cache precision (FP16, FP8, INT4)
- Throughput model: prefill (compute-bound, ignores quantization) + decode (memory-bandwidth-bound, respects quantization)
- MFU slider (20–50%) for realistic FLOPS utilization
- KV cache aware: MHA ×16, GQA ×4–8, MLA ×～50 compression
- MoE aware: total params for VRAM, active params for compute
- Pricing tiers: on-demand (1×), reserved-1y (0.65×), spot (0.35×)
- 5 real-world presets with tuned peak factors and pricing tiers

## Development

```bash
npm install
npm run dev      # Vite dev server (localhost:5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build
npm run typecheck  # TypeScript --noEmit
```

## Project Structure

```
src/
├── main.tsx               Entry point
├── App.tsx                 Full component tree
├── index.css               Gruvbox theme + slider/chart/badge styles
├── data/
│   └── constants.ts        MODELS, GPUS, API_PRICING, PRESETS, interfaces
├── lib/
│   └── calculations.ts     VRAM, throughput, cost, break-even (pure TS)
└── components/
    ├── Slider.tsx
    ├── ThemeToggle.tsx
    ├── PresetSelector.tsx
    └── BreakEvenChart.tsx  Step-function SVG chart with tooltips
```

No backend. No analytics. No cookies beyond theme preference (localStorage). All math runs in the browser.

## Architecture

### VRAM Model
```
VRAM = (total_params × quant_bytes + kv_per_token × context × concurrent) × 1.15 overload
```
- `total_params` for MoE (all experts loaded), `active_params` for compute only
- KV cache dtype is independent of weight quantization
- MLA models use `kv_dim` instead of `kv_heads × head_dim`

### Throughput Model
```
prefill_tps = MFU × GPU_FP16_TFLOPS ÷ (2 × active_params)  [compute-bound]
decode_tps  = B × HBM_GBW ÷ (weights_bytes + B × KV_per_seq)  [bandwidth-bound]
```
- Prefill ignores quantization (kernels dequantize and run FP16 math)
- Decode respects quantization (fewer bytes to read from HBM)
- GPU count = max(gpu_for_prefill, gpu_for_decode, gpu_for_vram)

### GPU Selection
- Evaluates all GPUs, picks lowest cost/month
- Filters non-TP-capable GPUs (RTX 3090/4090/5090, L4, A10G) when multi-GPU needed
- Respects `replica_count` for HA (multiplied on top, replicas are independent hosts)

## Deployment

Push to `main` branch:

```bash
npm run build
cp -r dist/* docs/
git add docs/ && git commit -m "deploy" && git push
```

GitHub Pages serves from `docs/` at `llm-cost.rituraj.info` via CNAME.

## Maintenance

See `CONTEXT.md` (private) for update cadence, design rationale, and model metadata sourcing. Key update files:

| What | File | Cadence |
|------|------|---------|
| API pricing | `src/data/constants.ts` → `API_PRICING` | Monthly |
| GPU pricing | `src/data/constants.ts` → `GPUS` | Monthly |
| New models | `src/data/constants.ts` → `MODELS` | As released |
| Presets | `src/data/constants.ts` → `PRESETS` | As use cases emerge |
| Footer date | `src/App.tsx` → `<footer>` | With pricing updates |
