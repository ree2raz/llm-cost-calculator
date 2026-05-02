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
npm run dev        # Vite dev server (localhost:5173)
npm run build      # Production build → docs/
npm run preview     # Preview production build
npm run typecheck   # TypeScript --noEmit
```

## Deployment

Build to `docs/` and push to `main`:

```bash
npm run build       # outputs to docs/ (includes CNAME)
git add docs/ && git commit -m "deploy" && git push
```

GitHub Pages serves from the `docs/` folder at `llm-cost.rituraj.info` (CNAME auto-copied during build).

## Maintenance

See `CONTEXT.md` (private) for update cadence, design rationale, and model metadata sourcing. Key update files:

| What | File | Cadence |
|------|------|---------|
| API pricing | `src/data/constants.ts` → `API_PRICING` | Monthly |
| GPU pricing | `src/data/constants.ts` → `GPUS` | Monthly |
| New models | `src/data/constants.ts` → `MODELS` | As released |
| Presets | `src/data/constants.ts` → `PRESETS` | As use cases emerge |
| Footer date | `src/App.tsx` → `<footer>` | With pricing updates |
