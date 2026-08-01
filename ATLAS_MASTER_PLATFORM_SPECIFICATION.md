# ATLAS_MASTER_PLATFORM_SPECIFICATION

**The Constitution of Atlas — Single Source of Truth**

**Version:** 1.0
**Status:** Active / Living Document
**Owner:** Atlas Engineering
**Date:** August 2026

---

# Preamble

Atlas is an **AI-native operating system for insurance restoration companies**. It turns an
entire restoration business into a queryable, explainable, revenue-optimizing platform:
every claim, document, photo, communication, estimate, supplement, and AI observation is
captured, connected, and reasoned over — with every AI output traceable to evidence and
every financial claim computed, never fabricated.

This document is the **constitution** of Atlas. It consolidates the product vision, customer
journey, business workflows, platform and AI architecture, data model, intelligence layers,
security model, event system, package structure, APIs, UI architecture, multi-tenant model,
AI providers, and future roadmap into **one authoritative reference**.

Detailed sub-specifications remain in `docs/` and are normative where this document is
summary-level. Where they conflict, this document governs.

---

# Table of Contents

**Part I — Product**
1. Product Vision
2. Customer Journey
3. Business Workflows
4. Claims Lifecycle

**Part II — Platform**
5. Platform Architecture
6. Package Structure
7. Multi-Tenant Architecture
8. Security
9. Event System
10. APIs
11. UI Architecture

**Part III — Data**
12. Data Model
13. Evidence Graph
14. Knowledge Graph

**Part IV — AI**
15. AI Architecture & Providers
16. Decision Engine & Confidence
17. Claim Intelligence Layer
18. Operations Intelligence Layer
19. Financial Intelligence
20. Compliance
21. Cognitive Engine

**Part V — Roadmap & References**
22. Future Roadmap
23. Documentation Index
24. Glossary

---

# PART I — PRODUCT

# Section 1 — Product Vision

## 1.1 Mission

Atlas exists to give insurance restoration companies a **conversational operating system**:
an AI that understands every claim, manages every workflow, finds every dollar of recoverable
revenue, and explains every recommendation — so owners and operators can run a faster,
higher-margin restoration business.

## 1.2 The Four Evolutions

| Stage | Capability | Status |
|---|---|---|
| 1. AI-assisted workflows | Claims, interviews, documents, photos, supplements, packages, voice | ✅ Shipped |
| 2. AI Intelligence | Evidence Graph, Knowledge Graph, Decision Engine, Compliance, Claim Intelligence Layer | ✅ Shipped |
| 3. AI Operations | AI Case Manager, Lifecycle Engine, Financial Intelligence, Dashboards | ✅ Shipped |
| 4. AI Cognition | Cognitive Engine — coordinated, prioritized, self-improving AI | 📐 Specified (COGNITIVE-001) |

## 1.3 Product Principles

1. **Explainable AI** — every recommendation carries why, which evidence, which policy,
   which estimate item, which agent, and a confidence score. No opaque outputs.
2. **Evidence before conclusions** — no recommendation without a supporting evidence chain.
3. **Human approval before automation** — uncertain or high-stakes actions route to humans.
4. **Never fabricate financials** — all numbers derive from real data; absent data yields
   `null`, never invention.
5. **Flexible entry** — contractors join a claim at any stage (new, existing,
   supplement-only, imported); nothing blocks unrelated work.
6. **Composition over replacement** — intelligence layers coordinate existing engines, never
   duplicate them.
7. **Backward compatibility** — every phase ships additive; existing schemas, routes, and
   modules are preserved.
8. **Tenant isolation** — all data and cognition are scoped per company (RLS).
9. **Free AI by default** — Gemini + Groq free provider layer; no paid-LLM dependency.
10. **Event-driven, eventually consistent** — new information automatically triggers
    intelligence refreshes; the UI reads live recomputes.

## 1.4 Success Metrics (platform level)

- Recommendation accuracy: ≥ 90% of high-confidence recommendations accepted without change.
- Explainability: 100% of recommendations carry full traces.
- Financial honesty: 0 fabricated figures (CI-tested).
- Coverage: 100% of claims have a live Digital Twin within 1 minute of any change event.
- Replayability: any claim's state reconstructible from the `domain_events` log alone.
- Zero breaking changes across Phase 2→3→4.

---

# Section 2 — Customer Journey

## 2.1 Personas

| Persona | Needs | Atlas surface |
|---|---|---|
| **Owner / Executive** | Company health, revenue pipeline, bottlenecks, workload | Executive Operations Dashboard |
| **Project Manager** | Prioritized work, stalled-claim alerts, deadlines, team workload | Case Manager, Operations dashboards, Ask Atlas |
| **Estimator** | Fast supplement generation, pricing opportunities, policy-aware scope | Supplement Engine, Revenue Opportunity Detection, Claim Workspace |
| **Adjuster / Reviewer** | Evidence-backed recommendations, compliance readiness, approval workflows | Claim Intelligence tab, Compliance, Review workflow |
| **Technician / Field** | Intake, photo capture, inspection capture | Interviews, Photo/Document upload, Voice |

## 2.2 Journey Map

```
1. SIGN UP & ONBOARD     → company created, users invited, roles assigned (Supabase auth + RBAC)
2. ENTER THE WORKFLOW    → 4 entry points: New Claim / Continue Existing / Supplement Only / Import
3. CAPTURE               → customer, property, insurance, inspection (interview), photos, documents
4. INTELLIGENCE          → Atlas analyzes: evidence graph, KG, compliance, health, readiness (auto)
5. OPERATIONS            → case manager stages, deadlines, priorities, financial intelligence
6. ACT                   → recommendations: generate supplement, request evidence, follow up, escalate
7. REVIEW & APPROVE      → human review of AI outputs; overrides audited
8. SUBMIT & TRACK        → supplement submitted, carrier response tracked, negotiation
9. RECOVER REVENUE       → approved amounts, recovered revenue, outstanding opportunity
10. LEARN                → outcomes feed confidence calibration + carrier intelligence
11. MANAGE               → executive dashboard, portfolio trends, forecasts
```

## 2.3 Day-in-the-Life (illustrative)

- **08:00** — Owner opens `/admin/operations`: 3 claims at risk, $86k outstanding opportunity,
  one stalled 16 days (auto-escalated).
- **08:30** — Estimator opens the stalled claim's Workspace: Case Manager banner shows missing
  roof photos; recommendation "Upload 6 additional roof photos" with evidence refs.
- **09:00** — Estimator asks Ask Atlas: *"What does State Farm usually request for hail
  claims?"* — answered from carrier intelligence, grounded.
- **10:00** — Supplement generated for a supplement-only entry (no claim package required);
  compliance says *Ready*; financial shows +$12k opportunity at 82% confidence; routed to
  reviewer because > $5k.
- **14:00** — Reviewer approves; supplement marked submitted; timeline + case manager update
  automatically (event-driven).
- **16:00** — Voice: *"Atlas, what's the status of claim 23-441?"* → conversational answer.

---

# Section 3 — Business Workflows

## 3.1 Multi-Entry Claim Workflow (shipped, validated)

Contractors enter the claims lifecycle at **any stage**; all paths converge into the same
dynamic **Claim Workspace**.

```
        ┌─────────────────────────────────────┐
        │   New Project Dialog (4 entry points)│
        └──────────────┬──────────────────────┘
        ┌──────────────┼──────────────┬───────────────┐
        ▼              ▼              ▼               ▼
   Start New      Continue       Supplement      Import
   Claim          Existing       Only            Project
        └──────────────┬──────────────┴───────────────┘
                       ▼
              ┌──────────────────────┐
              │    Claim Workspace   │  ← dynamic, state-driven (14 adaptive sections)
              └──────────────────────┘
                       ▼
              AI Decision Engine
              evaluateTaskReadiness(task, ctx) — "enough verified evidence?"
```

**Entry points** (`entry_point` column on claims, default `new_claim`):

| Entry | Requires | Never blocks on |
|---|---|---|
| `new_claim` | customer, property, insurance | claim package, carrier response |
| `existing_claim` | insurance | claim package |
| `supplement_only` | claim number, carrier, estimates, photos/docs | **customer intake, claim package, inspection** |
| `imported` | customer, property, claim, docs/estimates (+ source system) | claim package |

**Six independent AI tasks** with per-task evidence requirements (`workflow-engine.ts`):
Generate Claim Package, Generate Supplement (**deliberately does NOT require claim package**),
Analyze Policy, Review Carrier Estimate, Generate Narrative, Generate Recommendations.
Missing **optional** modules → warnings with friendly messaging, never blockers; missing
**required** evidence → blocks.

## 3.2 Core Business Modules (all shipped)

| Module | Status | Description |
|---|---|---|
| Claims | ✅ | 12 workflow statuses, status history, financial fields, dashboard stats |
| Supplements | ✅ | 9 statuses, line items with auto-calculations, revision history, approval rate |
| Interviews | ✅ | 11 question types, FNOL template (15 sections), progress, autosave, claim data extraction |
| Documents | ✅ | Upload/download, public URLs, company-scoped, claim linking |
| Photos | ✅ | Managed as documents (image mime types); photo intelligence |
| Adjusters | ✅ | CRUD, search, assignment, active/inactive |
| Companies/Contacts/Properties/Tasks/Notes | ✅ | Full CRUD via generic route generator |
| Activity Timeline | ✅ | Chronological feed, filters, user attribution, prev/new values |
| Export Packages | ✅ | Package export workflow (claims detail) |
| Atlas Voice | ✅ | Ask Atlas conversational surface + voice orchestration with fallback |
| Evidence Graph | ✅ | Node/relationship model with claim-level API (`evidence-links`) |

## 3.3 Workflow Engine (`apps/api/src/lib/workflow-engine.ts`)

A pure, dependency-free state-driven engine (mirrored in `apps/web/src/lib/workflow-engine.ts`
so UI and API share one source of truth):

- `EntryPoint` + `ENTRY_POINTS` (labels, descriptions, icons)
- `AITask` + `AI_TASK_LABELS`
- `TASK_REQUIREMENTS` — per-task independent evidence requirements
- `evaluateTaskReadiness(task, ctx)` — blocks only on `missingRequired`
- `getWorkspaceState(entryPoint, ctx)` — entry-point-aware section states
  (`ready` / `inactive` / `optional` / `pending`)
- `ENTRY_POINT_CORE` — required sections per entry point
- `emptyEvidenceContext()` — 16-flag evidence context

---

# Section 4 — Claims Lifecycle

## 4.1 Claim Statuses (business workflow)

`New → Inspection Scheduled → Inspection Complete → Estimate Submitted → Supplement
Required → Supplement Submitted → Waiting for Carrier → Approved → Denied → Work In
Progress → Completed → Closed`

Status transitions are validated; every change is logged with timestamps and user
attribution (Activity Service).

## 4.2 Standardized Intelligence Lifecycle (Phase 3, 12 stages)

The AI Case Manager tracks a standardized 12-stage lifecycle **independent of** (but aligned
with) the business statuses:

```
Lead → Inspection Scheduled → Inspection Complete → Claim Created → Carrier Review →
Documentation Requested → Supplement Preparation → Supplement Submitted → Negotiation →
Approved → Final Payment → Closed
```

**Entry-point aware:** claims enter at the correct stage based on `entry_point`; the engine
determines current stage, next stage, progress %, missing requirements, blocking issues, and
recommended actions. **A closed claim can never regress** (CI-asserted).

## 4.3 Lifecycle Monitoring (AI Case Manager)

- **Stall detection** — 14 days with no activity → `cognitive.claim_stalled` event + alert.
- **Deadlines** — 21-day carrier-response expectation from supplements + deadlines extracted
  from communications.
- **Priority score** — 0–100, computed from stage, stall, deadlines, evidence gaps.
- **AI summary** — natural-language case-manager summary with next actions (rule-based
  fallback if providers unavailable).

---

# PART II — PLATFORM

# Section 5 — Platform Architecture

## 5.1 System Context

```
                ┌────────────────────────────────────────────────────┐
   USERS        │                    ATLAS PLATFORM                 │
 ┌─────────┐    │  ┌──────────────┐      ┌───────────────────────┐  │
 │ Browser │────┼─▶│  Next.js Web │      │  Fastify API (apps/api)│  │
 │ Voice   │    │  │  (apps/web)  │─────▶│  + server-side mirrors │  │
 └─────────┘    │  └──────────────┘      └───────────┬───────────┘  │
                │            ▲                       │              │
                │            └── server libs ────────┘              │
                │   ┌───────────────────────────────────────────┐   │
                │   │   Packages (shared, pure, framework-free) │   │
                │   │   claim-intelligence · ai · database · ui │   │
                │   │   + Phase 4: atlas-engine/agents/memory/… │   │
                │   └───────────────────────────────────────────┘   │
                │   ┌───────────────────────────────────────────┐   │
                │   │   Postgres (Supabase) · Auth · Storage    │   │
                │   │   RLS · domain_events · snapshots · twins │   │
                │   └───────────────────────────────────────────┘   │
                │   ┌───────────────────────────────────────────┐   │
                │   │   AI Providers: Gemini 2.5 Flash + Groq   │   │
                │   └───────────────────────────────────────────┘   │
                └────────────────────────────────────────────────────┘
```

## 5.2 Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Monorepo | Turborepo + pnpm/bun workspace | Shared configs, build orchestration |
| API | Fastify (TypeScript) | Typed routes, auth middleware, company-context RLS |
| Web | Next.js (App Router) | SSR + server-side intelligence mirrors |
| DB | PostgreSQL via Drizzle ORM | Migrations 001–005 applied; RLS policies |
| Auth | Supabase Auth | Email/password + magic link; JWT; role from tenant_members |
| Storage | Supabase Storage | Documents, photos, exports; public URLs |
| AI | Gemini 2.5 Flash (primary) + Groq Llama (fallback) | `generateText()` single entry point; free provider layer |
| Language | TypeScript throughout | Strict; shared configs |
| Validation | Zod | API + env schemas |

## 5.3 Layered Architecture

| Layer | Responsibility | Home |
|---|---|---|
| L0 Presentation | Dashboards, workspace, Ask Atlas, voice UI | `apps/web` |
| L1 API / BFF | Routes, auth, RLS context, read-only compute mirrors | `apps/api` + `apps/web/src/lib/*-server.ts` |
| L2 Intelligence | Claim Intelligence, Operations, Cognitive (future) | `packages/claim-intelligence` + Phase 4 `atlas-*` |
| L3 Data | Persistence, events, snapshots, twins | `packages/database` |

**Dependency rule:** layers depend downward only; packages are framework-free and shared by
both apps (the Phase 2/3 pattern that eliminates duplicated business logic).

## 5.4 Runtime Topology

- **API** runs on port 3001 (`apps/api`, entry `dist/server.js`); serves `/api/v1/*` and the
  intelligence/operations routes.
- **Web** runs on port 3000 (`apps/web`); Next.js API routes mirror read-only intelligence
  for SSR/dashboard rendering.
- **Event bus** is in-process pub/sub; `domain_events` table gives persistence + replay.
- **Demo mode** — 6 personas, seeded demo company (scripts in `apps/api/src/lib/demo-data/`).

---

# Section 6 — Package Structure

## 6.1 Current Packages

```
packages/
  ai/               # Free AI provider layer (Gemini + Groq), generateText(), prompts, UnifiedAIProvider
  api-utils/        # Shared API helpers
  claim-intelligence/  # Phase 2 (scoring, health, NBA, KG, comms, event-bus, analyze)
                    #        + Phase 3 (lifecycle, financial, opportunities, ops-rec, case-manager,
                    #          digital-twin, portfolio, operations orchestrator)
  config-eslint/    # Shared ESLint presets
  config-typescript/# Shared TS presets
  database/         # Drizzle schema + migrations (001–005)
  ui/               # Design-system primitives (Button, Input, …)
```

## 6.2 Phase 4 Target Packages (per COGNITIVE-001 §14)

```
packages/
  atlas-shared/     # types, enums, evidence refs, config, errors
  atlas-events/     # cognitive event catalog, idempotency, replay helpers
  atlas-memory/     # ContextBundle facade over existing tables (no new DB)
  atlas-knowledge/  # KG taxonomy extensions, traversal, portfolio fold
  atlas-scoring/    # confidence aggregation, ranking, calibration
  atlas-agents/     # 10 cognitive agents (thin adapters over engines)
  atlas-engine/     # Orchestrator: planner, scheduler, synthesizer, router, learning
```

## 6.3 Package Rules

- Pure TS, no framework imports in package cores (testable in isolation).
- `atlas-memory` is the only package that touches `database` directly.
- App adapters (in `apps/api`, `apps/web`) wire packages to Fastify/Next.js.
- No circular dependencies (agents never import engine).

---

# Section 7 — Multi-Tenant Architecture

## 7.1 Model

- Every tenant row carries `company_id` (UUID) with FK cascade.
- **RLS policies** enforce row-level isolation at the database.
- **Company context** is set per request in the DB session by the auth middleware
  (`set_config`-style pattern; Phase 3 RLS fix).
- `tenant_members` maps users ↔ companies with roles.
- CRUD routes filter by company scope; all intelligence queries are company-scoped.

## 7.2 Tenant Scoping in Intelligence

- `domain_events`, `claim_intelligence_snapshots`, `communication_extractions`,
  `carrier_intelligence`, `digital_twins` are all company-scoped.
- Memory facade (Phase 4) always filters by companyId — no cross-tenant read is expressible.
- No cross-tenant knowledge sharing (per ATLAS_MEMORY_ENGINE_SPEC security).

## 7.3 Roles (RBAC, PLAT-002)

| Role | Capabilities |
|---|---|
| Viewer | View claims, recommendations, traces |
| Adjuster/Estimator | Accept/reject; request evidence; edit claims/supplements |
| Reviewer | Approve, reject, modify, override AI recommendations |
| Admin | Override compliance veto; edit engine config; user/tenant admin |

Roles are extracted from `tenant_members`; UI hides actions by permission.

---

# Section 8 — Security

## 8.1 Authentication

- Supabase Auth: email/password + magic link; JWT sessions; API auth middleware verifies
  tokens and resolves company + role.
- Frontend route protection middleware; protected admin routes.

## 8.2 Authorization & Isolation

- RLS at DB; company context per session; role checks per action.
- Cognitive endpoints (Phase 4) reuse the same middleware.

## 8.3 Data Protection

- Encryption at rest and in transit (platform posture).
- PII minimization in AI paths: Slim fields only; redact policy/claim numbers in stochastic
  prompts; prefer deterministic alternatives over sending raw PII to providers.
- Retention: snapshots prunable; cycle records company-owned and deletable.

## 8.4 Prompt Security (Phase 4 spec)

- All LLM prompts templated; document text treated as untrusted (prompt-injection guard).
- Outputs parsed into typed schemas; invalid → fallback.
- Provider keys in server env only; model/version recorded per output.

## 8.5 Audit

- Activity Timeline (user actions), `domain_events` (system/business events), Phase 4
  cognitive cycle records — all auditable, immutable where required (PLAT-005).

---

# Section 9 — Event System

## 9.1 Architecture (PLAT-006 + Phase 2 implementation)

```
Domain action → Domain event → Event bus (in-process pub/sub) → subscribers
                                      │
                                      ▼
                              domain_events table (persist + replay)
```

- Event envelope: `{ eventId, eventType, organizationId/companyId, entityType, entityId,
  payload, createdAt, version? }`
- Commands are requests; **events are facts** (already happened).

## 9.2 Emitted Domain Events (current, factual)

| Event | Emitted by |
|---|---|
| `claim.created` | claims route |
| `document.uploaded` | documents route (also covers photos/estimates — they are documents) |
| `supplement.submitted` | supplements route (on creation) |
| `communication.added` | notes route |

Planned (cataloged in PLAT-006, not yet emitted): `photo.uploaded`, `estimate.uploaded`,
`ocr.completed`, `claim.updated`, `supplement.approved/denied`, `evidence.link_created`, …
Implementers must not depend on them until wired.

## 9.3 Intelligence Subscribers

- `wireClaimIntelligenceEvents` — persist Phase 2 snapshot per claim event.
- `wireOperationsEvents` — refresh digital twin per claim event.
- `wireCognitiveEvents` (Phase 4) — debounced cognitive cycle per claim.

## 9.4 Cognitive Event Catalog (Phase 4, 19 events)

`cognitive.cycle_started/completed/failed`, `cognitive.review_required`,
`cognitive.policy_updated`, `cognitive.evidence_updated`, `cognitive.financial_updated`,
`cognitive.opportunity_detected`, `cognitive.compliance_updated/blocked`,
`cognitive.claim_stalled`, `cognitive.deadline_approaching`, `cognitive.priority_changed`,
`cognitive.communications_updated`, `cognitive.document_intelligence_updated`,
`cognitive.knowledge_graph_updated`, `cognitive.recommendations_updated`,
`cognitive.answered`, `cognitive.agent_defect`.

## 9.5 Reliability

- Best-effort publish (`.catch`, never blocks primary workflow).
- Idempotency via eventId; cycles idempotent (pure recompute).
- Replay from `domain_events` (read-only with `replay_cycle` flag).
- Per-claim debounce (1 s default) + per-claim serialization (Phase 4).
- `traceId` propagation across event → cycle → agents → outputs.

---

# Section 10 — APIs

## 10.1 API Surface Summary

| Group | Routes | Notes |
|---|---|---|
| Auth | Supabase-managed; middleware | JWT verified; company + role resolved |
| Core CRUD | `/companies`, `/contacts`, `/properties`, `/claims`, `/supplements`, `/tasks`, `/notes`, `/interviews`, `/adjusters`, `/tenants`, `/users`, `/tenant-members` | Generic route generator + Zod schemas; company-scoped |
| Claims workflow | status change, transitions, dashboard stats | Activity Service logging |
| Supplements workflow | status change, transitions, dashboard stats, line items | 9 statuses, revision history |
| Interviews workflow | template, questions, progress, autosave, extraction | 11 question types, FNOL template |
| Multi-entry | `/api/v1/multi-entry/supplement-only`, `/import`, `/workspace/:claimId`, `/ai-tasks/:task/check` | 4 entry points; evidence-based readiness |
| Documents | upload/download, claim linking | Supabase storage, public URLs |
| Intelligence | `/intelligence/claims/:id/{summary,recovery-readiness,health,next-best-actions,knowledge-graph,history,explain/:actionId,communications}`, `/intelligence/claims/:carrier?carrier=`, `POST /analyze` | Read-only dynamic recompute; analyze = only write path |
| Operations | `/operations/claims/:id/{lifecycle,financial,case-manager,opportunities,recommendations,twin}`, `/operations/company/{overview,revenue,executive,portfolio}`, `POST /refresh` | Phase 3 dashboards; refresh = only write path |
| Evidence | evidence-links create/get; claim-level evidence graph | Phase 2/3 integration |
| AI supplements | `/ai-supplements` generate | Structured 500 when providers unconfigured (clean) |
| Demo | demo mode, 6 personas | Seed + persona endpoints |
| Activity | activity timeline with filters/search/pagination | Audit-style log |
| Cognitive (Phase 4) | `/cognition/claims/:id/analyze`, `/state`, `/cognition/cycles/:id`, `/cognition/agents`, `POST /config` | Planned |

## 10.2 Conventions

- JSON payloads; Zod validation (`safeParse` → 400 with details; missing/unknown → 404; unexpected → 500 with message).
- Auth-gated everywhere; company-scoped by default.
- Read paths always recompute live (never stale); write paths are explicit (`analyze`, `refresh`).
- Intelligence persistence is best-effort (`.catch`) — never blocks primary workflows.

## 10.3 Web (Next.js) API Routes

Next.js API routes mirror read-only intelligence for SSR/dashboard rendering:

- `/api/intelligence/claims/[claimId]/[section]` (+ `explain/[actionId]`)
- `/api/operations/claims/[claimId]/[section]` and `/api/operations/company/[section]`
- `/api/ai-supplements`

Server-side libraries: `apps/web/src/lib/{claim-intelligence-server,operations-server,server-db,server-auth}.ts`.

---

# Section 11 — UI Architecture

## 11.1 Shell & Navigation

- Next.js App Router; admin area with protected routes; responsive navigation with
  sign-out; route-protection middleware.
- Design system migrated to the Lovable design language (Button, Input, cards, badges,
  dialogs, tabs, steppers).

## 11.2 Key Screens

| Screen | Route | Content |
|---|---|---|
| Landing | `/` | Marketing/entry |
| Login | `/login` | Email/password + magic link |
| Dashboard | `/admin` | Claims widgets, supplements widgets, recently updated, New Project button |
| Claims list | `/admin/claims` | Search, filters, pagination, entry-point badge |
| Claim detail (Workspace) | `/admin/claims/[id]` | **14 adaptive sections**: Customer, Property, Insurance, Timeline, Communications, Documents, Photos, Estimates, Evidence, AI Insights, Claim Package, Supplements, Carrier Responses, Compliance + tabs (Workspace \| Intelligence \| Operations) + AI task readiness panel |
| Claim Intelligence tab | same | Health score, Recovery Readiness (6-factor bars), Evidence Map, Recommendation Feed + explain panels, Risk Feed, Compliance status, Timeline + extracted-entity chips |
| Operations tab | same | Case Manager banner, 12-stage lifecycle stepper, Digital Twin snapshot, Financial Intelligence w/ sources, deadlines, explainable opportunities, recommendations w/ business impact |
| Operations dashboards | `/admin/operations` | 3 tabs: Revenue Recovery \| Executive \| Portfolio (drill-down) |
| Supplements | `/admin/supplements` + detail | Filters, line-item editor w/ auto-calc, status history, financial summary |
| Interviews | list + detail | Question runner, progress bar, section nav, autosave |
| Documents | management UI | Upload/download, claim linking |
| Ask Atlas | home/conversational | Background intelligence cards, push-to-talk STT/TTS, AI orchestration routing, Operations quick card |
| System health | `/admin/system-health` | Readiness incl. AI provider status |
| New Project dialog | modal | 4 entry points with adaptive forms |

## 11.3 UI Principles

- Live data: dashboards fetch fresh; no manual refresh needed (event-driven refresh + live recompute).
- Entry-point awareness: optional modules show friendly "not yet generated" messaging, never errors.
- Explainability surfacing: every recommendation expandable into why/evidence/confidence; rejected alternatives disclosure (Phase 4).
- Accessibility: aria labels, focus states, keyboard navigation.
- Micro-interactions: hover states, transitions, loading skeletons.

---

# PART III — DATA

# Section 12 — Data Model

## 12.1 Principles

- UUID primary keys; `company_id` on all tenant tables; FK cascade deletes; audit fields
  (`created_by`, `updated_by`) + timestamps everywhere.
- Drizzle ORM schema + raw SQL migrations; migrations 001–005 applied and verified live.
- Additive evolution only: every phase adds tables/columns, never alters existing ones.
- RLS policies defined per table.

## 12.2 Core Tables

| Domain | Tables | Notes |
|---|---|---|
| Organizations | organizations, tenants, tenant_members, users | Multi-tenant foundation, RBAC roles |
| Operations | companies, contacts, properties, projects, rooms | Reference + operational entities |
| Claims | claims (+ `entry_point`, `source_system`), claim status history | 12 statuses; financial summary fields |
| Work | supplements (+ line items, revision/status history), interviews (+ templates, responses), tasks, adjusters, notes | 9 supplement statuses; 11 question types; activity logging |
| Files | documents, photos, storage refs, file versioning | Supabase storage; image mime inference |
| Evidence | evidence_links, evidence graph nodes/edges | Claim-level graph API |
| Intelligence (m004) | domain_events, claim_intelligence_snapshots, communication_extractions, carrier_intelligence | Replayable log; snapshot history; extraction store; carrier learning |
| Operations Intel (m005) | digital_twins | Latest twin snapshot per claim |
| Reference | reference data, restoration reference, compliance rules, prompts, webhooks/api-keys, vector search, voice sessions, analytics | Supporting schemas |

## 12.3 Key Column Highlights

- `claims`: `entry_point` (VARCHAR(32), default `new_claim`), `source_system`,
  `estimated_value`, `approved_value`, `deductible`, carrier/policy/customer/property
  links, status + status history.
- `supplements`: 9 statuses, line-item math (subtotal, tax, depreciation, requested,
  approved, difference), version + revision history.
- `domain_events`: `{ id, company_id, claim_id, event_type, entity_type, entity_id,
  payload JSONB, created_at }`.
- `claim_intelligence_snapshots`: health score, recovery readiness, compliance status,
  full model JSONB; history endpoint caps at 50.
- `carrier_intelligence`: preferred docs, frequently requested evidence, common omissions,
  review timelines, communication history.
- `digital_twins`: `{ company_id, claim_id, twin JSONB, generated_at }` — latest snapshot;
  GET always computes live.

## 12.4 Migration History

| Migration | Purpose |
|---|---|
| 001–002 | Foundation (organizations, users, tenants) |
| 003 | Multi-entry workflow: `claims.entry_point` + `source_system` + index |
| 004 | Claim Intelligence: domain_events, snapshots, extractions, carrier_intelligence |
| 005 | Operations Intelligence: digital_twins |

---

# Section 13 — Evidence Graph

## 13.1 Purpose (EVIDENCE_GRAPH_SPEC)

The Evidence Graph is the system of record for **connected evidence**: every entity,
document, photo, communication, workflow event, estimate, supplement, and AI observation is
a node; every relationship is an explicit, timestamped, confidence-bearing edge. It is what
makes every recommendation explainable and traceable.

## 13.2 Node Types

Claims, Projects, Rooms, Photos, Documents, Supplements, Estimate Line Items, Damage
Observations, Materials, Inspections, Communications, People, Companies, Timeline Events.

## 13.3 Relationship Types (examples)

`CLAIM_HAS_PROJECT`, `PROJECT_HAS_ROOM`, `ROOM_HAS_DAMAGE`, `PHOTO_SHOWS_DAMAGE`,
`PHOTO_LOCATED_IN_ROOM`, `PHOTO_SUPPORTS_SUPPLEMENT`, `DOCUMENT_REFERENCES_ROOM`,
`DOCUMENT_SUPPORTS_LINE_ITEM`, `SUPPLEMENT_REQUESTS_LINE_ITEM`,
`ESTIMATE_CONTAINS_LINE_ITEM`, `LINE_ITEM_REPAIRS_DAMAGE`, `INSPECTION_FOUND_DAMAGE`,
`EMAIL_REFERENCES_CLAIM`, `CALL_DISCUSSES_SUPPLEMENT`, `PERSON_CREATED_DOCUMENT`,
`PERSON_APPROVED_SUPPLEMENT`, `AI_GENERATED_OBSERVATION`, `OBSERVATION_SUPPORTS_DECISION`,
`DECISION_REQUIRES_EVIDENCE`.

Each edge stores confidence, source, timestamp, created by, AI model, human verification,
version.

## 13.4 Evidence Lifecycle

`Collected → Analyzed → Linked → Validated → Referenced → Archived`

## 13.5 API

`GET /evidence/{id}`, `GET /graph/{claimId}`, `GET /graph/search`, `POST /graph/link`,
`POST /graph/query`, `POST /graph/explain`, `GET /graph/timeline`, `GET /graph/evidence`.
The live implementation exposes claim-level evidence links (`evidence-links` routes),
integrated with the Claim Intelligence evidence map.

## 13.6 Role in the Platform

- Every AI recommendation cites evidence refs (`EvidenceRef`) into this graph.
- Missing-evidence detection powers compliance + recovery readiness + opportunities.
- Phase 4 Knowledge Graph evolution layers cognitive relationships on top (Section 14.3).

---

# Section 14 — Knowledge Graph

## 14.1 Purpose (Phase 2 `knowledge-graph.ts`)

The Knowledge Graph is the **navigable typed graph** per claim: customer, property, claim,
policy, carrier, photo, document, estimate, supplement, inspection, communication, evidence
— as typed nodes with typed edges, unique IDs, and explainable structure. It is rebuilt
live per analysis and embedded in intelligence responses and the Digital Twin.

## 14.2 Current Capabilities

- Typed node/edge model (unique IDs for duplicate labels).
- Exposed via `GET /intelligence/claims/:id/knowledge-graph` and embedded in the twin.
- Integrated into the Claim Intelligence UI evidence map.

## 14.3 Phase 4 Evolution (COGNITIVE-001 §9)

**New node types:** `opportunity`, `recommendation`, `risk`, `deadline`, `carrier-signal`,
`lesson`, `portfolio-metric`.

**New relationship types:** `supports`, `triggers`, `blocks`, `derived-from`,
`contributes-to`, `relates-to` (cross-claim), `concentrates`, `learned-from`,
`degraded-to` (rejected alternative).

**Semantic families:** evidence, policy, financial, temporal, cross-claim, portfolio.

**Traversal strategies:** BFS evidence chains, shortest-path blockers, k-similarity cross-
claim, provenance reverse-derivation, portfolio fold drill-down.

**Versioning:** graph recomputed per cycle; historical graphs recoverable from snapshots;
no separate graph storage or migration required.

---

# PART IV — AI

# Section 15 — AI Architecture & Providers

## 15.1 Architecture Principle

**Deterministic core first, stochastic surface last.** All numbers, scores, lifecycle
stages, and financial figures are computed by deterministic rules (reproducible,
auditable, free). LLM capabilities (summaries, explanations, conversation) run last, are
always grounded in the deterministic outputs, and are never the source of truth for
numbers. This is the design philosophy that makes Atlas explainable and cheap to run.

## 15.2 Free AI Provider Layer (shipped, validated)

| Item | Detail |
|---|---|
| Primary | **Google Gemini 2.5 Flash** (`GOOGLE_API_KEY`) via REST (no SDK) |
| Fallback | **Groq — Llama-3.3-70B** (`GROQ_API_KEY`) via OpenAI-compatible REST |
| Selection | `AI_PROVIDER=gemini` (default) or `groq` |
| Entry point | `generateText()` — the ONLY call surface app code uses |
| Result | Always structured `AITextResult` (success/failure union) — **never throws** |
| Fallback logic | No keys → structured failure (`retryable:true`); Gemini fail → Groq; both fail → structured failure |
| Logging | Structured `[atlas-ai]` JSON events (provider, model, latency, tokens, failures, fallbacks); injectable logger |
| Prompts | Single source of truth: `packages/ai/src/generate/prompts/{supplement,policy,claim,interview,summary}.ts` |
| Adapter | `UnifiedAIProvider` bridges the supplement engine to `generateText()` |

```
app code (web + api) ──► generateText() ──► provider.ts
                                            ├─ AI_PROVIDER=groq → Groq direct
                                            └─ default gemini ──► Gemini ──fail──► Groq
                                            └─► structured AITextResult + [atlas-ai] log
```

**Config note:** with no real keys set, the AI supplement path returns a clean structured
`500 "AI provider not configured. Set GOOGLE_API_KEY and/or GROQ_API_KEY."` — supplying
keys is configuration, not code.

## 15.3 AI Call Boundaries

- Deterministic analysis never calls an LLM (cost ≈ 0 per request).
- Stochastic surfaces (summaries, explanations, conversation) call only through
  `generateText()`/`AiProviderPort`.
- Phase 4 conversation agent: grounded answers, refuses when evidence absent, rule-based
  fallback on provider outage.

---

# Section 16 — Decision Engine & Confidence

## 16.1 Purpose (DECISION_CONFIDENCE_ENGINE_SPEC)

The Decision & Confidence Engine transforms structured evidence into **explainable
recommendations** with calculated confidence — never guessed. It evaluates completeness,
quality, consistency, and reliability before recommending or escalating.

## 16.2 Pipeline

`Collect evidence → Validate → Detect inconsistencies → Assess completeness → Calculate
confidence → Generate recommendation → Evaluate compliance → Escalate if required →
Publish`

## 16.3 Confidence Model

Weighted factors (configurable): evidence completeness 30%, evidence quality 20%,
cross-source consistency 15%, historical success 10%, human verification 10%, compliance
validation 10%, model certainty 5%.

Confidence categories: Very High 95–100% · High 85–94% · Moderate 70–84% · Low 50–69% ·
Very Low < 50%.

## 16.4 Readiness & Escalation

- Compliance readiness: `Ready / Needs Supporting Evidence / Needs Human Review / Blocked`.
- Auto-escalate on: confidence below threshold, critical evidence missing, compliance
  blocked, contradictions, large financial exposure, repeated AI uncertainty, manual
  override.
- Decision lifecycle: `Draft → Pending Analysis → Evidence Linked → Recommendation
  Generated → Human Review → Approved → Executed → Archived`.
- Learning loop: outcome vs predicted confidence → calibration (offline, audited).

## 16.5 Relationship to the Workflow Engine

The multi-entry workflow engine (`evaluateTaskReadiness`) embodies the same evidence-first
principle per AI task: it asks "do I have enough verified evidence?" per task, independent
of unrelated modules.

---

# Section 17 — Claim Intelligence Layer (Phase 2)

## 17.1 What It Is

The Claim Intelligence Engine continuously analyzes every claim and maintains a **live
intelligence model**: recovery readiness, health, risks, next-best actions, knowledge
graph, communications intelligence, and AI recommendations — refreshed automatically on
every event.

## 17.2 Modules (`packages/claim-intelligence`)

| Module | File | Function |
|---|---|---|
| Scoring | `scoring.ts` | 6-factor Recovery Readiness (25/20/15/15/15/10) + Claim Health |
| Next Best Actions | `next-best-actions.ts` | 8 rule-based, evidence-backed, explainable actions |
| Health Monitor | `health-monitor.ts` | Risk detection (missing/duplicate/conflicting docs, missing signatures, expired deadlines, weak evidence, incomplete supplements) + missing-information detection |
| Knowledge Graph | `knowledge-graph.ts` | Navigable typed graph per claim |
| Communications | `communications.ts` | Deterministic regex extraction (numbers, dates, names, promises, requested docs, deadlines) |
| Event Bus | `event-bus.ts` | Typed in-process pub/sub |
| Orchestrator | `analyze.ts` | `analyzeClaim(bundle)` — single entry point for the whole model |
| Types | `types.ts` | ClaimBundle, RecoveryReadiness, ClaimHealth, NBAction, Risk, KnowledgeGraph, DomainEvent, ExtractedEntity |

**Recovery Readiness factors:** Evidence Quality 25% · Documentation 20% · Policy
References 15% · Carrier Response Coverage 15% · Compliance 15% · AI Confidence 10%.

## 17.3 API & Persistence

- `/intelligence/claims/:id/{summary,recovery-readiness,health,next-best-actions,
  knowledge-graph,history,explain/:actionId,communications}` — read-only, dynamic.
- `POST /intelligence/claims/:id/analyze` — the only write path (persists snapshot).
- Event-driven: any claim event triggers a persisted analysis automatically
  (`wireClaimIntelligenceEvents`).

## 17.4 Validation

49/49 unit assertions; 9/9 integration flags (incl. event-driven persistence); part of the
50-endpoint sweep with zero server errors.

---

# Section 18 — Operations Intelligence Layer (Phase 3)

## 18.1 What It Is

The Operations Intelligence Layer turns Atlas from a claim *analyzer* into an AI
*operations platform*: an experienced restoration operations manager that monitors every
claim, detects bottlenecks, prioritizes work, and recommends the next best business actions.

## 18.2 Modules (Phase 3, in `packages/claim-intelligence`)

| Module | File | Function |
|---|---|---|
| AI Case Manager | `case-manager.ts` | Stall detection (14 days), deadlines (21-day carrier + comms), priority score (0–100), AI summary |
| Claim Lifecycle Engine | `lifecycle.ts` | 12 stages, entry-point aware, closed-never-regresses |
| Financial Intelligence | `financial.ts` | 8 explainable figures; never fabricates |
| Revenue Opportunity Detection | `revenue-opportunities.ts` | 7 rule-based opportunity types |
| Operational Recommendation Engine | `ops-recommendations.ts` | Priority/category/reason/business-impact/action |
| Claim Digital Twin | `digital-twin.ts` | Full claim aggregate (persisted `digital_twins`) |
| Portfolio Intelligence | `portfolio.ts` | Revenue Recovery + Executive + Portfolio dashboards |
| Orchestrator | `operations.ts` | `analyzeOperations` + `analyzePortfolio` |

## 18.3 Dashboards

- **Revenue Recovery** — active/awaiting/ready/missing/at-risk counts; recoverable,
  recovered, outstanding revenue; average health/readiness/AI confidence.
- **Executive** — company health, claim + revenue pipelines, high-risk claims, deadlines,
  team workload (approximated by per-stage counts), AI recommendations, revenue forecast,
  bottlenecks.
- **Portfolio** — common missing docs, delayed stages, recurring carrier requests, revenue
  concentration by carrier, supplement success rates, trends.

## 18.4 API

`/operations/claims/:id/{lifecycle,financial,case-manager,opportunities,recommendations,
twin}`, `/operations/company/{overview,revenue,executive,portfolio}`, `POST
/operations/claims/:id/refresh` (only write path). All read paths recompute live; twin
refresh also event-driven.

## 18.5 Validation

89/89 unit assertions; 56/56 integration assertions (all 10 flags true); endpoint sweep
50/50 with zero server errors; engine validation green; Phase 2 suite unaffected (49/49).

---

# Section 19 — Financial Intelligence

## 19.1 Principle

**Never fabricate.** All financial figures are derived from real claim data (estimates,
supplements, approvals); insufficient data yields `null`, never invention. Every figure
carries a source, evidence, and confidence score — fully explainable.

## 19.2 Tracked Figures (8, from `financial.ts`)

| Figure | Definition |
|---|---|
| Original Estimate | Claim's estimated value |
| Carrier Approved Amount | Approved value (claim-level approval, else supplement approvals) |
| Contractor Estimate (Total Scope) | Original estimate + **requested** supplement value (avoids double-count) |
| Supplement Value | Sum of requested supplement amounts |
| Recovered Revenue | Sum of approved supplement amounts |
| Outstanding Revenue | Requested − approved supplement gap |
| Potential Recovery | max(0, contractor scope − carrier approved) |
| Estimated Recovery Opportunity | Potential recovery, confidence-weighted |

Each figure carries a confidence score and a source string (e.g.,
`derived: claim.estimated_value + requested supplements`), so the math is auditable.

## 19.3 Revenue Opportunity Detection (7 types, `revenue-opportunities.ts`)

1. Missing estimate items
2. Pricing discrepancy (requested vs approved gap)
3. Code-related (Xactimate/RCV/ACV/code upgrades)
4. Matching (photos vs estimate)
5. Overhead & profit
6. Documentation deficiency
7. Potential supplement

Each opportunity: estimated value, confidence, priority, evidence, required action, and
explanation (why/what supports it/which docs & estimate items contributed).

## 19.4 Aggregate Financial Views

- Revenue Recovery Dashboard (company): recoverable/recovered/outstanding revenue.
- Executive: revenue pipeline, revenue forecast (30/60-day confidence-weighted buckets).
- Portfolio: carrier revenue concentration, supplement success rates.
- No opportunity is ever shown without an evidence chain and confidence — the Explainable
  Business Intelligence rule.

---

# Section 20 — Compliance

## 20.1 Purpose

The Compliance Validator ensures every recommended action and package is compliant for the
claim's jurisdiction and carrier — required documentation, signatures, policy references,
and scope constraints.

## 20.2 Model

- Readiness status: `Ready / Needs Supporting Evidence / Needs Human Review / Blocked`.
- Compliance status is surfaced in: Claim Intelligence tab (compliance status), Recovery
  Readiness factor (15%), Case Manager, Lifecycle (`blockingIssues`), and the Digital Twin.
- A `Blocked` status **vetoes** auto-approval of any financial or submission action
  (Decision Framework rule, Phase 4).

## 20.3 Compliance Agent (Phase 4)

Runs compliance validation (reuses existing rules engine); tracks exceptions; evaluates
readiness; escalates blockers. Safe default: rule-load failure degrades to
*needs human review*, never to auto-approve.

---

# Section 21 — Cognitive Engine

## 21.1 What It Is

The Cognitive Engine (Phase 4, **specified** in `docs/intelligence/COGNITIVE_ENGINE_
ARCHITECTURE_SPEC.md` / COGNITIVE-001) is the orchestration layer that **thinks,
coordinates, explains, prioritizes, and continuously improves**. It does not replace any
existing system — it schedules them.

## 21.2 Core Concepts

- **Cognitive cycle** — one orchestrated run of agents for a claim, triggered by an event,
  manual analyze, or schedule.
- **Orchestrator** — planner (trigger→DAG), scheduler (waves, concurrency, retry, timeout),
  synthesizer (merge, rank, explain), router (human-review thresholds). Never analyzes.
- **10 cognitive agents** — Policy, Evidence, Financial, Compliance, Operations,
  Communications, Document Intelligence, Recommendation, Knowledge Graph, Conversation.
  Each is a thin adapter over an existing engine (no duplication).
- **Shared memory** — `ContextBundle` facade over existing tables (`domain_events`,
  snapshots, extractions, carrier intelligence, twins). No new database.
- **Decision framework** — weighted confidence aggregation, compliance veto, evidence
  floor, ranking, human-review thresholds (confidence < 0.70 or exposure ≥ $5k → review).
- **Explainability** — 9-question trace model (why, evidence, policy, estimate,
  communication, agent, confidence, alternatives, rejected alternatives).
- **Learning** — outcome capture → calibration → diffed, audited config proposals.

## 21.3 DAG Execution (typical)

```
Wave 1 (parallel): Communications, Document Intelligence, Evidence
Wave 2: Policy
Wave 3: Knowledge Graph, Compliance, Operations, Financial
Wave 4: Recommendation
Stochastic tail: Conversation (grounded on synthesized output)
```

## 21.4 Events

19-event cognitive catalog (`cognitive.cycle_started/completed/failed`, …) on the existing
bus + `domain_events` persistence; per-claim debounce + serialization; `traceId`
propagation.

## 21.5 Status

Specification complete (COGNITIVE-001 v1.0, ~2,000 lines, two review rounds signed off).
Implementation roadmap Phases 4A–4F (Section 22.3).

---

# PART V — ROADMAP & REFERENCES

# Section 22 — Future Roadmap

## 22.1 Immediate (hardening of shipped layers)

| Item | Notes |
|---|---|
| Real AI keys | Add `GOOGLE_API_KEY` / `GROQ_API_KEY` to envs — config step; unlocks live Gemini→Groq generation |
| Event debounce | Coalesce rapid-fire per-claim events (Phase 3 known limitation) |
| Digital twin upsert | `INSERT … ON CONFLICT` on (company_id, claim_id) |
| Snapshot retention job | Prune snapshots older than N days |
| Assignee-aware workload | Bucket team workload by claim owner |
| Twin history viewer + interactive KG renderer | UI upgrades, data ready |

## 22.2 Backlog (pre-existing roadmap items)

- Claim package generator module (workspace already treats it as optional, readiness wired)
- Carrier response capture UI (readiness computed; UI follow-up)
- Storage-backed uploads surfaced in multi-entry dialogs
- Import UI depth (photos/docs/estimates in import form)
- Snapshot retention + event replay tooling
- Search/filter/pagination enrichment, bulk operations, API docs (OpenAPI)

## 22.3 Phase 4 Implementation Roadmap (COGNITIVE-001 §15)

| Phase | Deliverable | Effort | Depends on |
|---|---|---|---|
| 4A | Core Orchestrator (planner, scheduler, synthesizer, router, `/cognition` routes, debounced events) | 8–12 ED | — |
| 4B | Shared Memory (`atlas-memory` ContextBundle facade, cycle records, retention) | 5–8 ED | 4A |
| 4C | Agent Framework (8 deterministic agents + KG agent, registry) | 10–16 ED | 4A, 4B |
| 4D | Conversation Engine (grounded answers, explanations, provider port, feedback) | 8–12 ED | 4C |
| 4E | Knowledge Graph Evolution (taxonomy, traversal, cross-claim, portfolio fold) | 6–10 ED | 4C |
| 4F | Learning & Optimization (calibration, acceptance analytics, diffed config) | 10–16 ED | 4A–4E |

## 22.4 Long-term Direction

- Memory Engine (per `ATLAS_MEMORY_ENGINE_SPEC`) for cross-claim organizational knowledge.
- Multi-agent consensus for high-stakes decisions.
- Scenario simulation (what-if evidence added → rerun cycle).
- Streaming event platform behind the same contract (scale boundary).
- Predictive analytics (settlement forecasting, carrier scorecards).
- Additional industries on the same cognitive architecture.

---

# Section 23 — Documentation Index

Normative sub-specifications (all in `docs/`):

| Area | Documents |
|---|---|
| Architecture | README (doc map), PLAT-006 (event bus), PLAT-007 (background jobs) |
| Security | PLAT-001 (auth), PLAT-002 (RBAC), PLAT-003 (multi-tenant), PLAT-004 (errors), PLAT-005 (audit/observability) |
| Intelligence | AI_MODELS, AI_REASONING_PIPELINE, ATLAS_MEMORY_ENGINE_SPEC, DECISION_CONFIDENCE_ENGINE_SPEC, EMBEDDING_STRATEGY, EVIDENCE_GRAPH_SPEC, KNOWLEDGE_GRAPH_SCHEMA, MULTIMODAL_ARCHITECTURE, PHOTO_INTELLIGENCE_SPEC, RAG_ARCHITECTURE, SUPPLEMENT_INTELLIGENCE_ENGINE_SPEC, VOICE_ORCHESTRATION_ENGINE_SPEC, **COGNITIVE_ENGINE_ARCHITECTURE_SPEC (COGNITIVE-001)** |
| Database | ~60 schema docs (claims, supplements, evidence graph, events, memory, compliance, …) |
| Modules | claims, compliance, decision-engine, document-intelligence, users/teams specs |
| Implementation | CLAIM_INTELLIGENCE_LAYER (Phase 2), OPERATIONS_INTELLIGENCE_LAYER (Phase 3), MULTI_ENTRY_WORKFLOW, AI_FREE_PROVIDER_LAYER |
| Validation | LIVE_DEPLOYMENT_VALIDATION, ENGINE validation scripts, unit/integration suites |

---

# Section 24 — Glossary

| Term | Definition |
|---|---|
| Claim | Root entity of restoration work; 12 business statuses; entry-point aware |
| Claim Workspace | Dynamic 14-section claim detail page; entry-point-adaptive |
| Entry point | How a claim enters: new_claim / existing_claim / supplement_only / imported |
| AI task | One of 6 independent AI operations with per-task evidence requirements |
| Recovery Readiness | 0–100 six-factor score of how ready a claim is to recover revenue |
| Claim Health | 0–100 health score with severity |
| Next Best Action | Ranked, explainable recommendation (8 rule-based types) |
| Digital Twin | Persistent aggregate of a claim's full state (Phase 3) |
| Lifecycle | 12-stage standardized intelligence lifecycle; entry-point aware; closed never regresses |
| Case Manager | AI monitoring: stall, deadlines, priority, summary |
| Evidence Graph | System of record for connected evidence (nodes + edges) |
| Knowledge Graph | Navigable typed graph per claim (Phase 2), evolving (Phase 4) |
| domain_events | Replayable, auditable event log (Phase 2, m004) |
| Cognitive cycle | One orchestrated run of agents for a claim (Phase 4) |
| Cognitive agent | Specialist analyzer over one domain (10 agents, Phase 4) |
| ContextBundle | Immutable per-cycle shared memory read (Phase 4) |
| EvidenceRef | Pointer to an evidence artifact backing a claim/action |
| Calibration | Adjustment aligning predicted confidence with observed outcomes |
| generateText() | Single AI entry point; Gemini primary, Groq fallback; never throws |
| RLS | Row-level security; company-scoped isolation at the database |

---

**End of Master Specification — v1.0**

This document is the constitution of Atlas. All implementation work must be consistent with
it; detailed sub-specifications in `docs/` provide normative depth. Updates follow a
change-review process and are recorded in the changelog.

