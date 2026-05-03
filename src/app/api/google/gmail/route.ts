import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchReceiptEmails } from '@/lib/google/gmail'

export async function POST(req: NextRequest) {
  const { categoryId, accountId } = await req.json()

  if (!categoryId || !accountId) {
    return NextResponse.json(
      { error: 'categoryId and accountId are required to log transactions' },
      { status: 400 }
    )
  }

  try {
    const receipts = await fetchReceiptEmails(30)
    if (!receipts.length) {
      return NextResponse.json({ imported: 0, message: 'No receipt emails found in last 30 days' })
    }

    const supabase = await createClient()

    // Deduplicate by messageId using metadata note field
    const { data: existing } = await supabase
      .from('transactions')
      .select('note')
      .like('note', 'gmail:%')

    const importedIds = new Set((existing ?? []).map((t) => t.note?.replace('gmail:', '')))
    const newReceipts = receipts.filter((r) => !importedIds.has(r.messageId))

    if (!newReceipts.length) {
      return NextResponse.json({ imported: 0, message: 'All receipts already imported' })
    }

    const rows = newReceipts.map((r) => ({
      amount: r.amount,
      type: 'expense' as const,
      category_id: categoryId,
      account_id: accountId,
      date: r.date,
      note: `gmail:${r.messageId}`, // used for dedup
    }))

    const { error } = await supabase.from('transactions').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      imported: rows.length,
      receipts: newReceipts.map((r) => ({
        merchant: r.merchant,
        amount: r.amount,
        date: r.date,
        subject: r.rawSubject,
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  try {
    const receipts = await fetchReceiptEmails(30)
    return NextResponse.json({ count: receipts.length, receipts })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
