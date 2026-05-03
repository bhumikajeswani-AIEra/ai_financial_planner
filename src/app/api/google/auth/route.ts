import { NextResponse } from 'next/server'
import { google } from 'googleapis'

// Step 1: Redirect user to Google consent screen
export async function GET() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )

  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',  // force refresh_token to be returned
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
  })

  return NextResponse.redirect(url)
}
