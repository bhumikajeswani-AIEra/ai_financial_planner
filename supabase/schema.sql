-- Run this SQL in your Supabase SQL editor to set up the financial planner schema

-- Categories
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('income', 'expense')),
  color text not null default '#6366f1',
  icon text not null default 'tag'
);

-- Accounts
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('checking', 'savings', 'credit', 'investment')),
  balance numeric not null default 0
);

-- Transactions
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null,
  type text not null check (type in ('income', 'expense')),
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

-- Budgets (one per category per month)
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade,
  month char(7) not null,
  amount numeric not null,
  unique (category_id, month)
);

-- Investments
create table if not exists investments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('SIP', 'MF', 'stock', 'FD', 'crypto')),
  units numeric not null default 1,
  buy_price numeric not null,
  current_price numeric not null,
  created_at timestamptz not null default now()
);

-- Savings Goals
create table if not exists savings_goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  deadline date not null,
  color text not null default '#10b981'
);

-- Seed default categories
insert into categories (name, type, color, icon) values
  ('Salary', 'income', '#10b981', 'briefcase'),
  ('Freelance', 'income', '#06b6d4', 'laptop'),
  ('Food & Dining', 'expense', '#f59e0b', 'utensils'),
  ('Transport', 'expense', '#3b82f6', 'car'),
  ('Shopping', 'expense', '#ec4899', 'shopping-bag'),
  ('Utilities', 'expense', '#8b5cf6', 'zap'),
  ('Entertainment', 'expense', '#f43f5e', 'film'),
  ('Healthcare', 'expense', '#14b8a6', 'heart'),
  ('Education', 'expense', '#6366f1', 'book'),
  ('Travel', 'expense', '#f97316', 'plane'),
  ('Rent', 'expense', '#64748b', 'home'),
  ('Subscriptions', 'expense', '#a855f7', 'repeat')
on conflict do nothing;
