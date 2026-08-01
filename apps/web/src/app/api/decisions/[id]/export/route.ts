// apps/web/src/app/api/decisions/[id]/export/route.ts
// Export Package — structured decision package for carrier submission.
// GET /api/decisions/:id/export?format=json|markdown

import { NextRequest, NextResponse } from 'next/server';
import { DecisionRepository, buildExportPackage, exportPackageToMarkdown } from '@project-atlas/decision';
import { requireAuth } from '@/lib/server-auth';
import { setCompanyContext } from '@/lib/server-db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);
    const { id } = await params;

    const format = request.nextUrl.searchParams.get('format') ?? 'json';
    const repository = new DecisionRepository();
    const decisionContext = await repository.buildDecisionContext(id, context.companyId);

    if (!decisionContext) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }

    const pkg = buildExportPackage(decisionContext);
    const markdown = exportPackageToMarkdown(pkg);

    if (format === 'markdown') {
      return new NextResponse(markdown, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${pkg.packageId}.md"`,
        },
      });
    }

    return NextResponse.json({ package: pkg, markdown });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Decision export error:', error);
    return NextResponse.json({ error: 'Failed to export decision package' }, { status: 500 });
  }
}
