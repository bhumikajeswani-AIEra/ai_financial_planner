'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, currentMonth } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil } from 'lucide-react'
import type { Budget, Category, Transaction } from '@/lib/types'

export default function BudgetPage() {
  const supabase = createClient()
  const month = currentMonth()

  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({ category_id: '', amount: '' })

  async function load() {
    const startOfMonth = `${month}-01`
    const [{ data: bdgts }, { data: cats }, { data: txns }] = await Promise.all([
      supabase.from('budgets').select('*, category:categories(*)').eq('month', month),
      supabase.from('categories').select('*').eq('type', 'expense').order('name'),
      supabase.from('transactions').select('*').eq('type', 'expense').gte('date', startOfMonth),
    ])
    setBudgets((bdgts ?? []) as Budget[])
    setCategories((cats ?? []) as Category[])
    setTransactions((txns ?? []) as Transaction[])
  }

  useEffect(() => { load() }, [])

  async function saveBudget() {
    if (!form.category_id || !form.amount) return
    await supabase.from('budgets').upsert(
      { category_id: form.category_id, month, amount: parseFloat(form.amount) },
      { onConflict: 'category_id,month' }
    )
    setOpen(false)
    setForm({ category_id: '', amount: '' })
    startTransition(() => { load() })
  }

  async function deleteBudget(id: string) {
    await supabase.from('budgets').delete().eq('id', id)
    startTransition(() => { load() })
  }

  const spendMap = transactions.reduce((acc: Record<string, number>, t) => {
    acc[t.category_id] = (acc[t.category_id] ?? 0) + t.amount
    return acc
  }, {})

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0)
  const totalSpent = budgets.reduce((s, b) => s + (spendMap[b.category_id] ?? 0), 0)

  const budgetedCategoryIds = new Set(budgets.map((b) => b.category_id))
  const unbudgetedCategories = categories.filter((c) => !budgetedCategoryIds.has(c.id))

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Budget</h1>
          <p className="text-sm text-muted-foreground">{month} · vs actuals</p>
        </div>
        <Button size="sm" disabled={unbudgetedCategories.length === 0} onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Set Budget
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Monthly Budget</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v ?? '' })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {unbudgetedCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Budget Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <Button onClick={saveBudget} className="w-full" disabled={isPending}>Save Budget</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {totalBudgeted > 0 && (
        <Card>
          <CardContent className="pt-5 pb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall: {formatCurrency(totalSpent)} of {formatCurrency(totalBudgeted)}</span>
              <span className="font-medium">{Math.round((totalSpent / totalBudgeted) * 100)}%</span>
            </div>
            <Progress value={Math.min((totalSpent / totalBudgeted) * 100, 100)} className="h-2" />
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {budgets.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No budgets set for {month}. Click &quot;Set Budget&quot; to get started.
            </CardContent>
          </Card>
        ) : (
          budgets.map((b) => {
            const spent = spendMap[b.category_id] ?? 0
            const pct = Math.min((spent / b.amount) * 100, 100)
            const over = spent > b.amount
            const remaining = b.amount - spent

            return (
              <Card key={b.id}>
                <CardContent className="pt-4 pb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {b.category && (
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.category.color }} />
                      )}
                      <span className="text-sm font-medium">{b.category?.name ?? 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs tabular-nums font-medium ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {formatCurrency(spent)} / {formatCurrency(b.amount)}
                      </span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteBudget(b.id)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Progress
                    value={pct}
                    className={`h-2 ${over ? '[&>div]:bg-destructive' : pct > 80 ? '[&>div]:bg-yellow-500' : ''}`}
                  />
                  <p className={`text-xs ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {over
                      ? `Over budget by ${formatCurrency(Math.abs(remaining))}`
                      : `${formatCurrency(remaining)} remaining`}
                  </p>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
