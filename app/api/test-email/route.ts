import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = body?.email

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // TODO: integrate a real email provider or Supabase function here.
    return NextResponse.json({ status: 'ok', message: `Test email queued for ${email}` })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to send test email' }, { status: 500 })
  }
}
