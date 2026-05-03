'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CalendarCheck, FileUp, Mail, Loader2, ExternalLink } from 'lucide-react'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface ActionState {
  status: Status
  message: string
  link?: string
}

const defaultState: ActionState = { status: 'idle', message: '' }

export function GoogleIntegrations({
  defaultCategoryId,
  defaultAccountId,
}: {
  defaultCategoryId: string
  defaultAccountId: string
}) {
  const [calendar, setCalendar] = useState<ActionState>(defaultState)
  const [reminder, setReminder] = useState<ActionState>(defaultState)
  const [drive, setDrive] = useState<ActionState>(defaultState)
  const [gmail, setGmail] = useState<ActionState>(defaultState)

  async function syncGoals() {
    setCalendar({ status: 'loading', message: 'Syncing goals…' })
    try {
      const res = await fetch('/api/google/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_goals' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCalendar({ status: 'success', message: `${data.synced}/${data.total} goals synced to Calendar` })
    } catch (e) {
      setCalendar({ status: 'error', message: String(e) })
    }
  }

  async function addBudgetReminder() {
    setReminder({ status: 'loading', message: 'Creating reminder…' })
    try {
      const res = await fetch('/api/google/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'budget_reminder' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setReminder({ status: 'success', message: `Monthly reminder set from ${data.date}` })
    } catch (e) {
      setReminder({ status: 'error', message: String(e) })
    }
  }

  async function exportToDrive() {
    setDrive({ status: 'loading', message: 'Exporting to Drive…' })
    try {
      const res = await fetch('/api/google/drive', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDrive({ status: 'success', message: `Exported: ${data.fileName}`, link: data.url })
    } catch (e) {
      setDrive({ status: 'error', message: String(e) })
    }
  }

  async function importGmailReceipts() {
    setGmail({ status: 'loading', message: 'Scanning emails…' })
    try {
      const res = await fetch('/api/google/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: defaultCategoryId, accountId: defaultAccountId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGmail({
        status: 'success',
        message: data.imported > 0
          ? `${data.imported} transactions imported from Gmail`
          : data.message ?? 'No new receipts found',
      })
    } catch (e) {
      setGmail({ status: 'error', message: String(e) })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Google Integrations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <IntegrationRow
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Sync Goals to Calendar"
          description="Create deadline events for all savings goals"
          state={calendar}
          onAction={syncGoals}
        />
        <IntegrationRow
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Monthly Budget Reminder"
          description="Recurring reminder on 1st of every month"
          state={reminder}
          onAction={addBudgetReminder}
        />
        <IntegrationRow
          icon={<FileUp className="h-4 w-4" />}
          label="Export Report to Drive"
          description="Upload this month's CSV summary to Google Drive"
          state={drive}
          onAction={exportToDrive}
        />
        <IntegrationRow
          icon={<Mail className="h-4 w-4" />}
          label="Import Gmail Receipts"
          description="Auto-log expenses from payment emails (last 30 days)"
          state={gmail}
          onAction={importGmailReceipts}
        />
      </CardContent>
    </Card>
  )
}

function IntegrationRow({
  icon,
  label,
  description,
  state,
  onAction,
}: {
  icon: React.ReactNode
  label: string
  description: string
  state: ActionState
  onAction: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="flex items-start gap-3 min-w-0">
        <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{label}</p>
          {state.status === 'idle' && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {state.status === 'loading' && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> {state.message}
            </p>
          )}
          {state.status === 'success' && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              {state.message}
              {state.link && (
                <a href={state.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </p>
          )}
          {state.status === 'error' && (
            <p className="text-xs text-destructive truncate">{state.message}</p>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {state.status === 'success' && <Badge variant="outline" className="text-xs text-green-600 border-green-600">Done</Badge>}
        <Button
          size="sm"
          variant="outline"
          onClick={onAction}
          disabled={state.status === 'loading'}
          className="text-xs h-7 px-2"
        >
          {state.status === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Run'}
        </Button>
      </div>
    </div>
  )
}
