import { NextRequest, NextResponse } from 'next/server';
import { db, setCompanyContext } from '@/lib/server-db';
import { notes } from '@project-atlas/database';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '@/lib/server-auth';
import { z } from 'zod';

const noteSchema = z.object({
  entityType: z.string().min(1).optional(),
  entityId: z.string().uuid().optional(),
  content: z.string().min(1),
});

// GET /api/notes - List notes
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const allNotes = await db
      .select()
      .from(notes)
      .where(eq(notes.companyId, context.companyId))
      .orderBy(desc(notes.createdAt));

    return NextResponse.json(allNotes);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Notes GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

// POST /api/notes - Create note
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const body = await request.json();
    const validated = noteSchema.parse(body);

    const [newNote] = await db
      .insert(notes)
      .values({
        entityType: validated.entityType || 'company',
        entityId: validated.entityId || context.companyId,
        content: validated.content,
        companyId: context.companyId,
        createdBy: context.userId,
      })
      .returning();

    return NextResponse.json(newNote, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Notes POST error:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}