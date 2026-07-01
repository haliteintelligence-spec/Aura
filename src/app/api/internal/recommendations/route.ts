import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

function verifyInternalSecret(req: NextRequest) {
  return req.headers.get('x-internal-secret') === process.env.INTERNAL_API_SECRET
}

export async function POST(req: NextRequest) {
  if (!verifyInternalSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, recommendations } = await req.json()

  if (!userId || !Array.isArray(recommendations)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await sql`
    INSERT INTO user_recommendations (user_id, recommendations, cached_at)
    VALUES (${userId}, ${JSON.stringify(recommendations)}, now())
    ON CONFLICT (user_id) DO UPDATE
      SET recommendations = EXCLUDED.recommendations,
          cached_at = now()
  `

  return NextResponse.json({ ok: true })
}
