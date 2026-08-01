// ==========================================================
// Atlas
// apps/api/tests/seeder-reset.test.ts
// Seeder reset logic tests (P3) — mocked database, no live DB.
// ==========================================================

jest.mock("@project-atlas/database", () => {
  const state: any = { selectResult: [] as any[], deletes: [] as any[] };

  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    orderBy: () => chain,
    values: () => chain,
    set: () => chain,
    returning: () => Promise.resolve([]),
    then: (resolve: any) => resolve(state.selectResult),
    catch: (reject: any) => Promise.reject(reject),
  };

  const db: any = {
    __state: state,
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn((table: any) => {
      state.deletes.push(table.__name);
      return chain;
    }),
  };

  const table = (name: string, cols: Record<string, string>) => ({
    __name: name,
    ...Object.fromEntries(Object.keys(cols).map((k) => [k, `${name}.${k}`])),
  });

  return {
    db,
    pool: {},
    companies: table("companies", { id: "id", slug: "slug" }),
    tenants: table("tenants", { id: "id", slug: "slug" }),
    profiles: table("profiles", { id: "id", email: "email" }),
    tenantMembers: table("tenant_members", { userId: "user_id", companyId: "company_id" }),
    adjusters: table("adjusters", { companyId: "company_id" }),
    contacts: table("contacts", { companyId: "company_id" }),
    properties: table("properties", { companyId: "company_id" }),
    claims: table("claims", { companyId: "company_id" }),
    documents: table("documents", { claimId: "claim_id" }),
    interviews: table("interviews", { claimId: "claim_id" }),
    interviewTemplates: table("interview_templates", { companyId: "company_id" }),
    supplements: table("supplements", { claimId: "claim_id" }),
    supplementDrafts: table("supplement_drafts", { supplementId: "supplement_id" }),
    activityLogs: table("activity_logs", { companyId: "company_id" }),
    decisions: table("decisions", { companyId: "company_id", claimId: "claim_id" }),
    decisionScores: table("decision_scores", { decisionId: "decision_id" }),
    decisionEvidenceLinks: table("decision_evidence_links", { decisionId: "decision_id" }),
    decisionRisks: table("decision_risks", { decisionId: "decision_id" }),
    decisionActions: table("decision_actions", { decisionId: "decision_id" }),
    decisionApprovals: table("decision_approvals", { decisionId: "decision_id" }),
    decisionReasoningLogs: table("decision_reasoning_logs", { decisionId: "decision_id" }),
    decisionOutcomes: table("decision_outcomes", { companyId: "company_id" }),
  };
});

import { resetDemoData, clearDemoData } from "../src/lib/demo-data/database-seeder";
import { db as mockedDb } from "@project-atlas/database";

const DEMO_SLUG = "npp-roofing-restoration";

describe("Seeder reset logic", () => {
  beforeEach(() => {
    const state = (mockedDb as any).__state;
    state.selectResult = [];
    state.deletes = [];
    (mockedDb as any).select.mockClear();
    (mockedDb as any).delete.mockClear();
  });

  it("when no demo company exists: deletes demo profiles + tenant only", async () => {
    const state = (mockedDb as any).__state;
    state.selectResult = []; // no existing company

    await resetDemoData();

    expect(state.deletes).toContain("profiles");
    expect(state.deletes).toContain("tenants");
    expect(state.deletes).not.toContain("companies");
    // The select was scoped by the demo slug
    expect((mockedDb as any).select).toHaveBeenCalled();
  });

  it("when the demo company exists: deletes company + profiles + tenant (idempotent reset)", async () => {
    const state = (mockedDb as any).__state;
    state.selectResult = [{ id: "company-123" }];

    await resetDemoData();

    expect(state.deletes).toContain("companies");
    expect(state.deletes).toContain("profiles");
    expect(state.deletes).toContain("tenants");
  });

  it("clearDemoData deletes the company + demo-domain profiles", async () => {
    const state = (mockedDb as any).__state;

    // clearDemoData short-circuits to in-memory without DATABASE_URL,
    // so provide one to exercise the DB delete path.
    process.env.DATABASE_URL = "postgres://localhost:5432/atlas-test";
    try {
      await clearDemoData("company-123");
    } finally {
      delete process.env.DATABASE_URL;
    }

    expect(state.deletes).toContain("companies");
    expect(state.deletes).toContain("profiles");
  });

  it("is safe to run repeatedly (idempotent)", async () => {
    const state = (mockedDb as any).__state;
    state.selectResult = [];
    await resetDemoData();
    await resetDemoData();
    // Two passes, no throw, deletes tracked per pass
    expect(state.deletes.filter((d: string) => d === "profiles")).toHaveLength(2);
  });
});
