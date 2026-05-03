import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncGoalDeadlines, createMonthlyBudgetReminder } from '@/lib/google/calendar'
import type { SavingsGoal } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { action } = await req.json()

  try {
    if (action === 'sync_goals') {
      const supabase = await createClient()
      const { data: goals, error } = await supabase.from('savings_goals').select('*')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!goals?.length) return NextResponse.json({ message: 'No goals to sync', synced: 0 })

      const results = await syncGoalDeadlines(goals as SavingsGoal[])
      const synced = results.filter((r) => r.status === 'fulfilled').length
      return NextResponse.json({ synced, total: goals.length, results })
    }

    if (action === 'budget_reminder') {
      const result = await createMonthlyBudgetReminder()
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
