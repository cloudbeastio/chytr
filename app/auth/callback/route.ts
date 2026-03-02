import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  const loginUrl = `${origin}/login?error=auth_failed`
  const dashboardUrl = `${origin}${next}`
  const setSessionUrl = `${origin}/api/auth/set-session`
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Signing in...</title></head><body><p>Signing you in...</p><script>
(function(){
  var h = window.location.hash.slice(1);
  if (!h) { window.location.href = ${JSON.stringify(loginUrl)}; return; }
  var p = {};
  h.split('&').forEach(function(s){
    var i = s.indexOf('=');
    if (i > 0) p[decodeURIComponent(s.slice(0,i))] = decodeURIComponent(s.slice(i+1).replace(/\\+/g,' '));
  });
  var at = p.access_token, rt = p.refresh_token;
  if (!at || !rt) { window.location.href = ${JSON.stringify(loginUrl)}; return; }
  fetch(${JSON.stringify(setSessionUrl)}, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: at, refresh_token: rt }) })
    .then(function(r){ if (r.ok) window.location.href = ${JSON.stringify(dashboardUrl)}; else window.location.href = ${JSON.stringify(loginUrl)}; })
    .catch(function(){ window.location.href = ${JSON.stringify(loginUrl)}; });
})();
</script></body></html>`
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
