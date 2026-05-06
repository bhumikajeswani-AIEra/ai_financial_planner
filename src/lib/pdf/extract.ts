import Anthropic from '@anthropic-ai/sdk'

export interface ExtractedTransaction {
  date: string
  description: string
  amount: number
  type: 'expense' | 'income'
  rawLine: string
}

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a bank statement parser. Extract all financial transactions from the raw text of an Indian bank statement (HDFC, ICICI, SBI, Axis, Paytm, Kotak, Yes Bank, IndusInd, etc.) or credit card statement.

Rules:
- Debit / Dr / Withdrawal / Purchase = "expense"
- Credit / Cr / Deposit / NEFT Cr / UPI Cr = "income" — this includes salary, reimbursements, UPI received, NEFT received
- For UPI transactions, extract the actual merchant or person name from the UPI reference string (e.g. "UPI-ZOMATO-zomato@..." → "Zomato")
- For NEFT/RTGS, extract the sender/receiver name from the narration
- Skip: opening balance, closing balance, self-transfers between own accounts, duplicate header rows
- Amount must be a positive number (no sign)
- Date must be ISO format: YYYY-MM-DD
- Description max 80 chars, cleaned up (no raw UPI IDs, no ref numbers)

Return ONLY a valid JSON array, no explanation, no markdown fences:
[{"date":"YYYY-MM-DD","description":"clean name","amount":1234.56,"type":"expense|income"}]`

export async function extractTransactions(text: string): Promise<ExtractedTransaction[]> {
  // Truncate very large statements — Claude handles ~100k chars comfortably
  const truncated = text.slice(0, 100_000)

  let raw: string
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: truncated }],
    })
    raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  } catch {
    return []
  }

  // Extract JSON array from response (model may wrap in prose despite instructions)
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

// Category suggestion — kept separate so it runs client-side in the preview step
export function suggestCategory(description: string): string {
  const d = description.toLowerCase()
  if (/zomato|swiggy|restaurant|caf[eé]|food|blinkit|zepto|starbucks|domino|mcdonald|kfc|pizza|burger|dunzo/.test(d)) return 'Food & Dining'
  if (/uber|ola|rapido|metro|petrol|fuel|parking|fastag|irctc|railway|flight|airline|indigo|spicejet/.test(d)) return 'Transport'
  if (/amazon|flipkart|myntra|ajio|nykaa|shop|mall|store|meesho|snapdeal/.test(d)) return 'Shopping'
  if (/netflix|spotify|hotstar|prime|apple|jio|airtel|broadband|cloud/.test(d)) return 'Subscriptions'
  if (/electricity|water|gas|internet|bsnl|bescom|mseb/.test(d)) return 'Utilities'
  if (/hospital|clinic|pharmacy|medical|doctor|apollo|1mg|practo/.test(d)) return 'Healthcare'
  if (/salary|payroll|stipend|finarkein|reimbursement/.test(d)) return 'Income'
  if (/travel|holiday|booking|makemytrip|goibibo|cleartrip/.test(d)) return 'Travel'
  if (/beauty|parlour|salon|spa/.test(d)) return 'Personal Care'
  if (/grocery|bigbasket|grofers|dmart|zepto/.test(d)) return 'Groceries'
  if (/rent|maintenance|society/.test(d)) return 'Housing'
  if (/mutual fund|sip|equity|stocks|zerodha|groww|kuvera/.test(d)) return 'Investments'
  return 'Shopping'
}
