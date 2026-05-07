import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractTransactions, suggestCategory } from '@/lib/pdf/extract'

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Try unpdf first — better compatibility with ICICI/HDFC/modern PDFs
  try {
    const { extractText } = await import('unpdf')
    const uint8 = new Uint8Array(buffer)
    const { text } = await extractText(uint8, { mergePages: true })
    if (text && text.trim().length > 50) return text
  } catch (e) {
    console.error('[bills] unpdf failed:', e instanceof Error ? e.message : String(e))
  }

  // Fallback to pdf-parse
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse/lib/pdf-parse.js')
  const pdf = await pdfParse(buffer)
  return pdf.text
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  let text: string
  try {
    text = await extractPdfText(buffer)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[bills] pdf extraction error:', msg)
    const lower = msg.toLowerCase()
    const isProtected = lower.includes('encrypt') || lower.includes('password') ||
      lower.includes('bad xref') || lower.includes('invalid pdf') || lower.includes('xref')
    return NextResponse.json({
      error: isProtected
        ? 'This PDF is password-protected. Open it in Chrome, enter your password, then Cmd+P → Save as PDF and upload that instead.'
        : `Could not read this PDF (${msg.slice(0, 80)}). Try opening it in Chrome → Cmd+P → Save as PDF, then re-upload.`,
      transactions: [],
    }, { status: 422 })
  }

  if (!text || text.trim().length < 50) {
    return NextResponse.json({
      error: 'This PDF appears to be a scanned image with no text layer. Try downloading the statement directly from your bank\'s net banking portal.',
      transactions: [],
    }, { status: 422 })
  }

  const extracted = await extractTransactions(text)
  if (!extracted.length) {
    return NextResponse.json({ message: 'No transactions found in PDF', transactions: [] })
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', user.id)

  const categoryMap = Object.fromEntries((categories ?? []).map(c => [c.name, c.id]))

  const preview = extracted.map(t => ({
    ...t,
    suggestedCategory: suggestCategory(t.description),
    suggestedCategoryId: categoryMap[suggestCategory(t.description)] ?? null,
  }))

  return NextResponse.json({ transactions: preview, total: preview.length })
}
