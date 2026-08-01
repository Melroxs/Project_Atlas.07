# Multi-Entry Claim Workflow — Implementation Report

**Status:** ✅ Complete & validated live
**Branch:** `feature/frontend-backend-integration`
**Date:** August 1, 2026

---

## 1. Executive Summary

Atlas now supports contractors entering the claims lifecycle at **any stage** — new claims, existing claims, supplement-only projects, and imported projects — all converging into the same dynamic **Claim Workspace**.

The core architectural change: a **state-driven workflow engine** replaces linear workflow assumptions. A **Claim is the root entity**; a **Claim Package and Supplement are both OPTIONAL** and never block other work. The AI Decision Engine now asks *"Do I have enough verified evidence to perform this task?"* instead of *"Has a Claim Package been created?"*

**Backward compatibility is preserved** — existing claims default to `entry_point = 'new_claim'`, all existing CRUD, the Supplement Engine, Evidence Graph, Decision Engine, Compliance Validator, Document Intelligence, Timeline, and AI Services are untouched and still pass their validation suites.

---

## 2. Architecture Changes

### Before
Linear, implicit sequence: Claim → Claim Package → Supplement. Modules could block work when upstream modules were missing, even when the downstream task didn't actually need them.

### After
```
                      ┌─────────────────────────────────────┐
                      │   New Project Dialog (4 entry points)│
                      └──────────────┬──────────────────────┘
                                     │
        ┌──────────────┬─────────────┼──────────────┬─────────────┐
        ▼              ▼             ▼              ▼             ▼
   Start New      Continue      Supplement      Import       (all paths
   Claim          Existing      Only            Project      converge)
   Claim          Claim
        └──────────────┬─────────────┴──────────────┘
                       ▼
              ┌──────────────────────┐
              │    Claim Workspace   │  ← dynamic, state-driven
              │  (14 adaptive        │
              │   sections)          │
              └──────────────────────┘
                       ▼
       ┌──────────────────────────────────┐
       │  AI Decision Engine              │
       │  evaluateTaskReadiness(task, ctx)│
       │  "enough verified evidence?"     │
       └──────────────────────────────────┘
```

- **`apps/api/src/lib/workflow-engine.ts`** — a pure, dependency-free (no DB/Fastify imports) state-driven engine:
  - `EntryPoint` type + `ENTRY_POINTS` (new_claim / existing_claim / supplement_only / imported) with labels, descriptions, icons.
  - `AITask` + `AI_TASK_LABELS` — six independent AI tasks.
  - `TASK_REQUIREMENTS` — per-task independent evidence requirements. **`generate_supplement` deliberately omits `claimPackage`.** `generate_claim_package` deliberately omits `carrierResponse`.
  - `evaluateTaskReadiness(task, ctx)` — blocks **only** on `missingRequired`; missing optional modules become warnings, never blockers.
  - `getWorkspaceState(entryPoint, ctx)` — entry-point-aware section states (`ready` / `inactive` / `optional` / `pending`) with friendly optional-module messaging ("Claim Package not yet generated." + action).
  - `ENTRY_POINT_CORE` — which sections are *required* depends on entry point: `new_claim` requires customer/property/insurance; `existing_claim` requires insurance; `supplement_only` and `imported` require **none** (never blocked by customer intake).
  - `emptyEvidenceContext()` — 16-flag evidence context.

- **`apps/web/src/lib/workflow-engine.ts`** — UI mirror of the engine (labels, icons, section state colors) so the frontend and backend derive from the same source of truth.

### Key design decision: evidence-based readiness
Every AI output must be backed by evidence, but missing *unrelated* modules never block work:

| Task | Required | Explicitly NOT required |
|---|---|---|
| Generate Claim Package | claim, customer, property, documents | carrier response, supplement |
| Generate Supplement | claim | **claim package**, customer, property |
| Analyze Policy | policy | supplement, claim package |
| Review Carrier Estimate | carrier estimate | claim package |
| Generate Narrative | claim | claim package, compliance |
| Generate Recommendations | claim | claim package |

---

## 3. Database Migration

**Migration file:** `packages/database/migrations/003_multi_entry_workflow.sql` (additive, idempotent, backward compatible)

```sql
ALTER TABLE claims ADD COLUMN IF NOT EXISTS entry_point VARCHAR(32) NOT NULL DEFAULT 'new_claim';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS source_system VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_claims_entry_point ON claims (entry_point);
```

- `entry_point` — how a claim entered the lifecycle (`new_claim` default for all existing rows).
- `source_system` — optional origin reference for imported projects (e.g. XactAnalysis).
- **Applied live:** ✅ `node scripts/apply-migration-003.mjs` → "MIGRATION 003 APPLIED OK in 350 ms"; `claims` columns now `["entry_point","source_system"]`.

**Schema file:** `packages/database/src/schema/claims.ts` — added `entryPoint` + `sourceSystem` columns. `packages/database` rebuilt clean.

---

## 4. API Changes

**Modified:** `apps/api/src/routes/claims.ts` — `POST /claims` now accepts an optional `entryPoint` (defaults to `new_claim` for full backward compatibility).

**New routes (`apps/api/src/routes/multi-entry.ts`, registered in `routes/index.ts`):**

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/v1/multi-entry/supplement-only` | Entry Point 3: claim number + carrier + estimates + photos + documents → claim shell (`entry_point=supplement_only`, status `supplement_required`) + supplement draft immediately. **No customer intake, no claim package, no inspection required.** |
| POST | `/api/v1/multi-entry/import` | Entry Point 4: customer, property, claim, photos, documents, estimates → property + claim shell (`entry_point=imported`, `source_system`) + supplements from estimates. Workspace reconstructed automatically. |
| GET | `/api/v1/multi-entry/workspace/:claimId` | Returns dynamic workspace state: sections + states + optional messages, all six AI task readiness results, readyTaskCount, and the raw evidence context. |
| POST | `/api/v1/multi-entry/ai-tasks/:task/check` | Evidence-based readiness for a single AI task. 404 on unknown/missing claim, 400 on unknown task. |

**Error handling:** Zod `safeParse` → 400 with validation details; claim existence + company scoping → 404; unexpected → 500 with message. All new endpoints are auth-gated like the rest of the API.

**Evidence context builder** (`buildEvidenceContext`): scopes documents/supplements/interviews by `claim_id` + `company_id`; infers photos (image mime types), carrier/contractor estimates (fileName heuristics + amounts), policy, carrier response, interviews, AI analysis (drafts joined through supplements — neither `evidence_links` nor `supplement_drafts` has a `claim_id` column), and an `evidence` aggregate flag.

---

## 5. UI Changes

### New Project Dialog — `apps/web/src/components/projects/NewProjectDialog.tsx`
"New Project" button on the **Dashboard** (`apps/web/src/app/admin/page.tsx`) and **Claims list** (`apps/web/src/app/admin/claims/page.tsx`) opens a dialog with four entry options:

- 🆕 **Start New Claim** — customer intake, property, inspection, photos, documents, (optional) policy, AI analysis, evidence graph, (optional) claim package, supplement if needed.
- 📄 **Continue Existing Claim** — claim number, carrier, customer, existing documents/photos/estimates. No claim package required.
- ⚡ **Generate Supplement** — claim number, carrier estimate, contractor estimate, photos, supporting documents → immediate evidence analysis, compliance validation, gap analysis, supplement generation.
- 📥 **Import Existing Project** — customer, property, claim details, photos, documents, estimates, source system.

The form adapts to the selected entry point (fields reset when switching entry points).

### Dynamic Claim Workspace — `apps/web/src/components/projects/ClaimWorkspace.tsx`
Renders the claim detail page (`apps/web/src/app/admin/claims/[id]/page.tsx`) as 14 adaptive sections (Customer, Property, Insurance, Timeline, Communications, Documents, Photos, Estimates, Evidence, AI Insights, Claim Package, Supplements, Carrier Responses, Compliance):

- **Optional modules** (e.g. Claim Package on a supplement-only project) show *"Claim Package not yet generated."* with action *"Generate Claim Package (Optional)"* — **never a warning or error**.
- **Inactive modules** (e.g. Supplement on a fresh new-claim project) stay quiet until the user is ready.
- **AI Task readiness panel** — each of the six tasks shows Ready / Needs X / Optional-missing, backed by the same engine the API uses.
- Entry-point badge on the claims list and workspace header.

---

## 6. Test Results

### Unit tests — `scripts/test-workflow-engine.mjs` (22 assertions)
```
Workflow engine unit tests: 22 passed, 0 failed
ALL UNIT TESTS PASSED
```
Covers: supplement generation ready with claim+evidence and **no claim package**; supplement blocked when required evidence missing; claim package ready without carrier response; policy analysis needs only a policy; supplement_only workspace has **no pending customer/property**; claim package section is `optional` with the friendly message; new_claim requires customer/property/insurance; imported workspace lights up ready sections; all six tasks; all four entry points; readyTaskCount aggregation.

### Integration tests — `scripts/validate-multi-entry.mjs` (against live API)
```
supplementOnlyCreated: true   (201, entryPoint=supplement_only, SUP-…-1)
noClaimPackageBlock:    true   (ai-task check: ready=true, blocksOnClaimPackage=false)
importReconstructed:    true   (201, entryPoint=imported, sourceSystem=XactAnalysis, property created, 1 supplement)
dynamicWorkspace:       true   (claim_package state=optional, message="Claim Package not yet generated.")
zeroBlockingOptionalWarnings: true (no pending customer/property on supplement-only or imported)
errorHandling:          true   (invalid body→400, unknown task→400, missing claim→404)
```
Cleanup verified: **0 orphaned documents, 0 orphaned supplements, 0 live test claims** after runs.

### Regression suites (all green after the change)
- `scripts/sweep-endpoints.mjs`: **50/50 OK, 0 server errors, 0 client errors**.
- `scripts/validate-engines.mjs`: intelligence (insights/recommendations/learning/query all 200, queryHasAnswer), health + diagnostics + export (200), evidence graph create/get (200), demo mode (200, 6 personas), voice orchestrator fallback (200). AI supplement `generate` returns the expected structured 500 ("AI provider not configured") since no API keys are set — same as before this change.
- `packages/database` builds clean; `apps/api` + `apps/web` typecheck clean on all touched files (only pre-existing `organization.controller.ts` errors remain, untouched).

### Code review
`code-reviewer-deepseek-flash` signed off with **no blockers** after two review passes. Issues found and fixed:
1. ❌→✅ `evidence_links` has no `claim_id` column — AI-analysis evidence now scoped via supplements join.
2. ❌→✅ Unused `desc` import removed; `carrrier` typo fixed.
3. ❌→✅ Workspace is entry-point-aware (`ENTRY_POINT_CORE`) so supplement-only/imported never block on customer/property.
4. ❌→✅ Insurance section keys on a real `insurance` flag (insuranceCompany || policyNumber).
5. ❌→✅ Supplement-only/import now return 400 (safeParse) not 500; missing claim → 404.
6. ❌→✅ NewProjectDialog resets stale auto-filled fields when switching entry points.
7. ❌→✅ Integration-test cleanup switched to the established Supabase-REST pattern; orphan verification confirms zero leftovers.

---

## 7. Files Modified / Added

### New files
| File | Purpose |
|---|---|
| `apps/api/src/lib/workflow-engine.ts` | Pure state-driven workflow engine (entry points, AI tasks, requirements, readiness, workspace state) |
| `apps/api/src/routes/multi-entry.ts` | Supplement-only, import, workspace, ai-task-check endpoints |
| `apps/web/src/lib/workflow-engine.ts` | UI mirror of the engine |
| `apps/web/src/components/projects/NewProjectDialog.tsx` | 4-entry-point project creation dialog |
| `apps/web/src/components/projects/ClaimWorkspace.tsx` | Dynamic workspace renderer + AI task readiness UI |
| `packages/database/migrations/003_multi_entry_workflow.sql` | Additive migration: entry_point + source_system + index |
| `scripts/test-workflow-engine.mjs` | 22 unit tests for the engine |
| `scripts/validate-multi-entry.mjs` | Integration tests against the live API |
| `scripts/apply-migration-003.mjs` | Idempotent migration runner + verification |

### Modified files
| File | Change |
|---|---|
| `packages/database/src/schema/claims.ts` | Added `entryPoint`, `sourceSystem` columns |
| `apps/api/src/routes/claims.ts` | `POST /claims` accepts optional `entryPoint` |
| `apps/api/src/routes/index.ts` | Registered `multiEntryRoutes` |
| `apps/web/src/app/admin/page.tsx` | New Project button opens NewProjectDialog |
| `apps/web/src/app/admin/claims/page.tsx` | New Project button + entry-point badge on claims list |
| `apps/web/src/app/admin/claims/[id]/page.tsx` | ClaimWorkspace integrated; Claim interface gains `entryPoint` |

### Untouched (per requirements)
Supplement Engine, Evidence Graph, Decision Engine, Compliance Validator, Claims CRUD, Document Intelligence, Timeline, AI Services — all reused, none rewritten.

---

## 8. Remaining Roadmap Items

1. **Live AI generation** — the supplement engine returns a clean structured 500 until real `GOOGLE_API_KEY` / `GROQ_API_KEY` values are added to env files (config step, not code). The free-AI layer (Gemini → Groq fallback) from the prior sprint is in place and smoke-tested.
2. **Import UI depth** — the Import dialog currently collects claim/customer/property; photos/documents/estimates are fully supported by the API but not yet exposed in the import form (accepted for MVP).
3. **Claim Package feature** — the workspace already treats it as optional with a "Generate Claim Package (Optional)" action; a real claim-package generator module can hook into `generate_claim_package` readiness (already wired in the engine).
4. **Carrier response capture** — section exists and readiness is computed; the carrier-response recording UI is a natural follow-up.
5. **Document/photograph file upload** — documents are attached by URL in the multi-entry flows; the storage-backed upload path (existing elsewhere) can be surfaced in these dialogs.

---

## 9. Final Assessment

The Multi-Entry Claim Workflow is **complete and validated live**:

- ✅ Claim Package is **not** a mandatory prerequisite for supplement generation (unit + integration proven).
- ✅ Four entry points converge into one Claim Workspace.
- ✅ State-driven workflow — modules activate when required information exists; both example paths (claim-only→supplement, and full inspection→claim package→supplement) are valid.
- ✅ AI Decision Engine is evidence-based, per-task, with independent requirements.
- ✅ Missing optional modules never block; missing required evidence does.
- ✅ Backward compatible — existing claims default to `new_claim`; all existing functionality and validation suites pass.
- ✅ Tests: 22 unit assertions + 6 live integration checks + 50-endpoint sweep + full engine validation, all green.
