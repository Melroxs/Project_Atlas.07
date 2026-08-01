import { NextResponse } from 'next/server'

// Frontend-only build for Atlas. The backend is provided separately and will be
// connected later. This route exists only to satisfy Next.js and returns a
// friendly placeholder for any /api/* request during frontend development.
export async function GET(_request, { params }) {
  const path = params?.path?.join('/') || ''
  return NextResponse.json({
    ok: true,
    service: 'atlas-frontend',
    note: 'Frontend-only. Backend will be wired to this route later.',
    path,
  })
}

export async function POST(_request, { params }) {
  const path = params?.path?.join('/') || ''
  return NextResponse.json({ ok: true, path, note: 'Frontend-only stub.' })
}
