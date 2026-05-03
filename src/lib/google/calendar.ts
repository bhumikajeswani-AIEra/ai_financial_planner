import { google } from 'googleapis'
import { getOAuthClient } from './auth'
import type { SavingsGoal } from '@/lib/types'

export async function syncGoalDeadlines(goals: SavingsGoal[]) {
  const auth = getOAuthClient()
  const calendar = google.calendar({ version: 'v3', auth })

  const results = await Promise.allSettled(
    goals.map(async (goal) => {
      const event = {
        summary: `🎯 Goal Deadline: ${goal.name}`,
        description: `Target: ₹${goal.target_amount.toLocaleString('en-IN')}\nSaved: ₹${goal.current_amount.toLocaleString('en-IN')}\nRemaining: ₹${Math.max(goal.target_amount - goal.current_amount, 0).toLocaleString('en-IN')}`,
        start: { date: goal.deadline },
        end: { date: goal.deadline },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 * 24 * 7 },  // 1 week before
            { method: 'popup', minutes: 60 * 24 },       // 1 day before
          ],
        },
      }
      const res = await calendar.events.insert({ calendarId: 'primary', requestBody: event })
      return { goal: goal.name, eventId: res.data.id }
    })
  )

  return results.map((r, i) => ({
    goal: goals[i].name,
    status: r.status,
    eventId: r.status === 'fulfilled' ? r.value.eventId : null,
    error: r.status === 'rejected' ? String(r.reason) : null,
  }))
}

export async function createMonthlyBudgetReminder() {
  const auth = getOAuthClient()
  const calendar = google.calendar({ version: 'v3', auth })

  const now = new Date()
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toISOString()
    .split('T')[0]

  const event = {
    summary: '📊 Monthly Budget Review — FinPlan',
    description: 'Review last month\'s spending, update budgets, and check savings goals.',
    start: { date: firstOfNextMonth },
    end: { date: firstOfNextMonth },
    recurrence: ['RRULE:FREQ=MONTHLY;BYMONTHDAY=1'],
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 60 * 9 }], // 9am reminder
    },
  }

  const res = await calendar.events.insert({ calendarId: 'primary', requestBody: event })
  return { eventId: res.data.id, date: firstOfNextMonth }
}
