import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { buildDemoExport, type DemoExportType } from '@/lib/demo-export';

const VALID_TYPES: DemoExportType[] = ['claim', 'supplement', 'decision', 'evidence', 'compliance', 'package'];
const TITLES: Record<DemoExportType, string> = {
  claim: 'Claim Package',
  supplement: 'Supplement Package',
  decision: 'Decision Report',
  evidence: 'Evidence Report',
  compliance: 'Compliance Report',
  package: 'Final Claim Package',
};

// POST /api/demo/export — build an export payload for the demo experience.
// Body: { type: 'claim'|'supplement'|'decision'|'evidence'|'compliance'|'package',
//         format: 'markdown'|'json'|'zip' }
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    let body: { type?: string; format?: string } = {};
    try {
      body = await request.json();
    } catch {
      /* empty body defaults */
    }

    const type = (body.type || 'claim') as DemoExportType;
    const format = body.format === 'json' ? 'json' : body.format === 'zip' ? 'zip' : 'markdown';

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: `Unknown export type: ${type}` }, { status: 400 });
    }

    const result = await buildDemoExport(context, type);
    if (!result) {
      return NextResponse.json(
        { error: 'No claim data available. Generate demo data first.' },
        { status: 404 },
      );
    }

    if (format === 'json') {
      return NextResponse.json({
        filename: `${result.filename}json`,
        contentType: 'application/json',
        content: JSON.stringify(result.data, null, 2),
        title: TITLES[type],
      });
    }

    if (format === 'zip') {
      // ZIP bundle — the package splits into one file per section; other
      // reports ship as a single file inside the archive.
      const sections =
        result.packageSections && result.packageSections.length > 0
          ? result.packageSections.map((s, i) => ({
              title: s.title,
              filename: `${String(i).padStart(2, '0')}-${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.md`,
              markdown: s.markdown,
            }))
          : [{ title: TITLES[type], filename: `${type}-report.md`, markdown: result.markdown }];
      return NextResponse.json({
        filename: `atlas-${type}-${result.claimNumber}.zip`,
        contentType: 'application/zip',
        title: TITLES[type],
        sections,
      });
    }

    return NextResponse.json({
      filename: `${result.filename}md`,
      contentType: 'text/markdown; charset=utf-8',
      content: result.markdown,
      title: TITLES[type],
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Demo export POST error:', error);
    return NextResponse.json({ error: 'Failed to build demo export' }, { status: 500 });
  }
}
