import { createClient } from '@/lib/supabase/server'
import { formatCurrency, currentMonth } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TrendingUp, TrendingDown, Wallet, Target } from 'lucide-react'
import type { Transaction, Budget, Investment, SavingsGoal } from '@/lib/types'
import { format } from 'date-fns'
import { GoogleIntegrations } from '@/components/dashboard/GoogleIntegrations'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard — FinPlan' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const month = currentMonth()
  const startOfMonth = `${month}-01`

  const [
    { data: transactions },
    { data: budgets },
    { data: investments },
    { data: goals },
    { data: accounts },
    { data: categories },
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .gte('date', startOfMonth)
      .order('date', { ascending: false }),
    supabase
      .from('budgets')
      .select('*, category:categories(*)')
      .eq('month', month),
    supabase.from('investments').select('*'),
    supabase.from('savings_goals').select('*'),
    supabase.from('accounts').select('*'),
    supabase.from('categories').select('*').eq('type', 'expense').limit(1),
  ])

  const txns = (transactions ?? []) as Transaction[]
  const defaultCategoryId = (categories ?? [])[0]?.id ?? ''
  const defaultAccountId = (accounts ?? [])[0]?.id ?? ''
  const bdgts = (budgets ?? []) as Budget[]
  const invts = (investments ?? []) as Investment[]
  const glts = (goals ?? []) as SavingsGoal[]

  const totalExpenses = txns
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)
  const totalIncome = txns
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)
  const totalBudgeted = bdgts.reduce((s, b) => s + b.amount, 0)
  const totalInvested = invts.reduce((s, i) => s + i.buy_price * i.units, 0)
  const totalCurrentValue = invts.reduce((s, i) => s + i.current_price * i.units, 0)
  const accountsTotal = (accounts ?? []).reduce((s: number, a: { balance: number }) => s + a.balance, 0)
  const netWorth = accountsTotal + totalCurrentValue

  const budgetUsedPct = totalBudgeted > 0 ? Math.min((totalExpenses / totalBudgeted) * 100, 100) : 0

  const spendByCategory = txns
    .filter((t) => t.type === 'expense' && t.category)
    .reduce((acc: Record<string, { name: string; color: string; amount: number }>, t) => {
      const id = t.category_id
      if (!acc[id]) acc[id] = { name: t.category!.name, color: t.category!.color, amount: 0 }
      acc[id].amount += t.amount
      return acc
    }, {})

  const topCategories = Object.values(spendByCategory)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const recentTxns = txns.slice(0, 5)

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'MMMM yyyy')}</p>
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
          value={formatCurrency(totalExpenses)}
          icon={<TrendingDown className="h-4 w-4 text-destructive" />}
          sub={totalBudgeted > 0 ? `of ${formatCurrency(totalBudgeted)} budgeted` : 'no budget set'}
          highlight={totalBudgeted > 0 && totalExpenses > totalBudgeted}
        />
        <SummaryCard
          title="Income"
          value={formatCurrency(totalIncome)}
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
              <span className="text-muted-foreground">{formatCurrency(totalExpenses)} spent</span>
              <span className="font-medium">{Math.round(budgetUsedPct)}%</span>
            </div>
            <Progress value={budgetUsedPct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {formatCurrency(Math.max(totalBudgeted - totalExpenses, 0))} remaining
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top Spending This Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses this month yet.</p>
            ) : (
              topCategories.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span>{cat.name}</span>
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
            <p className="text-sm text-muted-foreground">No transactions this month. Add one in Expenses.</p>
          ) : (
            <div>
              {recentTxns.map((t, i) => (
                <div key={t.id}>
                  <div className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      {t.category && (
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.category.color }} />
                      )}
                      <div>
                        <p className="font-medium">{t.category?.name ?? 'Uncategorised'}</p>
                        <p className="text-xs text-muted-foreground">{t.note ?? t.date}</p>
                      </div>
                    </div>
                    <Badge variant={t.type === 'income' ? 'default' : 'secondary'}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </Badge>
                  </div>
                  {i < recentTxns.length - 1 && <Separator />}
                </div>
              ))}
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
