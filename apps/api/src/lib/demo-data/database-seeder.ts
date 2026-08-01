/**
 * Demo Data Manager
 *
 * Persists the full demo environment to the real database so the
 * application is fully usable immediately after seeding:
 *   company, users, adjusters, customers, properties, claims
 *   (with policy info), interviews, interview templates,
 *   documents (incl. photos), supplements, AI supplement drafts,
 *   activity timeline, and Decision Engine history (decisions,
 *   compliance, recommendations, learning outcomes).
 *
 * Idempotent: re-running wipes the demo company's rows first.
 * When DATABASE_URL is unavailable it falls back to the previous
 * in-memory behavior so demo mode keeps working without a DB.
 */

import { db } from "@project-atlas/database";
import {
  companies,
  tenants,
  profiles,
  tenantMembers,
  adjusters,
  contacts,
  properties,
  claims,
  documents,
  interviews,
  interviewTemplates,
  supplements,
  supplementDrafts,
  activityLogs,
} from "@project-atlas/database";
import { eq, like } from "drizzle-orm";
import { DemoData } from "./demo-data-service";
import { FNOL_TEMPLATE } from "../fnol-template";
import {
  DecisionService,
  DecisionRepository,
} from "../../../../../packages/domain/decision";
import type { DecisionContextSource } from "../../../../../packages/domain/decision";
import { DecisionContextCollector } from "../decision-context";

const DEMO_SLUG = "npp-roofing-restoration";
const DEMO_TENANT_SLUG = "npp-restoration";
const DEMO_EMAIL_DOMAIN = "@npproofing.com";

function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ") || first;
  return { first, last };
}

function mimeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".heic")) return "image/heic";
  return "application/pdf";
}

/**
 * Reset the demo company (cascades to most children) and the demo
 * profiles / tenant that belong to it.
 */
export async function resetDemoData(): Promise<void> {
  const existing = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, DEMO_SLUG))
    .limit(1);

  if (existing[0]) {
    await db.delete(companies).where(eq(companies.id, existing[0].id));
  }

  // Profiles are not linked to companies — remove demo users by email domain.
  await db.delete(profiles).where(like(profiles.email, `%${DEMO_EMAIL_DOMAIN}`));

  await db.delete(tenants).where(eq(tenants.slug, DEMO_TENANT_SLUG));
}

/**
 * Persist the complete demo dataset to the database and run the
 * Decision Engine over the persona claims so the demo has real
 * decision history, compliance results and AI recommendations.
 */
export async function seedDemoData(demoData: DemoData): Promise<{
  success: boolean;
  message: string;
  companyId?: string;
}> {
  if (!hasDatabase()) {
    return {
      success: true,
      message: "Demo data generated successfully (in-memory)",
      companyId: "demo-company-npp-roofing-restoration",
    };
  }

  try {
    await resetDemoData();

    const companyId = demoData.company.id;
    const demoUserIds = demoData.users.map((u: any) => u.id);

    // 1. Company + tenant
    await db.insert(companies).values({
      id: companyId,
      name: demoData.company.name,
      slug: DEMO_SLUG,
      plan: "demo",
      created_at: demoData.company.createdAt,
      updated_at: new Date(),
    });
    const tenantId = `${companyId}-tenant`.slice(0, 36).replace(/-/g, "");
    await db.insert(tenants).values({
      id: tenantId,
      name: `${demoData.company.name} Workspace`,
      slug: DEMO_TENANT_SLUG,
    });

    // 2. Profiles (demo users)
    const profileRows = demoData.users.map((u: any) => {
      const { first, last } = splitName(u.fullName);
      return {
        id: u.id,
        email: u.email,
        firstName: first,
        lastName: last,
      };
    });
    if (profileRows.length) await db.insert(profiles).values(profileRows);

    // 3. Tenant members
    const memberRows = demoData.users.map((u: any) => ({
      userId: u.id,
      companyId,
      role: u.role === "Administrator" ? "Owner" : u.role,
    }));
    if (memberRows.length) await db.insert(tenantMembers).values(memberRows);

    // 4. Adjusters
    const adjusterRows = demoData.adjusters.map((a: any) => ({
      companyId,
      fullName: a.fullName,
      insuranceCompany: a.insuranceCompany,
      email: a.email,
      phone: a.phone,
      office: a.territory ?? null,
      territory: a.territory ?? null,
      active: true,
    }));
    if (adjusterRows.length) await db.insert(adjusters).values(adjusterRows);

    // 5. Contacts (customers)
    const contactRows = demoData.customers.map((c: any) => ({
      companyId,
      name: `${c.firstName} ${c.lastName}`,
      email: c.email,
      phone: c.phone,
      role: "Customer",
    }));
    if (contactRows.length) await db.insert(contacts).values(contactRows);

    // 6. Properties
    const propertyRows = demoData.properties.map((p: any) => ({
      companyId,
      address: p.address?.street ?? "",
      city: p.address?.city ?? "",
      state: p.address?.state ?? "",
      zip: p.address?.zip ?? "",
      ownerName: "",
    }));
    if (propertyRows.length) await db.insert(properties).values(propertyRows);

    // 7. Claims (policies are captured on the claim: policy_number, deductible)
    const claimRows = demoData.claims.map((c: any) => {
      const customer = demoData.customers.find((x: any) => x.id === c.customerId);
      return {
        companyId,
        adjusterId: c.adjusterId ?? null,
        propertyId: c.propertyId ?? null,
        claimNumber: c.claimNumber,
        status: c.status,
        dateOfLoss: c.dateOfLoss,
        dateReported: c.dateReported,
        insuranceCompany: c.insuranceCompany,
        policyNumber: c.policyNumber,
        deductible: c.deductible != null ? String(c.deductible) : null,
        estimatedValue: c.estimatedAmount != null ? String(c.estimatedAmount) : null,
        approvedValue: c.approvedAmount != null ? String(c.approvedAmount) : null,
        description: c.damageType ?? null,
        customerName: customer ? `${customer.firstName} ${customer.lastName}` : null,
        customerEmail: customer?.email ?? null,
        customerPhone: customer?.phone ?? null,
        statusHistory: [
          {
            status: c.status,
            timestamp: c.createdAt,
            userName: "system",
            reason: "Seeded demo claim",
          },
        ],
        financialSummary: {
          estimatedValue: c.estimatedAmount,
          approvedValue: c.approvedAmount,
          paidAmount: c.paidAmount,
          outstandingAmount: c.outstandingAmount,
        },
      };
    });
    if (claimRows.length) await db.insert(claims).values(claimRows);

    // 8. Documents (incl. photos — roof_photo/drone_photo/completion_photo)
    const docRows = demoData.documents.map((doc: any) => ({
      companyId,
      claimId: doc.claimId ?? null,
      url: `/demo-documents/${doc.fileName}`,
      fileName: doc.fileName,
      mimeType: mimeFromFileName(doc.fileName),
      createdAt: doc.uploadedAt ?? new Date(),
      updatedAt: doc.uploadedAt ?? new Date(),
    }));
    if (docRows.length) await db.insert(documents).values(docRows);

    // 9. Interview templates (FNOL)
    await db.insert(interviewTemplates).values({
      companyId,
      templateId: FNOL_TEMPLATE.templateId,
      name: FNOL_TEMPLATE.name,
      description: FNOL_TEMPLATE.description,
      version: FNOL_TEMPLATE.version,
      sections: FNOL_TEMPLATE.sections as any,
      settings: {},
      isActive: true,
      isDefault: true,
    });

    // 10. Interviews
    const interviewRows = demoData.interviews.map((iv: any, i: number) => ({
      companyId,
      propertyId: iv.propertyId ?? null,
      claimId: iv.claimId ?? null,
      createdBy: demoUserIds[0] ?? demoUserIds[0],
      interviewNumber: `INT-${String(i + 1).padStart(4, "0")}`,
      templateId: FNOL_TEMPLATE.templateId,
      templateName: FNOL_TEMPLATE.name,
      status: iv.status,
      progress: iv.status === "completed" ? "100" : iv.status === "in_progress" ? "50" : "0",
      responses: iv.answers ?? {},
      startedAt: iv.startedAt ?? null,
      completedAt: iv.completedAt ?? null,
    }));
    if (interviewRows.length) await db.insert(interviews).values(interviewRows);

    // 11. Supplements + AI supplement drafts
    for (const supp of demoData.supplements) {
      const supplementId = supp.id;
      await db.insert(supplements).values({
        companyId,
        claimId: supp.claimId,
        adjusterId: null,
        supplementNumber: supp.supplementNumber,
        version: "1",
        status: supp.status,
        carrier: supp.carrierResponse ?? null,
        requestedAmount: supp.requestedAmount != null ? String(supp.requestedAmount) : null,
        approvedAmount: supp.approvedAmount != null ? String(supp.approvedAmount) : null,
        difference:
          supp.requestedAmount != null && supp.approvedAmount != null
            ? String(supp.requestedAmount - supp.approvedAmount)
            : null,
        lineItems: (supp.lineItems ?? []).map((li: any) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          total: li.totalPrice ?? li.quantity * li.unitPrice,
        })),
        internalNotes: supp.internalNotes ?? null,
        submissionDate: supp.submittedAt ?? null,
        approvalDate: supp.approvedAt ?? null,
      });

      const ai = supp.aiRecommendations ?? {
        confidenceScore: 0.78,
        riskScore: 0.25,
        reasoning:
          "Scope recovered from photo evidence and policy coverage analysis.",
        suggestedLineItems: (supp.lineItems ?? []).slice(0, 3).map((li: any) => li.description),
        missingDocumentation: [],
        questionsForEstimator: [],
      };

      await db.insert(supplementDrafts).values({
        supplementId,
        version: "1",
        status: supp.status === "approved" ? "approved" : "draft",
        generatedAt: supp.createdAt,
        recommendations: {
          summary: `AI detected ${ai.suggestedLineItems.length} additional line item(s) for ${supp.supplementNumber}.`,
          lineItems: ai.suggestedLineItems,
          reasoning: ai.reasoning,
          confidence: ai.confidenceScore,
          risk: ai.riskScore,
          missingDocumentation: ai.missingDocumentation ?? [],
          questionsForEstimator: ai.questionsForEstimator ?? [],
        },
        aiProvider: "atlas-demo",
        aiModel: "gpt-4o-mini-demo",
        confidenceScore: String(ai.confidenceScore ?? 0.75),
        riskScore: String(ai.riskScore ?? 0.3),
        estimatedRevenue: String(supp.requestedAmount ?? 0),
      });
    }

    // 12. Activity timeline
    const activityRows = demoData.activities.map((act: any) => ({
      companyId,
      userId: act.userId && demoUserIds.includes(act.userId) ? act.userId : null,
      userName: "Demo User",
      entityType: "claim",
      entityId: act.claimId ?? null,
      entityName: act.claimId ?? null,
      action: act.eventType ?? "status_changed",
      description: act.description ?? act.eventType ?? null,
      createdAt: act.createdAt,
    }));
    if (activityRows.length) {
      // Batch in chunks of 1000 to stay within pg parameter limits
      for (let i = 0; i < activityRows.length; i += 900) {
        await db.insert(activityLogs).values(activityRows.slice(i, i + 900));
      }
    }

    // 13. Decision Engine — run over the persona claims to create real
    //     decision history + compliance results + AI recommendations.
    const collector = new DecisionContextCollector();
    const repository = new DecisionRepository();
    const service = new DecisionService(
      repository,
      collector as DecisionContextSource
    );

    let decisionsCreated = 0;
    for (const persona of demoData.personas) {
      const claimId = persona.claim.id;
      try {
        await service.analyzeClaim(claimId, companyId);
        decisionsCreated++;
      } catch (error) {
        console.error(`Decision engine failed for claim ${claimId}:`, error);
      }
    }

    // 14. Learning outcomes for completed claims (continuous-learning panel)
    const completedClaims = demoData.claims.filter((c: any) =>
      ["approved", "completed", "closed"].includes(c.status)
    );
    for (const claim of completedClaims.slice(0, 8)) {
      try {
        await repository.recordOutcome({
          organizationId: companyId,
          claimId: claim.id,
          adjusterOutcome: claim.status === "denied" ? "DENIED" : "APPROVED",
          amountApproved: claim.approvedAmount ?? claim.estimatedAmount ?? 0,
          amountDenied: claim.approvedAmount != null ? claim.estimatedAmount - claim.approvedAmount : 0,
          confidenceAccuracy: 0.72,
          evidenceGaps: [],
          timeToApprovalMinutes: 1440 * 12,
        });
      } catch (error) {
        console.error(`Outcome seed failed for claim ${claim.id}:`, error);
      }
    }

    return {
      success: true,
      message: `Demo data persisted to database (${demoData.claims.length} claims, ${decisionsCreated} decisions generated by the engine).`,
      companyId,
    };
  } catch (error) {
    console.error("Database demo seeding failed:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unknown demo seeding error",
    };
  }
}

/**
 * Clear demo data from the database (cascade) or no-op in-memory.
 */
export async function clearDemoData(
  companyId: string
): Promise<{ success: boolean; message: string }> {
  if (!hasDatabase()) {
    return {
      success: true,
      message: "Demo data cleared successfully (in-memory)",
    };
  }
  try {
    await db.delete(companies).where(eq(companies.id, companyId));
    await db.delete(profiles).where(like(profiles.email, `%${DEMO_EMAIL_DOMAIN}`));
    return { success: true, message: "Demo data cleared from database." };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Clear failed",
    };
  }
}
