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
import { Plus, Trash2, Upload, Loader2, CheckCircle2, ChevronDown, ChevronRight, CreditCard, ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
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

interface L2Group { id: string; name: string; amount: number; transactions: Transaction[] }
interface L1Group { id: string; name: string; color: string; amount: number; pct: number; l2groups: L2Group[] }

type SourceType = 'UPI' | 'RTGS' | 'CC' | 'Manual'

function getSource(txn: Transaction): SourceType {
  const note = txn.note ?? ''
  if (note.startsWith('cc:') || note.startsWith('pdf:')) return 'CC'
  if (note.startsWith('gmail:')) {
    const merchant = (note.split('|')[1] ?? '').toLowerCase()
    if (txn.type === 'income' && /finarkein|salary|reimbursement/i.test(merchant)) return 'RTGS'
    return 'UPI'
  }
  return 'Manual'
}

const SOURCE_COLORS: Record<SourceType, string> = {
  UPI: 'bg-blue-100 text-blue-700',
  RTGS: 'bg-green-100 text-green-700',
  CC: 'bg-orange-100 text-orange-700',
  Manual: 'bg-slate-100 text-slate-600',
}

function merchantFromNote(note: string | null): string {
  if (!note) return ''
  const p = note.split('|')
  return p.length > 1 ? p[1] : (note.startsWith('cc:') ? note.slice(3) : '')
}

function buildGroups(categories: Category[]): CategoryGroup[] {
  const l1 = categories.filter(c => !c.parent_id).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  const l2 = categories.filter(c => c.parent_id)
  return l1.map(parent => ({
    ...parent,
    children: l2.filter(c => c.parent_id === parent.id).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
  }))
}

function parseMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1)
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
  const [filterSource, setFilterSource] = useState<'all' | SourceType>('all')
  const [view, setView] = useState<'category' | 'date'>('category')
  const [excludeCC, setExcludeCC] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedRow[]>([])
  const [extractError, setExtractError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set())
  const [expandedL2, setExpandedL2] = useState<Set<string>>(new Set())
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

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
    const { data: cats } = await supabase.from('categories').select('*').order('display_order')
    setCategories((cats ?? []) as Category[])
  }

  useEffect(() => { load() }, [])

  // Available months
  const availableMonths = useMemo(() => {
    const s = new Set<string>()
    for (const t of transactions) if (t.date) s.add(t.date.slice(0, 7))
    return Array.from(s).sort((a, b) => b.localeCompare(a))
  }, [transactions])

  // Default to latest month
  useEffect(() => {
    if (availableMonths.length > 0 && selectedMonth === null) setSelectedMonth(availableMonths[0])
  }, [availableMonths, selectedMonth])

  // Reset expand state on month change
  useEffect(() => { setExpandedL1(new Set()); setExpandedL2(new Set()) }, [selectedMonth])

  const currentMonthIndex = selectedMonth ? availableMonths.indexOf(selectedMonth) : 0
  const displayMonth = selectedMonth ?? availableMonths[0] ?? ''
  const monthLabel = displayMonth ? format(parseMonth(displayMonth), 'MMMM yyyy') : 'All time'

  function goPrev() { if (currentMonthIndex < availableMonths.length - 1) setSelectedMonth(availableMonths[currentMonthIndex + 1]) }
  function goNext() { if (currentMonthIndex > 0) setSelectedMonth(availableMonths[currentMonthIndex - 1]) }

  // Month-filtered base
  const monthTxns = useMemo(() =>
    displayMonth ? transactions.filter(t => t.date?.slice(0, 7) === displayMonth) : transactions,
    [transactions, displayMonth]
  )

  // Maps
  const l1Map = useMemo(() => Object.fromEntries(categories.filter(c => !c.parent_id).map(c => [c.id, c])), [categories])
  const l2ToL1 = useMemo(() => Object.fromEntries(categories.filter(c => c.parent_id).map(c => [c.id, c.parent_id!])), [categories])
  const ccL1Ids = useMemo(() => new Set(categories.filter(c => !c.parent_id && c.name.toLowerCase() === 'credit card bill').map(c => c.id)), [categories])

  function isCCTxn(t: Transaction) {
    const l1Id = l2ToL1[t.category_id] ?? t.category_id
    return ccL1Ids.has(l1Id)
  }

  // Apply all filters (type + source + excludeCC)
  const displayTxns = useMemo(() => {
    return monthTxns.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false
      if (filterSource !== 'all' && getSource(t) !== filterSource) return false
      if (excludeCC && isCCTxn(t)) return false
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthTxns, filterType, filterSource, excludeCC, ccL1Ids, l2ToL1])

  // Summary totals (month-scoped, CC-aware)
  const totalExpense = useMemo(() =>
    monthTxns.filter(t => t.type === 'expense' && !(excludeCC && isCCTxn(t))).reduce((s, t) => s + t.amount, 0),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [monthTxns, excludeCC, ccL1Ids])
  const totalIncome = useMemo(() => monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [monthTxns])

  // Sources present in this month
  const activeSources = useMemo(() => {
    const s = new Set<SourceType>()
    for (const t of monthTxns) s.add(getSource(t))
    return s
  }, [monthTxns])

  // L1 groups for category view
  const l1Groups = useMemo((): L1Group[] => {
    const expenses = displayTxns.filter(t => t.type === 'expense')
    const total = expenses.reduce((s, t) => s + t.amount, 0)
    const byL1: Record<string, Record<string, { cat: Category; txns: Transaction[] }>> = {}
    for (const t of expenses) {
      const l1Id = l2ToL1[t.category_id] ?? t.category_id
      if (!l1Map[l1Id]) continue
      if (!byL1[l1Id]) byL1[l1Id] = {}
      if (!byL1[l1Id][t.category_id]) {
        byL1[l1Id][t.category_id] = {
          cat: t.category ?? categories.find(c => c.id === t.category_id) ?? { id: t.category_id, name: 'other', type: 'expense', color: '#94a3b8', icon: '' },
          txns: [],
        }
      }
      byL1[l1Id][t.category_id].txns.push(t)
    }
    return Object.entries(byL1).map(([l1Id, l2map]) => {
      const l1 = l1Map[l1Id]
      const l2groups = Object.entries(l2map).map(([, { cat, txns }]) => ({
        id: cat.id,
        name: cat.name,
        amount: txns.reduce((s, t) => s + t.amount, 0),
        transactions: txns,
      })).sort((a, b) => b.amount - a.amount)
      const amount = l2groups.reduce((s, g) => s + g.amount, 0)
      return { id: l1Id, name: l1.name, color: l1.color, amount, pct: total > 0 ? (amount / total) * 100 : 0, l2groups }
    }).sort((a, b) => b.amount - a.amount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayTxns, l1Map, l2ToL1, categories])

  const groups = useMemo(() => buildGroups(categories), [categories])
  const filteredGroups = useMemo(() => groups.filter(g => g.type === form.type), [groups, form.type])

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
    setExtractError(null)
    setPdfOpen(true)
    setExtracted([])
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/bills', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.error) { setExtractError(data.error); setExtracting(false); if (fileRef.current) fileRef.current.value = ''; return }
    setExtracted((data.transactions ?? []).map((t: ExtractedRow) => ({ ...t, selected: true })))
    setExtracting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function saveExtracted() {
    const toSave = extracted.filter(t => t.selected)
    if (!toSave.length || !userId) return
    setSaving(true)
    const { data: cats } = await supabase.from('categories').select('id, name').eq('user_id', userId)
    const catMap = Object.fromEntries((cats ?? []).map(c => [c.name.toLowerCase(), c.id]))
    const fallbackId = cats?.[0]?.id ?? null
    const rows = toSave.map(t => ({
      amount: t.amount,
      type: t.type,
      category_id: t.suggestedCategoryId ?? catMap[t.suggestedCategory?.toLowerCase()] ?? fallbackId,
      date: t.date,
      note: `pdf:|${t.description.slice(0, 80)}`,
      user_id: userId,
    }))
    await supabase.from('transactions').insert(rows)
    setSaving(false)
    setPdfOpen(false)
    setExtracted([])
    startTransition(() => { load() })
  }

  function toggleL1(id: string) {
    setExpandedL1(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleL2(id: string) {
    setExpandedL2(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Expenses</h1>
          <p className="text-sm text-muted-foreground">{availableMonths.length} months of data</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Upload Statement
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">HDFC · ICICI · SBI · Axis · Paytm · CC — or Print to PDF from net banking</p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={goPrev} disabled={currentMonthIndex >= availableMonths.length - 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center">
          <p className="font-medium text-sm">{monthLabel}</p>
          <p className="text-xs text-muted-foreground">{currentMonthIndex + 1} / {availableMonths.length}</p>
        </div>
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={goNext} disabled={currentMonthIndex <= 0}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="text-xl font-semibold text-destructive tabular-nums">{formatCurrency(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="text-xl font-semibold text-green-600 tabular-nums">{formatCurrency(totalIncome)}</p>
            {totalIncome === 0 && <p className="text-xs text-muted-foreground mt-0.5">No credit alerts in Gmail</p>}
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="space-y-2">
        {/* Row 1: view + type + CC toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-0.5 border rounded-md p-0.5">
            {(['category', 'date'] as const).map(v => (
              <Button key={v} size="sm" variant={view === v ? 'default' : 'ghost'} className="h-7 text-xs capitalize" onClick={() => setView(v)}>
                {v === 'category' ? 'By Category' : 'By Date'}
              </Button>
            ))}
          </div>
          {view === 'date' && (
            <div className="flex gap-0.5">
              {(['all', 'expense', 'income'] as const).map(t => (
                <Button key={t} size="sm" variant={filterType === t ? 'default' : 'ghost'} className="h-7 text-xs capitalize" onClick={() => setFilterType(t)}>
                  {t}
                </Button>
              ))}
            </div>
          )}
          <Button size="sm" variant={excludeCC ? 'default' : 'outline'} className="h-7 text-xs gap-1 ml-auto" onClick={() => setExcludeCC(v => !v)}>
            <CreditCard className="h-3.5 w-3.5" />
            {excludeCC ? 'Excl. CC' : 'Incl. CC'}
          </Button>
        </div>

        {/* Row 2: source filter chips */}
        {activeSources.size > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground">Source:</span>
            {(['all', 'UPI', 'RTGS', 'CC', 'Manual'] as const).filter(s => s === 'all' || activeSources.has(s as SourceType)).map(s => (
              <button
                key={s}
                onClick={() => setFilterSource(s)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  filterSource === s
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border text-muted-foreground hover:border-foreground/40'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add Transaction dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: (v ?? 'expense') as 'income' | 'expense', category_id: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input type="number" placeholder="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v ?? '' })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {filteredGroups.map(l1 => {
                    const seenNames = new Set<string>()
                    const uniqueChildren = l1.children.filter(l2 => {
                      const key = l2.name.toLowerCase()
                      if (seenNames.has(key)) return false
                      seenNames.add(key)
                      return true
                    })
                    if (uniqueChildren.length === 0) return null
                    return (
                      <SelectGroup key={l1.id}>
                        <SelectLabel className="capitalize font-semibold text-foreground text-xs tracking-wide py-1.5">{l1.name}</SelectLabel>
                        {uniqueChildren.map(l2 => (
                          <SelectItem key={l2.id} value={l2.id} className="pl-6 capitalize text-muted-foreground">{l2.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. Lunch with team" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
            <Button onClick={addTransaction} className="w-full" disabled={isPending}>Save Transaction</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF import dialog */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Import from Bank / CC Statement</DialogTitle></DialogHeader>
          {extracting ? (
            <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Parsing PDF…</span>
            </div>
          ) : extractError ? (
            <div className="py-6 text-center space-y-2">
              <p className="text-sm text-destructive font-medium">{extractError}</p>
              <Button variant="outline" size="sm" onClick={() => { setPdfOpen(false); setExtractError(null) }}>Close</Button>
            </div>
          ) : extracted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No transactions could be extracted from this PDF.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{extracted.filter(t => t.selected).length} of {extracted.length} transactions — deselect any to skip.</p>
              <div className="space-y-1.5">
                {extracted.map((t, i) => (
                  <div
                    key={i}
                    onClick={() => setExtracted(prev => prev.map((r, j) => j === i ? { ...r, selected: !r.selected } : r))}
                    className={`flex items-center justify-between p-3 rounded-md border text-sm cursor-pointer transition-colors ${t.selected ? 'border-primary bg-primary/5' : 'border-border opacity-50'}`}
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
              <Button onClick={saveExtracted} className="w-full" disabled={saving || extracted.filter(t => t.selected).length === 0}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : `Import ${extracted.filter(t => t.selected).length} transactions`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* BY CATEGORY VIEW */}
      {view === 'category' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Spend by Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5 pb-3">
            {l1Groups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No expenses for {monthLabel}.</p>
            ) : l1Groups.map(l1 => {
              const isL1Open = expandedL1.has(l1.id)
              const totalItems = l1.l2groups.reduce((s, g) => s + g.transactions.length, 0)
              return (
                <div key={l1.id}>
                  <button onClick={() => toggleL1(l1.id)} className="w-full flex items-center gap-3 py-2.5 px-1 text-sm hover:bg-muted/40 rounded transition-colors">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l1.color }} />
                    <span className="flex-1 text-left capitalize font-medium">{l1.name}</span>
                    <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(l1.pct)}%</span>
                    <span className="text-xs text-muted-foreground">{totalItems} items</span>
                    <span className="font-medium tabular-nums w-22 text-right">{formatCurrency(l1.amount)}</span>
                    {isL1Open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </button>

                  {isL1Open && (
                    <div className="ml-5 border-l border-muted">
                      {l1.l2groups.map(l2 => {
                        const isL2Open = expandedL2.has(l2.id)
                        return (
                          <div key={l2.id}>
                            <button onClick={() => toggleL2(l2.id)} className="w-full flex items-center gap-3 py-2 pl-3 pr-1 text-sm hover:bg-muted/30 rounded transition-colors">
                              <span className="flex-1 text-left capitalize text-muted-foreground">{l2.name}</span>
                              <span className="text-xs text-muted-foreground">{l2.transactions.length} txns</span>
                              <span className="font-medium tabular-nums w-22 text-right">{formatCurrency(l2.amount)}</span>
                              {isL2Open ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                            </button>

                            {isL2Open && (
                              <div className="ml-4 border-l border-muted/60">
                                {l2.transactions.map((t, i) => {
                                  const merchant = merchantFromNote(t.note) || t.category?.name || 'Uncategorised'
                                  const src = getSource(t)
                                  return (
                                    <div key={t.id}>
                                      <div className="flex items-center justify-between py-1.5 pl-3 pr-1 text-xs group">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <span className="truncate text-foreground/80">{merchant}</span>
                                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${SOURCE_COLORS[src]}`}>{src}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="text-muted-foreground">{t.date}</span>
                                          <span className="tabular-nums font-medium">−{formatCurrency(t.amount)}</span>
                                          <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteTransaction(t.id)}>
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>
                                      {i < l2.transactions.length - 1 && <div className="mx-3 h-px bg-border/30" />}
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
            })}
          </CardContent>
        </Card>
      )}

      {/* BY DATE VIEW */}
      {view === 'date' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Transactions · {monthLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            {displayTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No transactions found.</p>
            ) : (
              <div>
                {displayTxns.map((t, i) => {
                  const merchant = merchantFromNote(t.note)
                  const l1Id = l2ToL1[t.category_id]
                  const l1 = l1Id ? l1Map[l1Id] : null
                  const displayColor = l1?.color ?? t.category?.color ?? '#94a3b8'
                  const src = getSource(t)
                  return (
                    <div key={t.id}>
                      <div className="flex items-center justify-between py-2.5 text-sm group">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: displayColor }} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium truncate">{merchant || t.category?.name || 'Uncategorised'}</p>
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${SOURCE_COLORS[src]}`}>{src}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              <span className="capitalize">{l1 ? `${l1.name} › ` : ''}{t.category?.name}</span>
                              {' · '}{formatDate(t.date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={t.type === 'income' ? 'default' : 'secondary'}>
                            {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
                          </Badge>
                          <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteTransaction(t.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {i < displayTxns.length - 1 && <Separator />}
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
