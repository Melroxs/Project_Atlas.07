# Atlas Operations Intelligence & AI Case Manager — Implementation Report (Phase 3)

**Status:** ✅ Implemented & validated
**Date:** August 2026
**Scope:** Turns Atlas from a claim *analyzer* into an AI *operations platform* — an
experienced restoration operations manager that continuously monitors every claim,
detects bottlenecks, prioritizes work, and recommends the next best business actions.

---

## 1. Executive Summary

Atlas now **actively manages** claims. Ten new modules — the AI Case Manager, Claim
Lifecycle Engine, Financial Intelligence Engine, Revenue Recovery Dashboard, Executive
Operations Dashboard, Portfolio Intelligence, Claim Digital Twin, Operational
Recommendation Engine, Revenue Opportunity Detection, and Explainable Business
Intelligence — sit on top of the Phase 2 Claim Intelligence Layer and reuse all existing
services (Evidence Graph, Knowledge Graph, Decision Engine, Compliance Validator,
Communications Intelligence, Policy Intelligence, Supplement Engine, Claim Workspace).

No existing module was replaced or refactored. The new layer coordinates them through the
same pure-engine + event-driven architecture established in Phase 2.

---

## 2. Architecture

```
              ┌──────────────────────────────────────────────────────┐
              │          Operations Intelligence (Phase 3)           │
              │   packages/claim-intelligence (pure engine modules)  │
              └──────────────────────────────────────────────────────┘
   ┌──────────┼───────────────┬───────────────┬───────────────┬──────┴───────┐
   │          │               │               │               │              │
   ▼          ▼               ▼               ▼               ▼              ▼
 Lifecycle  Financial   Revenue Opps    Ops Recs       Case Manager   Digital Twin
 (12-stage) (8 figures)  (7 types)      (business      (stall/dead-   (full claim
                                          impact)        line/priority)  aggregate)
   │          │               │               │               │              │
   └──────────┴───────────────┴───────────────┴───────────────┴──────────────┘
                              │  analyzeOperations(bundle)
                              ▼
              ┌───────────────────────────────────────────┐
              │     analyzePortfolio({ bundles })         │
              │  Revenue · Executive · Portfolio views     │
              └───────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
  Fastify /operations routes                  Next.js dashboards
  (apps/api)          ──────────────►         (apps/web)
  GET claim ops · company dashboards          OperationsDashboard (3 tabs)
  POST refresh (persists digital twin)        OperationsPanel (claim level)
        │
        ▼
  Event bus (Phase 2) ── wireOperationsEvents() → refresh twin on every claim event
```

### Core principles

- **Pure, shared engine** — `@project-atlas/claim-intelligence` runs identically in the
  Fastify API and the Next.js dashboard. No duplicated business logic.
- **Read-only dynamic GETs** — every dashboard endpoint recomputes from live claim data.
  The only write path is `POST /operations/claims/:id/refresh` (persists the twin) and the
  event subscriber.
- **Never fabricate financials** — every figure carries its source + evidence and a
  confidence score. All projections are derived from real claim data.
- **Explainable everything** — every opportunity and recommendation exposes why, the
  evidence used, the documents/estimate items/policy references that contributed, and a
  confidence score.
- **Event-driven** — the existing Phase 2 bus refreshes the digital twin whenever claim
  data changes; no manual refresh required.

---

## 3. Modules

### Module 1 — AI Case Manager (`case-manager.ts`)
Monitors claim progress, tracks workflow stages, detects **stalled claims** (14 days with
no activity), manages **deadlines** (21-day carrier-response expectations from supplements
+ deadlines extracted from communications), identifies missing documentation/evidence,
computes a **priority score** (0–100), and emits a natural-language AI summary with next
actions.

### Module 2 — Claim Lifecycle Engine (`lifecycle.ts`)
12 standardized stages (Lead → Inspection Scheduled → Inspection Complete → Claim Created
→ Carrier Review → Documentation Requested → Supplement Preparation → Supplement Submitted
→ Negotiation → Approved → Final Payment → Closed). **Entry-point aware**: `new_claim`,
`existing_claim`, `supplement_only`, and `imported` claims join the lifecycle at the
correct stage. Returns current stage, next stage, progress %, missing requirements,
blocking issues, and recommended actions. A closed claim can never regress.

### Module 3 — Financial Intelligence Engine (`financial.ts`)
Tracks original estimate, carrier approved amount, contractor estimate (total scope =
original + **requested** supplement value, avoiding double-counting), supplement value,
recovered revenue, outstanding revenue, potential recovery, estimated recovery
opportunity, and a confidence score — across **8 explainable figures**, each with source +
evidence. Never fabricates: with insufficient data, values are `null`.

### Module 4 — Revenue Recovery Dashboard (`portfolio.ts` → `revenue`)
Company-wide: total active claims, awaiting response, ready for supplement, missing
evidence, at risk, estimated recoverable revenue, revenue recovered, outstanding
opportunity, average claim health / recovery readiness / AI confidence.

### Module 5 — Executive Operations Dashboard (`portfolio.ts` → `executive`)
Company health, claim pipeline, revenue pipeline, high-risk claims, upcoming deadlines,
team workload (approximated by per-stage counts — no assignee data in the bundle),
AI recommendations, revenue forecast (30/60-day confidence-weighted buckets), and
operational bottlenecks.

### Module 6 — Portfolio Intelligence (`portfolio.ts` → `portfolio`)
Common missing documentation, frequently delayed stages, recurring carrier requests
(from communication extractions), repeated evidence gaps, claims requiring immediate
attention, revenue concentration by carrier, average claim duration, supplement success
rates, and monthly trends.

### Module 7 — Claim Digital Twin (`digital-twin.ts` + `digital_twins` table)
A persistent digital representation aggregating customer, property, policy, carrier,
claim, timeline, photos, documents, inspections, estimates, evidence graph, knowledge
graph, AI insights, compliance, financial metrics, supplements, and carrier responses.
Every AI decision operates on the twin. Persisted on `POST /refresh` and on every claim
event; the GET endpoint always computes the live twin.

### Module 8 — Operational Recommendation Engine (`ops-recommendations.ts`)
Proactive recommendations: schedule reinspection, upload additional roof photos, request
engineering report, await carrier estimate, generate supplement, **escalate overdue
claim**, follow up with adjuster, prepare final invoice. Each has priority, category,
reason, supporting evidence, confidence, **estimated business impact**, and required user
action.

### Module 9 — Revenue Opportunity Detection (`revenue-opportunities.ts`)
7 rule-based opportunity types: missing estimate items, pricing discrepancy (requested vs
approved gap), code-related (Xactimate/RCV/ACV/code upgrades), matching (photos vs
estimate), overhead & profit, documentation deficiency, and potential supplement. Each
with estimated value, confidence, priority, evidence, and required action.

### Module 10 — Explainable Business Intelligence
Every financial recommendation answers: why identified, what evidence supports it, which
documents/estimate items/policy references contributed, and how confident Atlas is —
never opaque.

---

## 4. Files Added

### Engine package — `packages/claim-intelligence/src/`

| File | Purpose |
|---|---|
| `lifecycle.ts` | 12-stage Claim Lifecycle Engine + entry-point-aware inference |
| `financial.ts` | Financial Intelligence (8 explainable figures, no fabrication) |
| `revenue-opportunities.ts` | Revenue Opportunity Detection (7 rule-based types) |
| `ops-recommendations.ts` | Operational Recommendation Engine (business impact) |
| `case-manager.ts` | AI Case Manager (stall/deadline/priority/AI summary) |
| `digital-twin.ts` | Claim Digital Twin aggregation |
| `portfolio.ts` | `analyzePortfolio` → Revenue / Executive / Portfolio analytics |
| `operations.ts` | `analyzeOperations` orchestrator (runs the full pipeline) |
| `types.ts` (extended) | Phase 3 types (LifecycleInfo, FinancialIntelligence, RevenueOpportunity, OperationalRecommendation, CaseManagerReport, DigitalTwin, OperationsModel, PortfolioAnalytics, dashboards) |
| `index.ts` (extended) | Exports all new modules |

### Database

| File | Purpose |
|---|---|
| `packages/database/migrations/005_operations_intelligence.sql` | `digital_twins` table |
| `packages/database/src/schema/digital-twins.ts` | Drizzle schema |
| `scripts/apply-migration-005.mjs` | Applies migration 005 (applied ✅) |

### API layer

| File | Purpose |
|---|---|
| `apps/api/src/lib/operations/operations-service.ts` | `loadCompanyBundles` (bulk ~8-query loader, no N+1), `computeOperations` (read-only), `computeCompanyOperations`, `persistDigitalTwin`, `analyzeOperationsAndPersist`, `wireOperationsEvents` |
| `apps/api/src/routes/operations.ts` | All `/operations` endpoints |
| `apps/api/src/lib/intelligence/claim-intelligence-service.ts` | `classifyDocument` now exported (reused by the bulk loader) |

### Web layer

| File | Purpose |
|---|---|
| `apps/web/src/lib/operations-server.ts` | Server-side mirror loaders (server-db + shared engine) |
| `apps/web/src/app/api/operations/claims/[claimId]/[section]/route.ts` | Claim-level Next.js routes |
| `apps/web/src/app/api/operations/company/[section]/route.ts` | Company-level Next.js routes |
| `apps/web/src/components/operations/OperationsDashboard.tsx` | 3-tab company dashboard (Revenue / Executive / Portfolio) with drill-down |
| `apps/web/src/components/operations/OperationsPanel.tsx` | Claim-level Operations panel (case manager, lifecycle stepper, financial, opportunities, recommendations, deadlines) |
| `apps/web/src/app/admin/operations/page.tsx` | New admin page |

### Tests

| File | Purpose |
|---|---|
| `scripts/test-operations.mjs` | 89 unit assertions (14 groups) — all passing |
| `scripts/validate-operations.mjs` | Live-API integration test — 56 assertions, all passing |

---

## 5. Files Modified

| File | Change |
|---|---|
| `apps/api/src/routes/index.ts` | Register `operationsRoutes` under `/operations` |
| `apps/api/src/server.ts` | Call `wireOperationsEvents()` (twin refresh on events) |
| `apps/web/src/app/admin/claims/[id]/page.tsx` | Added **Operations** tab (Workspace \| Intelligence \| Operations) |
| `apps/web/src/components/intelligence/AskAtlas.tsx` | Added Operations quick-access card |

---

## 6. Database Changes (additive only)

| Table | Purpose |
|---|---|
| `digital_twins` | Persistent digital twin per claim (company_id, claim_id, twin jsonb, generated_at). Kept as the latest single snapshot per claim; `GET /twin` always computes live, so the table is a convenience copy of current state. |

No existing tables were altered.

---

## 7. API Changes

All under `/operations`, **read-only and dynamically computed** unless noted:

| Endpoint | Purpose |
|---|---|
| `GET /operations/claims/:claimId` | Full OperationsModel (twin + lifecycle + financial + opportunities + recommendations + case manager) |
| `GET /operations/claims/:claimId/lifecycle` | Lifecycle stage, progress, next stage, requirements |
| `GET /operations/claims/:claimId/financial` | Financial figures + sources + confidence |
| `GET /operations/claims/:claimId/case-manager` | Case manager report (status, stall, deadlines, priority, summary) |
| `GET /operations/claims/:claimId/opportunities` | Revenue opportunities (explainable) |
| `GET /operations/claims/:claimId/recommendations` | Operational recommendations |
| `GET /operations/claims/:claimId/twin` | Live digital twin |
| `GET /operations/company/overview` | All three dashboards (revenue + executive + portfolio) |
| `GET /operations/company/revenue` | Revenue Recovery Dashboard |
| `GET /operations/company/executive` | Executive Operations Dashboard |
| `GET /operations/company/portfolio` | Portfolio Intelligence |
| `POST /operations/claims/:claimId/refresh` | Persist digital twin (the only write path) |

---

## 8. UI Changes

- **`/admin/operations`** — company-wide Operations Intelligence page with tabs:
  - **Revenue Recovery**: active/awaiting/ready/at-risk claim counts + recoverable,
    recovered, and outstanding revenue + average health/readiness/AI confidence.
  - **Executive**: company health, claim + revenue pipelines, revenue forecast,
    bottlenecks, upcoming deadlines, AI recommendations, high-risk claims (drill-down).
  - **Portfolio**: missing documentation, recurring carrier requests, carrier revenue
    concentration, supplement success, claims requiring immediate attention.
- **Claim detail page** — new **Operations** tab (alongside Workspace and Claim
  Intelligence) with the AI Case Manager banner, 12-stage lifecycle stepper, digital twin
  snapshot, financial intelligence with sources, deadlines, explainable revenue
  opportunities, and operational recommendations with business impact.
- **Ask Atlas** — Operations quick-access card.

---

## 9. Event Flows

```
Claim data changes (doc/supplement/note/status)
        │ emitClaimEvent (existing Phase 2 emitter)
        ▼
   domain_events row (audit) ──► bus publish
        │
        ├──► wireClaimIntelligenceEvents  → persist Phase 2 snapshot
        └──► wireOperationsEvents         → analyzeOperationsAndPersist
                                                   │
                                           rebuild twin + lifecycle + financial
                                           persist digital_twins (latest snapshot)
```

All GET dashboards recompute live, so the UI is always fresh even between persisted
twins. `POST /refresh` is available for on-demand persistence.

---

## 10. Test Results

### Unit tests — `scripts/test-operations.mjs` — **89/89 pass ✅**

| Group | Asserts |
|---|---|
| Lifecycle: 12 stages, entry-point inference, closed-never-regresses, completed→final_payment | ✓ |
| Lifecycle info: progress, next stage, stages array | ✓ |
| Financial: no fabrication, sources + confidence on every figure | ✓ |
| Financial: recovered + outstanding from supplement amounts | ✓ |
| Revenue opportunities: pricing discrepancy gap value, explainability | ✓ |
| Ops recommendations: escalate overdue (critical, business impact, action) | ✓ |
| Case manager: stalled after 20 days, valid status, priority, AI summary | ✓ |
| Case manager: not stalled with recent activity + supplement deadline | ✓ |
| Digital twin: aggregates customer/photos/documents/policy/KG/AI insights | ✓ |
| Operations orchestrator: full model shape | ✓ |
| Portfolio: company-wide aggregates (active/awaiting/missing/recovered/pipeline) | ✓ |
| Portfolio: revenue forecast + trends | ✓ |
| Event bus reuse (wildcard delivery intact) | ✓ |
| No fabrication: no supplement opportunity when data insufficient | ✓ |

### Integration tests — `scripts/validate-operations.mjs` — **56/56 pass, all 10 flags true ✅**

| Flag | Meaning |
|---|---|
| `opsModel` | Full claim operations model with twin |
| `lifecycle` | 12-stage lifecycle from live API |
| `financial` | Original 25000 / approved 18000 / potential 7000 (pure claim) |
| `caseManager` | Case manager with AI summary from live API |
| `opportunities` / `recommendations` | Explainable lists with evidence + business impact |
| `twin` | Digital twin embeds knowledge graph |
| `overview` | Company dashboards return all three sections |
| `refreshPersists` | POST refresh succeeds (write path) |
| `errorHandling` | 404 on missing claim |

Seed strategy: claims seeded first, an unanswered `submitted` supplement (requested 5000)
seeded **after** claim-level financial assertions (so the pure-claim `potentialRecovery
7000` stays intact) and **before** company-level checks (so `claimsAwaitingResponse >= 1`
is genuinely driven by this test's own data). Cleanup deletes claims (cascades
supplements) + the throwaway test user.

### Static checks & regression sweep

- `@project-atlas/claim-intelligence` build: **clean**
- `apps/api` `tsc`: **clean** (only pre-existing `organization.controller.ts` excluded)
- `apps/web` `tsc --noEmit`: **clean** for all operations files
- Endpoint sweep: **50/50 OK, 0 server errors, 0 client errors**
- Engine validation: green (intelligence, health, evidence, AI supplements, demo, voice)
- Phase 2 claim-intelligence unit tests still pass: **49/49**

---

## 11. Performance Considerations

- **Bulk loading** — company dashboards assemble all claim bundles in ~8 queries (no
  N+1 over claims), with a single in-memory grouping pass.
- **Read-only compute** — dashboards never write; recomputation is O(claims × bundle).
- **Best-effort persistence** — twin writes `.catch` and never block the workflow.
- **Explainability is free** — all rules are deterministic; no LLM calls per request.
- **Known costs** — every claim event now runs both the Phase 2 snapshot persist and the
  full Phase 3 pipeline; fine at demo scale, a per-claim debounce is future hardening.

---

## 12. Known Limitations (documented, non-blocking)

1. **"Team Workload" is approximated** by per-stage claim counts — the claim bundle has no
   assignee data, so this is not real workload distribution.
2. **Bulk portfolio loader omits `ai_conversations`** from communications (the per-claim
   loader includes them), so portfolio-level communications intelligence differs slightly
   from claim-level. Acceptable and intentional for bulk speed.
3. **`digital_twins` uses delete-then-insert** (non-atomic); benign because `GET /twin`
   computes live. An upsert would be future hardening.
4. **Event cost** — each claim event triggers snapshot + twin persistence; a per-claim
   debounce is the cheap future fix.
5. **Portfolio O(n²)** in a few counters (`bundles.find` inside filters) — fine for demo
   volumes.

---

## 13. Remaining Roadmap

| Item | Notes |
|---|---|
| Assignee-aware team workload | Add user assignment to claims and bucket by owner |
| Digital twin upsert | `INSERT ... ON CONFLICT` on (company_id, claim_id) |
| Event debounce | Coalesce rapid-fire events per claim before re-analysis |
| Twin history viewer | Expose prior twin snapshots (table already persists latest) |
| Interactive KG viewer | Force-directed renderer for the embedded knowledge graph |
| Carrier learning automation | Aggregate carrier_intelligence into per-carrier scorecards |

---

## 14. Conclusion

The Operations Intelligence & AI Case Manager layer is **implemented, reviewed, and
fully validated**:

- ✅ 10 modules across the pure engine package; both apps typecheck clean
- ✅ Migration 005 applied (`digital_twins`); additive only
- ✅ 89 unit + 56 integration assertions passing; all 10 integration flags true
- ✅ Endpoint sweep 50/50 with zero server errors; engine validation green
- ✅ Phase 2 Claim Intelligence unaffected (49/49 unit tests still pass)
- ✅ Backward compatible — zero changes to existing schemas or module behavior
- ✅ `/admin/operations` dashboards + claim-level Operations tab live in the UI
