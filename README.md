# LLM Deploy Cost Calculator

> **Live at:** [https://llm-cost.rituraj.info/](https://llm-cost.rituraj.info/)

A single-page, client-side calculator that helps CTOs and engineering leaders answer the three most critical infrastructure questions:

1. **What GPU do we need?** — Architecture-aware VRAM calculation with real GPU recommendations
2. **What does it cost monthly?** — Side-by-side self-hosted vs API cost comparison
3. **When does self-hosted beat API?** — Interactive break-even analysis

Built as a zero-dependency artifact (React + Tailwind via CDN) for instant deployment anywhere.

---

## Features

- **30+ current-generation models** including Qwen3, Gemma 3/4, Phi-4, Mistral, DeepSeek V4/R1, GPT-4o, Claude Sonnet/Opus/Haiku, Gemini 2.5/3, Grok-3, Kimi k1.5, GLM-4
- **Architecture-aware VRAM math** — accounts for GQA, MLA (DeepSeek), and standard MHA attention mechanisms
- **Real GPU database** — RTX 3090 through H200 141GB with hourly pricing from RunPod/Lambda
- **Multi-GPU auto-detection** — suggests tensor-parallel configs when no single GPU fits
- **Interactive SVG break-even chart** — log-scale with hover tooltips and intersection annotation
- **Gruvbox dark/light theme** — warm, premium aesthetic with persistent preference
- **5 relatable presets** — Customer Support Bot, Code Assistant, Enterprise RAG, Startup MVP, High-Volume API Replacement
- **Custom model support** — enter any parameter count (0.5B–500B), architecture auto-estimated from modern scaling laws

---

## Tech Stack

- **React 18** (UMD via CDN)
- **Tailwind CSS** (CDN)
- **SVG** for the break-even chart (zero charting libraries)
- **Babel Standalone** for JSX transformation
- **No build step, no backend, no API keys**

---

## Architecture Highlights

### VRAM Calculation

```
model_vram = active_params × bytes_per_param
kv_cache = 2 × layers × kv_heads × head_dim × context × concurrent × bytes_per_param
total_vram = (model_vram + kv_cache) × 1.15  // 15% overhead
```

- **MLA (DeepSeek):** Uses compressed latent dimension (~10× smaller KV cache)
- **GQA:** Reduces KV heads by 4–8× vs MHA
- **MoE:** Uses active parameters, not total parameters

### GPU Selection

Picks the cheapest single GPU that fits the VRAM requirement. If none fit, suggests multi-GPU configurations (2×, 4×, 8×) with a complexity warning.

### Cost Comparison

- **Self-hosted:** GPU hourly rate × 730 hours/month
- **API:** (input_tokens × input_price + output_tokens × output_price) / 1M
- **Per-transcript cost** for both paths

---

## Usage

### Deployed (Recommended)
[https://llm-cost.rituraj.info/](https://llm-cost.rituraj.info/)

### Local Development
```bash
git clone git@github.com:ree2raz/llm-cost-calculator.git
cd llm-cost-calculator
python3 -m http.server 8000
# Open http://localhost:8000
```

No `npm install`, no build step. The entire app is in `index.html`.

---

## Model Data Sources

- **API pricing:** OpenRouter (April 2026)
- **Architecture metadata:** Published technical reports (Qwen3, Gemma 3, DeepSeek V4, etc.)
- **GPU pricing:** RunPod Community Cloud / Lambda Cloud (approximate, update monthly)
- **Closed-source architectures:** Best-effort estimates based on parameter count and generation

---

## Roadmap

- [ ] Add more cloud providers (CoreWeave, Vast.ai, Salad)
- [ ] Fine-tuning cost estimator (LoRA vs full fine-tune)
- [ ] Batch inference optimization calculator
- [ ] Export to PDF / shareable link with query params
- [ ] Mobile-native PWA support

---

## License

MIT

---

Built for CTOs evaluating AI infrastructure decisions. If you have questions beyond what the calculator answers — model update strategy, operational maintenance, team hiring — those are consulting conversations, not calculator inputs.
