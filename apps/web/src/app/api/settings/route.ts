import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { companies } from '@project-atlas/database';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';

const settingsSchema = z.object({
  companyName: z.string().min(1).optional(),
  defaultTimezone: z.string().optional(),
  emailNotifications: z.boolean().optional(),
  slackIntegration: z.boolean().optional(),
  autoBackup: z.boolean().optional(),
});

// GET /api/settings - Get settings for the current company
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, context.companyId));

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({
      companyName: company.name,
      defaultTimezone: 'UTC',
      emailNotifications: true,
      slackIntegration: false,
      autoBackup: true,
      companyId: company.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT /api/settings - Update settings for the current company
export async function PUT(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const body = await request.json();
    const validated = settingsSchema.parse(body);

    const updateData: any = { updated_by: context.userId, updated_at: new Date() };
    if (validated.companyName) updateData.name = validated.companyName;

    const [updated] = await db
      .update(companies)
      .set(updateData)
      .where(eq(companies.id, context.companyId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({
      companyName: updated.name,
      defaultTimezone: validated.defaultTimezone || 'UTC',
      emailNotifications: validated.emailNotifications ?? true,
      slackIntegration: validated.slackIntegration ?? false,
      autoBackup: validated.autoBackup ?? true,
      message: 'Settings saved successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Settings PUT error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
