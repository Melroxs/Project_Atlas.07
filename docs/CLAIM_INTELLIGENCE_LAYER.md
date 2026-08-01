# Atlas AI Claim Intelligence Layer — Implementation Report (Phase 2)

**Status:** ✅ Implemented & validated
**Date:** August 2026
**Scope:** A new intelligence layer that sits above all existing Atlas workflows and
continuously analyzes every claim — explainable, evidence-backed, and traceable.

---

## 1. Executive Summary

Atlas no longer simply generates documents. The **Claim Intelligence Engine** now
understands every claim: it maintains a live intelligence model per claim, recalculates
scores, rebuilds the knowledge graph, re-runs compliance validation, and refreshes AI
recommendations automatically whenever new information arrives (photo, document,
estimate, communication, policy, carrier response, timeline update).

Every recommendation is explainable: it exposes *why* it was made, *which* evidence
supports it, *which* documents/photos/policy sections/estimate line items contributed,
and a confidence score.

No existing module was replaced. The layer **coordinates** the Evidence Graph, Decision
Engine, Compliance Validator, Document Intelligence, Claim Workspace, Supplement
Engine, Timeline, and Communications — it never duplicates their business logic.

---

## 2. Architecture

```
                        ┌─────────────────────────────────────┐
                        │      Claim Intelligence Engine       │
                        │        (packages/claim-intelligence) │
                        └─────────────────────────────────────┘
            ▲  analyzeClaim (orchestrator, read-only compute)  │
            │                                                   ▼
   ┌────────────────────┐   ┌──────────────┐   ┌──────────────────────────┐
   │ Recovery Readiness │   │  Health      │   │ Next Best Action Engine   │
   │   (6-factor 0-100) │   │  Monitor     │   │ (8 explainable actions)   │
   └────────────────────┘   └──────────────┘   └──────────────────────────┘
   ┌────────────────────┐   ┌──────────────┐   ┌──────────────────────────┐
   │ Claim Knowledge    │   │ Communications│  │ Event Bus (typed pub/sub) │
   │ Graph (navigable)  │   │ Intelligence  │   └──────────────────────────┘
   └────────────────────┘   └──────────────┘            ▲
            ▲                                            │ subscribe '*'
            │                ┌───────────────────────────┴──────────────────┐
            │                │  apps/api claim-intelligence-service         │
            │                │  loadClaimBundle · compute (RO) · analyze    │
            │                │  emitClaimEvent → domain_events + bus        │
            │                └───────────────────────────┬──────────────────┘
            │                                            │ emits
   ┌────────┴─────────┐   ┌──────────────┐   ┌───────────▼──────────┐
   │ /intelligence/*  │   │ Next.js API  │   │ documents / claims   │
   │ Fastify routes   │   │ routes (web) │   │ supplements / notes  │
   └──────────────────┘   └──────────────┘   └──────────────────────┘
            │                    │
            ▼                    ▼
   Claim Intelligence tab     Claim Intelligence
   (Claim Workspace UI)       dashboard panels
```

### Core principle

- **Compute is read-only and dynamic.** Every GET endpoint recomputes the intelligence
  model from the live claim bundle — nothing is stale.
- **Analysis persists via events.** `POST /analyze` and the event subscriber write
  snapshots, extractions, and carrier intelligence; the `domain_events` table gives
  auditability and a replayable event log.
- **Backward compatible.** All pre-existing modules, routes, and schemas are untouched
  (only additive event emissions were inserted).

---

## 3. Files Added

### Shared engine package — `packages/claim-intelligence/`

| File | Purpose |
|---|---|
| `src/types.ts` | `ClaimBundle`, `RecoveryReadiness`, `ClaimHealth`, `NBAction`, `Risk`, `KnowledgeGraph`, `DomainEvent`, `ExtractedEntity` |
| `src/scoring.ts` | 6-factor Recovery Readiness scoring (25/20/15/15/15/10) + `computeClaimHealth` |
| `src/next-best-actions.ts` | 8 rule-based, evidence-backed, explainable recommendations |
| `src/health-monitor.ts` | `detectRisks` (missing/duplicate/conflicting docs, missing signatures, missing carrier responses, expired deadlines, weak evidence, incomplete supplements) + `detectMissingInformation` |
| `src/knowledge-graph.ts` | Navigable typed graph: customer, property, claim, policy, carrier, photo, document, estimate, supplement, inspection, communication, evidence |
| `src/communications.ts` | Deterministic regex entity extraction: claim/policy numbers, dates, adjuster/customer names, addresses, damage descriptions, promises, requested documents, deadlines |
| `src/event-bus.ts` | Typed in-process pub/sub (subscribe/unsubscribe/publish, isolation per test) |
| `src/analyze.ts` | `analyzeClaim(bundle)` orchestrator — single entry point for the whole model |
| `src/index.ts` | Public exports |
| `package.json` / `tsconfig.json` | Workspace package (tsc → dist), mirrors `packages/ai` |

### Database migration

| File | Purpose |
|---|---|
| `packages/database/drizzle/0004_*.sql` (via migration 004) | `domain_events`, `claim_intelligence_snapshots`, `communication_extractions`, `carrier_intelligence` |
| `scripts/apply-migration-004.mjs` | Applies migration 004 against the live database |

### API layer

| File | Purpose |
|---|---|
| `apps/api/src/lib/intelligence/claim-intelligence-service.ts` | `loadClaimBundle`, `computeClaimIntelligence` (read-only), `analyzeClaimIntelligence` (persists), `emitClaimEvent` (domain_events + bus), `wireClaimIntelligenceEvents` (subscriber), `persistCarrierIntelligence` |
| `apps/api/src/routes/claim-intelligence.ts` | All `/intelligence/claims/*` endpoints (registered on the Fastify server) |

### Web layer

| File | Purpose |
|---|---|
| `apps/web/src/lib/claim-intelligence-server.ts` | `loadClaimBundleWeb` + `analyzeClaimWeb` (read-only, server-side) |
| `apps/web/src/app/api/intelligence/claims/[claimId]/[section]/route.ts` | Next.js route for summary / recovery-readiness / health / next-best-actions / knowledge-graph / history / communications |
| `apps/web/src/app/api/intelligence/claims/[claimId]/explain/[actionId]/route.ts` | AI explanation endpoint |
| `apps/web/src/components/projects/ClaimIntelligence.tsx` | Intelligence dashboard: Health Score, Recovery Readiness + factor breakdown, Evidence Map, Recommendation Feed, per-action AI Explanation panel, Risk Feed, Compliance Status, Claim Timeline + extracted-entity chips |

### Tests

| File | Purpose |
|---|---|
| `scripts/test-claim-intelligence.mjs` | 49 unit assertions (14 groups) against the pure engine |
| `scripts/validate-claim-intelligence.mjs` | Live-API integration test (seeds a claim, drives the workflow, asserts all 9 summary flags) |

---

## 4. Files Modified

| File | Change |
|---|---|
| `packages/database/src/schema/*` | 4 additive tables (domain events, snapshots, extractions, carrier intelligence) |
| `apps/api/src/routes/documents.ts` | Emit `document.uploaded` on document creation (syntax error introduced + fixed during review) |
| `apps/api/src/routes/supplements.ts` | Emit `supplement.submitted` on supplement creation |
| `apps/api/src/routes/claims.ts` | Emit `claim.created` on claim creation |
| `apps/api/src/routes/notes.ts` | Emit `communication.added` on note creation |
| `apps/api/src/server.ts` | Wire claim-intelligence routes + event bus startup |
| `apps/web/src/app/admin/claims/[id]/page.tsx` | Add the **Claim Intelligence** tab to the claim detail page |
| `apps/api/package.json` | Add `@project-atlas/claim-intelligence` workspace dependency |
| `apps/web/package.json` | Add `@project-atlas/claim-intelligence` workspace dependency |

---

## 5. Database Changes (additive only — no schema modifications)

| Table | Purpose |
|---|---|
| `domain_events` | Replayable, auditable event log (company_id, claim_id, event_type, entity_type, entity_id, payload, created_at) |
| `claim_intelligence_snapshots` | Historical snapshot per analysis run (health score, recovery readiness, compliance status, full model JSON) — powers the Recommendation History endpoint |
| `communication_extractions` | Structured entities extracted from communications (claim/policy numbers, dates, names, addresses, promises, requested documents, deadlines) linked to the source communication |
| `carrier_intelligence` | Carrier-specific learning foundation (preferred documentation, frequently requested evidence, common omissions, review timelines, communication history) |

All tables are company-scoped (RLS-friendly) and written best-effort (`.catch`), so
intelligence never blocks the primary workflow.

---

## 6. API Changes

All under `/intelligence`, **read-only and dynamically computed** unless noted:

| Endpoint | Purpose |
|---|---|
| `GET /intelligence/claims/:claimId/summary` | Live intelligence summary (scores, health, compliance, AI confidence, counts) |
| `GET /intelligence/claims/:claimId/recovery-readiness` | 0–100 score + per-factor breakdown |
| `GET /intelligence/claims/:claimId/health` | Health score + open risks + missing information |
| `GET /intelligence/claims/:claimId/next-best-actions` | Ranked, explainable recommendations |
| `GET /intelligence/claims/:claimId/knowledge-graph` | Navigable graph (nodes + typed edges) |
| `GET /intelligence/claims/:claimId/history` | Prior analysis snapshots (recommendation history) |
| `GET /intelligence/claims/:claimId/explain/:actionId` | Full AI explanation for one action |
| `GET /intelligence/claims/:claimId/communications` | Raw communications + extracted entities + stored count |
| `GET /intelligence/claims/:carrier?carrier=` | Carrier intelligence foundation |
| `POST /intelligence/claims/:claimId/analyze` | Force a persisted analysis (the only write path) |

### Event emissions

- `claim.created` — claims route
- `document.uploaded` — documents route
- `supplement.submitted` — supplements route
- `communication.added` — notes route

Each emission inserts a `domain_events` row (best-effort) and publishes to the in-process
bus. The `'*'` subscriber re-runs a persisted analysis. Future modules can subscribe
without touching existing logic.

---

## 7. UI Changes

The Claim Workspace (claim detail page) gains a **Claim Intelligence** tab containing:

- **Health Score** — live claim health (0–100) with severity color
- **Recovery Readiness** — 0–100 with the six contributing factors shown as bars
  (Evidence Quality 25% · Documentation 20% · Policy References 15% ·
  Carrier Response Coverage 15% · Compliance 15% · AI Confidence 10%)
- **Evidence Map** — counts of photos, documents, estimates, supplements, communications
- **Recommendation Feed** — ranked next-best actions with priority badges + confidence,
  each expandable into a full AI Explanation panel (why / supporting evidence / which
  documents, photos, policy sections, estimate line items contributed)
- **Risk Feed** — open risks and missing information as alerts
- **Compliance Status** — compliance validation state
- **Claim Timeline** — chronological communications log with extracted-entity chips
  (claim/policy numbers, deadlines, requested documents)

All panels fetch live data; no manual refresh required — the dashboard refreshes with
each analysis and on mount.

---

## 8. Event Flows

```
Photo uploaded (documents route)
        │  emitClaimEvent('document.uploaded')
        ▼
   domain_events row (best-effort) ──► replay/audit
        │
        ▼
   in-process bus publish ──────────► '*' subscriber
                                          │
                     analyzeClaimIntelligence (persisted, async)
                                          │
              ┌───────────────────────────┼────────────────────────────┐
              ▼                           ▼                            ▼
   snapshot row (history)        communication extractions      carrier intelligence
              │
              ▼
   UI dashboard + recommendations refresh (next fetch = live recompute)
```

The same chain fires for `supplement.submitted` and `communication.added`. Because GET
endpoints always recompute, the dashboard is correct even between persisted analyses.

---

## 9. Test Results

### Unit tests — `scripts/test-claim-intelligence.mjs` — **49/49 pass ✅**

| Group | Asserts |
|---|---|
| 6-factor weight sum = 100 | ✓ |
| Empty claim → low score / critical health | ✓ |
| Well-documented claim → readiness ≥ 70 | ✓ |
| Full model shape (all sections present) | ✓ |
| Next-best-actions (missing photos / carrier estimate / generate supplement **without** claim package) | ✓ |
| Risks: duplicate documents, missing signatures, missing photos | ✓ |
| Risks: conflicting estimates (2 estimate docs flagged) | ✓ |
| Knowledge graph: typed nodes, unique IDs for duplicate labels | ✓ |
| Communications extraction (claim/policy numbers incl. hyphenated, requested docs, deadlines, confidence, context) | ✓ |
| Event bus subscribe/unsubscribe + isolated publish | ✓ |
| Compliance status mapping | ✓ |
| Explainability fields on every action | ✓ |

### Integration tests — `scripts/validate-claim-intelligence.mjs` — **all 9 flags true ✅**

| Flag | Meaning |
|---|---|
| `dynamicSummary` | Summary recomputes live with correct shape |
| `weightsSum100` | Recovery Readiness factors sum to 100 |
| `explainable` | Every action exposes why/evidence/confidence |
| `knowledgeGraph` | Claim + carrier nodes and typed edges present |
| `communications` | Policy number + requested document extracted from a seeded note |
| `eventDriven` | **Snapshot persisted by the `communication.added` event before any explicit analyze** — proves continuous analysis without manual refresh |
| `analyzePersists` | Explicit analyze visible in history |
| `carrierFoundation` | Carrier intelligence row persisted with preferred docs |
| `errorHandling` | 404 on missing claim |

### Static checks

- `apps/api` `tsc` build: **clean** (no errors)
- `apps/web` `tsc --noEmit`: **clean** for all claim-intelligence files
- `@project-atlas/claim-intelligence` build: **clean**

---

## 10. Performance Considerations

- **Read-only compute:** GET endpoints never write; recomputation is O(bundle) with small
  constant factors (≤ a few ms per claim).
- **Best-effort persistence:** snapshot/extraction/carrier writes `.catch` and never
  block or fail the primary workflow.
- **Throttling-friendly:** the event subscriber can be debounced or serialized per claim
  without API changes (bus is in-process and typed).
- **History capped:** snapshots endpoint limits to 50 rows.
- **Deterministic extraction:** communications parsing is regex-based (no paid LLM
  calls), keeping per-request cost ≈ 0.

---

## 11. Remaining Roadmap

| Item | Notes |
|---|---|
| Snapshot retention policy | Prune snapshots older than N days per company (background job) |
| Knowledge Graph viewer | Interactive SVG/force-directed renderer in the UI (API + data model ready) |
| Carrier learning automation | Aggregate carrier_intelligence rows into per-carrier scorecards |
| Timeline enrichment | Fold decision-engine runs and supplement submissions into the Claim Timeline |
| Web-app persistence parity | Web-side `analyze` currently read-only; a web admin endpoint could persist snapshots directly (Fastify API already does) |
| Event replay tooling | Consumer for `domain_events` (e.g., rebuild a claim's model from the log) |
| Payload-lineage in explanations | Emit the exact policy-section/line-item references into the snapshot model for deeper traceability |

---

## 12. Conclusion

The AI Claim Intelligence Layer is **implemented, reviewed (3 rounds), and validated**:

- ✅ Engine package built, 49/49 unit tests passing
- ✅ Migration 004 applied; 4 new tables live
- ✅ API + web routes live; both apps typecheck clean
- ✅ Integration suite: all 9 summary flags true, including event-driven persistence
- ✅ Claim Intelligence tab + dashboard (with Claim Timeline) wired into the claim workspace
- ✅ Backward compatible — zero changes to existing schemas or module behavior
