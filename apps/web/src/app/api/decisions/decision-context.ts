// apps/web/src/app/api/decisions/decision-context.ts
// Web-side DecisionContextCollector — loads claim snapshots from
// the DB (claims, documents, interviews, supplements, activity,
// AI supplement drafts) into DecisionPipelineInput for the
// Decision Engine. Mirrors apps/api/src/lib/decision-context.ts.

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/server-db';
import {
  claims,
  documents,
  interviews,
  supplements,
  supplementDrafts,
  activityLogs,
} from '@project-atlas/database';
import type { DecisionPipelineInput } from '@project-atlas/decision';

export class DecisionContextCollector {
  async loadContext(
    claimId: string,
    organizationId: string
  ): Promise<DecisionPipelineInput> {
    const [claim] = await db
      .select()
      .from(claims)
      .where(
        and(
          eq((claims as any).id, claimId),
          eq((claims as any).companyId, organizationId)
        )
      )
      .limit(1);

    if (!claim) {
      throw new Error(`Claim ${claimId} not found in organization ${organizationId}`);
    }

    const [documentsList, interviewsList, supplementsList, activityList, drafts] =
      await Promise.all([
        db
          .select()
          .from(documents)
          .where(
            and(
              eq((documents as any).claimId, claimId),
              eq((documents as any).companyId, organizationId)
            )
          ),
        db
          .select()
          .from(interviews)
          .where(
            and(
              eq((interviews as any).claimId, claimId),
              eq((interviews as any).companyId, organizationId)
            )
          )
          .orderBy(desc((interviews as any).createdAt)),
        db
          .select()
          .from(supplements)
          .where(
            and(
              eq((supplements as any).claimId, claimId),
              eq((supplements as any).companyId, organizationId)
            )
          ),
        db
          .select()
          .from(activityLogs)
          .where(
            and(
              eq((activityLogs as any).entityId, claimId),
              eq((activityLogs as any).companyId, organizationId)
            )
          )
          .orderBy(desc((activityLogs as any).createdAt))
          .limit(50),
        this.loadAiDrafts(claimId, organizationId),
      ]);

    const c = claim as any;

    return {
      claimId,
      organizationId,
      claim: {
        id: c.id,
        claimNumber: c.claimNumber || 'UNKNOWN',
        insuranceCompany: c.insuranceCompany,
        policyNumber: c.policyNumber,
        dateOfLoss: c.dateOfLoss?.toISOString?.() ?? c.dateOfLoss,
        causeOfLoss: c.causeOfLoss,
        description: c.description,
        status: c.status,
        estimatedValue: c.estimatedValue ? Number(c.estimatedValue) : undefined,
        approvedValue: c.approvedValue ? Number(c.approvedValue) : undefined,
        deductible: c.deductible ? Number(c.deductible) : undefined,
        customerName: c.customerName,
      },
      documents: documentsList.map((d) => {
        const doc = d as any;
        return {
          id: doc.id,
          type: doc.fileName?.split('.').pop()?.toUpperCase(),
          name: doc.fileName,
          confidence: undefined,
          mimeType: doc.mimeType,
          createdAt: doc.createdAt?.toISOString?.(),
        };
      }),
      interviews: interviewsList.map((i) => {
        const iv = i as any;
        return {
          id: iv.id,
          status: iv.status,
          templateName: iv.templateName,
          progress: iv.progress ? Number(iv.progress) : undefined,
          responses: iv.responses || {},
          completedAt: iv.completedAt?.toISOString?.(),
        };
      }),
      supplements: supplementsList.map((s) => {
        const sup = s as any;
        return {
          id: sup.id,
          supplementNumber: sup.supplementNumber,
          status: sup.status,
          requestedAmount: sup.requestedAmount ? Number(sup.requestedAmount) : undefined,
          approvedAmount: sup.approvedAmount ? Number(sup.approvedAmount) : undefined,
          lineItems: (sup.lineItems || []).map((li: any) => ({
            id: li.id,
            description: li.description,
            quantity: Number(li.quantity || 0),
            unitPrice: Number(li.unitPrice || 0),
            total: Number(li.total || 0),
          })),
        };
      }),
      activity: activityList.map((a) => {
        const act = a as any;
        return {
          id: act.id,
          type: act.action,
          description: act.description,
          createdAt: act.createdAt?.toISOString?.(),
        };
      }),
      aiRecommendations: drafts,
    };
  }

  private async loadAiDrafts(
    claimId: string,
    organizationId: string
  ): Promise<DecisionPipelineInput['aiRecommendations']> {
    const claimSupplements = await db
      .select()
      .from(supplements)
      .where(
        and(
          eq((supplements as any).claimId, claimId),
          eq((supplements as any).companyId, organizationId)
        )
      );

    if (claimSupplements.length === 0) return [];

    const supplementIds = claimSupplements.map((s: any) => s.id);
    const drafts = await db
      .select()
      .from(supplementDrafts)
      .where(
        and(
          sql`${(supplementDrafts as any).supplementId} IN (${sql.join(
            supplementIds.map((id: string) => sql`${id}`),
            sql`, `
          )})`,
          eq((supplementDrafts as any).status, 'draft')
        )
      )
      .orderBy(desc((supplementDrafts as any).createdAt));

    const recommendations: NonNullable<DecisionPipelineInput['aiRecommendations']> = [];

    for (const draft of drafts) {
      const d = draft as any;
      const data = d.recommendations;
      if (!data) continue;

      const confidence = d.confidenceScore ? Number(d.confidenceScore) : undefined;

      for (const item of data.recommendedLineItems || []) {
        recommendations.push({
          id: `${d.id}-${item.id || 'li'}`,
          description: item.description || 'Additional scope item',
          category: item.category,
          amount: item.suggestedTotalPrice ?? undefined,
          confidence: item.confidence ?? confidence ?? 0.7,
          evidence: item.evidence || item.documents || [],
        });
      }

      for (const obs of data.missingDamageObservations || []) {
        recommendations.push({
          id: `${d.id}-${obs.id || 'obs'}`,
          description: obs.description || `Damage observation: ${obs.location || 'unknown location'}`,
          category: obs.location,
          amount: undefined,
          confidence: obs.confidence ?? confidence ?? 0.7,
          evidence: obs.evidence || [],
        });
      }
    }

    return recommendations;
  }
}
