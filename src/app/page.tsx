'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, Target, CreditCard } from 'lucide-react'
import { format } from 'date-fns'
import type { Transaction, Category, Investment, SavingsGoal } from '@/lib/types'

function parseMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

function merchantFromNote(note: string | null): string {
  if (!note) return ''
  const parts = note.split('|')
  return parts.length > 1 ? parts[1] : ''
}

export default function DashboardPage() {
  const supabase = createClient()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [accounts, setAccounts] = useState<{ id: string; balance: number; name: string }[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [excludeCC, setExcludeCC] = useState(false)

  useEffect(() => {
    async function load() {
      const [
        { data: txns },
        { data: cats },
        { data: invts },
        { data: glts },
        { data: accts },
      ] = await Promise.all([
        supabase.from('transactions').select('*, category:categories(*)').order('date', { ascending: false }),
        supabase.from('categories').select('*').order('display_order'),
        supabase.from('investments').select('*'),
        supabase.from('savings_goals').select('*'),
        supabase.from('accounts').select('*'),
      ])

      setTransactions((txns ?? []) as Transaction[])
      setCategories((cats ?? []) as Category[])
      setInvestments((invts ?? []) as Investment[])
      setGoals((glts ?? []) as SavingsGoal[])
      setAccounts(accts ?? [])
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // L1/L2 maps
  const l1Map = useMemo(
    () => Object.fromEntries(categories.filter(c => !c.parent_id).map(c => [c.id, c])),
    [categories]
  )
  const l2ToL1 = useMemo(
    () => Object.fromEntries(categories.filter(c => c.parent_id).map(c => [c.id, c.parent_id!])),
    [categories]
  )

  // Available months from transactions (descending)
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>()
    for (const t of transactions) {
      if (t.date) monthSet.add(t.date.slice(0, 7))
    }
    return Array.from(monthSet).sort((a, b) => b.localeCompare(a))
  }, [transactions])

  // Set default selectedMonth once availableMonths is ready
  useEffect(() => {
    if (availableMonths.length > 0 && selectedMonth === null) {
      setSelectedMonth(availableMonths[0])
    }
  }, [availableMonths, selectedMonth])

  const currentMonthIndex = selectedMonth ? availableMonths.indexOf(selectedMonth) : 0
  const displayMonth = selectedMonth ?? availableMonths[0] ?? new Date().toISOString().slice(0, 7)

  function goPrev() {
    if (currentMonthIndex < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentMonthIndex + 1])
    }
  }
  function goNext() {
    if (currentMonthIndex > 0) {
      setSelectedMonth(availableMonths[currentMonthIndex - 1])
    }
  }

  // Month transactions
  const monthTxns = useMemo(() => {
    return transactions.filter(t => t.date?.slice(0, 7) === displayMonth)
  }, [transactions, displayMonth])

  // CC category IDs (L1 named "credit card bill")
  const ccL1Ids = useMemo(() => {
    return new Set(
      categories
        .filter(c => !c.parent_id && c.name.toLowerCase() === 'credit card bill')
        .map(c => c.id)
    )
  }, [categories])
  const ccL2Ids = useMemo(() => {
    return new Set(
      categories
        .filter(c => c.parent_id && ccL1Ids.has(c.parent_id))
        .map(c => c.id)
    )
  }, [categories, ccL1Ids])

  function isCCTransaction(t: Transaction): boolean {
    const l1Id = l2ToL1[t.category_id] ?? t.category_id
    return ccL1Ids.has(l1Id) || ccL2Ids.has(t.category_id)
  }

  const filteredMonthExpenses = useMemo(() => {
    return monthTxns
      .filter(t => t.type === 'expense')
      .filter(t => !(excludeCC && isCCTransaction(t)))
      .reduce((s, t) => s + t.amount, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthTxns, excludeCC, ccL1Ids, ccL2Ids])

  const monthIncome = useMemo(() =>
    monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [monthTxns]
  )

  const savingsRate = useMemo(() => {
    if (monthIncome === 0) return 0
    return Math.round(((monthIncome - filteredMonthExpenses) / monthIncome) * 100)
  }, [monthIncome, filteredMonthExpenses])

  // Net worth
  const totalCurrentValue = useMemo(
    () => investments.reduce((s, i) => s + i.current_price * i.units, 0),
    [investments]
  )
  const accountsTotal = useMemo(
    () => accounts.reduce((s, a) => s + a.balance, 0),
    [accounts]
  )
  const netWorth = accountsTotal + totalCurrentValue

  // Top spending this month by L1 (top 6)
  const topSpending = useMemo(() => {
    const l1Spend: Record<string, { name: string; color: string; amount: number }> = {}
    for (const t of monthTxns.filter(t => t.type === 'expense')) {
      if (excludeCC && isCCTransaction(t)) continue
      const l1Id = l2ToL1[t.category_id] ?? t.category_id
      const l1 = l1Map[l1Id]
      if (!l1) continue
      if (!l1Spend[l1Id]) l1Spend[l1Id] = { name: l1.name, color: l1.color, amount: 0 }
      l1Spend[l1Id].amount += t.amount
    }
    return Object.values(l1Spend).sort((a, b) => b.amount - a.amount).slice(0, 6)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthTxns, excludeCC, l1Map, l2ToL1, ccL1Ids, ccL2Ids])

  // Recent transactions: last 5 from selectedMonth, fallback last 5 overall
  const recentTxns = useMemo(() => {
    const fromMonth = monthTxns.slice(0, 5)
    return fromMonth.length > 0 ? fromMonth : transactions.slice(0, 5)
  }, [monthTxns, transactions])

  const monthLabel = useMemo(() => {
    if (!displayMonth) return ''
    return format(parseMonth(displayMonth), 'MMMM yyyy')
  }, [displayMonth])

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header + month nav */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {availableMonths.length > 0
              ? `${currentMonthIndex + 1} / ${availableMonths.length} months`
              : 'No transactions yet'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={goPrev}
            disabled={currentMonthIndex >= availableMonths.length - 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium w-32 text-center tabular-nums">{monthLabel}</span>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={goNext}
            disabled={currentMonthIndex <= 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={excludeCC ? 'default' : 'outline'}
            className="h-8 text-xs ml-2 gap-1"
            onClick={() => setExcludeCC(v => !v)}
          >
            <CreditCard className="h-3.5 w-3.5" />
            {excludeCC ? 'Excl. CC Bills' : 'Incl. CC Bills'}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Net Worth"
          value={formatCurrency(netWorth)}
          icon={<Wallet className="h-4 w-4" />}
          sub="accounts + investments"
        />
        <SummaryCard
          title="Month Spent"
          value={formatCurrency(filteredMonthExpenses)}
          icon={<TrendingDown className="h-4 w-4 text-destructive" />}
          sub={monthLabel}
          highlight={filteredMonthExpenses > monthIncome && monthIncome > 0}
        />
        <SummaryCard
          title="Income"
          value={formatCurrency(monthIncome)}
          icon={<TrendingUp className="h-4 w-4 text-green-500" />}
          sub={monthLabel}
        />
        <SummaryCard
          title="Savings Rate"
          value={`${savingsRate}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          sub="(income − expenses) / income"
          highlight={savingsRate < 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top spending this month */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Top Spending
              <span className="text-muted-foreground font-normal ml-1 text-xs">{monthLabel}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topSpending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses this month.</p>
            ) : (
              topSpending.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="capitalize">{cat.name}</span>
                  </div>
                  <span className="font-medium tabular-nums">{formatCurrency(cat.amount)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Savings Goals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Savings Goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No goals yet. Add one in Goals.</p>
            ) : (
              goals.slice(0, 3).map((goal) => {
                const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100)
                return (
                  <div key={goal.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" style={{ color: goal.color }} />
                        {goal.name}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Recent Transactions
            <span className="text-muted-foreground font-normal ml-1 text-xs">{monthLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTxns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet. Add one in Expenses.</p>
          ) : (
            <div>
              {recentTxns.map((t, i) => {
                const merchant = merchantFromNote(t.note)
                const l1Id = l2ToL1[t.category_id]
                const l1 = l1Id ? l1Map[l1Id] : null
                const displayColor = l1?.color ?? t.category?.color ?? '#94a3b8'
                return (
                  <div key={t.id}>
                    <div className="flex items-center justify-between py-2.5 text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: displayColor }} />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{merchant || t.category?.name || 'Uncategorised'}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {l1 ? `${l1.name} › ${t.category?.name}` : (t.category?.name ?? '')}
                            {' · '}{t.date}
                          </p>
                        </div>
                      </div>
                      <Badge variant={t.type === 'income' ? 'default' : 'secondary'}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </Badge>
                    </div>
                    {i < recentTxns.length - 1 && <Separator />}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  title, value, icon, sub, highlight,
}: {
  title: string
  value: string
  icon: React.ReactNode
  sub: string
  highlight?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">{title}</p>
          {icon}
        </div>
        <p className={`text-xl font-semibold tabular-nums ${highlight ? 'text-destructive' : ''}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  )
}
