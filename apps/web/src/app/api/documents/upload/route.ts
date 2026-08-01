import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { db, setCompanyContext } from '@/lib/server-db';
import { documents } from '@project-atlas/database';
import { getStorageService } from '@/lib/server-storage';

// POST /api/documents/upload - Upload a document
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth();
    await setCompanyContext(context.companyId);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const claimId = formData.get('claimId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique file path
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const path = `${context.companyId}/${filename}`;

    // Upload to Supabase Storage
    const storage = getStorageService();
    const { path: storagePath, url, signedUrl } = await storage.uploadFile(
      'documents',
      path,
      buffer,
      file.type,
      { upsert: false, expiresIn: 3600 } // 1 hour expiry for signed URLs
    );

    // Save document metadata to database
    const [newDocument] = await db
      .insert(documents)
      .values({
        url,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        claimId: claimId || null,
        companyId: context.companyId,
        createdBy: context.userId,
      })
      .returning();

    return NextResponse.json(newDocument, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Document upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}