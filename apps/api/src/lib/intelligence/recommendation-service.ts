// apps/api/src/lib/intelligence/recommendation-service.ts
// Recommendation Service for Atlas Intelligence

export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  type: 'action' | 'warning' | 'opportunity';
  title: string;
  reason: string;
  expectedImpact: {
    financial?: number;
    time?: string;
    quality?: string;
  };
  suggestedAction: string;
  relatedEntityId?: string;
  relatedEntityType?: 'claim' | 'supplement' | 'interview' | 'document';
  createdAt: Date;
  acknowledged: boolean;
}

export class RecommendationService {
  /**
   * Get all active recommendations
   */
  async getRecommendations(): Promise<Recommendation[]> {
    return [
      {
        id: 'rec-1',
        priority: 'high',
        type: 'warning',
        title: 'Supplement not updated in 21 days',
        reason: 'SUP-003 has been in "submitted" status for 21 days without carrier response',
        expectedImpact: {
          financial: 15000,
          time: '2-3 weeks'
        },
        suggestedAction: 'Contact carrier adjuster for status update and consider escalation',
        relatedEntityId: 'SUP-003',
        relatedEntityType: 'supplement',
        createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        acknowledged: false
      },
      {
        id: 'rec-2',
        priority: 'high',
        type: 'warning',
        title: 'Claim missing required photos',
        reason: 'CLM-005 is missing roof photos required for supplement submission',
        expectedImpact: {
          financial: 12000,
          time: '1-2 days'
        },
        suggestedAction: 'Schedule photo documentation immediately to prevent denial',
        relatedEntityId: 'CLM-005',
        relatedEntityType: 'claim',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        acknowledged: false
      },
      {
        id: 'rec-3',
        priority: 'medium',
        type: 'action',
        title: 'Carrier typically requests engineer reports',
        reason: 'Liberty Mutual has requested engineer reports on 80% of supplements over $10,000',
        expectedImpact: {
          time: '3-5 days',
          quality: 'Higher approval rate'
        },
        suggestedAction: 'Include engineer report with initial submission for Liberty Mutual claims',
        relatedEntityId: undefined,
        relatedEntityType: undefined,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        acknowledged: false
      },
      {
        id: 'rec-4',
        priority: 'medium',
        type: 'opportunity',
        title: 'Supplement may be missing code upgrade items',
        reason: 'AI analysis suggests potential code upgrade opportunities not included in current estimate',
        expectedImpact: {
          financial: 3500,
          quality: 'Complete code compliance'
        },
        suggestedAction: 'Review local building codes and consider adding code upgrade line items',
        relatedEntityId: 'SUP-007',
        relatedEntityType: 'supplement',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        acknowledged: false
      },
      {
        id: 'rec-5',
        priority: 'low',
        type: 'opportunity',
        title: 'Recurring flashing pattern identified',
        reason: 'AI has identified missing flashing as a recurring supplement opportunity across 45% of claims',
        expectedImpact: {
          financial: 2500,
          quality: 'Prevent water damage'
        },
        suggestedAction: 'Include flashing inspection in standard checklist',
        relatedEntityId: undefined,
        relatedEntityType: undefined,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        acknowledged: false
      },
      {
        id: 'rec-6',
        priority: 'high',
        type: 'warning',
        title: 'Interview incomplete for 14 days',
        reason: 'INT-001 has been in "draft" status for 14 days at 65% completion',
        expectedImpact: {
          financial: 8500,
          time: '1 week'
        },
        suggestedAction: 'Contact customer to complete FNOL interview',
        relatedEntityId: 'INT-001',
        relatedEntityType: 'interview',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        acknowledged: false
      },
      {
        id: 'rec-7',
        priority: 'medium',
        type: 'action',
        title: 'Claim stalled with no activity',
        reason: 'CLM-008 has no activity logs for 28 days',
        expectedImpact: {
          financial: 18000,
          time: '2-4 weeks'
        },
        suggestedAction: 'Review claim status and contact customer or carrier',
        relatedEntityId: 'CLM-008',
        relatedEntityType: 'claim',
        createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        acknowledged: false
      },
      {
        id: 'rec-8',
        priority: 'low',
        type: 'opportunity',
        title: 'Estimator performing above average',
        reason: 'David Martinez has closed 85% more revenue than team average',
        expectedImpact: {
          financial: 20000,
          quality: 'Team improvement'
        },
        suggestedAction: 'Document and share David\'s estimation techniques with team',
        relatedEntityId: undefined,
        relatedEntityType: undefined,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        acknowledged: false
      }
    ];
  }

  /**
   * Get recommendations by priority
   */
  async getRecommendationsByPriority(priority: 'high' | 'medium' | 'low'): Promise<Recommendation[]> {
    const allRecommendations = await this.getRecommendations();
    return allRecommendations.filter(rec => rec.priority === priority && !rec.acknowledged);
  }

  /**
   * Get recommendations by type
   */
  async getRecommendationsByType(type: 'action' | 'warning' | 'opportunity'): Promise<Recommendation[]> {
    const allRecommendations = await this.getRecommendations();
    return allRecommendations.filter(rec => rec.type === type && !rec.acknowledged);
  }

  /**
   * Acknowledge a recommendation
   */
  async acknowledgeRecommendation(_id: string): Promise<void> {
    // Legacy in-memory service; acknowledgment state is managed by the
    // decision/intelligence layer (see claim-intelligence-service).
  }

  /**
   * Generate new recommendations based on data analysis
   */
  async generateRecommendations(): Promise<Recommendation[]> {
    // This would analyze current data and generate new recommendations
    return await this.getRecommendations();
  }
}

export const recommendationService = new RecommendationService();
