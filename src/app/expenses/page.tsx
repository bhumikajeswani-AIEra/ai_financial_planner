'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useTransition, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Upload, Loader2, CheckCircle2 } from 'lucide-react'
import type { Transaction, Category } from '@/lib/types'

interface ExtractedRow {
  date: string
  description: string
  amount: number
  type: 'expense' | 'income'
  suggestedCategory: string
  suggestedCategoryId: string | null
  selected: boolean
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
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedRow[]>([])
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

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

    const { data: cats } = await supabase.from('categories').select('*').order('name')
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

  const filtered = filterType === 'all' ? transactions : transactions.filter((t) => t.type === filterType)
  const filteredCategories = categories.filter((c) => c.type === form.type)
  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
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

      {/* Manual add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: (v ?? 'expense') as 'income' | 'expense', category_id: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input type="number" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v ?? '' })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. Lunch with team" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <Button onClick={addTransaction} className="w-full" disabled={isPending}>Save Transaction</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF preview dialog */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Extracted Transactions</DialogTitle>
          </DialogHeader>
          {extracting ? (
            <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Reading PDF…</span>
            </div>
          ) : extracted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No transactions could be extracted from this PDF.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{extracted.filter(t => t.selected).length} of {extracted.length} selected — deselect any you don&apos;t want to import.</p>
              <div className="space-y-2">
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

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">Transactions</CardTitle>
          <div className="flex gap-1">
            {(['all', 'expense', 'income'] as const).map((t) => (
              <Button key={t} size="sm" variant={filterType === t ? 'default' : 'ghost'} className="h-7 text-xs capitalize" onClick={() => setFilterType(t)}>
                {t}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No transactions found.</p>
          ) : (
            <div>
              {filtered.map((t, i) => (
                <div key={t.id}>
                  <div className="flex items-center justify-between py-2.5 text-sm group">
                    <div className="flex items-center gap-3">
                      {t.category && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.category.color }} />}
                      <div>
                        <p className="font-medium">{t.category?.name ?? 'Uncategorised'}</p>
                        <p className="text-xs text-muted-foreground">{t.note ? `${t.note} · ` : ''}{formatDate(t.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={t.type === 'income' ? 'default' : 'secondary'}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteTransaction(t.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {i < filtered.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
