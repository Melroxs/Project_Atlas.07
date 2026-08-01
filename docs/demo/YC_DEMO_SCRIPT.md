# Atlas — YC Demo Script

**Product:** Atlas — the AI operating system for insurance restoration companies.
**Length:** 5–7 minutes
**Presenter prep:** 10 minutes (seed the demo environment, verify voice fallback).

---

## Demo Storyline

> *"Every restoration company loses revenue to missed scope and slow supplements.
> Atlas is the AI operating system that reads every claim, interview, document and
> photo — finds the money the insurance company owes your customer, proves it with
> evidence, and gets it approved. Know everything. Miss nothing."*

**The hero moment:** Atlas finds a $1,250 flashing replacement that a human estimator
missed, proves it with a photo, passes compliance, and a human approves it — then
Atlas explains its reasoning out loud.

---

## Pre-Flight (before the demo)

```bash
# 1. Apply migrations (DATABASE_URL must be set — use API Keys)
bun run db:migrate

# 2. Seed the demo environment
bun run db:seed

# 3. Verify the API is healthy
curl http://localhost:3000/health
```

Verify in the app: log in → `/admin/decisions` shows seeded decisions with
confidence, risk, compliance and reasoning traces.

> **Voice:** Atlas Voice works out of the box via the grounded text fallback
> (no API key needed). For live AI voice, add `ELEMENTAL_API_KEY` (or
> `OPENAI_API_KEY`) to API Keys — the UI shows the provider badge either way.

---

## Demo Walkthrough (5–7 minutes)

### 1. Dashboard — "The operating picture" (0:30)
- **Screen:** `/admin` Dashboard.
- **Say:** "Atlas gives the owner a real-time operating picture: active claims,
  open supplement revenue, approval rates, top carriers, and adjuster performance."
- **Expected:** KPI cards populate from the seeded demo data (40 claims, 40
  supplements, $1,000+ activity events).

### 2. Claim → Interview → Documents → Photos (1:00)
- **Screen:** `/admin/claims` → open the Mitchell claim (`CLM-…`).
- **Say:** "Every claim starts with an AI-guided FNOL interview that captures the
  loss, then photos and documents are attached to the claim."
- **Expected:** Claim detail shows status history, financial summary, linked
  supplements and interviews. The claim page links to the Evidence Graph and
  Decision Review.

### 3. Decision Engine — "Atlas finds missed scope" (1:30)
- **Screen:** `/admin/decisions` → click **Evaluate Claim** → pick a claim.
- **Say:** "Atlas runs the Decision Engine: it collects evidence from the claim,
  the interview, documents, photos and the AI supplement generator — scores
  confidence and risk, validates compliance, and generates recommendations."
- **Expected:** A new decision appears with `SUPPLEMENT_OPPORTUNITY`, e.g.
  **"Replace roof flashing"** at ~78–85% confidence, risk score, `NEEDS_REVIEW`
  compliance, missing-evidence list and a full reasoning trace.

### 4. Human Review — "The reviewer is always in control" (1:00)
- **Screen:** `/admin/decisions/[id]` (the reviewer).
- **Say:** "Nothing becomes final without a human. The reviewer sees the
  recommendation, the supporting evidence IDs, confidence, risk, compliance
  findings and missing evidence — and can approve, reject, request more
  evidence, or regenerate."
- **Expected:** Click **Approve** → status flips to Approved and lands in the
  Review History with the reviewer's name. Bulk actions available on the list.

### 5. Ask Atlas Why — "Explainable AI" (1:00)
- **Screen:** Reviewer page → Atlas Voice panel.
- **Say:** "Ask Atlas why. Because every explanation is grounded in the stored
  decision and evidence graph — never invented."
- **Ask (voice prompt):** *"Why did Atlas recommend replacing the flashing?"*
- **Expected:** A grounded answer referencing the specific evidence nodes,
  decision version, confidence and the rules applied (SUP-001/002/003).
- **Fallback:** If `ELEMENTAL_API_KEY` is not set, the grounded text fallback
  produces the same answer locally (provider badge: `grounded-text`).

### 6. Export Package — "Ready for the carrier" (0:30)
- **Screen:** Reviewer → **Export Package**.
- **Say:** "One click builds the complete, traceable package for submission."
- **Expected:** Markdown preview opens; Download JSON / .md available. Package
  includes decision, evidence summary, recommendations, compliance, risks,
  reasoning trace and review history.

### 7. Continuous Learning — "Atlas gets better" (0:30)
- **Screen:** `/admin/decisions` → Continuous Learning panel.
- **Say:** "After each claim closes, Atlas records the outcome and tracks
  confidence calibration, recommendation accuracy, evidence quality and how
  often reviewers override it. Analytics only — it never retrains itself."

**Close:** *"Atlas turns every claim into a fully documented, human-approved,
carrier-ready package — and explains itself. Know everything. Miss nothing."*

---

## Voice Prompts (Elemental AI)

| Prompt | Expected grounding |
| --- | --- |
| "Why did Atlas recommend replacing the flashing?" | Top recommendation + supporting evidence IDs + rules applied |
| "What evidence supports this decision?" | Evidence nodes (type, source, confidence) |
| "How confident is Atlas in this recommendation?" | Confidence score + factors + coverage |
| "Is this compliant?" | Compliance status + score + what's missing |
| "What's missing before we can submit?" | Missing evidence list with severity |

All answers are generated exclusively from the Decision Repository → Evidence
Graph → Compliance Engine → Decision Engine. No hallucinated explanations.

---

## Backup Demo Procedure (if something breaks)

1. **App won't load decisions** → run `bun run db:migrate` then `bun run db:seed`,
   refresh `/admin/decisions`.
2. **Voice returns an error** → check API Keys for `ELEMENTAL_API_KEY` /
   `OPENAI_API_KEY`; otherwise the grounded fallback answers anyway.
3. **No seeded data** → re-run `bun run db:seed` (idempotent — resets the demo
   company and re-seeds deterministically with seed 42).
4. **Demo account issues** → log in with the demo credentials; if the profile is
   missing, the seeder re-creates demo profiles on the next seed.
5. **Last resort:** present the reviewer with a pre-exported markdown package and
   the reasoning trace — the explainability story survives without live data.

---

## Common Troubleshooting

| Symptom | Fix |
| --- | --- |
| `DATABASE_URL is not set` | Add the Postgres connection string via API Keys, then re-run migrate/seed. |
| Migration fails mid-way | The runner tracks `schema_migrations`; fix the failing SQL, re-run (idempotent `IF NOT EXISTS`). |
| `Cannot find module '@project-atlas/…'` | `bun install` at the repo root (workspace symlinks). |
| Decision list empty | Ensure `db:seed` ran and you're signed into the demo company that owns the data. |
| Voice panel shows error 500 | Confirm the decision exists for the claim; the service falls back to grounded text on provider failure. |
| Reviewer won't approve | The review endpoint requires the decision's company scope — verify you're in the demo company context. |

---

## Pre-Demo Checklist

- [ ] `bun run db:migrate` succeeded
- [ ] `bun run db:seed` succeeded (40 claims, 40 supplements, 25 interviews, 100 docs, decisions)
- [ ] `/admin/decisions` shows decisions with confidence/risk/compliance
- [ ] Reviewer approve flow works
- [ ] Export package downloads
- [ ] Atlas Voice answers (grounded or Elemental)
- [ ] Continuous Learning panel shows metrics
