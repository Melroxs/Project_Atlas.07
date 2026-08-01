import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';
import { createAIService } from '@project-atlas/ai';

const generateSupplementSchema = z.object({
  supplementId: z.string().uuid(),
  claimId: z.string().uuid().optional(),
  claim: z.object({
    claimNumber: z.string(),
    insuranceCompany: z.string(),
    dateOfLoss: z.string(),
    description: z.string(),
    status: z.string(),
  }).optional(),
  property: z.object({
    address: z.string(),
  }).optional(),
  documents: z.array(z.any()).optional(),
  interviewResponses: z.any().optional(),
});

// POST /api/ai-supplements/generate - Generate AI supplement recommendations
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    const body = await request.json();
    const { supplementId, claimId, claim, property, documents, interviewResponses } = generateSupplementSchema.parse(body);

    // Create AI service
    const aiService = createAIService();

    // Check if AI service is configured
    if (!aiService.isConfigured()) {
      return NextResponse.json({
        error: 'AI service not configured',
        message: 'Please set GOOGLE_API_KEY and/or GROQ_API_KEY environment variables to enable AI features',
        supplementId,
        userId: context.userId,
        companyId: context.companyId
      }, { status: 503 });
    }

    // Generate recommendations
    const recommendations = await aiService.generateSupplementRecommendations({
      supplementId,
      claimId: claimId || supplementId,
      context: {
        claim: claim || {
          claimNumber: 'unknown',
          insuranceCompany: 'unknown',
          dateOfLoss: new Date().toISOString(),
          description: 'No description provided',
          status: 'draft'
        },
        property,
        documents,
        interviewResponses
      },
    });

    return NextResponse.json({
      success: true,
      ...recommendations,
      userId: context.userId,
      companyId: context.companyId
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('AI Supplements POST error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate AI supplements',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
