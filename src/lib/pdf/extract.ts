import Anthropic from '@anthropic-ai/sdk'

export interface ExtractedTransaction {
  date: string
  description: string
  amount: number
  type: 'expense' | 'income'
  rawLine: string
}

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a bank statement parser for Indian banks and credit cards (HDFC, ICICI, SBI, Axis, Kotak, Yes Bank, IndusInd, Paytm, AMEX, etc.).

Extract every financial transaction from the statement. Rules:

TYPE:
- Debit / Dr / Withdrawal / Purchase / Payment / POS / ATM WDL / Spent = "expense"
- Credit / Cr / Deposit / NEFT Cr / UPI Cr / IMPS Cr / RTGS Cr / Salary / By Transfer / By Clearing / Refund / Cashback = "income"
- When the statement has separate Debit and Credit columns: if the Credit column has the value → "income", if the Debit column has the value → "expense"

DESCRIPTION:
- UPI: extract merchant/person name from UPI string (e.g. "UPI-ZOMATO-zomato@okicici" → "Zomato")
- NEFT/RTGS/IMPS: extract sender or receiver name from narration
- Strip ref numbers, transaction IDs, UPI IDs, VPA strings
- Max 60 chars, title-cased

DATE: ISO format YYYY-MM-DD. If year is missing, infer from statement period.

AMOUNT: positive number, no currency symbol, no commas.

SKIP: opening balance, closing balance, sub-total, grand total, duplicate header rows only.

Return ONLY a valid JSON array with no explanation, no markdown:
[{"date":"YYYY-MM-DD","description":"Merchant Name","amount":1234.56,"type":"expense"}]`

export async function extractTransactions(pdfBase64: string): Promise<ExtractedTransaction[]> {
  let raw: string
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: 'Extract all transactions from this bank or credit card statement as a JSON array.',
            },
          ],
        },
      ],
    })
    raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  } catch (err) {
    console.error('[extract] Claude error:', err instanceof Error ? err.message : String(err))
    return []
  }

  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  try {
    const parsed: Array<{ date: string; description: string; amount: number; type: string }> = JSON.parse(jsonMatch[0])
    return parsed
      .filter(t => t.date && t.description && t.amount > 0 && (t.type === 'expense' || t.type === 'income'))
      .map(t => ({
        date: t.date,
        description: t.description.slice(0, 80),
        amount: t.amount,
        type: t.type as 'expense' | 'income',
        rawLine: '',
      }))
  } catch {
    return []
  }
}

export function suggestCategory(description: string): string {
  const d = description.toLowerCase()
  if (/zomato|swiggy|restaurant|caf[eé]|food|blinkit|zepto|starbucks|domino|mcdonald|kfc|pizza|burger|dunzo/.test(d)) return 'Food & Dining'
  if (/uber|ola|rapido|metro|petrol|fuel|parking|fastag|irctc|railway|flight|airline|indigo|spicejet/.test(d)) return 'Transport'
  if (/amazon|flipkart|myntra|ajio|nykaa|shop|mall|store|meesho|snapdeal/.test(d)) return 'Shopping'
  if (/netflix|spotify|hotstar|prime|apple|jio|airtel|broadband|cloud/.test(d)) return 'Subscriptions'
  if (/electricity|water|gas|internet|bsnl|bescom|mseb/.test(d)) return 'Utilities'
  if (/hospital|clinic|pharmacy|medical|doctor|apollo|1mg|practo/.test(d)) return 'Healthcare'
  if (/salary|payroll|stipend|finarkein|reimbursement|neft cr|imps cr|rtgs cr/.test(d)) return 'Salary'
  if (/travel|holiday|booking|makemytrip|goibibo|cleartrip/.test(d)) return 'Travel'
  if (/beauty|parlour|salon|spa/.test(d)) return 'Personal Care'
  if (/grocery|bigbasket|grofers|dmart/.test(d)) return 'Groceries'
  if (/rent|maintenance|society/.test(d)) return 'Housing'
  if (/mutual fund|sip|equity|stocks|zerodha|groww|kuvera/.test(d)) return 'Investments'
  return 'Shopping'
}
