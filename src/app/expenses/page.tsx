'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useTransition, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Upload, Loader2, CheckCircle2, ChevronDown, ChevronRight, CreditCard } from 'lucide-react'
import type { Transaction, Category, CategoryGroup } from '@/lib/types'

interface ExtractedRow {
  date: string
  description: string
  amount: number
  type: 'expense' | 'income'
  suggestedCategory: string
  suggestedCategoryId: string | null
  selected: boolean
}

interface L2Group {
  id: string
  name: string
  amount: number
  transactions: Transaction[]
}

interface L1Group {
  id: string
  name: string
  color: string
  amount: number
  pct: number
  l2groups: L2Group[]
}

function merchantFromNote(note: string | null): string {
  if (!note) return ''
  const p = note.split('|')
  return p.length > 1 ? p[1] : ''
}

function buildGroups(categories: Category[]): CategoryGroup[] {
  const l1 = categories.filter(c => !c.parent_id).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  const l2 = categories.filter(c => c.parent_id)
  return l1.map(parent => ({
    ...parent,
    children: l2
      .filter(c => c.parent_id === parent.id)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
  }))
}

export default function ExpensesPage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [open, setOpen] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [view, setView] = useState<'category' | 'date'>('category')
  const [excludeCC, setExcludeCC] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedRow[]>([])
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set())
  const [expandedL2, setExpandedL2] = useState<Set<string>>(new Set())

  const [form, setForm] = useState({
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category_id: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
  })

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)

    const { data } = await supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setTransactions((data ?? []) as Transaction[])

    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .order('display_order')
    setCategories((cats ?? []) as Category[])
  }

  useEffect(() => { load() }, [])

  async function addTransaction() {
    if (!form.amount || !form.category_id || !userId) return
    await supabase.from('transactions').insert({
      amount: parseFloat(form.amount),
      type: form.type,
      category_id: form.category_id,
      date: form.date,
      note: form.note || null,
      user_id: userId,
    })
    setOpen(false)
    setForm({ amount: '', type: 'expense', category_id: '', date: new Date().toISOString().split('T')[0], note: '' })
    startTransition(() => { load() })
  }

  async function deleteTransaction(id: string) {
    await supabase.from('transactions').delete().eq('id', id)
    startTransition(() => { load() })
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    setPdfOpen(true)
    setExtracted([])
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/bills', { method: 'POST', body: fd })
    const data = await res.json()
    setExtracted((data.transactions ?? []).map((t: ExtractedRow) => ({ ...t, selected: true })))
    setExtracting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function saveExtracted() {
    const toSave = extracted.filter(t => t.selected)
    if (!toSave.length || !userId) return
    setSaving(true)
    const { data: cats } = await supabase.from('categories').select('id, name').eq('user_id', userId)
    const catMap = Object.fromEntries((cats ?? []).map(c => [c.name, c.id]))
    const fallbackId = cats?.[0]?.id ?? null
    const rows = toSave.map(t => ({
      amount: t.amount,
      type: t.type,
      category_id: t.suggestedCategoryId ?? catMap[t.suggestedCategory] ?? fallbackId,
      date: t.date,
      note: t.description.slice(0, 100),
      user_id: userId,
    }))
    await supabase.from('transactions').insert(rows)
    setSaving(false)
    setPdfOpen(false)
    setExtracted([])
    startTransition(() => { load() })
  }

  // Maps
  const l1Map = useMemo(
    () => Object.fromEntries(categories.filter(c => !c.parent_id).map(c => [c.id, c])),
    [categories]
  )
  const l2ToL1 = useMemo(
    () => Object.fromEntries(categories.filter(c => c.parent_id).map(c => [c.id, c.parent_id!])),
    [categories]
  )

  // CC detection
  const ccL1Ids = useMemo(() => new Set(
    categories.filter(c => !c.parent_id && c.name.toLowerCase() === 'credit card bill').map(c => c.id)
  ), [categories])

  function isCCTransaction(t: Transaction): boolean {
    const l1Id = l2ToL1[t.category_id] ?? t.category_id
    return ccL1Ids.has(l1Id)
  }

  // Hierarchical data for "By Category" view
  const l1Groups = useMemo((): L1Group[] => {
    const expenses = transactions.filter(t => {
      if (t.type !== 'expense') return false
      if (excludeCC && isCCTransaction(t)) return false
      return true
    })

    const totalExpense = expenses.reduce((s, t) => s + t.amount, 0)

    // Build L2 groups keyed by l1Id
    const byL1: Record<string, { l2: Record<string, { cat: Category; txns: Transaction[] }> }> = {}

    for (const t of expenses) {
      const l1Id = l2ToL1[t.category_id] ?? t.category_id
      if (!l1Map[l1Id]) continue
      if (!byL1[l1Id]) byL1[l1Id] = { l2: {} }
      const l2Key = t.category_id
      if (!byL1[l1Id].l2[l2Key]) {
        byL1[l1Id].l2[l2Key] = {
          cat: t.category ?? categories.find(c => c.id === t.category_id) ?? { id: l2Key, name: 'Other', type: 'expense', color: '#94a3b8', icon: '' },
          txns: [],
        }
      }
      byL1[l1Id].l2[l2Key].txns.push(t)
    }

    return Object.entries(byL1)
      .map(([l1Id, { l2 }]) => {
        const l1Cat = l1Map[l1Id]
        const l2groups: L2Group[] = Object.entries(l2).map(([l2Id, { cat, txns }]) => ({
          id: l2Id,
          name: cat.name,
          amount: txns.reduce((s, t) => s + t.amount, 0),
          transactions: txns,
        })).sort((a, b) => b.amount - a.amount)

        const amount = l2groups.reduce((s, g) => s + g.amount, 0)
        return {
          id: l1Id,
          name: l1Cat.name,
          color: l1Cat.color,
          amount,
          pct: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
          l2groups,
        }
      })
      .sort((a, b) => b.amount - a.amount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, excludeCC, l1Map, l2ToL1, ccL1Ids, categories])

  const totalExpense = useMemo(() =>
    transactions
      .filter(t => t.type === 'expense')
      .filter(t => !(excludeCC && isCCTransaction(t)))
      .reduce((s, t) => s + t.amount, 0),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [transactions, excludeCC, ccL1Ids])

  const totalIncome = useMemo(() =>
    transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
  [transactions])

  // Filtered list for "By Date" view
  const filtered = useMemo(() => {
    let txns = filterType === 'all' ? transactions : transactions.filter(t => t.type === filterType)
    if (excludeCC) txns = txns.filter(t => !isCCTransaction(t))
    return txns
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, filterType, excludeCC, ccL1Ids])

  const groups = useMemo(() => buildGroups(categories), [categories])
  const filteredGroups = useMemo(() => groups.filter(g => g.type === form.type), [groups, form.type])

  function toggleL1(id: string) {
    setExpandedL1(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleL2(id: string) {
    setExpandedL2(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Expenses</h1>
          <p className="text-sm text-muted-foreground">All transactions</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Upload Bill
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Transaction
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* View toggle */}
        <div className="flex gap-1 border rounded-md p-0.5">
          <Button
            size="sm"
            variant={view === 'category' ? 'default' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setView('category')}
          >
            By Category
          </Button>
          <Button
            size="sm"
            variant={view === 'date' ? 'default' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setView('date')}
          >
            By Date
          </Button>
        </div>

        {/* Type filter — only for By Date */}
        {view === 'date' && (
          <div className="flex gap-1">
            {(['all', 'expense', 'income'] as const).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={filterType === t ? 'default' : 'ghost'}
                className="h-7 text-xs capitalize"
                onClick={() => setFilterType(t)}
              >
                {t}
              </Button>
            ))}
          </div>
        )}

        {/* CC toggle */}
        <Button
          size="sm"
          variant={excludeCC ? 'default' : 'outline'}
          className="h-7 text-xs gap-1 ml-auto"
          onClick={() => setExcludeCC(v => !v)}
        >
          <CreditCard className="h-3.5 w-3.5" />
          {excludeCC ? 'Excl. CC Bills' : 'Incl. CC Bills'}
        </Button>
      </div>

      {/* Manual add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: (v ?? 'expense') as 'income' | 'expense', category_id: '' })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category_id}
                onValueChange={(v) => setForm({ ...form, category_id: v ?? '' })}
              >
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {filteredGroups.map(l1 => (
                    <SelectGroup key={l1.id}>
                      <SelectLabel className="capitalize">{l1.name}</SelectLabel>
                      {l1.children.map(l2 => (
                        <SelectItem key={l2.id} value={l2.id} className="pl-5 capitalize">
                          {l2.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input
                placeholder="e.g. Lunch with team"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
            <Button onClick={addTransaction} className="w-full" disabled={isPending}>
              Save Transaction
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF preview dialog */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Review Extracted Transactions</DialogTitle></DialogHeader>
          {extracting ? (
            <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Reading PDF…</span>
            </div>
          ) : extracted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No transactions could be extracted from this PDF.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {extracted.filter(t => t.selected).length} of {extracted.length} selected
              </p>
              <div className="space-y-2">
                {extracted.map((t, i) => (
                  <div
                    key={i}
                    onClick={() =>
                      setExtracted(prev => prev.map((r, j) => j === i ? { ...r, selected: !r.selected } : r))
                    }
                    className={`flex items-center justify-between p-3 rounded-md border text-sm cursor-pointer transition-colors ${
                      t.selected ? 'border-primary bg-primary/5' : 'border-border opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {t.selected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{t.description}</p>
                        <p className="text-xs text-muted-foreground">{t.date} · {t.suggestedCategory}</p>
                      </div>
                    </div>
                    <Badge variant={t.type === 'income' ? 'default' : 'secondary'} className="ml-3 shrink-0">
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </Badge>
                  </div>
                ))}
              </div>
              <Button
                onClick={saveExtracted}
                className="w-full"
                disabled={saving || extracted.filter(t => t.selected).length === 0}
              >
                {saving
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
                  : `Import ${extracted.filter(t => t.selected).length} transactions`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Summary cards — always shown, respect excludeCC */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-xl font-semibold text-destructive tabular-nums">{formatCurrency(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Total Income</p>
            <p className="text-xl font-semibold text-green-600 tabular-nums">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
      </div>

      {/* BY CATEGORY VIEW */}
      {view === 'category' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Spend by Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            {l1Groups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No expenses yet.</p>
            ) : (
              l1Groups.map((l1) => {
                const isL1Expanded = expandedL1.has(l1.id)
                const totalItems = l1.l2groups.reduce((s, g) => s + g.transactions.length, 0)
                return (
                  <div key={l1.id}>
                    {/* L1 row */}
                    <button
                      onClick={() => toggleL1(l1.id)}
                      className="w-full flex items-center gap-3 py-2.5 px-1 text-sm hover:bg-muted/40 rounded transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l1.color }} />
                      <span className="flex-1 text-left capitalize font-medium">{l1.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{totalItems} items</span>
                      <span className="font-medium tabular-nums w-24 text-right">{formatCurrency(l1.amount)}</span>
                      {isL1Expanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    </button>

                    {/* L2 rows */}
                    {isL1Expanded && (
                      <div className="ml-4 border-l border-muted">
                        {l1.l2groups.map((l2) => {
                          const isL2Expanded = expandedL2.has(l2.id)
                          return (
                            <div key={l2.id}>
                              {/* L2 row */}
                              <button
                                onClick={() => toggleL2(l2.id)}
                                className="w-full flex items-center gap-3 py-2 px-3 text-sm hover:bg-muted/30 rounded transition-colors"
                              >
                                <span className="flex-1 text-left capitalize text-muted-foreground">{l2.name}</span>
                                <span className="text-xs text-muted-foreground">{l2.transactions.length} txns</span>
                                <span className="tabular-nums text-sm font-medium w-24 text-right">{formatCurrency(l2.amount)}</span>
                                {isL2Expanded
                                  ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                  : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                              </button>

                              {/* Transaction rows */}
                              {isL2Expanded && (
                                <div className="ml-4 border-l border-muted">
                                  {l2.transactions.map((t, i) => {
                                    const merchant = merchantFromNote(t.note) || t.category?.name || 'Uncategorised'
                                    return (
                                      <div key={t.id}>
                                        <div className="flex items-center justify-between py-1.5 px-3 text-xs group">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-muted-foreground truncate">{merchant}</span>
                                            <span className="text-muted-foreground/60 shrink-0">{t.date}</span>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant="secondary" className="text-xs tabular-nums">
                                              -{formatCurrency(t.amount)}
                                            </Badge>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                              onClick={() => deleteTransaction(t.id)}
                                            >
                                              <Trash2 className="h-3 w-3 text-destructive" />
                                            </Button>
                                          </div>
                                        </div>
                                        {i < l2.transactions.length - 1 && (
                                          <div className="mx-3 h-px bg-border/40" />
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* BY DATE VIEW */}
      {view === 'date' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No transactions found.</p>
            ) : (
              <div>
                {filtered.map((t, i) => {
                  const merchant = merchantFromNote(t.note)
                  const l1Id = l2ToL1[t.category_id]
                  const l1 = l1Id ? l1Map[l1Id] : null
                  const displayColor = l1?.color ?? t.category?.color ?? '#94a3b8'
                  return (
                    <div key={t.id}>
                      <div className="flex items-center justify-between py-2.5 text-sm group">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: displayColor }} />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{merchant || t.category?.name || 'Uncategorised'}</p>
                            <p className="text-xs text-muted-foreground">
                              {l1
                                ? <span className="capitalize">{l1.name} › {t.category?.name}</span>
                                : <span className="capitalize">{t.category?.name}</span>}
                              {' · '}{formatDate(t.date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant={t.type === 'income' ? 'default' : 'secondary'}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={() => deleteTransaction(t.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {i < filtered.length - 1 && <Separator />}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
