import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function GET() {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Signing in…</title>
  <style>body{margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;font-family:system-ui, sans-serif;background:#f8fafc;color:#111827;} .card{max-width:420px;padding:32px;border-radius:28px;background:#ffffff;box-shadow:0 30px 80px rgba(15,23,42,0.12);text-align:center;} .spinner{margin:24px auto 0;width:40px;height:40px;border-radius:9999px;border:4px solid #e2e8f0;border-top-color:#1f2937;animation:spin 1s linear infinite;}@keyframes spin{to{transform:rotate(360deg);}}</style>
</head>
<body>
  <div class="card">
    <h1>Signing in…</h1>
    <p>Please wait while we complete your login.</p>
    <div class="spinner"></div>
  </div>
  <script type="module">
    import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
    const supabase = createClient('${supabaseUrl}', '${supabaseAnonKey}');
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get('access_token') || search.get('access_token');
    const refreshToken = hash.get('refresh_token') || search.get('refresh_token');
    const errorDescription = hash.get('error_description') || search.get('error_description');
    async function finish() {
      if (errorDescription) {
        window.location.href = '/auth/login';
        return;
      }
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
      window.location.href = '/dashboard';
    }
    finish();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}
