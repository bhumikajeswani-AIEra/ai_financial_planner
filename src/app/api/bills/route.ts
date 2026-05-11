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

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')

  const extracted = await extractTransactions(base64)

  if (!extracted.length) {
    return NextResponse.json({
      error: 'No transactions found. Make sure this is a valid bank or credit card statement PDF downloaded from your bank\'s net banking portal.',
      transactions: [],
    })
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', user.id)

  const categoryMap = Object.fromEntries((categories ?? []).map(c => [c.name.toLowerCase(), c.id]))

  const preview = extracted.map(t => ({
    ...t,
    suggestedCategory: suggestCategory(t.description),
    suggestedCategoryId: categoryMap[suggestCategory(t.description).toLowerCase()] ?? null,
  }))

  return NextResponse.json({ transactions: preview, total: preview.length })
}
