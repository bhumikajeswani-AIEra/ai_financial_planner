import { google } from 'googleapis'
import { getOAuthClient } from './auth'

export interface ParsedReceipt {
  merchant: string
  amount: number
  date: string
  rawSubject: string
  messageId: string
}

// Patterns to extract amounts from email bodies/subjects
const AMOUNT_PATTERNS = [
  /(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{2})?)/i,
  /(?:amount|paid|total|charged)[:\s]+(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{2})?)/i,
  /([\d,]+(?:\.\d{2})?)\s*(?:INR|Rs\.?|₹)/i,
]

function extractAmount(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      const raw = match[1].replace(/,/g, '')
      const val = parseFloat(raw)
      if (!isNaN(val) && val > 0) return val
    }
  }
  return null
}

function extractMerchant(subject: string, from: string): string {
  // Try to get sender name before the email address
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</)
  if (nameMatch) return nameMatch[1].trim()

  // Fallback: use domain from email
  const domainMatch = from.match(/@([^.>]+)/)
  return domainMatch ? domainMatch[1] : 'Unknown'
}

function decodeBase64(encoded: string): string {
  return Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function extractBody(payload: Record<string, unknown>): string {
  const parts = payload.parts as Array<Record<string, unknown>> | undefined
  if (parts) {
    for (const part of parts) {
      if (part.mimeType === 'text/plain') {
        const body = part.body as Record<string, unknown>
        if (body?.data) return decodeBase64(body.data as string)
      }
    }
  }
  const body = payload.body as Record<string, unknown> | undefined
  if (body?.data) return decodeBase64(body.data as string)
  return ''
}

export async function fetchReceiptEmails(maxResults = 20): Promise<ParsedReceipt[]> {
  const auth = getOAuthClient()
  const gmail = google.gmail({ version: 'v1', auth })

  // Search for payment/receipt emails in the last 30 days
  const query = 'subject:(receipt OR payment OR transaction OR order OR invoice OR debit OR credited) newer_than:30d'

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  })

  const messages = listRes.data.messages ?? []
  if (!messages.length) return []

  const receipts: ParsedReceipt[] = []

  await Promise.allSettled(
    messages.map(async (msg) => {
      if (!msg.id) return

      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      })

      const headers = (full.data.payload?.headers ?? []) as Array<{ name: string; value: string }>
      const subject = headers.find((h) => h.name === 'Subject')?.value ?? ''
      const from = headers.find((h) => h.name === 'From')?.value ?? ''
      const dateStr = headers.find((h) => h.name === 'Date')?.value ?? ''

      const body = extractBody(full.data.payload as Record<string, unknown>)
      const searchText = `${subject} ${body.slice(0, 1000)}`

      const amount = extractAmount(searchText)
      if (!amount) return  // skip emails with no parseable amount

      const date = dateStr
        ? new Date(dateStr).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]

      receipts.push({
        merchant: extractMerchant(subject, from),
        amount,
        date,
        rawSubject: subject,
        messageId: msg.id,
      })
    })
  )

  return receipts
}
