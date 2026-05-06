'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import type { Investment, InvestmentType } from '@/lib/types'

const INVESTMENT_TYPES: InvestmentType[] = ['SIP', 'MF', 'stock', 'FD', 'crypto']

export default function InvestmentsPage() {
  const supabase = createClient()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [userId, setUserId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    type: 'MF' as InvestmentType,
    units: '',
    buy_price: '',
    current_price: '',
  })

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)
    const { data } = await supabase.from('investments').select('*').order('created_at', { ascending: false })
    setInvestments((data ?? []) as Investment[])
  }

  useEffect(() => { load() }, [])

  async function addInvestment() {
    if (!form.name || !form.buy_price || !form.current_price || !userId) return
    await supabase.from('investments').insert({
      name: form.name,
      type: form.type,
      units: parseFloat(form.units) || 1,
      buy_price: parseFloat(form.buy_price),
      current_price: parseFloat(form.current_price),
      user_id: userId,
    })
    setOpen(false)
    setForm({ name: '', type: 'MF', units: '', buy_price: '', current_price: '' })
    startTransition(() => { load() })
  }

  async function deleteInvestment(id: string) {
    await supabase.from('investments').delete().eq('id', id)
    startTransition(() => { load() })
  }

  const totalInvested = investments.reduce((s, i) => s + i.buy_price * i.units, 0)
  const totalCurrent = investments.reduce((s, i) => s + i.current_price * i.units, 0)
  const totalPnL = totalCurrent - totalInvested
  const pnlPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

  const byType = investments.reduce((acc: Record<string, number>, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + i.current_price * i.units
    return acc
  }, {})

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Investments</h1>
          <p className="text-sm text-muted-foreground">Portfolio tracker</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Holding</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Investment</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input placeholder="e.g. Nifty 50 Index Fund" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: (v ?? 'MF') as InvestmentType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Units</Label>
                  <Input type="number" placeholder="1" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Buy NAV / Price (₹ per unit)</Label>
                  <Input type="number" placeholder="0" value={form.buy_price} onChange={(e) => setForm({ ...form, buy_price: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Current NAV / Price (₹ per unit)</Label>
                  <Input type="number" placeholder="0" value={form.current_price} onChange={(e) => setForm({ ...form, current_price: e.target.value })} />
                </div>
              </div>
              <Button onClick={addInvestment} className="w-full" disabled={isPending}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Total Invested</p>
            <p className="text-xl font-semibold tabular-nums">{formatCurrency(totalInvested)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Current Value</p>
            <p className="text-xl font-semibold tabular-nums">{formatCurrency(totalCurrent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-1 mb-1">
              <p className="text-xs text-muted-foreground">Overall P&L</p>
              {totalPnL >= 0
                ? <TrendingUp className="h-3 w-3 text-green-500" />
                : <TrendingDown className="h-3 w-3 text-destructive" />}
            </div>
            <p className={`text-xl font-semibold tabular-nums ${totalPnL >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
            </p>
            <p className="text-xs text-muted-foreground">{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</p>
          </CardContent>
        </Card>
      </div>

      {Object.keys(byType).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Allocation by Type</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {Object.entries(byType).map(([type, value]) => (
              <div key={type} className="flex items-center gap-1.5 text-sm">
                <Badge variant="outline">{type}</Badge>
                <span className="tabular-nums">{formatCurrency(value)}</span>
                <span className="text-muted-foreground text-xs">
                  ({totalCurrent > 0 ? Math.round((value / totalCurrent) * 100) : 0}%)
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          {investments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No holdings yet. Add your first investment.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Invested</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {investments.map((inv) => {
                  const invested = inv.buy_price * inv.units
                  const current = inv.current_price * inv.units
                  const pnl = current - invested
                  const pnlP = invested > 0 ? (pnl / invested) * 100 : 0
                  return (
                    <TableRow key={inv.id} className="group">
                      <TableCell className="font-medium">{inv.name}</TableCell>
                      <TableCell><Badge variant="outline">{inv.type}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{inv.units}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(invested)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(current)}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${pnl >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                        <span className="text-xs ml-1">({pnlP >= 0 ? '+' : ''}{pnlP.toFixed(1)}%)</span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          onClick={() => deleteInvestment(inv.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
