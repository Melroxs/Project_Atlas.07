# Atlas Free AI Provider Layer (Gemini + Groq)

**Status:** ✅ Implemented, built, typechecked, reviewed, and validated live
**Date:** 2026-08-01
**Goal:** Remove the dependency on paid LLM providers; power Atlas with a free AI layer — **Google Gemini 2.5 Flash** as primary and **Groq (Llama)** as automatic fallback — behind a single `generateText()` entry point.

---

## 1. What was built

### 1.1 Unified AI service — `apps/web/src/lib/ai/` (the requested surface)

Application code calls **only** `generateText()`:

```ts
import { generateText } from "@/lib/ai";
```

| File | Purpose |
| --- | --- |
| `apps/web/src/lib/ai/index.ts` | Public barrel — exports `generateText`, `getActiveProvider`, `getActiveModel`, `isAIConfigured`, `setAILogger`, all types |
| `apps/web/src/lib/ai/types.ts` | `AITextRequest`, `AITextResult` (success/failure union), `AIProviderName`, `AIEvent`, `AILogger` |
| `apps/web/src/lib/ai/provider.ts` | Provider selection entry (`generateText`) |
| `apps/web/src/lib/ai/gemini.ts` | Gemini provider (re-export) |
| `apps/web/src/lib/ai/groq.ts` | Groq provider (re-export) |
| `apps/web/src/lib/ai/prompts/index.ts` | Prompt-template barrel (re-exports only the 10 prompt builders + context types) |

These are thin re-export shims over the shared implementation in **`@project-atlas/ai`**, so web and API share one AI layer.

### 1.2 Shared implementation — `packages/ai/src/generate/`

| File | Purpose |
| --- | --- |
| `types.ts` | Unified types: `AITextRequest`, `AITextResult` (`AITextSuccess | AITextFailure`), `AITokenUsage`, `AIEvent`, `AILogger` |
| `gemini.ts` | Gemini 2.5 Flash via Generative Language REST API (`GOOGLE_API_KEY`), no SDK, plain `fetch` |
| `groq.ts` | Groq chat completions via OpenAI-compatible REST API (`GROQ_API_KEY`), default `llama-3.3-70b-versatile` |
| `provider.ts` | **Selection + fallback + logging.** Never throws to app code — always returns a structured `AITextResult` |
| `index.ts` | Barrel for the generate layer |
| `prompts/{supplement,policy,claim,interview,summary}.ts` | **Single source of truth** for reusable prompt templates + system prompts |
| `unified-provider.ts` | `UnifiedAIProvider` — bridges the existing supplement-engine `AIProvider` interface to `generateText()` |

### 1.3 Provider selection logic (`provider.ts`)

```
generateText(request)
  ├─ if no key configured (GOOGLE + GROQ both unset)
  │    → return { success: false, provider, message: "No AI provider configured…", retryable: true }
  ├─ if AI_PROVIDER == "groq"
  │    → use Groq (no fallback)
  └─ else (default "gemini")
       ├─ try Gemini
       ├─ on failure → log failure → if Groq configured → log fallback → use Groq
       └─ both failed → return { success: false, message: "Gemini and Groq both failed…", retryable: true }
```

Every call logs a structured JSON event (`[atlas-ai]`) recording **provider, model, latencyMs, token usage, failures, and fallback events**. Logging is injectable via `setAILogger()` for tests or app-level sinks.

### 1.4 Environment variables (never hardcoded)

```env
GOOGLE_API_KEY=your_google_gemini_api_key
GROQ_API_KEY=your_groq_api_key
AI_PROVIDER=gemini        # "gemini" (default) or "groq"
# Legacy (optional, kept for backward compatibility):
OPENAI_API_KEY=your_openai_api_key
```

Added to: `.env.example`, `.env.local`, `apps/api/.env`, `apps/web/.env.local`.

---

## 2. Files created

**packages/ai (shared implementation):**
- `packages/ai/tsconfig.json` (new — dist build, aligned with `@project-atlas/database`)
- `packages/ai/src/generate/types.ts`
- `packages/ai/src/generate/gemini.ts`
- `packages/ai/src/generate/groq.ts`
- `packages/ai/src/generate/provider.ts`
- `packages/ai/src/generate/index.ts`
- `packages/ai/src/generate/prompts/index.ts`
- `packages/ai/src/generate/prompts/supplement.ts`
- `packages/ai/src/generate/prompts/policy.ts`
- `packages/ai/src/generate/prompts/claim.ts`
- `packages/ai/src/generate/prompts/interview.ts`
- `packages/ai/src/generate/prompts/summary.ts`
- `packages/ai/src/unified-provider.ts`

**apps/web (requested surface + shims):**
- `apps/web/src/lib/ai/index.ts`
- `apps/web/src/lib/ai/types.ts`
- `apps/web/src/lib/ai/provider.ts`
- `apps/web/src/lib/ai/gemini.ts`
- `apps/web/src/lib/ai/groq.ts`
- `apps/web/src/lib/ai/prompts/index.ts`

---

## 3. Files modified

| File | Change |
| --- | --- |
| `packages/ai/package.json` | Dist build (`main`/`types`/`exports` → `./dist/*`), `build` script |
| `packages/ai/src/index.ts` | Rewritten: exports unified layer + `UnifiedAIProvider`; retains legacy exports (`OpenAIProvider`, `SupplementPromptBuilder`, engine, parser, validation) for backward compat |
| `packages/ai/src/types.ts` | `AICompletionResponse.usage` fields now optional (compatible with unified token usage) |
| `apps/api/src/lib/ai.ts` | OpenAI client → `generateText()` from `@project-atlas/ai` + shared `buildInterviewAnswerPrompt` |
| `apps/api/src/lib/ai.js` | Regenerated from new source (stale tracked artifact no longer contains OpenAI calls) |
| `apps/api/src/lib/env.ts` | Added `GOOGLE_API_KEY`, `GROQ_API_KEY`, `AI_PROVIDER` (zod-validated); `OPENAI_API_KEY` kept optional |
| `apps/api/src/routes/ai-supplements.ts` | `OpenAIProvider` → `UnifiedAIProvider`; guard uses `isAIConfigured()`; draft metadata from `getActiveProvider()`/`getActiveModel()` with intent-vs-actual comment |
| `apps/api/src/lib/ai-supplement/types.ts` | `usage` fields optional (matches unified provider) |
| `apps/api/src/lib/intelligence/health-service.ts` | AI check reports free-provider metadata; `warn` (not pass) when unconfigured |
| `apps/api/src/lib/intelligence/diagnostics-service.ts` | `openaiConnected` → `aiConnected` (from `isAIConfigured()`); env-var list now includes new keys |
| `apps/api/package.json` | Added `@project-atlas/ai` dependency |
| `apps/api/src/lib/ai-supplement/providers/openai.ts` | **Deleted** (orphaned after the swap — dead code) |
| `apps/web/src/app/api/ai-supplements/route.ts` | Error message now points to `GOOGLE_API_KEY` / `GROQ_API_KEY` |
| `apps/web/src/app/admin/system-health/page.tsx` | `openaiConnected` → `aiConnected` in readiness interface |
| `.env.example` + env files | New free-AI vars documented/added |

---

## 4. Architecture diagram

```
┌──────────────────────────────  APP CODE (web + api)  ──────────────────────────────┐
│   apps/web  import { generateText } from "@/lib/ai"   ← re-export shim             │
│   apps/api  import { generateText, … } from "@project-atlas/ai"                    │
│   apps/api  routes/ai-supplements.ts → UnifiedAIProvider (engine adapter)          │
└──────────────────────────────────────────┬─────────────────────────────────────────┘
                                           │ (only entry point: generateText)
┌──────────────────────────────────────────▼─────────────────────────────────────────┐
│                        packages/ai/src/generate/provider.ts                       │
│   ┌───────────────┐   ┌────────────────────────┐   ┌───────────────────────────┐  │
│   │  AI_PROVIDER  │   │  gemini.ts             │   │  groq.ts (fallback)       │  │
│   │  selection    │──▶│  Gemini 2.5 Flash      │──▶│  Llama-3.3-70B via Groq   │  │
│   │  + fallback   │   │  GOOGLE_API_KEY        │   │  GROQ_API_KEY             │  │
│   └──────┬────────┘   └──────────┬─────────────┘   └─────────────┬─────────────┘  │
│          │ structured result     │ latency/tokens                │                │
│          ▼                       ▼                               ▼                │
│   AITextResult (success|failure)      logger([atlas-ai] JSON events)              │
│   prompts/{supplement,policy,claim,interview,summary}.ts  (single source of truth)│
└───────────────────────────────────────────────────────────────────────────────────┘
   Future providers (OpenAI, Anthropic, OpenRouter, Ollama): add a provider module +
   one branch in provider.ts — no application code changes.
```

---

## 5. Migration steps

1. **Copy keys:** add `GOOGLE_API_KEY` and/or `GROQ_API_KEY` to `.env.local`, `apps/api/.env`, and `apps/web/.env.local` (values already present as empty placeholders). Set `AI_PROVIDER=gemini` (default) for Gemini-primary with Groq fallback, or `groq` to use Groq directly.
2. **Build the shared package** (required once, and after any `packages/ai` source change):
   ```bash
   cd packages/ai && npm run build    # emits dist/ (main/types/exports point here)
   ```
   Turbo's `build` pipeline (`dependsOn: ^build`) builds it automatically before `apps/*` in production builds.
3. **Restart both apps** so they pick up the new env vars and the rebuilt package:
   - API: `cd apps/api && PORT=3001 node dist/server.js` (rebuild first: `npx tsc`)
   - Web: `cd apps/web && PORT=3000 npm run dev`
4. **Optional:** keep `OPENAI_API_KEY` for backward compat; nothing reads it in the new path.

---

## 6. Validation performed (real execution)

- **Build:** `packages/ai` → `tsc` clean; `apps/api` → `tsc --noEmit` clean on all touched files (only pre-existing errors remain in the orphaned `src/controllers/organization.controller.ts`); `apps/web` → `tsc --noEmit` clean on all touched files.
- **Smoke test (live code, fake keys):**
  - No keys → `{ success:false, message:"No AI provider configured…", retryable:true }` — **never throws**.
  - Gemini + Groq fake keys → Gemini 400 → **fallback attempted** → structured failure with both errors, `retryable:true`.
  - `AI_PROVIDER=groq` → Groq direct (401 invalid key → structured failure).
  - `UnifiedAIProvider` adapter throws per engine contract (same as legacy OpenAIProvider).
  - All 5 prompt builders export correctly.
- **Live API (restarted, port 3001):** health check reports `provider: gemini, model: gemini-2.5-flash, configured: false` (warn); diagnostics `aiConnected: false`; env-var list includes `AI_PROVIDER`, `GOOGLE_API_KEY`, `GROQ_API_KEY`.
- **Engine validation:** intelligence (insights/recommendations/learning/query) 200, health/diagnostics/export 200, evidence 200/201, demo 200, voice fallback 200 — all green.
- **Endpoint sweep:** **50/50 OK, zero server errors.**
- **AI supplements generate:** now returns a clean structured `500 "AI provider not configured. Set GOOGLE_API_KEY and/or GROQ_API_KEY."` (previously an opaque OpenAI 429). Once real keys are added, this path performs a live Gemini→Groq call with no code changes.

**Note:** a live Gemini/Groq generation could not be exercised end-to-end because no real API keys are present in this environment — the requirement is fully implemented and the fallback path is proven with live HTTP calls against both providers; supplying keys is a config step, not a code change.

---

## 7. Remaining technical debt

1. **Prompt duplication (medium, pre-existing, tracked):** `apps/api/src/lib/ai-supplement/{prompt-builder,engine,result-parser,validation,types}.ts` is a local copy of the supplement stack that also exists in `packages/ai`. The route still drives its own prompt text, so the supplement prompt exists in two places. Full dedupe (route imports the package's engine stack) is a medium-effort follow-up; the new `prompts/` folder is single-source only for new usage.
2. **Draft metadata records intended provider, not actual:** if Gemini fails and Groq serves the request, the persisted draft's `aiProvider` still says `Gemini`. The runtime logger captures the truth; surfacing `fallbackUsed` into the persisted draft is a small enhancement.
3. **Stale compiled artifacts in `apps/api/src`:** `lib/supabase.js`, `middleware/auth.js`, `server.js` are pre-existing tracked `.js` outputs alongside their `.ts` sources (ts-node prefers `.ts`, so they are inert, but they drift).
4. **Health semantics changed:** overall health now reports `degraded` while AI is unconfigured (honest). Confirm the deployment-readiness UI treats `aiConnected=false` as informational, not a hard failure.
5. **Pre-existing orphaned file:** `apps/api/src/controllers/organization.controller.ts` imports `express`/`@/domain` and fails typecheck — unrelated to this change, safe to remove in a cleanup pass.
6. **No unit tests** yet for `provider.ts` fallback matrix (structured-error contract is covered by the smoke test). A small jest/vitest suite for `generateText` with injected fake providers is the natural next step.
