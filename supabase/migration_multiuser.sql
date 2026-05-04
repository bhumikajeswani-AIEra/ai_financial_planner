-- Multi-user migration: add user_id to all tables + user-scoped RLS
-- Run this in Supabase SQL Editor AFTER the initial schema.sql

-- 1. Drop existing open policies
drop policy if exists "Allow all" on categories;
drop policy if exists "Allow all" on accounts;
drop policy if exists "Allow all" on transactions;
drop policy if exists "Allow all" on budgets;
drop policy if exists "Allow all" on investments;
drop policy if exists "Allow all" on savings_goals;

-- 2. Add user_id column to all tables
alter table categories add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table accounts add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table transactions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table budgets add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table investments add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table savings_goals add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 3. Enable RLS on all tables
alter table categories enable row level security;
alter table accounts enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table investments enable row level security;
alter table savings_goals enable row level security;

-- 4. User-scoped RLS policies (each user sees only their own data)
create policy "users see own categories" on categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users see own accounts" on accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users see own transactions" on transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users see own budgets" on budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users see own investments" on investments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users see own goals" on savings_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. Seed default categories for new users via a function + trigger
create or replace function public.seed_default_categories()
returns trigger language plpgsql security definer as $$
begin
  insert into public.categories (name, type, color, icon, user_id) values
    ('Salary', 'income', '#10b981', 'briefcase', new.id),
    ('Freelance', 'income', '#06b6d4', 'laptop', new.id),
    ('Food & Dining', 'expense', '#f59e0b', 'utensils', new.id),
    ('Transport', 'expense', '#3b82f6', 'car', new.id),
    ('Shopping', 'expense', '#ec4899', 'shopping-bag', new.id),
    ('Utilities', 'expense', '#8b5cf6', 'zap', new.id),
    ('Entertainment', 'expense', '#f43f5e', 'film', new.id),
    ('Healthcare', 'expense', '#14b8a6', 'heart', new.id),
    ('Education', 'expense', '#6366f1', 'book', new.id),
    ('Travel', 'expense', '#f97316', 'plane', new.id),
    ('Rent', 'expense', '#64748b', 'home', new.id),
    ('Subscriptions', 'expense', '#a855f7', 'repeat', new.id),
    ('Credit Card Bill', 'expense', '#ef4444', 'credit-card', new.id),
    ('EMI', 'expense', '#f97316', 'landmark', new.id);
  return new;
end;
$$;

drop trigger if exists on_user_created on auth.users;
create trigger on_user_created
  after insert on auth.users
  for each row execute procedure public.seed_default_categories();
