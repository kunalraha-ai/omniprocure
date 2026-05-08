import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // If there's no code, Supabase sent us a hash-fragment flow (older implicit flow).
  // Redirect to a tiny client page that reads the hash and calls /auth/callback again with ?code=
  if (!code) {
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Signing in…</title>
  <style>
    body { margin:0; display:flex; min-height:100vh; align-items:center; justify-content:center;
           font-family:system-ui,sans-serif; background:#0a0e1a; color:#e0e8f0; }
    .card { max-width:400px; padding:32px; border-radius:20px; text-align:center;
            background:rgba(15,21,36,0.8); border:1px solid rgba(125,211,252,0.15); }
    .spinner { margin:24px auto 0; width:36px; height:36px; border-radius:9999px;
               border:3px solid rgba(125,211,252,0.2); border-top-color:#7dd3fc;
               animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;">Signing in…</h2>
    <p style="margin:0;font-size:13px;color:#a0b4c4;">Completing your login, please wait.</p>
    <div class="spinner"></div>
  </div>
  <script>
    // Supabase PKCE / implicit flow sends tokens in the URL hash.
    // Exchange them for a server-readable code by bouncing through the callback.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);

    const accessToken  = hash.get('access_token')  || query.get('access_token');
    const refreshToken = hash.get('refresh_token') || query.get('refresh_token');
    const errorDesc    = hash.get('error_description') || query.get('error_description');

    if (errorDesc) {
      window.location.href = '/auth/login?error=' + encodeURIComponent(errorDesc);
    } else if (accessToken && refreshToken) {
      // Post tokens back to our API so we can set server-side cookies
      fetch('/auth/callback/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
      })
      .then(r => r.json())
      .then(d => { window.location.href = d.ok ? '/dashboard' : '/auth/login'; })
      .catch(() => { window.location.href = '/auth/login'; });
    } else {
      window.location.href = '/auth/login';
    }
  </script>
</body>
</html>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // ── PKCE flow: exchange the code for a session server-side ──────────────────
  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () =>
        request.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
      setAll: (cookies) => {
        cookies.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  // Session is now set in cookies — middleware will see it on the next request
  return response;
}