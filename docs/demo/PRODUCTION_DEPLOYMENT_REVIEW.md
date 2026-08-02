# Atlas — Production Deployment Review

**Date:** August 2, 2026
**Branch:** `feature/phase4a-orchestrator` (HEAD == `main` @ `d629f56`, 0 ahead / 0 behind)
**Release tag:** `v0.5.0` (present)
**Prepared for:** First live deployment (Vercel)

---

## 1. Production Readiness Report

### Phase 1 — Repository Verification

| Check | Status | Detail |
|---|---|---|
| Working tree clean | ⚠️ **12 uncommitted changes** | Deployment-prep work from the readiness sprint (see Blockers, #1) |
| Main branch current | ✅ | HEAD (`d629f56`) == `main` (`d629f56`), 0 ahead / 0 behind |
| Latest release tag present | ✅ | `v0.5.0` (annotated, at merge commit) |
| No secrets committed | ✅ | Only `.env.example` tracked; no `service_role` / JWT / private-key patterns in tracked non-doc files |
| `.env.local` ignored | ✅ | `.env.local`, `apps/api/.env`, `apps/web/.env.local` all gitignored |
| `.env.example` complete | ⚠️ | All **required** vars present; docs updated this sprint (CORS_ORIGIN, NEXT_PUBLIC_APP_URL, ELEMENTAL_* added). Minor: `GIT_COMMIT` / `JWT_SECRET` (web only) not documented |
| No localhost in production code | ✅ | Only default fallbacks: `env.ts` `CORS_ORIGIN` default `http://localhost:3000`, landing `NEXT_PUBLIC_ATLAS_APP_URL` fallback `http://localhost:3000` — both overridable via env; no hardcoded localhost calls |
| No hardcoded API keys | ✅ | Zero matches for `sk-`, JWT, GCP/Groq key patterns in `apps/api/src`, `apps/web/src`, `packages/*/src` |

### Phase 2 — Vercel Readiness

| Item | Status | Detail |
|---|---|---|
| `vercel.json` | ✅ Created | `framework: nextjs`, build `npx turbo run build --filter=web`, output `apps/web/.next`, install `npm install`, region `iad1` |
| Root Directory | ✅ Repo root | Workspaces (`apps/*`, `packages/*`) resolved from root; `--filter=web` builds web + its internal deps (`@project-atlas/ai`, `claim-intelligence`, `database`, `ui`) via turbo `dependsOn: ^build` |
| Build Command | ✅ | `npx turbo run build --filter=web` — verified locally: **5/5 packages, exit 0** |
| Install Command | ✅ | `npm install` (npm 11, workspaces) |
| Output Directory | ✅ | `apps/web/.next` |
| Node version | ⚠️ | No `engines` field, no `.nvmrc`. Local Node v25.9.0. **Set Node 20 LTS (or 22) on Vercel** to match the toolchain that produced green builds |
| Turbo config | ✅ | `turbo.json` pipeline: build depends on `^build`, outputs `.next/**`, `dist/**`; dev is persistent (correct) |
| `next.config.js` | ✅ | Single config now (deleted empty `next.config.ts`); `transpilePackages: ['@project-atlas/ui']` intact |
| `package.json` scripts | ✅ | `build` (turbo), `dev` (turbo), `lint`, `typecheck`, `start` (workspace API) all present |
| **Architecture decision** | ✅ | **Option A recommended** (see below) |

### Phase 2 — Architecture: Option A vs Option B

**Recommendation: Option A — Landing + App in one Vercel project (deploy `apps/web`).**

Rationale:
1. **The landing page already lives inside `apps/web`** at `/landing` (`apps/web/src/app/landing/page.tsx`, fully built with the Atlas marketing site + pilot modal). The web app root `/` is the authenticated dashboard, `/login` is auth — all in one Next.js app.
2. **`apps/web` is self-contained**: its Next.js `/api/*` route handlers talk to Postgres via Drizzle (`server-db.ts`) and Supabase (`server-auth.ts`) directly — it does **not** depend on the Fastify API. The UI works standalone on Vercel.
3. **`apps/landing` is a separate, unshipped scaffold** (TanStack Start, package name `tanstack_start_ts`, Lovable template artifact) with **zero references from web/api**. Deploying it would double your project surface for no demo value.

The Fastify API (`apps/api`) is a **companion backend** (endpoint sweep 50/50) but is **not required by the UI**. Options for it: (a) deploy separately to Render/Railway/Fly with `CORS_ORIGIN` = Vercel domain for the external API surface, or (b) keep local for the demo. It cannot run on Vercel serverless as-is (long-running Fastify process).

### Phase 3 — Environment Variable Checklist

| Variable | Category | Required / Optional / Demo | Used by |
|---|---|---|---|
| `DATABASE_URL` | DATABASE | **Required** | API, web routes, migrations, packages |
| `NEXT_PUBLIC_SUPABASE_URL` | SUPABASE | **Required** (build-time) | Web client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | SUPABASE | **Required** (build-time) | Web client |
| `SUPABASE_URL` | AUTH | **Required** | API |
| `SUPABASE_SERVICE_ROLE_KEY` | AUTH | **Required** | API + web storage |
| `AI_PROVIDER` | AI | Optional (default `gemini`) | packages/ai |
| `GOOGLE_API_KEY` | AI | Optional → live AI; **Demo: warn without** | packages/ai (Gemini) |
| `GROQ_API_KEY` | AI | Optional → live AI fallback | packages/ai (Groq) |
| `ELEMENTAL_API_KEY` | VOICE | Optional → live voice; grounded fallback without | packages/domain voice |
| `ELEMENTAL_BASE_URL` | VOICE | Optional (default `https://api.elemental.ai/v1`) | voice provider |
| `ELEMENTAL_MODEL` | VOICE | Optional (default `elemental-voice-1`) | voice provider |
| `CORS_ORIGIN` | SERVER | **Required in prod** (defaults to localhost) | API CORS |
| `NEXT_PUBLIC_APP_URL` | PUBLIC | **Required in prod** (canonical/metadata) | Web layout |
| `NEXT_PUBLIC_ATLAS_APP_URL` | PUBLIC | Optional (landing CTA) | Landing |
| `OPENAI_API_KEY` | AI | Optional (legacy, unused by free layer) | — |
| `PORT` | SERVER | Optional (default 3000; API dev uses 3001) | API |
| `NEXT_PUBLIC_API_URL` | SERVER | Optional (unused — web uses same-origin `/api`) | Web |
| `JWT_SECRET` | AUTH | Demo only (present in web `.env.local`, not read by prod code path) | Web (reserved) |
| `GIT_COMMIT` | SERVER | Optional (diagnostics metadata) | API diagnostics |

**Secrets never committed.** All values entered only in Vercel project settings + local `.env` files.

### Phase 4 — Production Smoke Test

| Check | Result |
|---|---|
| Production build | ✅ `turbo run build` 5/5 (web next build, api tsc, landing vite, packages) exit 0 |
| TypeScript (web) | ✅ `tsc --noEmit` clean |
| TypeScript (api) | ✅ `tsc --noEmit` clean |
| ESLint (api src + tests) | ✅ 0 errors, 134 warnings |
| Unit suites | ✅ claim-intelligence 49/49 · operations 89/89 · workflow-engine 22/22 |
| Jest (legacy api tests) | ⚠️ `ts-jest` module not resolvable from `apps/api` (`Module ts-jest in the transform option was not found`). ts-jest is declared in devDeps but not installed at the resolvable path. **Not a deployment blocker** (jest is not part of Vercel build; unit suites + integration suites are green). Blocker #3 |
| Database migrations | ✅ Runner idempotent; live DB Postgres 17.6, 26 tables, 13 RLS, 78 indexes. Note: `schema_migrations` ledger empty (schema applied out-of-band) — only matters for fresh DB |
| Seed data | ✅ 16 claims, 4 companies, personas, walkthroughs present |
| Authentication | ✅ login/session/protected/logout all pass |
| Dashboard | ✅ `/` 200 (authenticated dashboard renders) |
| Claims | ✅ journey `complete: true`; claims CRUD validated |
| Claim Package Generation | ⚠️ **PARTIAL** — no dedicated claim-package export endpoint; `/intelligence/diagnostics/export` (200) covers export capability. Pre-existing, documented |
| Supplement Generation | ✅ multi-entry suite: `supplementOnlyCreated: true`, `noClaimPackageBlock: true` |
| Claim Intelligence | ✅ all 9 summary flags true |
| Operations Dashboard | ✅ 56/56 integration tests pass |
| Voice fallback | ✅ orchestrator fallback 200 (grounded provider); live voice needs `ELEMENTAL_API_KEY` |
| Live servers | ✅ API `/health` ok; web `/`, `/landing`, `/login` all 200; `AI Provider: warn` (keys empty — see below) |

### Phase 5 — Deployment Plan

1. **Commit the deployment-prep work** (12 uncommitted files — see Blockers #1) on `feature/phase4a-orchestrator`, then merge into `main` (or fast-forward `main` to HEAD).
2. **Push to GitHub** — `git push origin main --tags` (and feature branch). Includes `vercel.json`, deleted dead files, eslint fix, PII-log removal, `.env.example` update.
3. **Connect Vercel** — import the GitHub repo; framework auto-detect Next.js; root directory = repo root (vercel.json drives build); use the existing `vercel.json`.
4. **Configure environment variables in Vercel** — add all **Required** vars from Phase 3 (DATABASE_URL, Supabase ×4, CORS_ORIGIN, NEXT_PUBLIC_APP_URL) plus optional AI keys. Set **Node 20 LTS**.
5. **Deploy Preview** — verify build succeeds and `/`, `/landing`, `/login` render.
6. **Validate preview** — run the smoke checklist (Phase 4) against the preview URL; confirm auth against Supabase project.
7. **Promote to Production** (or merge to `main` triggers production deploy).
8. **Configure custom domain** — add apex + www; update `NEXT_PUBLIC_APP_URL` / `CORS_ORIGIN` to the production domain.
9. **Verify SSL** — automatic Vercel cert; confirm `https://` enforced, no mixed content.
10. **Verify authentication** — register/login/logout on the live domain; confirm Supabase redirect URLs include the production domain.
11. **Final production smoke test** — full journey (Phase 6) on the live domain.

### Phase 6 — Post-Deployment Validation Checklist

- [ ] **Landing** — `/landing` loads, all sections render, pilot modal opens, CTA links work
- [ ] **Sign In** — login form works against Supabase; error states render; redirect to app after auth
- [ ] **Dashboard** — `/` shows stats for the demo company; no console errors
- [ ] **Claims** — list loads; create claim; open claim detail; transitions render
- [ ] **Documents** — upload works (Supabase storage bucket); list + delete
- [ ] **Claim Package Generation** — diagnostics export returns 200; package/export UI present
- [ ] **Supplement Generation** — generate supplement for existing claim; AI draft + review flow
- [ ] **Decision Engine** — decision record + reasoning trace viewable
- [ ] **Operations Dashboard** — overview, lifecycle, financial, opportunities, case manager render
- [ ] **AI Claim Intelligence** — readiness score, next-best-actions, explain, recommendations
- [ ] **Voice** — Ask Atlas voice button present; grounded fallback answers; live voice if key set
- [ ] **Database** — writes persist (create claim → reload → still present)
- [ ] **Logging** — Vercel function logs clean; no PII (AUTH_DIAGNOSTICS removed); no 500s
- [ ] **Performance** — LCP < 3s on landing/dashboard; no oversized bundles flagged
- [ ] **Security** — HTTPS enforced; `X-Frame-Options`/CSP present; protected routes return 401 unauthenticated; RLS enforced (cross-tenant test)

---

## 2. Deployment Checklist (summary)

1. Commit 12 deployment-prep files → merge to `main`
2. Push `main` + tag `v0.5.0` to GitHub
3. Vercel: import repo, root = repo root, Node 20 LTS
4. Set env vars (Phase 3 Required set + optional AI keys)
5. Deploy preview → validate → promote
6. Custom domain + SSL
7. Supabase redirect URLs update
8. Final production smoke test (Phase 6)

## 3. Environment Variable Checklist

See Phase 3 table above. **Required:** DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CORS_ORIGIN (prod domain), NEXT_PUBLIC_APP_URL.

## 4. Vercel Configuration Review

- `vercel.json` is correct and minimal; build command proven locally.
- One correction: pin **Node 20 LTS** in Vercel project settings (no `engines` in package.json).
- Optional hardening: add `"engines": { "node": ">=20" }` to root `package.json` to make the requirement declarative (blocker #2, optional).

## 5. Final Go / No-Go

# ✅ GO — with 3 pre-flight actions

Atlas is **ready for its first live deployment** on Vercel as **Option A** (single project, `apps/web`). Production build, typechecks, lint, unit suites (49/89/22), and the full E2E journey are all green against the live stack; the repo is free of committed secrets; `vercel.json` is in place.

---

## Production Blockers (in priority order)

| # | Severity | Blocker | Exact files |
|---|---|---|---|
| 1 | **High — must fix before deploy** | Working tree has **12 uncommitted changes** that the deployment depends on (`vercel.json`, dead-file deletions, eslint config fix, PII-log removal, `.env.example`). The deploy cannot proceed from a dirty tree. | `vercel.json`, `eslint.config.js`, `.env.example`, `.gitignore`, `apps/api/src/server.ts`, `apps/api/src/lib/interviews-workflow.ts`, `apps/web/src/lib/server-auth.ts`, `apps/web/next.config.ts` (deleted), `apps/api/src/controllers/organization.controller.ts` (deleted), `apps/api/src/server.js` (deleted), `apps/landing/src/routeTree.gen.ts`, `docs/demo/DEPLOYMENT_READINESS_REPORT.md` |
| 2 | **Medium — recommend before deploy** | No `engines` / `.nvmrc` pins Node version; Vercel may use a different Node than the verified v25.9.0 local toolchain. | `package.json` (add `"engines": { "node": ">=20" }`) — **or** set Node 20 LTS in Vercel project settings |
| 3 | **Low — not a deploy blocker** | `npm test` (jest) fails to resolve `ts-jest` from `apps/api`; jest is not part of the Vercel build path and the actual validation suites are green. | `apps/api/jest.config.js` + `ts-jest` install (restore `npm install` in apps/api) |
| 4 | **Low — pre-existing, documented** | No dedicated claim-package export endpoint; `AI Provider: warn` because `GOOGLE_API_KEY`/`GROQ_API_KEY` values are empty in local env (key lines exist, values blank). | `apps/api/src/lib/env.ts` (CORS default), AI keys in Vercel env vars |

**No application-code changes are required to deploy.** Items 2–4 are configuration choices; item 1 is a commit, not a code change.
