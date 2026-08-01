import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { computeCompanyOperationsWeb } from '@/lib/operations-server';

const SECTIONS = ['overview', 'revenue', 'executive', 'portfolio'] as const;

// GET /api/operations/company/[section]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ section: string }> }
) {
  try {
    const context = await requireAuth();
    const { section } = await params;

    if (!(SECTIONS as readonly string[]).includes(section)) {
      return NextResponse.json({ error: 'Unknown operations section' }, { status: 400 });
    }

    const overview = await computeCompanyOperationsWeb(context.companyId);
    if (!overview) {
      return NextResponse.json({ empty: true });
    }

    switch (section) {
      case 'overview':
        return NextResponse.json(overview);
      case 'revenue':
        return NextResponse.json(overview.revenue);
      case 'executive':
        return NextResponse.json(overview.executive);
      case 'portfolio':
        return NextResponse.json(overview.portfolio);
      default:
        return NextResponse.json({ error: 'Unknown operations section' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Operations company GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch company operations' }, { status: 500 });
  }
}
