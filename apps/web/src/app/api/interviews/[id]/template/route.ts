import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { interviews } from '@project-atlas/database';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';
import { FNOL_TEMPLATE } from '@/lib/fnol-template';

// GET /api/interviews/[id]/template - Get interview template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const [interview] = await db
      .select()
      .from(interviews)
      .where(eq(interviews.id, id));

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    // Serve the canonical template for the interview's templateId.
    // Mirrors the Fastify API /interviews/:id/template handler: fnol-v1
    // returns the full template; unknown templates return 404 (the page
    // renders a graceful "Template not found" state instead of crashing).
    const template = interview.templateId === 'fnol-v1' ? FNOL_TEMPLATE : null;

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Interview template GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch interview template' }, { status: 500 });
  }
}