import { NextResponse } from 'next/server'
import { getSatusehatToken } from '../../../../lib/satusehat'

// POST /api/satusehat/test-connection
// Body: { client_id, client_secret, org_id }. No DB writes.
export async function POST(request: Request) {
  let body: { client_id?: string; client_secret?: string; org_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.client_id || !body.client_secret) {
    return NextResponse.json(
      { ok: false, error: 'client_id and client_secret are required' },
      { status: 400 }
    )
  }

  try {
    await getSatusehatToken({
      clientId: body.client_id,
      clientSecret: body.client_secret,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Connection failed' },
      { status: 200 }
    )
  }
}
