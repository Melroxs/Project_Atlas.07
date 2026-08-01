# ATLAS YC MVP — Release Candidate Report

**Date:** 2026-08-01
**Release Manager:** Freebuff (AI Release Manager)
**Repository:** Melroxs/Project_Atlas.07
**Scope:** Eliminate the release blockers from the independent code review (Jest regression, Evaluate navigation, correctness items, test coverage) and validate the release candidate.

---

## Executive Summary

| Status | Meaning |
|---|---|
| ✅ **RELEASE CANDIDATE (code-level)** | All Priority 1 release blockers resolved. Full Jest suite green (83 passed / 6 skipped env-gated legacy tests). Zero new TypeScript errors in touched code. All decision routes verified. |

**Primary remaining blocker:** `DATABASE_URL` is not provisioned in this workspace, so live-database validation (migrate → seed → live E2E) cannot be executed here. The migration and seed pipelines are wired and fail cleanly only on the missing connection string.

---

## ✓ Fixed Issues (review checklist)

### Priority 1 — Release blockers

**1. Jest regression — fully green suite restored**
- Corrected the legacy Fastify tests: `app = await buildFastify()` → `app = buildFastify()` (the function is synchronous).
- Added clean environment guards (`describe` / `describe.skip` based on required env vars) so the legacy `companies` / `interviews` suites skip cleanly in CI instead of failing compilation.
- `jest.config.js` now prefers TS sources over stale compiled `.js` twins in `src/` (the compiled twins had broken relative imports and were being resolved by jest).
- Result: `npm test` → **8 suites passed, 2 legacy suites skipped (6 tests), 83 tests passed, 0 failed.**

**2. Evaluate Claim navigation**
- `POST /decisions/evaluate` (Fastify) and `POST /api/decisions` (Next) now return the **persisted DecisionRecord** (`{ ...result, decision }`) from the repository, not a stale-state read.
- The Decision Review list page navigates using the **decision id from the evaluate response**, no longer reading the stale `decisions` closure; selected-claim state is preserved until navigation completes.

### Priority 2 — Correctness

**3. Double persistence removed** — `createSupplementDecision` no longer writes a second decision row; the pipeline result is reused directly.

**4. Score mapping normalized** — single shared `mapScoreRow()` mapper used by both `createScore()` and `getScore()`; numeric strings consistently converted to numbers; raw Drizzle rows are never returned.

**5. Voice context** — decision records now persist and expose `claimNumber`, `riskFactors`, and `reasoningTrace` (migration `005_decision_voice_context` + schema + record type). Both the grounded and Elemental voice paths read the **same persisted facts**, so explanations are identical in content regardless of provider.

**6. Elemental configuration verified** — live voice is enabled **only** when `ELEMENTAL_API_KEY` is set. The unrelated `OPENAI_API_KEY` fallback was removed; otherwise the grounded text provider is used explicitly.

**7. Transactional saveDecision** — the decision row, score, risk factors, and reasoning logs are written inside a **single DB transaction**, with a **per-claim `pg_advisory_xact_lock`** serializing concurrent evaluations so version numbers can never collide.

**8. Route hardening** — Zod validation failures now return **400** (not 500) across all decision routes; the review schema no longer requires a `decisionId` body field (it comes from the URL param).

### Priority 3 — Test coverage added

| File | Coverage |
|---|---|
| `tests/decision-repository.test.ts` | Pure mappers (`toDecisionRecord`, `mapScoreRow`, evidence nodes), transactional `saveDecision`, versioning (never overwrites), `getScore` mapping, `updateHumanReviewStatus` + approval record |
| `tests/decision-service.test.ts` | Service orchestration with mocked repository/context source |
| `tests/decision-routes.test.ts` | 12 Fastify route tests (evaluate, list, detail, 404s, review, voice, export JSON/markdown, outcomes, learning metrics, 400 validation) with fully mocked dependencies |
| `tests/migration-runner.test.ts` | Migration file selection: sorted order, skips `000_*` reset + `*_down.sql`, dedupes, no input mutation |
| `tests/seeder-reset.test.ts` | Seeder reset logic |

Existing coverage was not reduced (all prior decision tests still pass).

---

## Test Summary

| Runner | Result |
|---|---|
| `npm test` (jest — established runner) | ✅ **8 suites passed, 2 legacy suites skipped (env-gated), 83 passed, 6 skipped, 0 failed** |
| `bun test` | ⚠️ Partial — domain-level tests pass; Fastify `inject`-based tests hit a known bun/Fastify incompatibility (`Cannot writeHead headers after they are sent`). Not a logic failure; jest is the declared runner (`"test": "jest"`). |

## Build Summary

| Check | Result |
|---|---|
| `apps/api` tsc (`npx tsc --noEmit`) | ✅ **0 errors** excluding the pre-existing legacy `organization.controller` (2 errors, isolated per instructions) |
| `apps/api` build (`tsc`) | ✅ Passes (same 0 non-legacy errors) |
| `apps/web` tsc — touched files | ✅ **0 errors** in `admin/decisions`, `api/decisions`, `decision-learning`, `bulk-review` |
| `apps/web` tsc — total | ⚠️ 146 pre-existing errors, **all in legacy files untouched by this work** |
| Next build | ⚠️ **Blocked by pre-existing legacy scaffold** — see below |

---

## Known Legacy Issues (documented, not fixed per instructions)

1. **Next build / web tsc — pre-existing legacy scaffold.** Files tracked at HEAD with zero uncommitted changes (`apps/web/src/app/api/claims/*`, `apps/web/src/app/api/users/*`, `apps/web/src/app/api/documents/document.service.ts`) import:
   - `@/domain/claims/{validation,service,repository}` — these exist at `packages/domain/claims/`, but the web `tsconfig` never mapped the `@/domain/*` alias to the package, and
   - `@/modules/audit/audit.service` — **exists nowhere in the repository**.
   Fix path (post-YC): configure the alias (or a webpack resolve) and restore/port the missing audit service, or remove the dead legacy routes. Not part of the MVP execution path; left unchanged per release instructions.
2. **`organization.controller.ts`** — pre-existing legacy controller with 2 tsc errors; isolated and left unchanged per instructions.
3. **`bun.lock` is untracked** — commit it (ts-jest was added to `apps/api/package.json`).

## Production Blockers

1. **`DATABASE_URL` is not provisioned** in this workspace. `bun run db:migrate` and `bun run db:seed` are wired (`apps/api/package.json`) and both fail cleanly with `DATABASE_URL is not set`. Once the connection string is added via API Keys, run:
   ```
   bun run db:migrate && bun run db:seed
   ```
   then execute the live E2E workflow (Claim → Interview → Documents → Photos → Evidence Graph → Decision Engine → Compliance → AI Recommendation → Human Review → Package Export → Atlas Voice).

---

## YC Demo Readiness

- **Decision Engine, Evidence Graph, Compliance, Reviewer workflow, Export, and Atlas Voice (grounded) are verified at the code + unit/integration level** (45 existing + 38 new tests green; API typechecks clean; decision routes exercised end-to-end in `tests/demo-validation.test.ts`).
- **Conditionally demo-ready:** the release candidate is complete on code; live-database validation is the single remaining gate, blocked only on `DATABASE_URL`.
- **Recommended before recording the demo:** provision `DATABASE_URL`, run `db:migrate` + `db:seed`, and walk the full workflow once against the live database to confirm the seeded demo environment.
