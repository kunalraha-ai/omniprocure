/**
 * app/api/test-email/route.ts
 * Called by Settings page "Test" button to verify email works
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured in Railway' }, { status: 500 });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: email,
      subject: '✅ OmniProcure — Email notifications are working!',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0f1524; padding: 24px; border-radius: 12px; border-left: 4px solid #7dd3fc;">
            <h2 style="color: #e0e8f0; margin: 0 0 12px;">✅ Email notifications active</h2>
            <p style="color: #a0b4c4; font-size: 14px; margin: 0 0 20px;">
              Your OmniProcure alert email is configured correctly. You'll receive notifications here when supply chain issues are detected.
            </p>
            <a href="https://omniprocure.online/dashboard/alerts"
              style="display: inline-block; padding: 10px 20px; background: #7dd3fc; color: #0f1524; border-radius: 8px; text-decoration: none; font-weight: bold;">
              View Alerts →
            </a>
          </div>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.json();
    return NextResponse.json({ error: body?.message ?? 'Resend API error' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
