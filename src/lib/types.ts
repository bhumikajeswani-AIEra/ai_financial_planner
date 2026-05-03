export type CategoryType = 'income' | 'expense'
export type AccountType = 'checking' | 'savings' | 'credit' | 'investment'
export type InvestmentType = 'SIP' | 'MF' | 'stock' | 'FD' | 'crypto'
export type TransactionType = 'income' | 'expense'

export interface Category {
  id: string
  name: string
  type: CategoryType
  color: string
  icon: string
}

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
}

export interface Transaction {
  id: string
  amount: number
  type: TransactionType
  category_id: string
  account_id: string
  date: string
  note: string | null
  created_at: string
  category?: Category
  account?: Account
}

export interface Budget {
  id: string
  category_id: string
  month: string
  amount: number
  category?: Category
}

export interface Investment {
  id: string
  name: string
  type: InvestmentType
  units: number
  buy_price: number
  current_price: number
  created_at: string
}

export interface SavingsGoal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  deadline: string
  color: string
}
