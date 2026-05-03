'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, daysUntil, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Trash2 } from 'lucide-react'
import type { SavingsGoal } from '@/lib/types'

const GOAL_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#f43f5e']

export default function GoalsPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [contributeGoal, setContributeGoal] = useState<SavingsGoal | null>(null)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    name: '',
    target_amount: '',
    deadline: '',
    color: GOAL_COLORS[0],
  })
  const [contribution, setContribution] = useState('')

  async function load() {
    const { data } = await supabase.from('savings_goals').select('*').order('deadline')
    setGoals((data ?? []) as SavingsGoal[])
  }

  useEffect(() => { load() }, [])

  async function addGoal() {
    if (!form.name || !form.target_amount || !form.deadline) return
    await supabase.from('savings_goals').insert({
      name: form.name,
      target_amount: parseFloat(form.target_amount),
      current_amount: 0,
      deadline: form.deadline,
      color: form.color,
    })
    setAddOpen(false)
    setForm({ name: '', target_amount: '', deadline: '', color: GOAL_COLORS[0] })
    startTransition(() => { load() })
  }

  async function addContribution() {
    if (!contributeGoal || !contribution) return
    const newAmount = contributeGoal.current_amount + parseFloat(contribution)
    await supabase
      .from('savings_goals')
      .update({ current_amount: Math.min(newAmount, contributeGoal.target_amount) })
      .eq('id', contributeGoal.id)
    setContributeGoal(null)
    setContribution('')
    startTransition(() => { load() })
  }

  async function deleteGoal(id: string) {
    await supabase.from('savings_goals').delete().eq('id', id)
    startTransition(() => { load() })
  }

  const totalSaved = goals.reduce((s, g) => s + g.current_amount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0)

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Savings Goals</h1>
          <p className="text-sm text-muted-foreground">Track your financial milestones</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Goal</Button>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Savings Goal</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Goal Name</Label>
                <Input placeholder="e.g. Emergency Fund, Europe Trip" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Target Amount (₹)</Label>
                  <Input type="number" placeholder="0" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Deadline</Label>
                  <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {GOAL_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setForm({ ...form, color: c })}
                    />
                  ))}
                </div>
              </div>
              <Button onClick={addGoal} className="w-full" disabled={isPending}>Create Goal</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {goals.length > 0 && (
        <Card>
          <CardContent className="pt-5 pb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total saved: {formatCurrency(totalSaved)} of {formatCurrency(totalTarget)}</span>
              <span className="font-medium">{totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%</span>
            </div>
            <Progress value={totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Contribute dialog */}
      <Dialog open={!!contributeGoal} onOpenChange={(o) => { if (!o) setContributeGoal(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Contribution — {contributeGoal?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Current: {formatCurrency(contributeGoal?.current_amount ?? 0)} / {formatCurrency(contributeGoal?.target_amount ?? 0)}
            </p>
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input type="number" placeholder="0" value={contribution} onChange={(e) => setContribution(e.target.value)} />
            </div>
            <Button onClick={addContribution} className="w-full" disabled={isPending}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {goals.length === 0 ? (
          <Card className="col-span-2">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No goals yet. Start by adding your first savings goal.
            </CardContent>
          </Card>
        ) : (
          goals.map((goal) => {
            const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100)
            const days = daysUntil(goal.deadline)
            const done = pct >= 100

            return (
              <Card key={goal.id} className="group">
                <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: goal.color }} />
                    <CardTitle className="text-sm font-semibold">{goal.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    {done ? (
                      <Badge className="text-xs">Achieved!</Badge>
                    ) : (
                      <Badge variant={days < 30 ? 'destructive' : 'secondary'} className="text-xs">
                        {days > 0 ? `${days}d left` : 'Overdue'}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={pct} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="tabular-nums font-medium text-foreground">{formatCurrency(goal.current_amount)}</span>
                    <span className="tabular-nums">{formatCurrency(goal.target_amount)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Deadline: {formatDate(goal.deadline)}</p>
                  <div className="flex gap-2 pt-1">
                    {!done && (
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setContributeGoal(goal)}>
                        + Contribute
                      </Button>
                    )}
                    <Button
                      size="icon" variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 ml-auto"
                      onClick={() => deleteGoal(goal.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
