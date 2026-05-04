import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TrendingUp, TrendingDown, Wallet, Target } from 'lucide-react'
import type { Transaction, Budget, Investment, SavingsGoal, Category } from '@/lib/types'
import { format } from 'date-fns'
import { GoogleIntegrations } from '@/components/dashboard/GoogleIntegrations'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard — FinPlan' }

function merchantFromNote(note: string | null): string {
  if (!note) return ''
  const parts = note.split('|')
  return parts.length > 1 ? parts[1] : ''
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: allTxns },
    { data: budgets },
    { data: investments },
    { data: goals },
    { data: accounts },
    { data: allCategories },
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .order('date', { ascending: false }),
    supabase.from('budgets').select('*, category:categories(*)'),
    supabase.from('investments').select('*'),
    supabase.from('savings_goals').select('*'),
    supabase.from('accounts').select('*'),
    supabase.from('categories').select('*').order('display_order'),
  ])

  const txns = (allTxns ?? []) as Transaction[]
  const cats = (allCategories ?? []) as Category[]
  const bdgts = (budgets ?? []) as Budget[]
  const invts = (investments ?? []) as Investment[]
  const glts = (goals ?? []) as SavingsGoal[]

  // L1/L2 maps
  const l1Map = Object.fromEntries(cats.filter(c => !c.parent_id).map(c => [c.id, c]))
  const l2ToL1 = Object.fromEntries(cats.filter(c => c.parent_id).map(c => [c.id, c.parent_id!]))

  // Latest month with transactions
  const latestDate = txns[0]?.date
  const latestMonth = latestDate ? latestDate.slice(0, 7) : new Date().toISOString().slice(0, 7)
  const startOfLatestMonth = `${latestMonth}-01`

  const monthTxns = txns.filter(t => t.date >= startOfLatestMonth && t.date <= `${latestMonth}-31`)
  const monthExpenses = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const monthIncome = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)

  const totalBudgeted = bdgts.reduce((s, b) => s + b.amount, 0)
  const budgetUsedPct = totalBudgeted > 0 ? Math.min((monthExpenses / totalBudgeted) * 100, 100) : 0

  const totalInvested = invts.reduce((s, i) => s + i.buy_price * i.units, 0)
  const totalCurrentValue = invts.reduce((s, i) => s + i.current_price * i.units, 0)
  const accountsTotal = (accounts ?? []).reduce((s: number, a: { balance: number }) => s + a.balance, 0)
  const netWorth = accountsTotal + totalCurrentValue

  // All-time L1 spend breakdown
  const l1Spend: Record<string, { name: string; color: string; amount: number }> = {}
  for (const t of txns.filter(t => t.type === 'expense')) {
    const l1Id = l2ToL1[t.category_id] ?? t.category_id
    const l1 = l1Map[l1Id]
    if (!l1) continue
    if (!l1Spend[l1Id]) l1Spend[l1Id] = { name: l1.name, color: l1.color, amount: 0 }
    l1Spend[l1Id].amount += t.amount
  }
  const topCategories = Object.values(l1Spend)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const defaultCategoryId = cats.find(c => c.parent_id)?.id ?? ''
  const defaultAccountId = (accounts ?? [])[0]?.id ?? ''
  const recentTxns = txns.slice(0, 5)

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(`${latestMonth}-15`), 'MMMM yyyy')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Net Worth"
          value={formatCurrency(netWorth)}
          icon={<Wallet className="h-4 w-4" />}
          sub="accounts + investments"
        />
        <SummaryCard
          title="Month Spent"
          value={formatCurrency(monthExpenses)}
          icon={<TrendingDown className="h-4 w-4 text-destructive" />}
          sub={totalBudgeted > 0 ? `of ${formatCurrency(totalBudgeted)} budgeted` : 'no budget set'}
          highlight={totalBudgeted > 0 && monthExpenses > totalBudgeted}
        />
        <SummaryCard
          title="Income"
          value={formatCurrency(monthIncome)}
          icon={<TrendingUp className="h-4 w-4 text-green-500" />}
          sub="this month"
        />
        <SummaryCard
          title="Portfolio"
          value={formatCurrency(totalCurrentValue)}
          icon={<TrendingUp className="h-4 w-4" />}
          sub={`${totalCurrentValue >= totalInvested ? '+' : ''}${formatCurrency(totalCurrentValue - totalInvested)} P&L`}
          highlight={invts.length > 0 && totalCurrentValue < totalInvested}
        />
      </div>

      {totalBudgeted > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monthly Budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{formatCurrency(monthExpenses)} spent</span>
              <span className="font-medium">{Math.round(budgetUsedPct)}%</span>
            </div>
            <Progress value={budgetUsedPct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {formatCurrency(Math.max(totalBudgeted - monthExpenses, 0))} remaining
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Top Spending
              <span className="text-muted-foreground font-normal ml-1 text-xs">all time</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses yet.</p>
            ) : (
              topCategories.map((cat) => (
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Savings Goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {glts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No goals yet. Add one in Goals.</p>
            ) : (
              glts.slice(0, 3).map((goal) => {
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

      <GoogleIntegrations
        defaultCategoryId={defaultCategoryId}
        defaultAccountId={defaultAccountId}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
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
                            {l1 ? `${l1.name} › ${t.category?.name}` : t.category?.name ?? ''}
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
  title: string; value: string; icon: React.ReactNode; sub: string; highlight?: boolean
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
