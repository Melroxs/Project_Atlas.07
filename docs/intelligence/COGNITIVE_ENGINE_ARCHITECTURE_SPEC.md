# Atlas Cognitive Engine Architecture Specification (Phase 4)

**Document ID:** COGNITIVE-001
**Version:** 1.0
**Status:** Draft — architecture & systems design (no implementation in this phase)
**Owner:** Atlas Engineering
**Date:** August 2026
**Depends On:**

- PLAT-006 Event Bus & Domain Events Architecture
- DECISION_CONFIDENCE_ENGINE_SPEC (Decision & Confidence Engine)
- ATLAS_MEMORY_ENGINE_SPEC (Atlas Memory Engine)
- Claim Intelligence Layer (Phase 2) — `packages/claim-intelligence`
- Operations Intelligence Layer (Phase 3) — `packages/claim-intelligence` (operations modules)
- Multi-Entry Claim Workflow (Phase 1 integration)
- Claim Workspace / Claim Detail page
- Evidence Graph, Knowledge Graph, Document Intelligence, Communications Intelligence, Policy Intelligence, Decision Engine, Compliance Validator, Supplement Engine, Atlas Voice

---

# Table of Contents

1. Cognitive Engine Vision
2. Overall Architecture
3. Atlas Orchestrator
4. Cognitive Agents
5. Agent Communication
6. Shared Memory
7. Decision Framework
8. Explainability
9. Knowledge Graph Evolution
10. Event Architecture
11. Human Collaboration
12. Performance
13. Security
14. Package Structure
15. Implementation Roadmap
16. Diagrams (Sequence, Component, Event Flow, Agent Interaction, Data Flow, Package Dependency)
17. Risk Assessment
18. Trade-off Analysis
19. Open Architectural Decisions
20. Future Extensibility Recommendations
Appendix A — Contract Reference (types)
Appendix B — Event Catalog
Appendix C — Glossary

---

# Section 1 — Cognitive Engine Vision

## 1.1 Purpose

Atlas has evolved through three stages:

| Stage | Capability | Status |
|---|---|---|
| 1. AI-assisted workflows | Claims, interviews, documents, photos, supplements, packages, voice | ✅ Shipped |
| 2. AI Intelligence | Evidence Graph, Knowledge Graph, Decision Engine, Compliance, Claim Intelligence Layer (Phase 2) | ✅ Shipped |
| 3. AI Operations | AI Case Manager, Lifecycle Engine, Financial Intelligence, Dashboards (Phase 3) | ✅ Shipped |
| 4. **AI Cognition** | The **Cognitive Engine** — coordinated, prioritized, self-improving AI | ⬅ **This specification** |

The Cognitive Engine is the layer that **thinks, coordinates, explains, prioritizes, and continuously improves**. It does not replace any existing system. It orchestrates the systems listed above into a single cognitive loop: when anything happens on a claim, the engine decides which specialist agents should look at it, runs them in dependency order (in parallel where safe), aggregates their confidence, resolves conflicts, synthesizes a ranked set of actions, explains every recommendation, and routes uncertain or high-stakes results to humans. It then learns from every human decision to improve its future performance.

## 1.2 Objectives

The Cognitive Engine will:

1. Provide one **orchestrator** that plans, schedules, and supervises cognitive work across all specialist agents.
2. Define **10 cognitive agents** (Policy, Evidence, Financial, Compliance, Operations, Communications, Document Intelligence, Recommendation, Knowledge Graph, Conversation) with explicit contracts.
3. Establish a **shared cognitive memory** (working, long-term, conversation, claim, company, agent, historical, decision) built on the existing event log, snapshots, extractions, carrier intelligence, and digital twins — not a new database.
4. Define a **decision framework**: scoring, confidence aggregation, evidence weighting, conflict resolution, ranking, human-review thresholds, and learning.
5. Make **every** recommendation explainable at the level required by Phase 2/3: *why*, *which evidence*, *which policy*, *which estimate item*, *which communication*, *which agent*, *confidence*, *alternatives*, *rejected alternatives*.
6. Define how the **Knowledge Graph** evolves with cross-claim and portfolio relationships.
7. Extend the **event architecture** with an explicit event catalog, ordering, idempotency, replay, and tracing.
8. Define the **human collaboration** loop: review, override, accept, reject, feedback, audit.
9. Set **performance, security, and package structure** standards for implementation.
10. Provide an **implementation roadmap** (Phases 4A–4F) with deliverables, dependencies, testing, rollback, risk, and effort.

## 1.3 Guiding Principles

1. **Composition over replacement.** The engine coordinates existing engines; it never duplicates their business logic.
2. **Orchestration, not analysis.** The Orchestrator never performs specialist analysis itself.
3. **Evidence before conclusions.** No recommendation exists without a supporting evidence chain.
4. **Explainability by construction.** Every output carries its reasoning trace; there is no such thing as an opaque AI output in Atlas.
5. **Confidence is calculated, not guessed.** Scores derive from the Decision & Confidence Engine methodology (weighted, configurable factors).
6. **Human oversight for uncertain decisions.** Escalation thresholds route low-confidence or high-stakes results to human reviewers.
7. **Event-driven, eventually consistent.** New information triggers a cognitive cycle automatically; the UI reads live recomputes, so staleness is bounded.
8. **Backward compatibility.** No existing schema, route, or module is modified in a breaking way.
9. **Never fabricate.** Financial and statistical claims are computed from real data; absent data yields `null`/`unknown`, never invented values.
10. **Tenant isolation.** All cognition is scoped per company (RLS + company context), with no cross-tenant leakage.

## 1.4 Design Philosophy

The engine is designed as a **scheduler of deterministic + stochastic work over a shared evidence corpus**:

- **Deterministic core** (rules, scoring, lifecycle, financial math) runs first and is always reproducible.
- **Stochastic surface** (LLM summaries, explanations, conversational responses) runs last, is always grounded in the deterministic core's outputs, and is never the source of truth for numbers.
- **Agents are stateless.** All state lives in the shared memory (events, snapshots, twins, extractions); agents are pure functions over a `ContextBundle`.
- **The cycle is idempotent and replayable.** Given the same event log, the same cycle can be recomputed (the `domain_events` table is the source of truth for replay).

## 1.5 Non-Goals

The Cognitive Engine **will not**:

- Replace the Evidence Graph, Knowledge Graph, Decision Engine, Compliance Validator, Document Intelligence, Communications Intelligence, Policy Intelligence, Supplement Engine, Claim Workspace, Timeline, or Voice Orchestration.
- Introduce new databases or migrate existing schemas (memory is composed from existing tables: `domain_events`, `claim_intelligence_snapshots`, `communication_extractions`, `carrier_intelligence`, `digital_twins`, plus the Memory Engine tables when they ship).
- Ship UI components (this phase is architecture-only; UI surface is described for implementers).
- Introduce autonomous actions without human approval (recommendations are advisory; the existing human-approval-before-automation principle holds).
- Add paid LLM dependencies — all stochastic work uses the existing free-provider layer (Gemini + Groq) already in the repo.
- Solve general-purpose AGI problems; the scope is insurance-restoration claim cognition.

## 1.6 Success Criteria

| Criterion | Target |
|---|---|
| Cognitive cycle latency (typical claim, no LLM) | p50 < 400 ms, p95 < 1.5 s |
| Cognitive cycle latency (with LLM summary) | p95 < 8 s (async where possible) |
| Coverage | 100% of claims have a live Digital Twin within 1 min of any change event |
| Explainability | 100% of recommendations carry full trace (why/evidence/agent/confidence) |
| Recommendation accuracy | ≥ 90% of high-confidence recommendations accepted by humans without modification |
| Confidence calibration | ≤ 5% average absolute deviation between predicted confidence and outcome (post-learning) |
| Human-in-the-loop | 0 autonomous financial or compliance actions without review when confidence < threshold |
| Replayability | Any claim's cognitive state reconstructible from `domain_events` alone |
| Backward compatibility | Zero breaking changes to existing routes/schemas/modules |

---

# Section 2 — Overall Architecture

## 2.1 System Context

```
                     ┌────────────────────────────────────────────────────┐
                     │                     ATLAS COGNITIVE ENGINE         │
                     │                                                    │
  USERS              │   ┌────────────┐   ┌──────────────────────────┐    │
 ┌─────────┐         │   │  Cognitive │   │    Cognitive Agents      │    │
 │ Adjuster│─────────┼──▶│ Orchestrator│─▶│ Policy · Evidence ·       │    │
 │ Estimator│        │   │ (planner,  │   │ Financial · Compliance ·  │    │
 │ PM / Mgr│         │   │  scheduler,│   │ Operations · Comms · Doc  │    │
 │ Exec    │         │   │  synthesizer│   │ Intelligence · Recommend  │    │
 │ Admin   │         │   └─────┬──────┘   │ · KG · Conversation        │    │
 └────┬────┘         │         │           └───────┬──────────────────┘    │
      │ REST/WS      │         ▼                   ▼                       │
      ▼              │   ┌──────────────────────────────────────┐          │
 ┌──────────┐        │   │   Shared Cognitive Memory (read-only  │          │
 │ Next.js  │        │   │   composition of existing tables)     │          │
 │ Web app  │        │   └──────────────────────────────────────┘          │
 └────┬─────┘        │   ┌──────────────────────────────────────┐          │
      │ /api/*       │   │   EXISTING ENGINES (never duplicated) │          │
      ▼              │   │ Evidence Graph · Knowledge Graph ·     │          │
 ┌────────────┐      │   │ Decision Engine · Compliance · Doc     │          │
 │ Fastify API│──────┼──▶│ Intelligence · Comms Intelligence ·    │          │
 │ (apps/api) │      │   │ Policy Intelligence · Supplement       │          │
 └────┬───────┘      │   │ Engine · Voice Orchestration           │          │
      │              │   └──────────────────────────────────────┘          │
      ▼              │   ┌──────────────────────────────────────┐          │
 ┌──────────┐        │   │   Data & Services                     │          │
 │ Postgres │        │   │ Supabase Auth · RLS · Storage ·       │          │
 │ (Drizzle)│        │   │ Free AI providers (Gemini + Groq)     │          │
 └──────────┘        │   └──────────────────────────────────────┘          │
                     └────────────────────────────────────────────────────┘
```

## 2.2 Layered Architecture

| Layer | Responsibility | Existing artifacts |
|---|---|---|
| **L0 Presentation** | Dashboards, claim workspace, Ask Atlas, voice UI | `apps/web` (Next.js) — Claim Intelligence tab, Operations tab, AskAtlas |
| **L1 API / BFF** | Route handling, auth, RLS context, server-side compute mirrors | `apps/api` (Fastify) + `apps/web/src/lib/*-server.ts` mirrors |
| **L2 Cognitive Engine** | Orchestration, planning, scheduling, synthesis, explanation, learning | **NEW** — `packages/atlas-engine` (Section 14) |
| **L3 Agents** | Specialist analysis per domain | **NEW** — `packages/atlas-agents`, wrapping existing engines |
| **L4 Existing Engines** | Domain logic & AI | `packages/claim-intelligence` (Phase 2 + 3), `packages/ai`, evidence/document/compliance/supplement services in `apps/api/src/lib` |
| **L5 Data** | Persistence, events, memory | Postgres via Drizzle; `domain_events`, snapshots, extractions, carrier intelligence, digital twins |

**Dependency rule:** layers depend only downward. L2 depends on L3 interfaces and L4; L3 depends on L4; L4 never depends on L2/L3. The web BFF mirrors (L1) may call L4 directly for read-only recompute, exactly as Phase 2/3 do today.

## 2.3 Bounded Contexts

| Bounded Context | Owns | Existing homes |
|---|---|---|
| **Claims** | Claim lifecycle, multi-entry workflow, workspace | `apps/api/src/routes/claims.ts`, claim detail page |
| **Evidence** | Photos, documents, evidence links, evidence graph | `documents.ts`, `photos`, `evidence-links.ts`, `EVIDENCE_GRAPH_SPEC` |
| **Intelligence** | Claim intelligence model, KG, scores, NBA | `packages/claim-intelligence` Phase 2 modules |
| **Operations** | Case manager, lifecycle, financial, dashboards | `packages/claim-intelligence` Phase 3 modules, `/operations` routes |
| **Compliance** | Validation rules, readiness, exceptions | Compliance Validator (Phase 2/3 integration) |
| **Communications** | Notes, extractions, deadlines, promises | `communications.ts`, `notes.ts` |
| **Financial** | Estimates, supplements, recovery math | `financial.ts`, supplements routes |
| **Policy** | Policy extraction, references, limits | Policy Intelligence (document-derived) |
| **Cognition (new)** | Planning, scheduling, synthesis, explanation, learning | `packages/atlas-engine` + `packages/atlas-agents` |

Each bounded context exposes a public contract (types + functions); internal implementation is private.

## 2.4 Package Structure (target)

The production package layout is specified in Section 14. High-level:

```
packages/
  atlas-engine/       # Orchestrator, planner, scheduler, synthesizer, learning  (NEW)
  atlas-agents/       # 10 cognitive agents, thin adapters over existing engines (NEW)
  atlas-memory/       # Shared memory facade over existing tables               (NEW)
  atlas-events/       # Event catalog, bus wrapper, idempotency, replay helpers (NEW)
  atlas-knowledge/    # KG evolution: taxonomy, relationships, traversal        (NEW)
  atlas-scoring/      # Confidence aggregation, weighting, calibration          (NEW)
  claim-intelligence/ # Existing Phase 2/3 engine (unchanged, reused)
  ai/                 # Existing free-provider layer (Gemini + Groq)
  database/           # Existing schemas + migrations
```

## 2.5 Service Responsibilities

| Service | Responsibilities | Anti-responsibilities |
|---|---|---|
| Orchestrator | Plan cycle, schedule agents, retry, timeout, aggregate, synthesize, explain, route to human, learn | Never performs analysis itself |
| Agents | One domain each: analyze inputs, produce typed outputs + confidence + evidence refs | Never orchestrate other agents; never persist directly (memory facade persists) |
| Memory facade | Assemble `ContextBundle` from existing tables; append cycle results | Never owns schema; reads existing tables |
| Event bus | Publish typed events, deliver to subscribers, dedupe, trace | Never does business logic |
| Existing engines | Their existing responsibilities, unchanged | — |

## 2.6 Data Flow (request → response)

```
1. User/event triggers cycle            (POST /cognition/claims/:id/analyze | domain event)
2. Orchestrator loads ContextBundle      (memory facade: claim, docs, photos, evidence,
                                          KG, comms extractions, carrier intel, twin)
3. Planner builds a DAG of agent tasks   (Section 3.3)
4. Scheduler executes DAG                 (parallel where safe, sequential where dependent)
5. Each agent returns AgentResult        (typed output + confidence + evidence refs)
6. Synthesizer aggregates + resolves     (scoring framework, Section 7)
7. Explainer builds traces               (Section 8)
8. Router decides: auto / human review   (thresholds, Section 11)
9. Persistence (best-effort)             (snapshot row, twin refresh via existing paths)
10. Response returned; events emitted    (e.g., cognitive.cycle_completed)
```

## 2.7 Event Flow

```
any existing domain event (claim.created, document.uploaded, supplement.submitted,
communication.added, photo.uploaded, ...)
        │ emitClaimEvent (existing Phase 2 emitter)
        ▼
   domain_events row (audit + replay source)
        │ in-process bus publish
        ▼
   [existing] wireClaimIntelligenceEvents  → persisted Phase 2 snapshot
   [existing] wireOperationsEvents         → twin refresh
   [NEW]      wireCognitiveEvents          → run cognitive cycle (debounced per claim)
        ▼
   cognitive.cycle_started → cognitive.cycle_completed | cognitive.cycle_failed
```

## 2.8 AI Flow

```
Deterministic core first:
  evidence aggregation → lifecycle → financial → opportunities → recommendations (rule-based)
        ▼
Stochastic surface last (grounded in deterministic outputs):
  AI summary (case manager), explanations, conversational answers (Ask Atlas / Voice)
        ▼
  Confidence aggregation (deterministic weights over deterministic + model signals)
        ▼
  Optional learning feedback (outcome → calibration adjustment)
```

## 2.9 Request Flow (synchronous read path)

```
GET /operations/claims/:id            → compute live from bundle (existing behavior)
GET /intelligence/claims/:id/summary  → compute live (existing behavior)
GET /cognition/claims/:id/state       → compute live cognitive state (plan + agents run once, cached in-memory briefly)
```

Read paths never write. Write paths (`POST /analyze`, `POST /refresh`, event-driven cycles) are async and best-effort.

## 2.10 Failure Flow

```
Agent failure (timeout / error / provider outage)
   → retry with backoff (max 2 retries for transient)
   → degrade: deterministic fallback (rule-based) where the agent is stochastic
   → isolate: mark agent result 'degraded', continue DAG with dependents marked 'blocked'
   → persist failure into cycle record (cognitive.cycle_failed or per-agent status)
   → emit monitoring event; surface in UI as "analysis degraded — reason"
```

Never fail the primary workflow because cognition failed (existing best-effort `.catch` pattern).

## 2.11 Why Each Architectural Decision Was Made

| Decision | Rationale |
|---|---|
| Orchestrator is a separate package, not folded into agents | Keeps "who does what" explicit; enables retry/scheduling as one concern |
| Agents are thin adapters over existing engines | Zero duplication; the cognitive layer adds coordination only |
| Memory is a **facade over existing tables**, not a new DB | No migration burden; `domain_events` is already the replayable source of truth |
| Deterministic first, stochastic last | Numbers are always reproducible; LLM only summarizes or explains |
| Read paths always recompute live | UI freshness without invalidation logic (proven in Phase 2/3) |
| Cycles are debounced per claim | Coalesces rapid-fire events; bound compute cost (Phase 3 known-limitation fix) |
| Everything is event-sourced via `domain_events` | Replayability, audit, and learning all fall out of one mechanism |

---

# Section 3 — Atlas Orchestrator

## 3.1 Purpose

The Atlas Orchestrator is the **central scheduling and synthesis service** of the Cognitive
Engine. It decides *what cognitive work to do*, *in what order*, *in parallel or sequence*,
*how to handle failure*, and *how to combine results into a single, ranked, explainable
output*. It never performs specialist analysis itself — that is delegated to the agents of
Section 4.

The Orchestrator lives in `packages/atlas-engine` and is a **pure orchestration core** with
no I/O of its own: all data access goes through the memory facade (Section 6) and all
side effects go through the event adapter (Section 10). This keeps it unit-testable and
replayable.

## 3.2 Responsibilities

The Orchestrator is responsible for:

| Responsibility | Description | Section |
|---|---|---|
| Agent scheduling | Decides which agents run for a given trigger + claim state | 3.3 |
| Dependency management | Builds and executes a DAG of agent tasks | 3.3, 3.4 |
| Parallel execution | Runs independent agents concurrently, bounded by a pool | 3.4 |
| Retry strategy | Retries transient failures with backoff | 3.5 |
| Timeouts | Enforces per-agent and per-cycle deadlines | 3.6 |
| Conflict resolution | Mediates contradictory agent outputs | 3.7 (with Section 7) |
| Confidence aggregation | Combines per-agent confidence into a cycle-level confidence | 3.8 (with Section 7) |
| Result synthesis | Produces a single ranked, deduplicated recommendation set | 3.9 |
| Fallback behavior | Degrades gracefully when agents/engines/providers fail | 3.10 |
| Human review routing | Routes low-confidence/high-stakes outputs to humans | 3.11 (with Section 11) |

## 3.3 The Cognitive Cycle & Planning

A **cognitive cycle** is the unit of orchestrated work triggered by a `CognitiveTrigger`:

```typescript
type CognitiveTrigger =
  | { kind: 'event'; eventType: string; claimId: string; companyId: string; payload: unknown }
  | { kind: 'manual'; claimId: string; companyId: string; requestedBy: string }
  | { kind: 'scheduled'; claimId: string; companyId: string; reason: 'stall-check' | 'deadline-check' | 'daily-digest' };
```

The **Planner** (pure function) maps a trigger + a summary of claim state (`ClaimStateSlim`)
to a **Plan**: an ordered set of `AgentTask`s with declared dependencies.

```typescript
interface AgentTask {
  agent: AgentName;            // 'policy' | 'evidence' | 'financial' | ...
  priority: number;            // execution priority within the plan
  dependsOn: AgentName[];      // DAG edges
  required: boolean;           // cycle fails hard if a required agent fails
  mode: 'deterministic' | 'stochastic';
  timeoutMs: number;
  retries: number;
  inputFilter?: string;        // optional selector into the ContextBundle
}

interface Plan {
  tasks: AgentTask[];
  cycleId: string;
  trigger: CognitiveTrigger;
}
```

Example plans:

| Trigger | Agents (in DAG order) | Notes |
|---|---|---|
| `claim.created` (new claim) | evidence → KG → policy ∥ document-intelligence → compliance → operations → financial → recommendation → conversation(optional) | KG and policy run after evidence; compliance depends on policy; recommendation depends on everything |
| `document.uploaded` | document-intelligence → evidence → KG → policy → compliance → financial → recommendation | Document classification feeds evidence; financial re-runs only if estimate-type doc |
| `supplement.submitted` | operations → financial → compliance → recommendation | Carrier-response/deadline updates; no document work |
| `communication.added` | communications → evidence → operations → recommendation | Deadline extraction feeds case manager |
| `scheduled: stall-check` | operations → recommendation | Cheap daily pass over all active claims |

> **Current event surface (factual):** today only four domain events are emitted —
> `claim.created` (claims route), `document.uploaded` (documents route, which also covers
> photos and estimates — they are documents), `supplement.submitted` (supplements route),
> `communication.added` (notes route). The trigger table above uses only these four.
> Events such as `photo.uploaded`, `estimate.uploaded`, `ocr.completed`, and
> `evidence.link_created` are **planned** (cataloged in PLAT-006) but not yet emitted;
> implementers must not wait for them. Where a plan row says "photo/estimate", the current
> implementation receives `document.uploaded` and must classify the document type first.

**Deterministic agents always run before stochastic agents.** In the DAG this is enforced
by `mode` ordering and by the fact that stochastic agents (conversation) declare dependency
on the deterministic synthesizer output.

## 3.4 The Scheduler & Parallel Execution

- The Scheduler performs a **topological sort** of the DAG and executes it in waves.
- Independent waves run concurrently, bounded by `COGNITIVE_MAX_CONCURRENCY` (default 4).
- Each agent runs in its own isolated async task with its own timeout (Section 3.6).
- Deterministic agents are cheap (ms) and effectively always parallel-safe; stochastic
  agents are rate-limited against the free-provider layer to stay within quota.
- Results are collected into a `CycleResult` map keyed by agent name.

```typescript
interface CycleResult {
  cycleId: string;
  claimId: string;
  companyId: string;
  startedAt: number;
  finishedAt: number;
  agents: Record<AgentName, AgentResult | undefined>;  // undefined = skipped/failed
  synthesized: SynthesizedOutput | null;
  status: 'completed' | 'partial' | 'failed';
  trace: { agent: AgentName; status: 'ok' | 'degraded' | 'failed' | 'skipped'; durationMs: number }[];
}
```

## 3.5 Retry Strategy

- **Transient failures** (network, provider 429/5xx, DB blips): retry with exponential
  backoff — 250 ms, 750 ms, max 2 retries (configurable per agent).
- **Deterministic rule failures** (bad input shape): **no retry** — a defect; record and
  escalate to engineering via a `cognitive.agent_defect` event.
- **Stochastic failures** (provider outage): retry once; on second failure, **fall back**
  to the deterministic rule-based variant of that agent if one exists (e.g., rule-based
  summary instead of LLM summary).
- Retries are **idempotent**: agents are pure functions of the `ContextBundle`, so
  re-running is safe and produces identical deterministic outputs.

## 3.6 Timeouts

| Scope | Default | Notes |
|---|---|---|
| Deterministic agent | 2 000 ms | Rules + scoring are ms-fast; generous bound |
| Stochastic agent (LLM) | 15 000 ms | Free providers can be slow; async summarization recommended |
| Whole cycle (sync) | 20 000 ms | Cycles triggered from HTTP requests must respect caller budget; long cycles go async |
| Whole cycle (async/event) | 120 000 ms | Background cycles can afford more |

On timeout: the agent result is marked `failed` (timeout), dependents are handled per
Section 3.10, and the cycle continues if no `required` agent is affected.

## 3.7 Conflict Resolution

The Orchestrator delegates *semantic* conflict resolution to the Decision Framework
(Section 7) but owns the *mechanics*:

1. **Detect** — the synthesizer compares agent outputs for contradictions (e.g.,
   Financial says "potential recovery $12k" while Compliance says "blocked: missing
   signature").
2. **Weight** — each agent's claim is weighted by its confidence and its domain priority
   (policy/compliance rank above optimization-only claims).
3. **Resolve** — lower-weighted claim yields; the surviving claim is annotated with the
   conflict and the losing alternative is preserved in `rejectedAlternatives` (Section 8).
4. **Escalate** — unresolvable conflicts (equal weight, opposite sign) route to human
   review with both sides presented.

## 3.8 Confidence Aggregation

The Orchestrator computes a **cycle-level confidence** per synthesized recommendation by
combining the contributing agents' confidences with the Decision Framework weights
(Section 7.2). It never invents confidence: if an input is missing, the aggregate drops.

## 3.9 Result Synthesis

The synthesizer produces the single ranked recommendation set:

```typescript
interface SynthesizedOutput {
  recommendations: RankedRecommendation[];   // ranked by score (Section 7.4)
  insights: Insight[];                        // non-actionable observations
  blockers: Blocker[];                        // things preventing action
  summary: { text: string; generator: 'rule' | 'llm'; confidence: number } | null;
  confidence: { overall: number; perAgent: Record<AgentName, number> };
  rejectedAlternatives: RejectedAlternative[];
  cycleRef: { cycleId: string; agentVersion: string; engineVersion: string };
}
```

Deduplication: agents may surface the same action (e.g., "upload roof photos" from both
Evidence and Recommendation agents) — the synthesizer merges by canonical action key,
summing evidence references and keeping the highest confidence.

## 3.10 Fallback Behavior

| Layer | Fallback |
|---|---|
| Agent fails (non-required) | Mark `failed`, record trace, continue |
| Agent fails (required) | Plan degrades: dependents that strictly need it are skipped and flagged `blocked`; cycle status `partial` |
| Stochastic agent fails | Deterministic variant (rule-based summary/explanation) |
| Provider outage (both Gemini + Groq) | All stochastic agents degrade to deterministic; UI shows "AI summaries unavailable — rule-based analysis shown" |
| Memory facade read fails | Cycle aborts safely (`failed`); existing live-compute GET paths still serve the UI |
| Event publish fails | Best-effort `.catch` (existing pattern); cycle result still returned |

## 3.11 Human Review Routing

The Orchestrator routes to human review when (Section 11 details the workflow):

1. Any recommendation's aggregate confidence < `COGNITIVE_HUMAN_THRESHOLD` (default 0.70).
2. Any financial recommendation > `COGNITIVE_FINANCIAL_REVIEW_MIN` (default $5 000).
3. Any compliance blocker present.
4. An unresolved conflict exists.
5. The trigger is `manual` and the requester has `review` role.

Routing emits a `cognitive.review_required` event and persists a review-task row via the
existing task/notification paths (Section 11).

## 3.12 API Surface (design)

The Orchestrator exposes (registered in `apps/api/src/routes/cognition.ts`):

| Endpoint | Purpose |
|---|---|
| `POST /cognition/claims/:claimId/analyze` | Run a full cycle synchronously (or async via `?async=true`), return `CycleResult` |
| `POST /cognition/claims/:claimId/analyze/event` | Internal: trigger cycle from a domain event (used by the wireCognitiveEvents subscriber) |
| `GET /cognition/claims/:claimId/state` | Current cognitive state (last cycle + live recompute) |
| `GET /cognition/cycles/:cycleId` | Retrieve a past cycle result |
| `GET /cognition/agents` | Agent registry (names, versions, health, config) |
| `POST /cognition/config` | Update engine thresholds (admin) |

## 3.13 Orchestrator Acceptance Criteria

- ✅ Given the same trigger + bundle, the same cycle result is produced (deterministic part).
- ✅ Independent agents run concurrently; the DAG ordering is respected.
- ✅ A failed non-required agent never fails the cycle.
- ✅ Timeouts abort only the affected agent.
- ✅ The orchestrator itself contains zero domain logic (only planning/scheduling/synthesis).
- ✅ All outputs carry evidence refs + confidence + traces.

---

# Section 4 — Cognitive Agents

## 4.1 Agent Definition Template

Every agent is defined by the following contract (implemented in `packages/atlas-agents`):

```typescript
interface Agent<In, Out> {
  name: AgentName;
  version: string;
  domain: string;
  deterministic: boolean;            // true = no LLM, always reproducible
  mission: string;
  run(input: In, ctx: AgentContext): Promise<AgentResult<Out>>;
  validateInput?(input: unknown): input is In;
  fallback?(input: In, ctx: AgentContext): AgentResult<Out> | Promise<AgentResult<Out>>;
}

interface AgentContext {
  bundle: ContextBundle;             // shared memory read (Section 6)
  claimId: string; companyId: string;
  traceId: string;                   // observability (Section 10.9)
  provider: AiProviderPort;          // free-provider port (Gemini + Groq)
  emit(event: CognitiveDomainEvent): void;  // via event adapter
}

interface AgentResult<Out> {
  agent: AgentName; version: string;
  output: Out;
  confidence: number;                // 0..1, computed not guessed
  evidence: EvidenceRef[];           // pointers into the evidence corpus
  durationMs: number;
  status: 'ok' | 'degraded' | 'failed';
  error?: { code: string; message: string; retryable: boolean };
}

type EvidenceRef = { kind: 'document' | 'photo' | 'communication' | 'estimate_item' |
  'policy_section' | 'evidence_link' | 'supplement' | 'inspection' | 'event';
  id: string; note?: string };
```

All agents reuse existing engines — none duplicate business logic. The following subsections
define the ten agents using one consistent template. Each lists mission, responsibilities,
inputs, outputs, dependencies, events consumed, events produced, memory, confidence model,
failure handling, escalation rules, performance targets, testing strategy, extensibility.

## 4.2 Policy Agent

| Field | Definition |
|---|---|
| **Mission** | Maintain the authoritative policy picture for a claim: which policy provisions, limits, deductibles, and exclusions apply, and how they bear on recovery. |
| **Responsibilities** | Extract/extend policy references from documents; resolve policy sections cited by other agents; classify policy-driven constraints (coverage limits, code-upgrade eligibility, O&P applicability); answer policy questions for the Conversation agent. |
| **Inputs** | Claim bundle policy fields, policy-type documents + their extractions, carrier intelligence rows, policy references from evidence links. |
| **Outputs** | `PolicyProfile { policyNumber, carrier, coverageSections[], limits[], deductible, exclusions[], codeUpgradeEligible, policyRefs: EvidenceRef[] }` |
| **Dependencies** | Document Intelligence (classify/extract), Evidence Graph (policy links). |
| **Events consumed** | `document.uploaded` (policy docs — classify first). Planned: dedicated `claim.updated` emission for carrier/policy field changes (not emitted today). |
| **Events produced** | `cognitive.policy_updated` (carrier-scoped learning feed). |
| **Memory** | Reads carrier intelligence + snapshot policy sections; writes policy section into snapshot (via existing persistence). |
| **Confidence model** | Rule-based: coverage extraction completeness (0.4), policy doc presence (0.3), cross-source consistency (0.3). Degrades if no policy doc — never assumes. |
| **Failure handling** | Deterministic (no LLM by default); on extraction failure returns partial profile with `confidence=0` gaps flagged. |
| **Escalation rules** | Escalate if limits unknown AND financial recommendation > review threshold; escalate on conflicting policy sections. |
| **Performance targets** | p50 < 50 ms, p95 < 200 ms. |
| **Testing strategy** | Unit: fixture policy docs → profile shape + refs; no-fabrication when policy missing; conflict detection. Integration: seeded policy doc → `/cognition` state shows policy profile. |
| **Extensibility** | Add carrier-specific rules via carrier intelligence rows; swap extraction to LLM (grounded, deterministic fallback retained) behind the provider port. |

## 4.3 Evidence Agent

| Field | Definition |
|---|---|
| **Mission** | Be the single authoritative view of *what evidence exists and what is missing* for a claim. |
| **Responsibilities** | Aggregate documents/photos/inspections/measurements/estimates into the evidence inventory; classify evidence completeness against claim type; identify gaps (roof photos, moisture readings, signature, adjuster comms); flag weak/conflicting evidence (reuses Phase 2 health-monitor risk detection). |
| **Inputs** | Claim bundle (photos, documents, evidence links, inspection data). |
| **Outputs** | `EvidenceAssessment { inventory: EvidenceItem[], gaps: EvidenceGap[], conflicts: EvidenceConflict[], completeness: number, refs }` |
| **Dependencies** | Document Intelligence (classification), Evidence Graph (links), Knowledge Graph (nodes). |
| **Events consumed** | `document.uploaded` (photos are documents today). Planned: `photo.uploaded`, `evidence.link_created` (not emitted yet). |
| **Events produced** | `cognitive.evidence_updated` (feeds KG + compliance + recommendation). |
| **Memory** | Reads evidence graph + KG; contributes evidence refs to cycle record. |
| **Confidence model** | Reuses the Phase 2 six-factor Recovery Readiness weighting: Evidence Quality 25% · Documentation 20% · Policy References 15% · Carrier Response Coverage 15% · Compliance 15% · AI Confidence 10%. |
| **Failure handling** | Deterministic; a failed read → partial inventory with `complete=false`, never blocks cycle (non-required except for KG). |
| **Escalation rules** | Escalate when critical evidence missing AND compliance blocked; escalate conflicting estimates. |
| **Performance targets** | p50 < 80 ms, p95 < 300 ms. |
| **Testing strategy** | Unit: inventory + gap detection per claim type; conflict (two estimates) detection. Integration: photo+doc upload → evidence completeness rises. |
| **Extensibility** | New evidence kinds plug into the taxonomy (Section 9) without agent changes. |

## 4.4 Financial Agent

| Field | Definition |
|---|---|
| **Mission** | Produce explainable financial intelligence for a claim — never fabricated, always derived from real estimates/supplements/approvals. |
| **Responsibilities** | Compute original estimate, carrier approved amount, contractor scope, supplement value, recovered/outstanding revenue, potential recovery, recovery opportunity, confidence (reuses Phase 3 `financial.ts`); detect pricing discrepancies, code-related and O&P opportunities (reuses `revenue-opportunities.ts`). |
| **Inputs** | Estimates, supplements, approvals, claim financial fields, policy constraints. |
| **Outputs** | `FinancialIntelligence` (Phase 3 shape) + `RevenueOpportunity[]` (7 types) — all with source+evidence+confidence. |
| **Dependencies** | Document Intelligence (estimate extraction), Policy Agent (coverage limits), Evidence Agent (invoice/photo corroboration). |
| **Events consumed** | `document.uploaded` (estimates — classify first). Planned: `estimate.uploaded`, `claim.updated`, and `supplement.approved/denied` (today supplements emit `supplement.submitted` on creation). |
| **Events produced** | `cognitive.financial_updated`, `cognitive.opportunity_detected`. |
| **Memory** | Reads carrier intelligence (approval patterns), snapshots (historical amounts), digital twin; writes financial figures into snapshot. |
| **Confidence model** | Data sufficiency + cross-source consistency + policy alignment; **never fabricates** — insufficient data ⇒ `null` figures (Phase 3 rule). |
| **Failure handling** | Deterministic; parse failures flag item-level degradation, keep the rest. |
| **Escalation rules** | Escalate any opportunity > $5 000 or with confidence < 0.70 for human review; always if compliance blocks submission. |
| **Performance targets** | p50 < 60 ms, p95 < 250 ms. |
| **Testing strategy** | Unit: the 89 Phase 3 operations assertions include financial/opportunity math; add cross-agent: policy limit cap applied to opportunity value. Integration: seed estimate+approval → `/cognition` financial matches. |
| **Extensibility** | New opportunity types registered as rules; LLM-assisted pricing review behind provider port (fallback to rules). |

## 4.5 Compliance Agent

| Field | Definition |
|---|---|
| **Mission** | Ensure every recommended action and package is compliance-ready for the claim's jurisdiction and carrier. |
| **Responsibilities** | Run compliance validation (reuse Phase 2/3 compliance integration); evaluate readiness (Ready / Needs Supporting Evidence / Needs Human Review / Blocked); track exceptions; verify required documentation, signatures, policy references, and licensing/scope constraints. |
| **Inputs** | Evidence assessment, policy profile, financial proposal, carrier intelligence compliance notes. |
| **Outputs** | `ComplianceAssessment { status, checks[], exceptions[], blocking: boolean, refs }` |
| **Dependencies** | Evidence, Policy, Financial, Document Intelligence. |
| **Events consumed** | `document.uploaded`, `supplement.submitted`, `cognitive.policy_updated`, `cognitive.evidence_updated`. |
| **Events produced** | `cognitive.compliance_updated`, `cognitive.compliance_blocked` (routes to human). |
| **Memory** | Reads compliance rules + exceptions history; writes check results into snapshot. |
| **Confidence model** | Rule coverage + evidence sufficiency; a blocker forces overall low confidence regardless of other factors. |
| **Failure handling** | Deterministic; rule-load failure degrades to 'needs human review' (safe default). |
| **Escalation rules** | Any `Blocked` status routes to human; unresolved exceptions escalate to compliance reviewer. |
| **Performance targets** | p50 < 70 ms, p95 < 300 ms. |
| **Testing strategy** | Unit: checklist matrix per claim type; blocked-state routing. Integration: incomplete claim → blocked → review task created. |
| **Extensibility** | Rules live in the compliance rules engine; agent adds no new rule logic. |

## 4.6 Operations Agent

| Field | Definition |
|---|---|
| **Mission** | Continuously assess operational state of a claim: stage, stall, deadlines, health, priority — the case-manager view. |
| **Responsibilities** | Determine lifecycle stage (12-stage, entry-point aware — Phase 3 `lifecycle.ts`); detect stalled claims (14-day rule); manage deadlines (21-day carrier expectations + comms-extracted deadlines); compute priority score (0–100); produce AI case-manager summary. |
| **Inputs** | Claim status + timeline, communications extractions (deadlines/promises), supplements (submission/response dates), events history. |
| **Outputs** | `CaseManagerReport` (Phase 3 shape) + `LifecycleInfo` (12 stages, next stage, missing requirements, blocking issues, recommended actions). |
| **Dependencies** | Communications, Evidence, Financial, Compliance (their outputs enrich the summary). |
| **Events consumed** | All claim-domain events (via `*` subscriber), `scheduled: stall-check`. |
| **Events produced** | `cognitive.claim_stalled`, `cognitive.deadline_approaching`, `cognitive.priority_changed`. |
| **Memory** | Reads digital twin (last snapshot) for baseline; writes updated case-manager output. |
| **Confidence model** | Stage-inference certainty + data freshness + evidence completeness (weighted). |
| **Failure handling** | Deterministic stage/math; LLM summary has rule fallback (template summary). |
| **Escalation rules** | Escalate stalled claims (14+ days) and deadline-risk claims to assignees; priority ≥ 80 auto-attention. |
| **Performance targets** | p50 < 60 ms, p95 < 300 ms (rule path); summary async. |
| **Testing strategy** | Unit: the 89 Phase 3 assertions (stall, deadlines, priority, closed-never-regresses). Integration: overdue supplement → `claim_stalled` event. |
| **Extensibility** | New stages/config via lifecycle config, no agent change. |

## 4.7 Communications Agent

| Field | Definition |
|---|---|
| **Mission** | Extract structured intelligence from every claim communication so other agents can act on promises, deadlines, requests, and carrier signals. |
| **Responsibilities** | Deterministic regex extraction of claim/policy numbers, dates, names, addresses, damage descriptions, promises, requested documents, deadlines (reuse Phase 2 `communications.ts`); classify carrier vs customer vs internal; maintain a per-claim communications summary. |
| **Inputs** | Notes/comms rows (or their `communication_extractions`). |
| **Outputs** | `CommunicationsIntelligence { extractions: ExtractedEntity[], carrierSignals: CarrierSignal[], summary, refs }` |
| **Dependencies** | None (leaf agent). |
| **Events consumed** | `communication.added`. |
| **Events produced** | `cognitive.communications_updated` (deadlines/promises feed Operations + Recommendation). |
| **Memory** | Writes `communication_extractions` (existing table) — the extraction store. |
| **Confidence model** | Regex-match certainty + source quality + entity cardinality; unparsed free-text ⇒ lower confidence. |
| **Failure handling** | Deterministic; zero matches is a valid result (no fabrication). |
| **Escalation rules** | Rarely escalates directly; escalates on explicit carrier deadline language in high-stakes claims. |
| **Performance targets** | p50 < 40 ms, p95 < 150 ms. |
| **Testing strategy** | Unit: Phase 2 49-assertion suite (extraction correctness incl. hyphenated numbers, promises, deadlines, confidence, context). Integration: seeded note → extraction rows + deadline surfaced in case manager. |
| **Extensibility** | New regex rules / LLM-assisted extraction behind provider port (fallback to regex). |

## 4.8 Document Intelligence Agent

| Field | Definition |
|---|---|
| **Mission** | Turn documents into structured claim knowledge: classification, extraction, and intelligence reuse — without owning OCR. |
| **Responsibilities** | Classify documents (reuse `classifyDocument` from Phase 2); trigger/consume OCR results; surface extracted entities (estimates, invoices, policy, reports) into the bundle; flag duplicates/conflicts (Phase 2 health monitor). |
| **Inputs** | Document metadata + OCR/extraction results; evidence graph links. |
| **Outputs** | `DocumentIntelligence { classified: Classification[], extractions: DocExtraction[], duplicates: Ref[], conflicts: Ref[], refs }` |
| **Dependencies** | Evidence Graph (document nodes), OCR service (existing). |
| **Events consumed** | `document.uploaded` (drives classification). Planned: `ocr.completed`, `document.classification_completed` (not emitted today). |
| **Events produced** | `cognitive.document_intelligence_updated`. |
| **Memory** | Reads extraction tables; writes classification into snapshot + evidence links (existing paths). |
| **Confidence model** | OCR confidence + classifier certainty + cross-doc consistency. |
| **Failure handling** | If OCR pending → output `status: 'pending'`; cycle marks it non-blocking (documents keep flowing). |
| **Escalation rules** | Duplicate/conflicting critical documents (estimates) escalate to evidence agent + human review. |
| **Performance targets** | p50 < 100 ms, p95 < 400 ms (excluding OCR itself, which is async). |
| **Testing strategy** | Unit: classification fixtures; duplicate detection. Integration: upload estimate → classification + evidence link. |
| **Extensibility** | New document types via classification taxonomy; no agent rewrite. |

## 4.9 Recommendation Agent

| Field | Definition |
|---|---|
| **Mission** | Produce the ranked, explainable set of next-best actions for a claim by merging all specialist inputs — the final decision-support output. |
| **Responsibilities** | Merge rule-based NBA (Phase 2 `next-best-actions.ts`) + operational recommendations (Phase 3 `ops-recommendations.ts`) + financial opportunities; deduplicate to canonical actions; rank by score (Section 7.4); attach evidence, business impact, required action, confidence. |
| **Inputs** | Outputs of all other agents + synthesizer weights. |
| **Outputs** | `RankedRecommendation[]` — the core deliverable of the cycle. |
| **Dependencies** | Every other agent (runs last among deterministic agents). |
| **Events consumed** | All `cognitive.*_updated` events (recomputes when any input changes). |
| **Events produced** | `cognitive.recommendations_updated`, `cognitive.review_required` (via router). |
| **Memory** | Reads cycle results; writes recommendation snapshot rows (existing snapshot table). |
| **Confidence model** | Aggregated per Section 7.2 (component confidences × weights, decayed by staleness). |
| **Failure handling** | Deterministic merge; a missing input agent degrades that recommendation's confidence (never invents). |
| **Escalation rules** | Threshold routing (Section 3.11). |
| **Performance targets** | p50 < 80 ms, p95 < 300 ms. |
| **Testing strategy** | Unit: merge/dedup/ranking; conflicting-input handling. Integration: full cycle → ranked recommendations present. |
| **Extensibility** | New recommendation producers register canonical action keys. |

## 4.10 Knowledge Graph Agent

| Field | Definition |
|---|---|
| **Mission** | Maintain the claim's knowledge graph so every agent and the UI can navigate typed entities and relationships. |
| **Responsibilities** | Build/refresh the typed KG (reuse Phase 2 `knowledge-graph.ts`); add cross-claim and portfolio relationships (Section 9); expose traversal queries for other agents; version graphs per cycle. |
| **Inputs** | Evidence assessment, document intelligence, communications extractions, policy profile, twin aggregate. |
| **Outputs** | `KnowledgeGraph` (nodes + typed edges) + traversal handles. |
| **Dependencies** | Evidence, Document Intelligence, Communications, Policy. |
| **Events consumed** | `cognitive.evidence_updated`, `cognitive.document_intelligence_updated`, `cognitive.communications_updated`, `cognitive.policy_updated`. |
| **Events produced** | `cognitive.knowledge_graph_updated`. |
| **Memory** | Reads/writes snapshot KG; supports graph versioning via cycle refs. |
| **Confidence model** | Node/edge source confidence (inherit from contributing agents). |
| **Failure handling** | Deterministic; a missing contributor yields a smaller graph, not a failed cycle. |
| **Escalation rules** | Never escalates directly. |
| **Performance targets** | p50 < 120 ms, p95 < 400 ms (per claim). |
| **Testing strategy** | Unit: Phase 2 KG assertions (typed nodes, unique IDs, edges); add portfolio-relationship fixtures. Integration: `/cognition` state embeds navigable KG. |
| **Extensibility** | Taxonomy extension (Section 9.2) without agent change. |

## 4.11 Conversation Agent

| Field | Definition |
|---|---|
| **Mission** | Power the Ask Atlas conversational surface (web + voice) with grounded, evidence-backed answers — never answering outside the claim/company corpus. |
| **Responsibilities** | Route questions to the right engine or cognitive state (reuse the existing Ask Atlas orchestrator + AI routing); assemble context (Section 6.6); call the free-provider layer for natural language; ground responses in evidence refs; fall back to deterministic answers (dashboards/state) when providers are down. |
| **Inputs** | User utterance (+ voice session context), claim/company cognitive state, retrieved memory. |
| **Outputs** | `ConversationAnswer { text, groundedRefs: EvidenceRef[], confidence, followUps?, source: 'llm' | 'rules' }` |
| **Dependencies** | All other agents (for grounding); Memory facade (retrieval); provider port. |
| **Events consumed** | Planned (not emitted today): `voice.session_started` (voice sessions exist; the event emission is cataloged in PLAT-006), `conversation.message_received` (defined by this engine's contract). The agent may also be invoked directly by the Ask Atlas orchestrator without an event. |
| **Events produced** | `cognitive.answered`, `conversation.feedback` (learning loop). |
| **Memory** | Reads conversation memory + claim/company memory (Section 6); appends session summaries. |
| **Confidence model** | Retrieval relevance + provider confidence + grounding overlap; refuses when evidence is absent ("I can't find evidence for that"). |
| **Failure handling** | Provider outage → rule-based answer (state summary, dashboards); never hallucinates numbers. |
| **Escalation rules** | Sensitive/legal questions route to human; unrecognized intents suggest the closest valid intent. |
| **Performance targets** | p50 < 1.5 s, p95 < 6 s (LLM path); streaming for long answers. |
| **Testing strategy** | Unit: grounding checks (no answer without refs for factual questions); fallback behavior. Integration: Ask Atlas question → grounded answer + feedback capture. |
| **Extensibility** | New intents register in the existing orchestrator; voice reuses the same agent. |

## 4.12 Agent Interaction Diagram (summary)

```
                 ┌────────────────────────────────────────────────────┐
                 │              Cognitive Orchestrator               │
                 │   planner → scheduler → synthesizer → router      │
                 └────────────────────────────────────────────────────┘
     Wave 1 (parallel):          Wave 2 (after 1):      Wave 3 (after 2):
   ┌───────────────┐          ┌─────────────────┐      ┌──────────────────────┐
   │ Communications│          │ Knowledge Graph │      │ Recommendation Agent │
   │ Document Intel│───▶      │ Compliance      │      └──────────┬───────────┘
   │ Evidence      │          │ Operations      │                 │
   └───────────────┘          │ Financial       │      ┌──────────▼───────────┐
            │                 └────────┬────────┘      │ Synthesizer + Router │
            ▼                          │               │ → review routing     │
   ┌────────────────┐                  │               └──────────────────────┘
   │ Policy Agent   │──────────────────┘
   └────────────────┘        (conversation runs last, stochastic, async-capable)
```

---

# Section 5 — Agent Communication

## 5.1 Communication Model

Agents communicate **only through the Orchestrator** (hub-and-spoke). There is no direct
agent-to-agent call: an agent that needs another's output declares a DAG dependency, and
the Orchestrator provides the upstream result in its input. This gives:

- **Failure isolation** — a failing agent only affects its declared dependents.
- **Replayability** — the full conversation of a cycle is the sequence of inputs/outputs,
  recorded in the cycle record.
- **Testability** — every agent is a pure function of `(input, ctx)`.

## 5.2 Message Contracts

### Request/response (synchronous, in-cycle)

```typescript
interface AgentRequest {
  cycleId: string; agent: AgentName;
  input: unknown;                      // typed per agent
  context: AgentContext;               // bundle + trace + provider + emit
  deadlineMs: number;                  // computed by scheduler
  attempt: number;                     // retry counter
}

interface AgentResponse {
  cycleId: string; agent: AgentName;
  result: AgentResult<unknown>;        // output + confidence + evidence + status
}
```

### Out-of-cycle (asynchronous) — cognitive domain events

```typescript
interface CognitiveDomainEvent {
  eventId: string;                     // uuid; idempotency key
  eventType: CognitiveEventType;       // 'cognitive.cycle_completed' | ...
  companyId: string; claimId: string;
  entityType: 'claim'; entityId: string;
  traceId: string;                     // correlation across the chain
  payload: Record<string, unknown>;
  createdAt: string;                   // ISO
  version: number;                     // event schema version
}
```

All cognitive events follow the existing `domain_events` shape (PLAT-006) so they reuse the
existing persistence and replay machinery without schema changes. **Naming note:** the
interface above uses `companyId`; the PLAT-006 envelope and the `domain_events` table use
`organizationId` / `company_id` respectively — all refer to the same tenant field, and the
adapter maps them at the edge.

## 5.3 Shared Context

The `ContextBundle` (Section 6.2) is the single shared read context for a cycle. It is
**immutable during a cycle** — agents never mutate it. Mutations (persisted extractions,
snapshots, twins) happen through the memory facade's write port after the cycle, or through
existing persistence paths, so concurrent agents cannot corrupt each other's view.

## 5.4 Conflict Handling

- Agents never resolve conflicts with each other directly.
- The synthesizer collects contradictions (Section 3.7) and the Decision Framework resolves
  them (Section 7.3).
- Both sides of any resolved conflict are preserved in `rejectedAlternatives` (Section 8.4).

## 5.5 Priority Rules

Within a plan:

1. **DAG order wins** — a dependent never starts before its dependencies complete.
2. **Deterministic before stochastic** — enforced by mode ordering.
3. **Required agents before optional** — required agents get scheduling priority so a cycle
   failure is detected early.
4. **Budget fairness** — each agent has a compute budget; no agent starves the pool.

## 5.6 Agent Discovery

A static **registry** (compile-time, plus a runtime health endpoint):

```typescript
const AGENT_REGISTRY: Record<AgentName, Agent<unknown, unknown>> = {
  policy: policyAgent, evidence: evidenceAgent, financial: financialAgent,
  compliance: complianceAgent, operations: operationsAgent, communications: communicationsAgent,
  'document-intelligence': documentIntelligenceAgent, recommendation: recommendationAgent,
  'knowledge-graph': knowledgeGraphAgent, conversation: conversationAgent,
};
```

Discovery is explicit (no dynamic plugin loading in MVP). The `GET /cognition/agents`
endpoint exposes name, version, health (last cycle outcomes), and config for ops visibility.
The registry is the extension point for new agents (Section 4.1 contract + registry entry +
planner mapping).

## 5.7 Versioning

- **Agent version** — semver; `run` may change behavior; planner records the agent version
  used per cycle (`cycleRef.agentVersion`), so explanations and learning can point at the
exact code that produced a result.
- **Event schema version** — each cognitive event carries `version`; consumers tolerate
  older versions (additive evolution), and unknown event types are logged + ignored
  (forward compatible), matching PLAT-006 event-versioning guidance.
- **Contract compatibility** — changing an agent's input/output type is a major version
  bump; the orchestrator validates agent contracts at startup against the registry schema.

## 5.8 Failure Isolation

- Each agent runs in an isolated async task with its own timeout, retry budget, and error
  capture (Section 3.5–3.6).
- A failed agent returns a structured `AgentResult` with `status:'failed'`; it never throws
  out of the cycle.
- Memory writes are best-effort `.catch` (existing pattern) — a persistence failure never
  fails the cycle.
- Provider calls are behind the `AiProviderPort`; an outage degrades stochastic agents
  only (Section 3.10).

---

# Section 6 — Shared Memory

## 6.1 Design Principle

The Cognitive Engine has **no private database**. Its memory is a **facade over the existing
persistence**: `domain_events`, `claim_intelligence_snapshots`, `communication_extractions`,
`carrier_intelligence`, `digital_twins`, and the future Memory Engine tables. This preserves
auditability, avoids migration churn, and makes replay trivial.

## 6.2 Working Memory

The per-cycle in-process context: the immutable `ContextBundle`.

```typescript
interface ContextBundle {
  claim: ClaimSlim;                    // id, status, stage-relevant fields, dates
  financial: { estimates: EstimateSlim[]; supplements: SupplementSlim[]; approvals: ApprovalSlim[] };
  evidence: { photos: PhotoSlim[]; documents: DocumentSlim[]; evidenceLinks: EvidenceLinkSlim[] };
  communications: { notes: NoteSlim[]; extractions: ExtractedEntity[] };
  policy: PolicyProfile | null;
  knowledgeGraph: KnowledgeGraph | null;
  carrier: CarrierIntelligence | null;
  twin: DigitalTwin | null;            // last persisted twin (baseline)
  lastSnapshot: ClaimIntelligenceSnapshot | null;
  companyContext: { companyId: string; role: string; config: EngineConfig };
}
```

Assembled by the memory facade in **≤ 8 queries** (mirroring the Phase 3 bulk loader's
no-N+1 approach), then frozen for the cycle.

## 6.3 Memory Kinds & Where They Live

| Memory kind | Definition | Backing store |
|---|---|---|
| **Working memory** | Current cycle context | In-process `ContextBundle` |
| **Long-term memory** | Organizational knowledge (SOPs, lessons) | Memory Engine tables (per `ATLAS_MEMORY_ENGINE_SPEC`) |
| **Conversation memory** | Ask Atlas / voice session context | Conversation history / voice session tables |
| **Claim memory** | Per-claim intelligence history | `claim_intelligence_snapshots` + `digital_twins` |
| **Company memory** | Cross-claim carrier/team knowledge | `carrier_intelligence` + Memory Engine company memory |
| **Agent memory** | Per-agent facts/versions per cycle | Cycle records + snapshots (agent version, outputs) |
| **Historical memory** | The event log | `domain_events` |
| **Decision memory** | Past decisions + outcomes | Decision records (DECISION_CONFIDENCE_ENGINE_SPEC) + snapshots |

## 6.4 Memory Lifecycle

The engine follows the existing lifecycle: **Captured → Validated → Indexed → Embedded →
Retrieved → Referenced → Updated → Archived** (from `ATLAS_MEMORY_ENGINE_SPEC`). The
cognitive cycle uses it as follows:

1. **Captured** — new claim data arrives (event) → cycle runs.
2. **Validated** — deterministic agents cross-check the data (conflict detection).
3. **Indexed / Embedded** — extraction rows + (future) embeddings are written best-effort.
4. **Retrieved** — next cycle's `ContextBundle` reads them.
5. **Referenced** — recommendations cite `EvidenceRef`s.
6. **Updated** — snapshots/twins refreshed.
7. **Archived** — retention policy (Section 6.8).

## 6.5 Memory Indexing

- **Structured index** — existing foreign keys: claim_id, company_id, event_type, dates.
- **Semantic index (future)** — embeddings on snapshots/extractions per the Embedding
  Strategy spec; not required for Phase 4A–4D.
- **Cycle index** — cycle records link to the contributing events (`traceId` + eventIds), so
  any recommendation can be traced to the exact event that triggered its cycle.

## 6.6 Memory Invalidation

- **Event-based invalidation** — a new event for a claim invalidates that claim's cached
  context; the next cycle re-reads fresh (no manual invalidation, matching Phase 2/3
  live-recompute behavior).
- **Freshness metadata** — every bundle read records `loadedAt`; staleness is surfaced to
  agents (they may lower confidence if data is old, per agent rules).
- **Snapshot churn** — snapshots are append-only; the history endpoint caps at 50 rows
  (existing Phase 2 behavior).

## 6.7 Memory Retention & Compression

| Store | Retention | Compression |
|---|---|---|
| `domain_events` | Company-configurable (default keep-all for demo) | Payload JSONB — compress only large OCR/embeddings fields |
| `claim_intelligence_snapshots` | Prune > N days (background job; existing roadmap item) | Keep summary columns + full model in JSONB (current) |
| `digital_twins` | Latest snapshot per claim (current behavior) | Twin JSONB — drop after new snapshot write |
| `communication_extractions` | Tied to source note lifecycle | Row per entity (already compact) |
| `carrier_intelligence` | Accumulate; version on update | Summarized per carrier |
| Cycle records | Configurable (default 90 days) | Keep trace + synthesized output; drop full agent payloads older than 30 days |

## 6.8 Memory API (facade) — design

`packages/atlas-memory` exposes:

```typescript
interface MemoryFacade {
  loadContext(claimId: string, companyId: string, traceId: string): Promise<ContextBundle>;
  appendCycle(record: CycleRecord): Promise<void>;                 // best-effort
  appendExtraction(row: ExtractionRow): Promise<void>;             // via existing path
  refreshTwin(claimId: string, twin: DigitalTwin): Promise<void>;  // existing persist
  queryEvents(filter: EventFilter): Promise<DomainEventRow[]>;
  retrieveLongTerm(query: string, opts: RetrievalOpts): Promise<MemoryHit[]>; // future
}
```

---

# Section 7 — Decision Framework

## 7.1 Purpose

The Decision Framework is the deterministic layer that turns raw agent outputs into
trusted, ranked, reviewable recommendations. It reuses the Decision & Confidence Engine
methodology (`DECISION_CONFIDENCE_ENGINE_SPEC`) — this section specifies how the Cognitive
Engine applies it across agents.

## 7.2 Decision Scoring & Confidence Aggregation

Per recommendation, the synthesizer computes:

```
score(recommendation) = Σ_agents (agentWeight[agent] × agentConfidence × recRelevance[agent])
                         × freshness × policyWeight
```

Where:

- `agentWeight` — configurable per agent (defaults below; sum = 1 across contributing agents).
- `agentConfidence` — that agent's own confidence in its output (0..1).
- `recRelevance` — how central that agent is to this specific action (e.g., financial is
  central to "generate supplement", compliance to "submit package").
- `freshness` — decay by age of underlying data (1.0 fresh → 0.7 stale).
- `policyWeight` — 1.0 normally; >1.0 for actions explicitly enabled by the policy profile
  (e.g., code-upgrade eligible); capped at 1.2.

Default agent weights (configurable):

| Agent | Weight | Rationale |
|---|---|---|
| Policy | 0.15 | Constraints shape eligibility |
| Evidence | 0.20 | Every action needs evidence |
| Financial | 0.20 | Monetary impact is central |
| Compliance | 0.20 | Blockers trump all |
| Operations | 0.10 | Stage/timing context |
| Communications | 0.05 | Secondary signals |
| Document Intelligence | 0.10 | Input quality |

## 7.3 Conflict Resolution

Resolution policy (mechanics in Section 3.7):

1. **Compliance veto** — a `Blocked` compliance status vetoes the action regardless of
   score (unless a human override exists).
2. **Evidence floor** — an action with zero supporting evidence refs is never
   auto-approved; it must route to review.
3. **Weighted majority** — conflicting recommendations resolve by comparing
   `agentWeight × confidence`; the higher wins; the loser → `rejectedAlternatives`.
4. **Escalate ties** — equal-weight conflicts escalate to human review.

## 7.4 Recommendation Ranking

Final rank: sort by `score` desc, then priority (Phase 3 `priority` field), then estimated
business impact desc, then confidence desc. The top-N (default 5) are surfaced as the
recommendation feed; the rest are available on demand.

## 7.5 Human Review Thresholds

Defaults (configurable per company):

| Signal | Threshold → Review |
|---|---|
| Aggregate confidence | < 0.70 |
| Financial exposure | ≥ $5 000 |
| Compliance status | `blocked` |
| Conflict | unresolved tie |
| New opportunity type | first occurrence of a type (learning gate) |

## 7.6 Learning Opportunities

The engine records every cycle + outcome to learn (Phase 4F):

- Predicted confidence vs actual outcome (accept/reject/modify/settle) → **calibration**
  adjustments (per agent, per carrier, per claim type).
- Recommendation action taken/not taken → **acceptance rates** per canonical action.
- Feedback reasons → **rule tuning** suggestions surfaced to admins.
- Performance: cycle latency, agent failures → **scheduler tuning** (weights, concurrency,
  retries).

Learning is always **offline and audited** — never silently changes live behavior; proposed
changes are diffed and activated via `POST /cognition/config` with an audit record.

## 7.7 Auditability

Every recommendation carries a stable `recommendationId`, the `cycleRef` (cycle + agent +
engine versions), the evidence refs, the score breakdown (`scoreCard`), and the events that
triggered the cycle. This is sufficient to reproduce the decision from the event log alone.

---

# Section 8 — Explainability

## 8.1 Requirement

Every recommendation must answer, at minimum:

1. **Why** was this identified?
2. **Which evidence** supports it?
3. **Which policy** references apply?
4. **Which estimate** items contribute?
5. **Which communication** signals support it?
6. **Which agent** produced it (and version)?
7. **How confident** is Atlas, and why?
8. **What alternatives** exist?
9. **Which alternatives were rejected**, and why?

This extends the Phase 2 `explain/:actionId` endpoint pattern to the full cycle.

## 8.2 Explanation Trace Model

```typescript
interface ExplanationTrace {
  recommendationId: string;
  action: string;                     // canonical action key
  why: string;                        // human-readable reason
  evidence: EvidenceRef[];            // (2)
  policyRefs: { section: string; text: string; confidence: number }[];   // (3)
  estimateItems: { lineItem: string; amount: number; contributes: boolean }[]; // (4)
  communications: { noteId: string; extracted: string }[];               // (5)
  agents: { agent: AgentName; version: string; confidence: number }[];   // (6)
  confidence: { overall: number; breakdown: Record<string, number>; reason: string }; // (7)
  alternatives: AlternativeAction[];   // (8)
  rejectedAlternatives: RejectedAlternative[]; // (9) + why rejected
  scoreCard: Record<string, number>;   // scoring inputs (Section 7.2)
  cycleRef: { cycleId: string; trigger: CognitiveTrigger; engineVersion: string };
}
```

## 8.3 Generation Rules

- **Deterministic first** — the `why`, evidence refs, score breakdown, and rejected
  alternatives are computed by rules; they exist even if the LLM explanation fails.
- **LLM polish, grounded** — the conversational prose ("Because the estimate excludes
  insulation replacement while photos show moisture intrusion…") is generated only from the
  structured trace (no free-form reasoning), so it can never contradict the facts.
- **Never-fabricate** — if an answer component has no data, it says so ("no policy document
  on file") rather than inventing.

## 8.4 Rejected Alternatives

```typescript
interface RejectedAlternative {
  action: string;
  suggestedBy: AgentName;
  rejectedBecause: 'lower-score' | 'conflict-lost' | 'compliance-veto' | 'insufficient-evidence';
  scoreAtRejection: number;
}
```

Preserving rejected alternatives is what makes recommendations **auditable decisions**, not
just suggestions.

## 8.5 UI Surface (for implementers)

The existing Claim Intelligence *explain* panel and Operations panel already render
why/evidence/confidence. The cognitive layer adds: agent attribution chips, scoreCard
breakdown, and a "view rejected alternatives" disclosure — implemented without new
components beyond these extensions.

## 8.6 Success Metrics

- 100% of recommendations carry a full `ExplanationTrace`.
- 0 cases where LLM prose contradicts the structured trace (tested in CI).
- Explanation generation adds < 150 ms deterministic overhead.

---

# Section 9 — Knowledge Graph Evolution

## 9.1 Principle

The cognitive engine reuses the Phase 2 typed Knowledge Graph (`knowledge-graph.ts`,
node/edge model with unique IDs). Section 9 **extends the taxonomy** so cognition can
express cross-claim and portfolio semantics; it does not replace the graph.

## 9.2 Node Taxonomy

Existing nodes (Phase 2): `customer`, `property`, `claim`, `policy`, `carrier`, `photo`,
`document`, `estimate`, `supplement`, `inspection`, `communication`, `evidence`.

New cognitive nodes:

| Node type | Meaning | Example |
|---|---|---|
| `opportunity` | A detected revenue opportunity | `opportunity:code-upgrade` |
| `recommendation` | A ranked action | `recommendation:generate-supplement` |
| `risk` | An open risk/blocker | `risk:missing-signature` |
| `deadline` | A tracked deadline | `deadline:carrier-response-2026-09-01` |
| `carrier-signal` | A carrier behavior signal | `carrier-signal:requests-moisture-readings` |
| `lesson` | A learned outcome (Phase 4F) | `lesson:supplement-approval-pattern` |
| `portfolio-metric` | Company-level aggregate | `portfolio-metric:carrier-revenue-concentration` |

## 9.3 Relationship Taxonomy

Existing edge types (Phase 2): typed semantic edges (`customer->claim`, `claim->document`,
`document->evidence`, etc.).

New relationship types:

| Relationship | From → To | Meaning |
|---|---|---|
| `supports` | evidence/photo/doc → opportunity | Evidence underpins an opportunity |
| `triggers` | event/evidence → recommendation | What caused the action |
| `blocks` | risk → recommendation | Blocker relationship |
| `derived-from` | recommendation → opportunity/financial | Provenance |
| `contributes-to` | estimate-item → financial-figure | Line-item attribution |
| `relates-to` | claim → claim (cross-claim) | Similar/same-property claims |
| `concentrates` | carrier → portfolio-metric | Revenue concentration |
| `learned-from` | lesson → claim (outcome) | Learning provenance |
| `degraded-to` | recommendation → alternative | Rejected alternative edge |

## 9.4 Semantic, Evidence, Policy, Financial, Temporal Relationships

- **Semantic** — existing typed edges extended with `reason` + `confidence` metadata.
- **Evidence** — every opportunity/recommendation node carries `supports` edges to its
  evidence refs (bidirectional with Section 8 trace).
- **Policy** — `policy-section` nodes connect to opportunity/recommendation nodes via
  `enables` / `constrains` edges (e.g., code-upgrade eligibility).
- **Financial** — estimate-item and supplement nodes link to financial figures with
  `contributes-to`; the graph mirrors `financial.ts` sources.
- **Temporal** — timeline edges (`before`, `after`, `on`) from claim events; the graph
  supports "was this deadline missed?" queries.

## 9.5 Cross-Claim & Portfolio Relationships

- **Cross-claim** — `relates-to` edges built from shared property, customer, carrier,
  policy number, or learned similarity (Phase 4E). Enables "same property, prior claim"
  queries.
- **Portfolio** — a lightweight portfolio graph aggregates nodes per company (carrier
  concentration, common gaps) by folding `portfolio.ts` outputs into the graph — computed
  on demand, never persisted as a second source of truth.

## 9.6 Traversal Strategies

| Query | Strategy | Example |
|---|---|---|
| Evidence chain | BFS over `supports`/`triggers` | "Why this recommendation?" → walk back to events/docs |
| Blocker path | Shortest path over `blocks` | "What blocks submission?" |
| Similar claims | k-similarity over `relates-to` | "Find like claims" |
| Provenance | Reverse `derived-from` | "Where did this figure come from?" |
| Portfolio drill-down | Fold + filter | Revenue dashboard → claim drill-down |

Traversal is exposed via the KG agent (Section 4.10) and the existing `GET
/intelligence/claims/:claimId/knowledge-graph` endpoint (extended shape, additive).

## 9.7 Graph Versioning

- The graph is **recomputed per cycle** from current data (consistent with live-recompute
  philosophy).
- Version metadata = `cycleRef`; the snapshot table stores the graph JSON per cycle, so
  historical graphs are recoverable from snapshots.
- No separate graph storage or migration is required.

---

# Section 10 — Event Architecture

## 10.1 Principle

Reuse the existing event bus (`packages/claim-intelligence/src/event-bus.ts` in-process
pub/sub) and the `domain_events` persistence from Phase 2. The cognitive layer **adds a
catalog, idempotency, replay helpers, and tracing** — it does not introduce a new bus.

## 10.2 Event Catalog (cognitive domain)

All events follow the existing shape: `{ eventId, eventType, organizationId/companyId,
entityType, entityId, payload, createdAt }` (PLAT-006).

| Event | Producer | Consumers | Purpose |
|---|---|---|---|
| `cognitive.cycle_started` | Orchestrator | Observability, audit | Cycle begun for claim |
| `cognitive.cycle_completed` | Orchestrator | UI refresh (via events), analytics, learning feed | Cycle finished; payload = synthesized output summary |
| `cognitive.cycle_failed` | Orchestrator | Monitoring, alerts | Cycle failed/partial |
| `cognitive.review_required` | Router | Notifications, task creation | Human review needed (Section 11) |
| `cognitive.policy_updated` | Policy agent | Compliance, KG, carrier learning | Policy profile changed |
| `cognitive.evidence_updated` | Evidence agent | KG, compliance, recommendation | Evidence state changed |
| `cognitive.financial_updated` | Financial agent | Recommendation, dashboards | Financial figures changed |
| `cognitive.opportunity_detected` | Financial agent | Recommendation, notifications | New revenue opportunity |
| `cognitive.compliance_updated` / `cognitive.compliance_blocked` | Compliance agent | Recommendation, review routing | Compliance state |
| `cognitive.claim_stalled` | Operations agent | Notifications, dashboards | Stall detected |
| `cognitive.deadline_approaching` | Operations agent | Notifications | Deadline risk |
| `cognitive.priority_changed` | Operations agent | Dashboards | Priority moved |
| `cognitive.communications_updated` | Communications agent | Operations, recommendation | New extractions |
| `cognitive.document_intelligence_updated` | Doc Intel agent | Evidence, KG | Document analysis done |
| `cognitive.knowledge_graph_updated` | KG agent | UI, other agents | Graph refreshed |
| `cognitive.recommendations_updated` | Recommendation agent | UI, notifications | New ranked actions |
| `cognitive.answered` | Conversation agent | Conversation history | An answer was produced |
| `cognitive.agent_defect` | Orchestrator | Engineering alerts | Deterministic agent bug |

## 10.3 Event Naming

`<domain>.<past-tense-verb>` (e.g., `cognitive.cycle_completed`), matching existing Atlas
conventions (`claim.created`, `document.uploaded`). Cognitive events are versioned via the
`version` field for additive evolution (Section 5.7).

## 10.4 Publishing

- Publish through the existing emitter (`emitClaimEvent`) so rows land in `domain_events`
  and the bus delivers to in-process subscribers.
- Publishing is **best-effort and never blocks** the cycle (existing `.catch` pattern).
- Each event carries `traceId` so the full chain (event → cycle → agents → outputs) is
  correlatable.

## 10.5 Subscriptions

- `wireCognitiveEvents(engine)` subscribes to `'*'` (like `wireClaimIntelligenceEvents` /
  `wireOperationsEvents`) and, per claim, **debounces** the cycle start (default 1 s window,
  configurable) to coalesce rapid-fire events.
- Agents subscribe to their specific `cognitive.*` events only when they run **outside** a
  cycle (e.g., scheduled stall checks); inside a cycle they are driven by the DAG, not by
  events (avoiding double-execution).

## 10.6 Ordering

- Per-claim cycles are **serialized**: a cycle for claim X never overlaps another for X
  (per-claim lock / queue). Ordering across claims is irrelevant.
- Within a cycle, DAG order governs (Section 3.4).
- The event log preserves global append order via `created_at` + `eventId` (UUIDv7
  recommended for sortability).

## 10.7 Idempotency

- Every event carries `eventId`; consumers dedupe on it (insert ... on conflict / in-memory
  set).
- Every cycle is idempotent: re-running produces the same deterministic result (Section
  3.5); `cycleId` dedupes manual re-triggers.
- `POST /cognition/claims/:id/analyze` accepts a caller-supplied `idempotencyKey` to
  prevent duplicate manual cycles.

## 10.8 Replay

- The `domain_events` log is the replay source (Phase 2 roadmap item becomes first-class).
- A replay tool consumes events for a claim in order and re-runs cycles, rebuilding
  snapshots/twins. Used for: recovery after data loss, debugging, learning-data generation.
- Replay is read-only with respect to primary tables; it writes only a marked
  `replay_cycle` flag so replayed results never overwrite real ones silently.

## 10.9 Monitoring & Tracing

- `traceId` is minted at cycle start and propagated to all agent calls, memory reads,
  provider calls, and emitted events.
- Cycle telemetry (durations, statuses, agent failures, provider latency) is written to the
  existing observability/audit paths (PLAT-005) and exposed at `GET /cognition/cycles/:id`.
- Alerting hooks: `cognitive.cycle_failed`, `cognitive.agent_defect` → ops channels.

---

# Section 11 — Human Collaboration

## 11.1 Principle

Atlas is a decision-support platform: **humans approve before automation** (existing
principle). The cognitive engine routes, records, and learns from every human interaction
with its outputs.

## 11.2 Workflows

### Recommendation review

```
recommendation (score ≥ threshold → auto; else → review)
        │
        ▼
review task created (existing tasks/notifications paths) + cognitive.review_required
        │
        ▼
reviewer: Approve | Reject | Modify | Request more evidence | Override
        │
        ▼
outcome recorded (decision memory) + audit trail + learning feed (Section 7.6)
```

### Override workflow

- A human **override** sets an explicit decision that supersedes engine output; the engine
  records `overriddenBy`, `overrideReason`, and demotes the original recommendation to
  `rejectedAlternatives` (with `rejectedBecause: 'human-override'`).
- Overrides require `reviewer`/`admin` permission (RBAC, PLAT-002) and are audited.
- The engine never silently re-proposes an overridden action for the same evidence state
  (override memoization keyed by canonical action + evidence fingerprint).

### Recommendation acceptance / rejection

- Accept → recorded as outcome; feeding acceptance-rate learning (Section 7.6).
- Reject → `rejectedBecause` captured; if the same action re-appears with new evidence, it
  is re-proposed with a diff note ("previously rejected — new evidence: …").

## 11.3 Feedback Capture

| Feedback type | Capture point | Used for |
|---|---|---|
| Accept/reject/modify | Review UI action | Acceptance rates, calibration |
| Free-text reason | Review UI textarea | Rule tuning, carrier learning |
| Confidence rating | Optional per-review rating | Calibration (Section 7.6) |
| Conversation feedback | Ask Atlas thumbs/comment | Conversation quality |
| Correction | User edits extraction/snapshot | Extraction rule tuning |

## 11.4 Learning Loop

Cycle outcome → decision memory → offline aggregation → proposed rule/weight changes
(diffed, audited) → activated via `POST /cognition/config` (admin, audit-logged). Never
silent self-modification. (Detail in Phase 4F, Section 15.6.)

## 11.5 Audit History

Every human action on an engine output is recorded: user, timestamp, action, before/after,
reason, recommendationId, cycleRef, permission role. This reuses the existing audit
framework (PLAT-005) and adds a `cognitive_review_actions` event stream (no schema change
— event payloads).

## 11.6 Permissions

| Role | Can | Cannot |
|---|---|---|
| Viewer | View recommendations + traces | Approve/override |
| Adjuster/Estimator | Accept/reject; request evidence | Override compliance blockers |
| Reviewer | Approve, reject, modify, override (except compliance veto without admin) | Change thresholds |
| Admin | Override compliance veto; edit `POST /cognition/config` | — |

Mapped to existing RBAC roles (PLAT-002) — no new permission model.

---

# Section 12 — Performance

## 12.1 Latency Targets

| Path | p50 | p95 | Notes |
|---|---|---|---|
| Cycle, deterministic-only (typical claim) | < 400 ms | < 1.5 s | No LLM |
| Cycle with LLM summary | < 3 s | < 8 s | Async summarization recommended |
| Live GET state (recompute) | < 150 ms | < 500 ms | Mirrors Phase 2/3 GET behavior |
| Explanation trace generation | + < 150 ms | + < 300 ms | Deterministic |
| Conversation answer | < 1.5 s | < 6 s | LLM path, streaming |

## 12.2 Parallel Execution

- DAG waves run concurrently with `COGNITIVE_MAX_CONCURRENCY` (default 4) (Section 3.4).
- Memory facade loads the bundle in ≤ 8 parallel queries (no N+1 — Phase 3 pattern).
- Snapshot/twin persistence is async and best-effort; it never extends the response path.

## 12.3 Caching

| Cache | Key | TTL | Invalidated by |
|---|---|---|---|
| Context bundle (in-memory) | claimId | 5 s | any claim event (per-claim invalidation) |
| Agent results (in-memory) | cycleId + agent | cycle lifetime | — (cycle-scoped) |
| Provider responses | prompt hash + version | configurable (5 min) | provider/model version change |
| Digital twin (persisted) | claimId | latest snapshot | event → refresh (existing) |
| Live GET recompute | — (none) | — | always fresh (existing philosophy) |

## 12.4 Incremental Computation

- The event subscriber **debounces** per claim (Section 10.5) so bursts coalesce.
- Cycle planning is **incremental**: trigger-specific plans (Section 3.3) run only the
  affected agents — a `communication.added` never re-runs document OCR.
- Financial/operations modules already skip work when inputs unchanged (deterministic
  guard: if the relevant input hashes match the last cycle, reuse prior output).

## 12.5 Memory Optimization

- Bundles carry only `Slim` projections (Section 6.2), not full rows.
- Snapshot JSONB is written once per cycle (append-only), capped reads (50 rows).
- Per-claim cycle serialization prevents duplicate concurrent cycles (Section 10.6).

## 12.6 Graph Optimization

- KG built per claim per cycle; traversal uses typed adjacency maps in memory.
- Portfolio graph folds are computed on demand and never persisted (Section 9.5).
- Future: index edges by type for large claims; partition historical graphs into the
  snapshot store (already the design).

## 12.7 Horizontal Scaling

- The engine core is **stateless** (agents pure; state in the facade). Multiple API
  instances can run cycles concurrently.
- Per-claim serialization uses a distributed claim-lock (DB advisory lock / Redis when
  available; falls back to in-process lock for single-instance).
- The in-process bus is per-instance; cross-instance fan-out requires the future event
  streaming upgrade (PLAT-006 future enhancement) — noted as a scale boundary, not a Phase
  4 requirement.

## 12.8 Background Processing

- Long stochastic work (LLM summaries, explanations, conversation) is async where possible
  (`?async=true`, event-driven cycles) using the existing background-jobs patterns (PLAT-
  007) — no new worker framework in Phase 4A–4D.
- Scheduled passes (stall-check, deadline-check, daily digest) hook into the existing
  background jobs mechanism.

---

# Section 13 — Security

## 13.1 Authentication & Authorization

- Auth remains Supabase-based (existing). All cognitive endpoints are authenticated via the
  existing auth middleware (which also sets the RLS company context — the Phase 3 RLS
  session pattern).
- RBAC per Section 11.6 (PLAT-002 roles).

## 13.2 Tenant Isolation

- Every cognitive query is scoped by `companyId` from the authenticated context; RLS
  policies on all backing tables enforce isolation at the database.
- The memory facade **always** filters by companyId — no cross-tenant read is expressible.
- Carrier intelligence and memory are per-company; no cross-tenant sharing (per
  ATLAS_MEMORY_ENGINE_SPEC security section).

## 13.3 Audit Logging

- Cycles, events, agent runs, human actions, and config changes are audited (PLAT-005 + the
  cognitive event catalog).
- Audit records are immutable (existing audit framework) and include traceId, actor,
  before/after, and versions.

## 13.4 Encryption, Governance, PII

- Encryption at rest and in transit: existing platform posture (Supabase/Postgres TLS,
  storage encryption).
- PII (names, addresses, policy numbers, damage descriptions): the engine minimizes
  exposure by (a) passing only needed Slim fields to agents, (b) **never** sending raw PII
  to LLM providers when a deterministic alternative exists, (c) redacting policy/claim
  numbers in stochastic prompts (template placeholders), (d) honoring company data
  retention (Section 6.7).
- Data governance: retention + archival follow the existing DATA_RETENTION specs; cycle
  records and snapshots are company-owned and deletable.

## 13.5 Compliance Boundaries

- The engine does not change claim/legal semantics; compliance evaluation stays in the
  Compliance Validator (Section 4.5).
- Recommendations carry no legal/financial guarantees; the UI disclaimers follow existing
  product wording (out of scope for this spec).

## 13.6 Prompt Security

- All LLM prompts are **templated** (no free-form user text concatenation); document text
  is treated as untrusted data, wrapped with delimiter + instruction to ignore embedded
  instructions (prompt-injection guard).
- Output validation: parse into the typed result schema (existing `result-parser` pattern);
  invalid outputs → fallback (Section 3.10).
- Provider calls are centralized behind the `AiProviderPort` so prompt policy is enforced
  in one place.

## 13.7 Model Security

- Provider keys live in server env (existing `env.ts`); never exposed to the browser.
- Model/version metadata is recorded per output (cycleRef) for governance.
- No user-supplied content is ever used to retrain or prompt a third-party model outside
  the configured providers (free provider layer, Gemini + Groq).

---

# Section 14 — Package Structure

## 14.1 Rationale

The engine is split so that each package is (a) independently testable, (b) re-usable by
both API and web (the Phase 2/3 pattern), and (c) free of framework imports in the core.

## 14.2 Proposed Packages

```
packages/
  atlas-shared/       # types, enums, small pure utils (evidence refs, config, errors)
  atlas-events/       # cognitive event catalog, typing, idempotency, replay helpers
  atlas-memory/       # ContextBundle facade over existing tables (loadContext, append*)
  atlas-knowledge/    # KG taxonomy extensions, traversal, portfolio fold
  atlas-scoring/      # confidence aggregation, weighting, ranking, calibration
  atlas-agents/       # the 10 agents (Section 4), each a thin adapter over engines
  atlas-engine/       # Orchestrator: planner, scheduler, synthesizer, router, learning
```

Existing packages are untouched: `claim-intelligence` (Phase 2/3 engine), `ai` (providers),
`database`, `ui`, `api-utils`, `config-*`.

## 14.3 Package Boundaries & Responsibilities

| Package | Owns | Depends on | Never touches |
|---|---|---|---|
| `atlas-shared` | Shared types/enums/errors | — | DB, HTTP, LLM |
| `atlas-events` | Event catalog + bus wrapper + idempotency/replay | atlas-shared | Business logic |
| `atlas-memory` | ContextBundle assembly + persistence facade | atlas-shared, database (reads), claim-intelligence (types) | Business logic |
| `atlas-knowledge` | KG taxonomy + traversal | atlas-shared, claim-intelligence (KG) | Persistence |
| `atlas-scoring` | Aggregation/ranking/calibration math | atlas-shared | I/O |
| `atlas-agents` | Agent adapters over engines | atlas-shared, atlas-memory, atlas-knowledge, atlas-scoring, ai (provider port), claim-intelligence | Orchestration (no planning) |
| `atlas-engine` | Orchestrator (plan/schedule/synthesize/route/learn) | atlas-shared, atlas-events, atlas-memory, atlas-agents, atlas-scoring | Domain analysis (delegates to agents) |

## 14.4 Dependency Rules

- Core packages (`atlas-*`) have **no framework or app imports** — they are pure TS,
  testable in isolation (mirrors `claim-intelligence` today).
- `atlas-memory` is the only package that imports `database` (via the existing schema
  exports) — all other packages get data through the facade.
- App adapters (in `apps/api` and `apps/web`) wire the pure packages to Fastify/Next.js
  (route registration, auth, RLS context) — matching the existing `*-service.ts` + route
  pattern.
- No circular dependencies: `agents` → `engine` is forbidden (engine depends on agents).

## 14.5 Package Dependency Diagram

```
                  apps/api (Fastify)        apps/web (Next.js)
                        │  ▲                     │  ▲
                        ▼  │                     ▼  │
              ┌────────────────────────┐  ┌─────────────────────┐
              │  app adapters: routes  │  │  server-side mirrors │
              │  /cognition, auth, RLS │  │  (lib/*-server.ts)   │
              └──────────┬─────────────┘  └──────────┬──────────┘
                         │                           │
                         └──────────┬────────────────┘
                                    ▼
                          ┌───────────────────┐
                          │   atlas-engine     │  (orchestrator)
                          └─────────┬─────────┘
                ┌───────────┬───────┴────────┬──────────────┐
                ▼           ▼                ▼              ▼
         atlas-agents   atlas-scoring   atlas-events  (learning feeds)
                │
        ┌───────┼───────┬───────────┐
        ▼       ▼       ▼           ▼
  atlas-memory  atlas-knowledge  ai (providers)  claim-intelligence (engines)
        │
        ▼
  database (reads only) ── domain_events, snapshots, extractions, carrier, twins
```

## 14.6 Build & Versioning

- Each package builds with `tsc` → `dist` (existing workspace pattern), versioned together
  in the monorepo (turbo).
- `atlas-engine` version is the **engine version** recorded in every `cycleRef`.

---

# Section 15 — Implementation Roadmap

Each phase includes scope, deliverables, dependencies, testing, rollback strategy, risk
assessment, and estimated effort (engineer-days = ED, senior engineer).

## 15.1 Phase 4A — Core Orchestrator

| Item | Detail |
|---|---|
| **Scope** | `atlas-engine` skeleton: planner (trigger→plan maps), scheduler (DAG waves, concurrency, retry, timeouts), synthesizer (dedupe/rank), router (thresholds), cycle records, `/cognition` routes + `wireCognitiveEvents` (debounced) |
| **Deliverables** | Orchestrator package + API routes + unit/integration tests + this spec's Sections 3, 7, 12 realized |
| **Dependencies** | Phase 2/3 (shipped); `atlas-shared`, `atlas-events` first |
| **Testing** | Unit: DAG order, retry, timeout, isolation, idempotent cycles. Integration: event → cycle → cycle_completed; manual analyze |
| **Rollback** | Routes behind feature flag; package additive; remove flag = full rollback |
| **Risk** | Low — pure additive; main risk is over-engineering the scheduler (mitigate: minimal scheduler first) |
| **Effort** | 8–12 ED |

## 15.2 Phase 4B — Shared Memory

| Item | Detail |
|---|---|
| **Scope** | `atlas-memory`: `ContextBundle` loader (≤ 8 queries, Slim projections), cycle records persistence (reusing snapshot tables), per-claim cache + invalidation, retention rules |
| **Deliverables** | Memory facade + tests + memory instrumentation in cycle records |
| **Dependencies** | Phase 4A; existing tables (no migrations) |
| **Testing** | Unit: loader projection correctness, no-N+1 (query-count assertions), invalidation. Integration: bundle reflects live data after events |
| **Rollback** | Facade is additive; engine can fall back to direct reads |
| **Risk** | Low–medium — coupling to Drizzle schema; mitigate by reading via existing schema exports |
| **Effort** | 5–8 ED |

## 15.3 Phase 4C — Agent Framework

| Field | Detail |
|---|---|
| **Scope** | `atlas-agents`: 8 deterministic agents first (Policy, Evidence, Financial, Compliance, Operations, Communications, Document Intelligence, Recommendation), registry, contract validation, per-agent tests; KG agent |
| **Deliverables** | Agents + registry + `GET /cognition/agents` + tests |
| **Dependencies** | 4A, 4B; claim-intelligence engines |
| **Testing** | Per-agent unit suites (fixtures) + integration (seed → agent outputs in cycle) |
| **Rollback** | Agents independently disable-able via registry config |
| **Risk** | Medium — agent/engine boundary clarity; mitigate with strict contract tests |
| **Effort** | 10–16 ED |

## 15.4 Phase 4D — Conversation Engine

| Field | Detail |
|---|---|
| **Scope** | Conversation agent + grounding pipeline + explanation traces + provider port integration (free providers), feedback capture, Ask Atlas + voice integration |
| **Deliverables** | Grounded conversation + explanations + fallbacks + tests |
| **Dependencies** | 4C; existing Ask Atlas orchestrator + voice |
| **Testing** | Grounding tests (no answer w/o evidence), prompt-injection fixtures, provider-outage fallback |
| **Rollback** | Stochastic path off by default; rule answers always available |
| **Risk** | Medium — provider latency/cost; mitigate with async + streaming + caching |
| **Effort** | 8–12 ED |

## 15.5 Phase 4E — Knowledge Graph Evolution

| Field | Detail |
|---|---|
| **Scope** | `atlas-knowledge`: new node/edge taxonomy, traversal queries, cross-claim `relates-to`, portfolio fold, graph versioning via snapshots |
| **Deliverables** | Extended KG + traversal API + tests |
| **Dependencies** | 4C (KG agent); Phase 2 KG |
| **Testing** | Unit: taxonomy fixtures, traversal correctness; Integration: portfolio drill-down |
| **Rollback** | Additive nodes/edges; old UI ignores new types |
| **Risk** | Low–medium — graph growth; mitigate with typed in-memory adjacency |
| **Effort** | 6–10 ED |

## 15.6 Phase 4F — Learning & Optimization

| Field | Detail |
|---|---|
| **Scope** | Decision memory, outcome capture, calibration adjustments, acceptance-rate analytics, proposed-rule diffing + activation, dashboard for admin |
| **Deliverables** | Learning pipeline + admin config UI + reports |
| **Dependencies** | 4A–4E; analytics tables (existing ANALYTICS_SCHEMA where applicable) |
| **Testing** | Offline replay tests (learn from historical outcomes, assert calibration improvement); audit assertions |
| **Rollback** | Learning proposals are diffed + audited; revert = activate previous config |
| **Risk** | Medium — silent-drift risk; mitigate with diffed proposals + thresholds |
| **Effort** | 10–16 ED |

## 15.7 Roadmap Summary

| Phase | Deliverable | Effort | Depends on |
|---|---|---|---|
| 4A | Core Orchestrator | 8–12 ED | — |
| 4B | Shared Memory | 5–8 ED | 4A |
| 4C | Agent Framework | 10–16 ED | 4A, 4B |
| 4D | Conversation Engine | 8–12 ED | 4C |
| 4E | KG Evolution | 6–10 ED | 4C |
| 4F | Learning & Optimization | 10–16 ED | 4A–4E |
| **Total** | | **47–74 ED** | |

---

# Section 16 — Diagrams

## 16.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         COGNITIVE ENGINE                            │
│                                                                     │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────────────┐ │
│  │  Planner     │  │  Scheduler     │  │  Synthesizer + Router   │ │
│  │ (trigger→DAG)│→│ (waves, retry,  │→│ (merge, rank, route,    │ │
│  │              │  │  timeout, lock)│  │  explain)               │ │
│  └──────────────┘  └───────┬────────┘  └───────────┬─────────────┘ │
│                            │                       │               │
│  ┌──────────────┐  ┌───────▼────────┐  ┌───────────▼─────────────┐ │
│  │  Registry    │  │  Agent Runner  │  │  Learning / Calibration │ │
│  │ (10 agents)  │  │ (isolated ctx) │  │  (offline, audited)     │ │
│  └──────────────┘  └───────┬────────┘  └─────────────────────────┘ │
│                            │                                         │
│              ┌─────────────▼───────────────┐                         │
│              │  Memory Facade (ContextBundle)│                        │
│              └─────────────┬───────────────┘                         │
└────────────────────────────┼─────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  domain_events         snapshots / twins     existing engines
  (event log)          (claim memory)        (claim-intelligence, ai)
```

## 16.2 Sequence Diagram — Event-Triggered Cycle

```
Event emitter          Orchestrator        Memory facade       Agents          Router
    │ emitClaimEvent        │                    │                │               │
    ├──────────────────────▶│                    │                │               │
    │ (claim.created, …)    │ debounce(1s)       │                │               │
    │                       │── traceId minted ─▶│                │               │
    │                       │── loadContext ────▶│                │               │
    │                       │◀── ContextBundle ──┤                │               │
    │                       │ plan(trigger,bundle)│                │               │
    │                       │─ wave1: comms, docintel, evidence ─▶│               │
    │                       │◀─ results ──────────────────────────┤               │
    │                       │─ wave2: policy ────────────────────▶│               │
    │                       │─ wave3: kg, compliance, ops, fin ──▶│               │
    │                       │─ wave4: recommendation ────────────▶│               │
    │                       │ synthesize + explain                 │               │
    │                       │ route (thresholds) ─────────────────────────────────▶│
    │                       │◀──────────────────────────── review decision ────────┤
    │                       │ persist (best-effort)               │                │
    │◀─ cognitive.cycle_completed (or review_required) ───────────┤                │
```

## 16.3 Event Flow Diagram

```
claim events (doc/photo/supplement/note/estimate/…) ──► domain_events row
        │                                                     │
        ▼                                                     ▼
 bus publish ──► [existing] wireClaimIntelligenceEvents ──► snapshot persist
        │       └──► [existing] wireOperationsEvents ──► twin refresh
        ▼
 [new] wireCognitiveEvents (debounced, per-claim serialized)
        │
        ▼
 cognitive.cycle_started ──► agents (DAG) ──► cognitive.cycle_completed
                                                      │
                        ┌─────────────────────────────┤
                        ▼                             ▼
               cognitive.review_required     learning feed (offline)
```

## 16.4 Agent Interaction Diagram

See Section 4.12 (wave diagram) — reproduced here in summary:

```
Wave 1 (parallel): Communications, Document Intelligence, Evidence
Wave 2: Policy (depends on evidence + doc intelligence)
Wave 3: Knowledge Graph, Compliance, Operations, Financial
Wave 4: Recommendation (depends on all)
Stochastic tail: Conversation (grounded on synthesized output)
```

## 16.5 Data Flow Diagram

```
Postgres ──► Memory facade ──► ContextBundle ──► Planner ──► Scheduler
                                                              │
   Postgres ◄── best-effort persists ◄── cycle record ◄── synthesizer ◄── agents
                                                              │
                                                              ▼
                                                     ExplanationTrace → UI / API
```

## 16.6 Package Dependency Diagram

See Section 14.5.

---

# Section 17 — Risk Assessment

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Orchestrator over-engineering (scheduler complexity) | Medium | Medium | Minimal scheduler first (Phase 4A); DAG = array + topo sort |
| R2 | Agent/engine boundary drift (agents duplicating engine logic) | Medium | High | Contract tests asserting agents delegate; code-review gate on engine calls |
| R3 | LLM grounding failures (prose contradicts trace) | Low | High | Grounded templating (Section 8.3); CI assertion; deterministic fallback |
| R4 | Provider outage (Gemini + Groq) | Medium | Medium | Deterministic fallbacks everywhere (Section 3.10); never hard-depend on LLM |
| R5 | Event storms (rapid-fire claims events) | Medium | Medium | Per-claim debounce + serialization (Section 10.5–10.6) |
| R6 | Confidence over-calibration drift | Medium | Medium | Offline diffed proposals + audits (Section 7.6); calibration CI |
| R7 | PII leakage into prompts | Low | High | Redaction templates + provider port centralization (Section 13.6) |
| R8 | Snapshot/twin growth (retention) | Medium | Low | Retention rules (Section 6.7) + prune job (Phase 4B) |
| R9 | Replay writes over real data | Low | High | `replay_cycle` flag; read-only replay (Section 10.8) |
| R10 | Scale boundary (in-process bus across instances) | Medium | Low | Documented; single-instance for MVP; streaming upgrade later (Section 12.7) |
| R11 | Human override churn (engine re-proposing overridden actions) | Low | Medium | Override memoization keyed by action + evidence fingerprint (Section 11.2) |

## 17.1 Top Risks & Owners

- **R2 (boundary drift)** — owned by engineering lead; enforced by contract tests + review.
- **R3 (grounding)** — owned by AI engineers; CI assertion + fallback path.
- **R7 (PII)** — owned by security lead; redaction policy reviewed per provider change.

---

# Section 18 — Trade-off Analysis

| # | Decision | Option A (chosen) | Option B | Why A wins |
|---|---|---|---|---|
| T1 | Memory storage | Facade over existing tables | New cognitive DB | No migration, replayable, auditable; B adds schema churn + drift |
| T2 | Agent communication | Hub-and-spoke via orchestrator | Direct agent-to-agent | Isolation, replay, testability; B couples agents |
| T3 | Determinism vs LLM | Deterministic core + stochastic surface | LLM everywhere | Reproducible numbers + explainability; B risks hallucination |
| T4 | Cycle sync vs async | Sync by default, async opt-in | Async always | Demo UX needs synchronous cycle results; heavy work async |
| T5 | In-process bus vs streaming | In-process + domain_events | Kafka/streaming | Zero infra, matches Phase 2; B for scale (documented boundary) |
| T6 | Recompute live vs materialized | Live recompute + latest twin | Full materialization | Always-fresh UI (proven); B adds invalidation complexity |
| T7 | Per-claim serialization | DB advisory lock fallback | Optimistic (no lock) | Prevents duplicate cycles; B risks racing twins |
| T8 | One engine package vs many | 7 focused packages | Single monolith package | Independent testing + dependency control; B simpler but coupled |

---

# Section 19 — Open Architectural Decisions

| # | Decision | Options | Suggested default | Needed by |
|---|---|---|---|---|
| AD-1 | Cross-instance event fan-out | (a) keep in-process (single instance) (b) DB-poll (c) Redis pub/sub (d) streaming platform | (a) for MVP; revisit at multi-instance | Phase 4C hardening |
| AD-2 | Claim-lock mechanism | (a) Postgres advisory lock (b) Redis (c) in-process only | (a) with (c) fallback | Phase 4A |
| AD-3 | Debounce window | 1 s / 5 s / event-batch | 1 s (configurable) | Phase 4A |
| AD-4 | Provider caching scope | per-claim / per-company / global | per-company | Phase 4D |
| AD-5 | Snapshot retention default | 30 / 90 / 180 days | 90 days configurable | Phase 4B |
| AD-6 | Conversation streaming | SSE vs WebSocket vs poll | SSE (existing patterns) | Phase 4D |
| AD-7 | Calibration activation | auto after diff / manual only | manual with diff view | Phase 4F |
| AD-8 | Cross-claim similarity basis | carrier+property+policy vs embedding | rule-based first, embeddings later | Phase 4E |
| AD-9 | Agent versions in snapshots | full payload vs summary | summary + refs | Phase 4B |
| AD-10 | Who may trigger `POST /cognition/config` | admin only vs admin + reviewer | admin only (audited) | Phase 4F |

---

# Section 20 — Future Extensibility Recommendations

1. **New agents** register via the static registry + planner mapping (Section 5.6) — e.g.,
   Inspection Agent, Estimator Agent, Negotiation Agent, Legal Agent.
2. **New industries** — the domain engines are restoration-specific; the cognitive layer is
   generic. Add domain engines; agents remain.
3. **Memory Engine integration** — when `ATLAS_MEMORY_ENGINE_SPEC` tables ship, plug them
   into the facade's `retrieveLongTerm` for cross-claim reasoning.
4. **Multi-agent consensus** — for high-stakes decisions, run N stochastic variants and
   require majority (deferred; deterministic framework already provides guardrails).
5. **Scenario simulation** — expose "what-if" (add missing evidence → rerun cycle) as an
   explainer; the pure/replayable design makes this cheap.
6. **Streaming events** — swap the bus for a streaming platform behind the same
   `atlas-events` contract when scale demands (no engine change).
7. **Predictive analytics** — feed cycle records into the analytics pipeline for
   settlement forecasting and carrier scorecards (Phase 4F groundwork).

---

# Appendix A — Contract Reference (types)

Central types (full definitions appear inline in Sections 3–9):

- `CognitiveTrigger` — Section 3.3
- `AgentTask`, `Plan` — Section 3.3
- `CycleResult`, `SynthesizedOutput`, `RankedRecommendation` — Section 3.4, 3.9
- `Agent`, `AgentContext`, `AgentResult`, `EvidenceRef` — Section 4.1
- `AgentRequest`, `AgentResponse`, `CognitiveDomainEvent` — Section 5.2
- `ContextBundle` — Section 6.2
- `ExplanationTrace`, `RejectedAlternative` — Section 8.2, 8.4
- `MemoryFacade` — Section 6.8

Naming conventions: `camelCase` fields, ISO-8601 timestamps, UUID ids, `snake_case` DB
columns (existing Drizzle), enum values in `snake_case` (matching Phase 2/3).

# Appendix B — Event Catalog

## B.1 Existing domain events (consumed today — factual)

Only these four events are emitted by the current implementation:

| Event | Emitted by | Note |
|---|---|---|
| `claim.created` | `apps/api/src/routes/claims.ts` | On claim creation |
| `document.uploaded` | `apps/api/src/routes/documents.ts` | Also covers **photos** and **estimates** — they are documents; classify the type before treating as photo/estimate |
| `supplement.submitted` | `apps/api/src/routes/supplements.ts` | Emitted on supplement creation (not per approval/denial) |
| `communication.added` | `apps/api/src/routes/notes.ts` | On note/communication creation |

## B.2 Planned domain events (cataloged in PLAT-006, NOT yet emitted)

`photo.uploaded`, `photo.analyzed`, `damage.detected`, `estimate.uploaded`,
`ocr.completed`, `document.classification_completed`, `evidence.link_created`,
`claim.updated`, `claim.status_changed`, `supplement.approved`, `supplement.denied`,
`compliance.*`, `ai.review_required`.

Implementers **must not depend on these** until they are wired; the Cognitive Engine maps
the four existing events to trigger plans today (Section 3.3) and adds mappings as new
events ship.

## B.3 Cognitive events (NEW — produced by this engine)

All 19 events from the Section 10.2 catalog (`cognitive.cycle_started` …
`cognitive.agent_defect`). Envelope (PLAT-006):

```json
{
  "eventId": "0192f1a2-…-uuidv7",
  "eventType": "cognitive.cycle_completed",
  "organizationId": "<company_uuid>",
  "entityType": "claim",
  "entityId": "<claim_uuid>",
  "traceId": "<cycle_trace_uuid>",
  "version": 1,
  "payload": {
    "cycleId": "…",
    "status": "completed",
    "synthesized": { "recommendations": [], "summary": null, "confidence": {} },
    "agents": ["evidence", "financial", "…"]
  },
  "createdAt": "2026-08-02T12:00:00.000Z"
}
```

Events are versioned (`version` field, additive evolution) per PLAT-006 and Section 5.7.

# Appendix C — Glossary

| Term | Definition |
|---|---|
| Cognitive cycle | One orchestrated run of agents for a claim triggered by an event/manual/schedule |
| Agent | Specialist analyzer over one domain (Section 4) |
| Orchestrator | Planner+scheduler+synthesizer+router (Section 3) |
| ContextBundle | Immutable per-cycle shared memory read (Section 6.2) |
| DAG | The dependency graph of agent tasks for a cycle |
| Digital Twin | Persistent aggregate of a claim's state (Phase 3) |
| domain_events | Replayable event log (Phase 2) |
| EvidenceRef | Pointer to an evidence artifact backing a claim (Section 4.1) |
| ScoreCard | The numeric inputs to a recommendation's score (Section 7.2) |
| Calibration | Adjustment aligning predicted confidence with observed outcomes (Section 7.6) |

---

**End of specification — COGNITIVE-001 v1.0**

**Next step:** Phase 4A implementation (Core Orchestrator) per Section 15.1, after this
specification is reviewed by the engineering team and AD-1–AD-10 are resolved.

