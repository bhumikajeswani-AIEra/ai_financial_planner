import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exportMonthlyReport } from '@/lib/google/drive'
import { currentMonth } from '@/lib/utils'
import type { Transaction, Budget, Investment } from '@/lib/types'

export async function POST() {
  const supabase = await createClient()
  const month = currentMonth()
  const startOfMonth = `${month}-01`

  try {
    const [{ data: transactions }, { data: budgets }, { data: investments }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, category:categories(*)')
        .gte('date', startOfMonth)
        .order('date', { ascending: false }),
      supabase.from('budgets').select('*, category:categories(*)').eq('month', month),
      supabase.from('investments').select('*'),
    ])

    const txns = (transactions ?? []) as Transaction[]
    const bdgts = (budgets ?? []) as Budget[]
    const invts = (investments ?? []) as Investment[]

    const totalIncome = txns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const totalExpenses = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const totalBudgeted = bdgts.reduce((s, b) => s + b.amount, 0)

    const result = await exportMonthlyReport({
      month,
      totalIncome,
      totalExpenses,
      totalBudgeted,
      transactions: txns,
      budgets: bdgts,
      investments: invts,
    })

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
