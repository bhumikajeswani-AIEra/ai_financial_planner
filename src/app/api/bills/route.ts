import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractTransactions, suggestCategory } from '@/lib/pdf/extract'

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
    // Use lib path directly to avoid pdf-parse loading test files (causes slowness)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const pdf = await pdfParse(buffer)
    text = pdf.text
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('encrypt') || msg.toLowerCase().includes('password')) {
      return NextResponse.json({
        error: 'This PDF is password-protected. Please remove the password and re-upload.',
        transactions: [],
      }, { status: 422 })
    }
    return NextResponse.json({ error: 'Could not read PDF. Please try a different file.', transactions: [] }, { status: 422 })
  }

  const extracted = extractTransactions(text)
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
