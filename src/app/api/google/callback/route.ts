import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

// Step 2: Google redirects here with ?code=...
// Exchanges code for tokens and shows the refresh_token to copy into .env.local
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'No code in callback' }, { status: 400 })
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )

  const { tokens } = await client.getToken(code)

  if (!tokens.refresh_token) {
    return new NextResponse(
      `<html><body style="font-family:monospace;padding:2rem">
        <h2>⚠️ No refresh_token returned</h2>
        <p>This happens when the account already granted access.
        Go to <a href="https://myaccount.google.com/permissions">Google Account Permissions</a>,
        revoke access for this app, then visit
        <a href="/api/google/auth">/api/google/auth</a> again.</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  return new NextResponse(
    `<html><body style="font-family:monospace;padding:2rem;max-width:700px">
      <h2>✅ Google OAuth connected!</h2>
      <p>Copy this into your <code>.env.local</code>:</p>
      <pre style="background:#f4f4f4;padding:1rem;border-radius:6px;word-break:break-all">GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}</pre>
      <p>Then restart the dev server — all Google integrations will be live.</p>
      <p><a href="/">← Back to Dashboard</a></p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
