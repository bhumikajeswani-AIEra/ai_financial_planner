import { google } from 'googleapis'
import { Readable } from 'stream'
import { getOAuthClient } from './auth'
import type { Transaction, Budget, Investment } from '@/lib/types'

interface ReportData {
  month: string
  totalIncome: number
  totalExpenses: number
  totalBudgeted: number
  transactions: Transaction[]
  budgets: Budget[]
  investments: Investment[]
}

function buildCSV(data: ReportData): string {
  const lines: string[] = []

  lines.push(`FinPlan Monthly Report — ${data.month}`)
  lines.push(`Income,${data.totalIncome}`)
  lines.push(`Expenses,${data.totalExpenses}`)
  lines.push(`Budgeted,${data.totalBudgeted}`)
  lines.push(`Net,${data.totalIncome - data.totalExpenses}`)
  lines.push('')

  lines.push('--- Transactions ---')
  lines.push('Date,Type,Category,Amount,Note')
  for (const t of data.transactions) {
    lines.push(
      [t.date, t.type, t.category?.name ?? '', t.amount, t.note ?? ''].join(',')
    )
  }
  lines.push('')

  lines.push('--- Budgets ---')
  lines.push('Category,Budgeted')
  for (const b of data.budgets) {
    lines.push([b.category?.name ?? '', b.amount].join(','))
  }
  lines.push('')

  lines.push('--- Investments ---')
  lines.push('Name,Type,Units,Buy Price,Current Price,P&L')
  for (const i of data.investments) {
    const pl = (i.current_price - i.buy_price) * i.units
    lines.push([i.name, i.type, i.units, i.buy_price, i.current_price, pl.toFixed(2)].join(','))
  }

  return lines.join('\n')
}

export async function exportMonthlyReport(data: ReportData) {
  const auth = getOAuthClient()
  const drive = google.drive({ version: 'v3', auth })

  const csv = buildCSV(data)
  const fileName = `FinPlan_${data.month}.csv`

  const fileMetadata: Record<string, unknown> = { name: fileName, mimeType: 'text/csv' }
  if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
    fileMetadata.parents = [process.env.GOOGLE_DRIVE_FOLDER_ID]
  }

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media: { mimeType: 'text/csv', body: Readable.from([csv]) },
    fields: 'id, name, webViewLink',
  })

  return {
    fileId: res.data.id,
    fileName: res.data.name,
    url: res.data.webViewLink,
  }
}
