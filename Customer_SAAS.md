OmniRoute SaaS Token Sales Module — PRD + Technical Spec + Implementation Prompt
1. Repository Analysis

OmniRoute is currently a unified AI router/gateway with a dashboard, OpenAI-compatible APIs, provider routing, auto-fallback, combos, pricing, usage tracking, rate limiting, API keys, logs, health checks and resilience modules. The repository exposes dashboard sections such as combos, providers, usage, costs, limits, logs, settings, webhooks, analytics, and api-manager. This means the SaaS customer module should integrate with the existing dashboard navigation instead of creating a separate product shell.

The backend already has many relevant API route groups, including keys, combos, usage, pricing, rate-limit, rate-limits, provider-metrics, providers, webhooks, and v1, which are important integration points for token validation, usage counting, combo selection and customer-facing API access.

The current persistence layer is SQLite-based, with database modules for apiKeys, combos, creditBalance, quotaSnapshots, registeredKeys, providerLimits, stats, syncTokens, and others. For a Supabase SaaS model, the cleanest path is not to rewrite the whole router immediately, but to add a Supabase-backed commercial layer for customers, subscriptions, plans, payments and customer tokens.

Supabase should be used with Auth + Postgres + Row Level Security. Supabase documents that API keys identify the application, while Supabase Auth identifies users; secret/service keys must stay server-side because they bypass RLS. Row Level Security should be enabled on all customer-facing SaaS tables so each customer can only access their own token, plan, payments and usage data.

2. PRD
Product Name

OmniRoute SaaS Token Sales Module

Objective

Add a SaaS layer to OmniRoute that allows the platform owner to sell token packages connected to existing OmniRoute combos. Admins can register customers, assign plans, generate customer API tokens, monitor usage, suspend access, manage renewals, and view financial performance. Customers can log in with their email/password and see their API token, usage, validity, and renewal/payment options.

Main Navigation

Add a new dashboard menu item:

Customer

Submenu:

Registration
Plans
Financial

All UI text must be in English.

User Roles
Admin

The admin manages customers, plans, tokens, billing, suspensions and financial reporting.

Customer

The customer logs in to a simplified portal and can only see their own subscription, token, usage, validity and payment/renewal options.

Core User Stories
Admin — Registration

As an admin, I want to create a customer with name, email, password, plan and generated token, so that the customer can consume OmniRoute APIs using a controlled SaaS token.

Admin — Plans

As an admin, I want to create and manage commercial plans connected to OmniRoute native combos, so that each sold plan routes traffic through the correct model fallback chain.

Admin — Financial

As an admin, I want to see all payments, revenue, renewals and charts, so that I can track the SaaS business performance.

Admin — Suspension

As an admin, I want to suspend a customer and immediately suspend their token, so that unpaid, abusive or expired customers cannot consume tokens.

Customer — Portal

As a customer, I want to log in and see my token, copy it, check validity, check used tokens and renew/pay, so that I can manage my subscription without admin support.

3. Functional Requirements
3.1 Customer Menu

Add a new sidebar/menu group:

Customer
  - Registration
  - Plans
  - Financial

The design must match the existing OmniRoute dashboard style.

3.2 Registration Page

Path suggestion:

/dashboard/customer/registration
Registration Fields
Name
E-mail
Password
Plan
Token
Usage
BRL Value
Renewal Date
Status
Actions
Field Details
Field	Type	Description
Name	Text	Customer full name or company name
E-mail	Email	Used for customer login
Password	Password	Used to create Supabase Auth user
Plan	Combo select	Dropdown populated from existing OmniRoute native combos/plans
Token	Generated	Automatically generated based on selected plan/combo
Usage	Display	Format: 0 / 1,000,000 tokens
BRL Value	Currency	Brazilian Real amount, example: R$ 299.00
Renewal Date	Date	Next plan renewal date
Status	Badge	Active, Suspended, Expired, Pending Payment
Actions	Icons	Edit, View, Suspend
Required Actions

Each customer row must have:

Pencil icon: Edit customer
Eye icon: View customer details
Suspend icon: Suspend customer and token

When a customer is suspended:

customer.status = "suspended"
customer_token.status = "suspended"
API access must be blocked immediately
3.3 Plans Page

Path suggestion:

/dashboard/customer/plans
Purpose

Manage commercial SaaS plans that map to OmniRoute native combos.

Plan Fields
Plan Name
Description
Native Combo
Monthly Token Limit
Price BRL
Billing Interval
Status
Created At
Updated At
Example Plans
Starter
Native Combo: auto/cheap
Monthly Token Limit: 1,000,000
Price: R$ 99.00

Professional
Native Combo: auto/coding
Monthly Token Limit: 5,000,000
Price: R$ 399.00

Enterprise
Native Combo: custom-enterprise-fallback
Monthly Token Limit: 25,000,000
Price: R$ 1,499.00
Plan Rules

A plan must reference an existing OmniRoute combo or native routing model.

If the combo changes, all customers on that plan should use the updated combo on the next request unless the customer has a custom override.

3.4 Financial Page

Path suggestion:

/dashboard/customer/financial
Financial Dashboard Cards
Total Revenue
Monthly Recurring Revenue
Paid Customers
Pending Payments
Overdue Customers
Suspended Customers
Revenue This Month
Revenue Last Month
Charts

Required charts:

Monthly Revenue Chart
Payments by Status
Revenue by Plan
Customer Growth
Token Usage vs Revenue

The repository already uses recharts, so use it for dashboard charts to stay consistent with the existing stack.

Payment List Columns
Customer
Plan
Amount BRL
Payment Status
Payment Method
Payment Date
Renewal Date
Invoice ID
Transaction Reference
Actions
Payment Statuses
paid
pending
failed
refunded
cancelled
overdue
3.5 Customer Portal

Path suggestion:

/customer/portal

After login, the customer sees a simplified dashboard using the same visual style as OmniRoute.

Customer Portal Sections
Current Plan
API Token
Token Usage
Plan Validity
Payment / Renewal
Usage History
Customer Portal Fields
Plan Name
Token
Copy Token Button
Token Status
Used Tokens
Token Limit
Usage Percentage
Valid Until
Renewal Date
Payment Button
Renew Button
Example Display
Plan: Professional
Token: omr_live_xxxxxxxxxxxxxxxxx
Usage: 320,000 / 1,000,000 tokens
Status: Active
Valid Until: 2026-06-24
Renewal Date: 2026-06-24
4. Technical Specification
4.1 Architecture

Recommended architecture:

Next.js Dashboard
  ├── Admin Customer Module
  ├── Customer Portal
  ├── API Routes / Server Actions
  └── OmniRoute Router Integration

Supabase
  ├── Auth
  ├── Postgres
  ├── RLS Policies
  ├── Edge Functions / Webhooks
  └── Storage if invoices are needed later

OmniRoute Core
  ├── Existing combos
  ├── Existing routing engine
  ├── Existing /v1 API
  ├── Existing usage/rate limit modules
  └── New SaaS token validation middleware
4.2 Recommended Integration Strategy

Do not replace the existing SQLite routing database immediately.

Use Supabase for:

customers
plans
subscriptions
customer_tokens
payments
usage ledger
customer portal auth
financial dashboard

Keep OmniRoute native storage for:

provider connections
native combos
local routing config
existing API key system
runtime logs
provider health
fallback chains

Add a bridge layer:

Customer SaaS Token -> Supabase validation -> OmniRoute native combo -> Existing router
5. Supabase Database Schema
5.1 Tables
profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'customer' check (role in ('admin', 'customer')),
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
saas_plans
create table public.saas_plans (
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
customer_subscriptions
create table public.customer_subscriptions (
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
customer_tokens

Store only a token hash. Show the raw token only once at creation or store encrypted server-side if copy/view is strictly required.

create table public.customer_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid not null references public.customer_subscriptions(id) on delete cascade,
  token_prefix text not null,
  token_hash text not null unique,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'revoked', 'expired')),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
customer_usage_ledger
create table public.customer_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid not null references public.customer_subscriptions(id) on delete cascade,
  token_id uuid not null references public.customer_tokens(id) on delete cascade,
  request_id text,
  model text,
  native_combo_id text,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  total_tokens bigint generated always as (input_tokens + output_tokens) stored,
  cost_brl numeric(12,4) default 0,
  created_at timestamptz not null default now()
);
customer_payments
create table public.customer_payments (
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
6. Token Validation Flow
Request Flow
1. Customer calls OmniRoute /v1 endpoint with:
   Authorization: Bearer omr_live_xxxxx

2. SaaS middleware extracts token.

3. Middleware hashes token and checks Supabase customer_tokens.

4. Middleware verifies:
   - token status is active
   - customer status is active
   - subscription status is active
   - renews_at/expires_at is valid
   - usage is below plan token limit

5. Middleware resolves plan.native_combo_id.

6. Request is forwarded to the existing OmniRoute routing engine.

7. After response, token usage is written to customer_usage_ledger.

8. Customer portal and admin dashboard show updated usage.
Block Conditions

Return 401 or 403 when:

Invalid token
Suspended token
Suspended customer
Expired subscription
Usage limit exceeded
Payment overdue and grace period expired

Suggested responses:

{
  "error": {
    "code": "customer_token_suspended",
    "message": "This customer token is suspended. Please contact support."
  }
}
{
  "error": {
    "code": "usage_limit_exceeded",
    "message": "Monthly token limit exceeded. Please renew or upgrade your plan."
  }
}
7. Admin UI Specification
7.1 Registration Page UI

Components:

CustomerRegistrationPage
CustomerFormModal
CustomerDetailsDrawer
CustomerTable
SuspendCustomerDialog
UsageProgressBar
PlanComboSelect
CurrencyInputBRL
RenewalDatePicker

Table columns:

Name
E-mail
Plan
Token Prefix
Usage
BRL Value
Renewal Date
Status
Actions

Actions:

Edit
View
Suspend / Reactivate
Regenerate Token
Record Payment
7.2 Plans Page UI

Components:

PlansPage
PlanFormModal
PlanTable
NativeComboSelector
PlanStatusBadge

Table columns:

Plan Name
Native Combo
Monthly Token Limit
Price BRL
Billing Interval
Status
Customers
Actions
7.3 Financial Page UI

Components:

FinancialDashboardPage
RevenueSummaryCards
MonthlyRevenueChart
PaymentsStatusChart
RevenueByPlanChart
PaymentsTable
8. Customer Portal UI Specification

Path:

/customer/portal

Components:

CustomerPortalPage
CustomerTokenCard
UsageCard
PlanValidityCard
PaymentRenewalCard
UsageHistoryTable
CopyTokenButton

Customer can:

View token
Copy token
View validity
View usage
View plan
Pay
Renew

Customer cannot:

Change native combo
See other customers
See admin financial data
Edit plan price
Change own token limit
9. API Endpoints
Admin APIs
GET    /api/customer/customers
POST   /api/customer/customers
GET    /api/customer/customers/:id
PATCH  /api/customer/customers/:id
POST   /api/customer/customers/:id/suspend
POST   /api/customer/customers/:id/reactivate
POST   /api/customer/customers/:id/regenerate-token

GET    /api/customer/plans
POST   /api/customer/plans
PATCH  /api/customer/plans/:id
DELETE /api/customer/plans/:id

GET    /api/customer/financial/summary
GET    /api/customer/financial/payments
POST   /api/customer/financial/payments
Customer APIs
GET  /api/customer/portal/me
GET  /api/customer/portal/usage
GET  /api/customer/portal/payments
POST /api/customer/portal/renew
Router Middleware API
POST /api/customer/token/validate
POST /api/customer/usage/record
10. Security Requirements
Use Supabase Auth for admin and customer login.
Enable RLS on all SaaS tables.
Customers can only read their own profile, subscription, token metadata, payments and usage.
Admins can manage all customers, plans, tokens and payments.
Never expose Supabase secret/service keys in the browser.
Never store raw customer API tokens unless encrypted.
Token validation must happen server-side before routing to any LLM provider.
Suspended customers must be blocked immediately.
Expired subscriptions must be blocked or moved to grace-period mode.
Payment webhooks must be idempotent.
11. RLS Policy Direction

Example customer policy:

create policy "Customers can read own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

Example subscription policy:

create policy "Customers can read own subscriptions"
on public.customer_subscriptions
for select
to authenticated
using ((select auth.uid()) = customer_id);

Example admin policy:

create policy "Admins can manage all profiles"
on public.profiles
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
    and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
    and p.role = 'admin'
  )
);
12. Acceptance Criteria
Registration
Admin can create a customer.
Admin can select a native OmniRoute combo/plan.
System generates a token.
Customer appears in the Registration table.
Usage starts at 0 / plan limit.
BRL value is visible.
Renewal date is visible.
Admin can edit, view and suspend customer.
Suspending customer suspends token immediately.
Plans
Admin can create plans.
Admin can link plans to native OmniRoute combos.
Plan list shows price, token limit and status.
Registration page plan dropdown uses active plans.
Financial
Admin can see payment list.
Admin can see revenue summary.
Admin can see charts.
Admin can filter payments by status/date/customer.
Customer Portal
Customer can log in with email/password.
Customer sees only their own token.
Customer can copy token.
Customer sees validity and renewal date.
Customer sees used tokens and total token limit.
Customer can click payment or renewal button.
API Usage
Valid active token can call OmniRoute /v1.
Suspended token is blocked.
Expired subscription is blocked.
Usage limit exceeded is blocked.
Usage ledger records token consumption.
13. Implementation Prompt

Use this prompt with Cursor, Claude Code, Codex, Cline or another coding agent.

You are working inside the OmniRoute repository.

Goal:
Build a new SaaS Customer module for OmniRoute using Supabase. The module must allow the admin to sell token plans connected to existing OmniRoute native combos, generate customer API tokens, track usage, manage payments, suspend customers, and provide a customer portal.

Important repository context:
- The project is a Next.js + React + TypeScript application.
- The dashboard already has sections such as combos, providers, usage, costs, limits, logs, settings, analytics and API manager.
- The backend already has API route groups for keys, combos, usage, pricing, rate limits, providers, webhooks and v1.
- The current local persistence layer uses SQLite/better-sqlite3.
- Do not rewrite the existing routing engine.
- Add Supabase as the SaaS commercial layer only.

Required menu:
Add a new dashboard menu group named "Customer" with:
- Registration
- Plans
- Financial

All labels, messages and UI text must be in English.

Pages to create:
1. /dashboard/customer/registration
2. /dashboard/customer/plans
3. /dashboard/customer/financial
4. /customer/portal

Registration page:
Create a customer management table and form with:
- Name
- E-mail
- Password
- Plan
- Token generated from the selected plan/combo
- Usage, formatted like 0 / 1,000,000 tokens
- BRL value
- Renewal date
- Status
- Actions: edit pencil icon, view eye icon, suspend icon

Plans page:
Create plan CRUD connected to native OmniRoute combos:
- Plan name
- Description
- Native combo ID/name
- Monthly token limit
- Price in BRL
- Billing interval
- Status

Financial page:
Show:
- Total revenue
- Monthly recurring revenue
- Paid customers
- Pending payments
- Overdue payments
- Suspended customers
- Charts using Recharts
- Payment list with customer, plan, amount BRL, status, method, payment date, renewal date, invoice ID and transaction reference

Customer portal:
After login, the customer must see:
- Current plan
- API token with copy button
- Token usage
- Validity
- Renewal date
- Payment/renewal button
- Usage history
The customer must only see their own data.

Supabase:
Create migrations for:
- profiles
- saas_plans
- customer_subscriptions
- customer_tokens
- customer_usage_ledger
- customer_payments

Security:
- Use Supabase Auth.
- Enable RLS on all SaaS tables.
- Customers can only access their own data.
- Admins can manage all SaaS data.
- Never expose service_role or secret keys in browser code.
- Store customer API tokens as hashes. Only show the raw token once after generation, unless an encrypted storage approach is implemented.
- Token validation must run server-side before any OmniRoute provider call.

Router integration:
Add SaaS token validation middleware for /v1 requests:
1. Extract Bearer token.
2. Hash token.
3. Look up customer_tokens in Supabase.
4. Check token status, customer status, subscription status, expiry/renewal date and usage limit.
5. Resolve the plan native_combo_id.
6. Route the request through the existing OmniRoute routing engine using that combo.
7. Record usage in customer_usage_ledger after the request completes.
8. Block suspended, expired, invalid or over-limit tokens.

Expected errors:
- invalid_customer_token
- customer_suspended
- customer_token_suspended
- subscription_expired
- usage_limit_exceeded
- payment_overdue

Use existing UI components where possible:
- Card
- Button
- Input
- Select
- Modal
- DataTable
- Badge
- Sidebar
- Recharts

Deliverables:
1. Supabase SQL migrations.
2. TypeScript Supabase client setup.
3. Admin Customer menu.
4. Registration page.
5. Plans page.
6. Financial page.
7. Customer portal.
8. Server-side token generation and validation.
9. Usage recording.
10. RLS policies.
11. Basic tests for token validation and suspension behavior.

Do not remove existing OmniRoute features.
Do not break existing combos, provider routing, usage pages or /v1 compatibility.
Keep all new UI text in English.
14. Recommended Build Order
Create Supabase schema and RLS.
Add Supabase env variables.
Add admin role support.
Add Customer menu.
Build Plans page.
Build Registration page.
Generate and hash customer tokens.
Add token validation middleware.
Add usage ledger writes.
Build Financial page.
Build Customer Portal.
Add payment integration/webhook later.

The most important architectural decision is: keep OmniRoute’s existing router and combos as the engine, and add Supabase as the SaaS control/billing layer around it.