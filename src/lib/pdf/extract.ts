export interface ExtractedTransaction {
  date: string
  description: string
  amount: number
  type: 'expense' | 'income'
  rawLine: string
}

// Amount patterns — handles Indian formats: 1,23,456.78 and 1234.56
const AMOUNT_RE = /(?:Rs\.?|INR|₹)?\s*([\d,]+\.\d{2})\s*(?:Dr|Cr)?/gi
const DR_CR_RE = /\b(Dr|Debit|Purchase|Payment|Withdrawal)\b/i
const CR_RE = /\b(Cr|Credit|Refund|Cashback|Reversal)\b/i

// Date patterns: DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY, MMM DD YYYY
const DATE_RE = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[,\s]+\d{4})/i

function parseDate(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  const d = new Date(cleaned)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]

  // Handle DD/MM/YYYY
  const parts = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (parts) {
    const [, dd, mm, yy] = parts
    const year = yy.length === 2 ? `20${yy}` : yy
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }

  return new Date().toISOString().split('T')[0]
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''))
}

function guessCategory(desc: string): string {
  const d = desc.toLowerCase()
  if (/zomato|swiggy|restaurant|caf[eé]|food|blinkit|zepto|starbucks|domino|mcdonald|kfc|pizza|burger|dunzo/.test(d)) return 'food & drinks'
  if (/uber|ola|rapido|metro|petrol|fuel|parking|fastag|irctc|railway|flight|airline|indigo|spicejet/.test(d)) return 'transport'
  if (/amazon|flipkart|myntra|ajio|nykaa|shop|mall|store|meesho|snapdeal/.test(d)) return 'shopping'
  if (/netflix|spotify|hotstar|prime|apple|jio|airtel/.test(d)) return 'subscriptions'
  if (/electricity|water|gas|broadband|internet|bsnl|bescom|mseb/.test(d)) return 'utilities & bills'
  if (/hospital|clinic|pharmacy|medical|doctor|apollo|1mg|practo/.test(d)) return 'health & wellness'
  if (/salary|payroll|stipend|finarkein/.test(d)) return 'income'
  if (/travel|holiday|booking\.com|makemytrip|goibibo|cleartrip/.test(d)) return 'travel'
  if (/beauty|parlour|salon|spa|grooming/.test(d)) return 'personal care'
  if (/grocery|bigbasket|grofers|dmart/.test(d)) return 'groceries'
  return 'shopping'
}

export function extractTransactions(text: string): ExtractedTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5)
  const results: ExtractedTransaction[] = []

  for (const line of lines) {
    const dateMatch = line.match(DATE_RE)
    if (!dateMatch) continue

    const amountMatches = [...line.matchAll(AMOUNT_RE)]
    if (!amountMatches.length) continue

    // For CC statements: last amount on line is usually the transaction amount
    const lastAmountRaw = amountMatches[amountMatches.length - 1][1]
    const amount = parseAmount(lastAmountRaw)
    if (amount <= 0 || amount > 10_000_000) continue

    const isCr = CR_RE.test(line)
    const type: 'expense' | 'income' = isCr ? 'income' : 'expense'

    // Description = line minus date and amount tokens
    const description = line
      .replace(DATE_RE, '')
      .replace(AMOUNT_RE, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 80)

    results.push({
      date: parseDate(dateMatch[0]),
      description: description || 'Unknown',
      amount,
      type,
      rawLine: line,
    })
  }

  return results
}

export function suggestCategory(description: string) {
  return guessCategory(description)
}
