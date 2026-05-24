-- OmniRoute SaaS Customer Module (Supabase)
-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'customer' check (role in ('admin', 'customer')),
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saas_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  native_combo_id text not null,
  native_combo_name text,
  monthly_token_limit bigint not null check (monthly_token_limit > 0),
  price_brl numeric(12,2) not null check (price_brl >= 0),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'yearly')),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.saas_plans(id),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'expired', 'pending_payment', 'cancelled')),
  starts_at timestamptz not null default now(),
  renews_at timestamptz not null,
  expires_at timestamptz,
  token_limit bigint not null,
  price_brl numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid not null references public.customer_subscriptions(id) on delete cascade,
  omni_api_key_id text unique,
  token_prefix text not null,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked', 'expired')),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.customer_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid not null references public.customer_subscriptions(id) on delete cascade,
  token_id uuid not null references public.customer_tokens(id) on delete cascade,
  request_id text,
  endpoint text,
  model text,
  native_combo_id text,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  total_tokens bigint generated always as (input_tokens + output_tokens) stored,
  cost_brl numeric(12,4) default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.customer_subscriptions(id) on delete set null,
  amount_brl numeric(12,2) not null,
  status text not null default 'pending'
    check (status in ('paid', 'pending', 'failed', 'refunded', 'cancelled', 'overdue')),
  payment_method text,
  invoice_id text,
  transaction_reference text,
  paid_at timestamptz,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_tokens_hash on public.customer_tokens(token_hash);
create index if not exists idx_subscriptions_customer_status on public.customer_subscriptions(customer_id, status);
create index if not exists idx_usage_customer_created on public.customer_usage_ledger(customer_id, created_at desc);
create index if not exists idx_usage_subscription_created on public.customer_usage_ledger(subscription_id, created_at desc);
create index if not exists idx_payments_customer_status on public.customer_payments(customer_id, status);

alter table public.profiles enable row level security;
alter table public.saas_plans enable row level security;
alter table public.customer_subscriptions enable row level security;
alter table public.customer_tokens enable row level security;
alter table public.customer_usage_ledger enable row level security;
alter table public.customer_payments enable row level security;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.status = 'active'
  );
$$;

create policy "profiles_self_select"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_admin_all"
on public.profiles
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "plans_public_read"
on public.saas_plans
for select
to authenticated
using (status = 'active' or public.is_admin_user());

create policy "plans_admin_write"
on public.saas_plans
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "subs_self_select"
on public.customer_subscriptions
for select
to authenticated
using (customer_id = auth.uid());

create policy "subs_admin_all"
on public.customer_subscriptions
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "tokens_self_select"
on public.customer_tokens
for select
to authenticated
using (customer_id = auth.uid());

create policy "tokens_admin_all"
on public.customer_tokens
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "usage_self_select"
on public.customer_usage_ledger
for select
to authenticated
using (customer_id = auth.uid());

create policy "usage_admin_all"
on public.customer_usage_ledger
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "payments_self_select"
on public.customer_payments
for select
to authenticated
using (customer_id = auth.uid());

create policy "payments_admin_all"
on public.customer_payments
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
