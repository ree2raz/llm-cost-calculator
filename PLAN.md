# LLM Cost Calculator v3 — Improvement Plan

**Date**: 2026-05-20
**Status**: Planning
**Source**: Competitive analysis + HN/Dev.to user signal research
**Scope**: High-signal features only. No code deletion — disabled features wrap in `{false && ...}` or feature flags.

---

## Guiding Principle

CTOs and founding engineers land on this tool with ONE question:
**"How much will it cost to deploy model X for my use case, and should I self-host or use an API?"**

Everything that doesn't directly answer that question is noise. The plan adds what users ask for and hides what they don't.

---

## Phase 1: Model Coverage (no architecture changes, data-only)

**Why**: Llama is mentioned in 80%+ of self-hosting discussions. Not having it is the #1 credibility gap.

### 1.1 Add missing model families to `constants.ts`

Add to `MODELS`:

```
'llama4': Llama 4 Scout 17B (MoE, 109B total / 17B active, 128 experts top-8)
          Llama 4 Maverick 400B (MoE, 400B total / 17B active)
'llama3': Llama 3.3 70B (dense)
          Llama 3.1 8B (dense)
```

Research exact architecture params (layers, hidden, heads, kv_heads) from official model cards before adding.

### 1.2 Add corresponding API pricing to `API_PRICING`

- Llama 4 Scout via Together/DeepInfra/Groq
- Llama 4 Maverick via Together/DeepInfra
- Llama 3.3 70B via Groq/Together/OpenRouter

Use cheapest publicly available API pricing per model.

### 1.3 Update presets

Add two new presets:
- **"Llama 4 Scout — High Volume"**: MoE, high concurrency, spot pricing
- **"Llama 3.3 70B — Enterprise Chat"**: Dense, reserved pricing, HA replicas

**Files**: `src/data/constants.ts`
**Estimate**: 1 task

---

## Phase 2: Multi-Provider GPU Pricing

**Why**: Every HN self-hosting thread shows users comparing RunPod vs Lambda vs Vast.ai vs AWS manually. Having one hardcoded price per GPU is the biggest functional gap vs GPU Tracker / LLMcalc.

### 2.1 Extend GPU data model

Current `GPU` interface has single `hourly: number`. Add:

```ts
interface GPUPricing {
  provider: string;
  on_demand: number;
  reserved_1y?: number;
  spot?: number;
  source: string;       // e.g. "runpod.com/pricing"
  updated: string;      // ISO date
}

interface GPU {
  // ... existing fields ...
  pricing: GPUPricing[];  // replaces single hourly
}
```

### 2.2 Populate pricing for existing GPUs

Hardcode 4-5 providers per GPU:

| Provider | GPUs to cover | Notes |
|----------|---------------|-------|
| RunPod | All current | Most popular for self-host |
| Lambda Labs | A100, H100, H200, B200 | Datacenter-class |
| Vast.ai | RTX 3090, 4090, A100 | Spot-heavy, cheapest |
| AWS | A10G, A100 (p4d), H100 (p5) | Enterprise default |
| GCP | L4, A100, H100 | Enterprise alternative |

Prices are hardcoded, sourced from provider pricing pages. Add a footer note: "GPU prices sourced from provider pages, updated [DATE]. Verify before committing."

### 2.3 GPU selection in UI — show cheapest provider

The recommended GPU card now shows:

```
H100 80GB · $2.49/hr (Lambda reserved) · cheapest for this config
   RunPod spot: $1.99 · AWS on-demand: $3.29 · GCP reserved: $2.68
```

The `pricingTier` selector now also picks provider. Or: always show cheapest provider per tier, and show "N providers compared" expandable.

### 2.4 Update cost calculations

`recommendGPU()` and `calculateCosts()` use `gpu.pricing[cheapestForTier]` instead of `gpu.hourly`.

**Files**: `src/data/constants.ts`, `src/lib/calculations.ts`, `src/App.tsx`
**Estimate**: 2-3 tasks

---

## Phase 3: API Comparison Table

**Why**: Every competitor (KickLLM, TokenCost, Curlscape, Brainguru) shows a sortable table of all models ranked by cost. Single-dropdown comparison is the #2 UX gap.

### 3.1 New component: `ApiComparisonTable.tsx`

Input: current workload params (dailyVolume, avgTokens, inputRatio, cacheHitRatio, batchEnabled)

Output: sorted table of ALL API_PRICING entries showing:
| Model | Provider | Monthly Cost | Per Request | Notes |
|-------|----------|-------------|-------------|-------|
| DeepSeek V4 Flash | DeepSeek | $42/mo | $0.0028 | Cheapest |
| Qwen3.5-4B | Alibaba | $58/mo | $0.0039 | |
| ... | ... | ... | ... | |

- Sorted by monthly cost ascending
- Highlight current selection
- Show top-10 by default, "show all N models" expandable
- Quick select: clicking a row sets it as the comparison model

### 3.2 Layout change

Move the API comparison from the "Traffic & API" left panel (single dropdown) to the right panel, below the cost comparison cards.

Left panel "Traffic & API" section keeps: Requests/Day, Avg Tokens, Input/Output Ratio, Adjustments (cache, utilization, batch). Removes the API model dropdown.

Right panel gets new section between "Infrastructure & Cost" and "Break-even Analysis":
```
API Cost Comparison (top 10 cheapest for your workload)
[ table ]
```

### 3.3 Calculations

New function in `calculations.ts`:

```ts
export function calculateAllApiCosts(
  dailyVolume, avgTokens, inputRatio, cacheHitRatio, batchEnabled
): { model: string; provider: string; monthly: number; perRequest: number }[]
```

Iterates all API_PRICING entries, returns sorted array.

**Files**: New `src/components/ApiComparisonTable.tsx`, `src/lib/calculations.ts`, `src/App.tsx`
**Estimate**: 2 tasks

---

## Phase 4: Ops Overhead Toggle

**Why**: Multiple practitioner articles and HN discussions cite engineering time ($6k-80k/yr) as the hidden cost that flips self-hosting decisions. Adding this makes break-even numbers honest.

### 4.1 New state and UI

Add to "Advanced: Infrastructure" section in left panel:

```
[x] Include ops overhead
    Engineering FTE: [0.5] (slider 0-2, step 0.25)
    Loaded cost/FTE: [$150k/yr] (preset: Junior $100k, Mid $150k, Senior $200k)
```

Default: OFF (0.5 FTE × $150k). When enabled, adds `fteCost` to self-hosted monthly.

### 4.2 Calculation change

```ts
const opsMonthly = (opsFte * opsCostPerFte) / 12;
const selfHostedMonthly = gpuMonthly + opsMonthly;
```

Ops cost only applies to self-hosted column, not API. This makes break-even shift right significantly — which is the point. Show a note: "Includes $N/mo ops overhead (0.5 FTE × $150k/yr)"

### 4.3 Break-even chart update

When ops is enabled, the self-hosted step function shifts up by a flat `opsMonthly`. The break-even point moves right. This is the correct behavior — show it clearly.

**Files**: `src/App.tsx`, `src/lib/calculations.ts`
**Estimate**: 1 task

---

## Phase 5: Hide Low-Signal Features

**Why**: The current UI has 20+ inputs on first load. CTOs bounce when they see a wall of configuration. Hide engineering details that don't affect the budget decision.

### 5.1 Hide from default view (keep code, wrap in feature flag or `{false && ...}`)

| Feature | Current Location | Action |
|---------|-----------------|--------|
| AWQ Kernel selector | Model & Deployment | Hide. Default to Marlin. Move to "Advanced" |
| KV Cache Precision | Model & Deployment | Hide. Default to FP16. Move to "Advanced" |
| Custom Model family | Model Family dropdown | Keep but move to bottom, gray out "est." variants |
| MFU slider | Advanced: Infrastructure | Hide. Default to 0.35. Only useful for ML engineers |
| Cache hit ratio | Adjustments | Keep but default to 0%, collapse by default |
| GPU Utilization | Adjustments | Default to 85%, collapse. Most users don't touch this |
| Batch Processing | Adjustments | Keep checkbox but collapse by default |
| "Show calculation formulas" | Break-even section | Keep as-is (already collapsed) |

### 5.2 Simplify the "Advanced: Infrastructure" section

Current advanced section has 4 controls (peak factor, replicas, pricing tier, MFU). After hiding:

**Visible by default:**
- Pricing Tier (on-demand / reserved / spot)

**Hidden behind "Engineering Details" toggle:**
- Peak Factor
- HA Replicas
- MFU
- AWQ Kernel
- KV Cache Precision

### 5.3 Left panel restructure

```
Model & Deployment
  Model Family [dropdown]
  Variant [dropdown]
  Weight Quantization [dropdown]
  Context Length [slider]
  Concurrent Requests [slider]

Traffic
  Requests / Day [input]
  Avg Tokens per Request [input]
  Input / Output Ratio [slider]

[▸ Show engineering details]
  Peak Factor, Replicas, Pricing Tier, MFU,
  AWQ Kernel, KV Precision, GPU Utilization,
  Cache Hit Ratio, Batch Processing
```

The entire left panel should be ~6 inputs visible by default, not 12+.

**Files**: `src/App.tsx`
**Estimate**: 1 task

---

## Phase 6: Shareable Output

**Why**: CTOs need to paste numbers into budget docs, Slack threads, and board decks.

### 6.1 "Copy Summary" button

Below the Infrastructure & Cost card, add:

```
[ Copy cost summary ]
```

Copies to clipboard:
```
LLM Deploy Cost Estimate
Model: Qwen3-32B (Q4_K_M) · 32K context · 8 concurrent
GPU: 1× A100 80GB (RunPod reserved) · $1,215/mo
API equiv: GPT-4o · $4,680/mo
Winner: Self-hosted saves 74%
Break-even: 320 requests/day
Config: https://llm-cost.rituraj.info/?family=qwen3&...
```

### 6.2 Existing URL state

Already implemented (URL params sync). Add a visible "Share this config" button near the top that copies the URL. The URL state already captures all parameters.

**Files**: `src/App.tsx`
**Estimate**: 0.5 task

---

## Phase 7: Owned Hardware / Apple Silicon (stretch)

**Why**: The HN Apple Silicon thread and multiple self-hosting discussions show users comparing owned hardware (amortized) vs cloud rental vs API. Nobody does owned-hardware TCO well.

### 7.1 Add hardware purchase option

New GPU pricing tier: "Owned (amortized)". Inputs:
- Purchase price (pre-filled per GPU)
- Amortization period (3/4/5 years)
- Electricity rate ($/kWh, default $0.12)
- GPU TDP (pre-filled)

Monthly cost = (purchase / amortization_months) + (TDP_watts × hours_per_month × electricity_rate / 1000)

### 7.2 Apple Silicon tier

Add as a separate "compute tier" option:
- M2/M3/M4 Mac with 24/36/48/64/128/192GB unified memory
- Throughput: much slower than datacenter GPUs but $0 marginal cost
- Useful for the "I already own a Mac" audience from HN

**Files**: `src/data/constants.ts`, `src/lib/calculations.ts`, `src/App.tsx`
**Estimate**: 2 tasks (stretch, do after phases 1-6)

---

## Execution Order and Dependencies

```
Phase 1: Model Coverage         [no deps]     → Task 1
Phase 5: Hide Low-Signal        [no deps]     → Task 2
Phase 2: Multi-Provider GPU     [after 1]     → Tasks 3-5
Phase 3: API Comparison Table   [no deps]     → Tasks 6-7
Phase 4: Ops Overhead Toggle    [no deps]     → Task 8
Phase 6: Shareable Output       [no deps]     → Task 9
Phase 7: Owned Hardware         [after 2,4]   → Tasks 10-11 (stretch)
```

**Total estimate**: ~12 tasks across 7 phases. Phases 1-6 are the v3 release. Phase 7 is v3.1.

---

## What We Are NOT Building (explicitly)

These were in my initial analysis but lack user demand in cost-calculator context:

1. ~~Inference engine selector (vLLM vs SGLang vs TRT-LLM)~~ — performance question, not cost
2. ~~Speculative decoding toggle~~ — engineering optimization, not budget decision
3. ~~Latency estimates (TTFT/TPOT)~~ — belongs in Modal advisor / benchmarking tools
4. ~~Fine-tuning cost estimator~~ — adjacent product
5. ~~Multi-model routing estimator~~ — interesting but no user demand signal
6. ~~On-prem TCO with PUE/depreciation/co-lo~~ — out of scope for v3 (phase 7 touches this lightly)

---

## Verification Checklist

After implementation, verify:
- [ ] All existing URL params still work (backward compat)
- [ ] Llama 4 Scout shows correct MoE VRAM (109B total for weights, 17B active for throughput)
- [ ] Multi-provider pricing shows cheapest first, with provider name
- [ ] API comparison table sorts by monthly cost, highlights current selection
- [ ] Ops overhead shifts break-even right realistically
- [ ] Hidden controls don't appear in DOM by default (not just `display:none`)
- [ ] "Copy summary" produces clean plaintext
- [ ] Mobile layout still works after restructure
- [ ] Blog post figures still match live tool output
