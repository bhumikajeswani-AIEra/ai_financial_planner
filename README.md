# AI Financial Planner

A personal finance OS built for India — automatically ingests transactions from bank statements, Gmail alerts, and credit card PDFs, then gives you a clean monthly view of where your money goes.

## What it does

Indian banking is fragmented. Money moves across HDFC, ICICI, Paytm, UPI, and credit cards with no unified view. This app connects those dots automatically.

**Data in — 3 ways:**
- Upload any bank or CC statement PDF (HDFC, ICICI, SBI, Axis, Paytm, Kotak) — Claude parses it, extracts all transactions including salary and NEFT credits
- Gmail sync — reads bank debit/credit alerts from your inbox
- Manual entry — add any transaction directly

**Analysis:**
- Monthly expense breakdown by L1 → L2 category (e.g. Food & Dining → Zomato)
- Income vs. expense per month, salary auto-detected from NEFT credits
- Budget tracking — set limits per category, see actuals in real time
- Source tagging — UPI / RTGS / CC / Manual on every transaction
- Investment portfolio tracking

## Stack

- **Frontend**: Next.js 15 (App Router), Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes, Supabase (Postgres + Auth)
- **AI**: Claude (Anthropic) — bank statement parsing
- **Deployment**: Vercel

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/bhumikajeswani-AIEra/ai_financial_planner.git
cd ai_financial_planner
npm install
```

### 2. Environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Uploading bank statements

The statement parser handles any PDF from HDFC, ICICI, SBI, Axis, Paytm, Kotak — including credit card statements.

**If your PDF is password-protected** (common with HDFC/ICICI):
1. Open the PDF in Chrome and enter your password
2. `Cmd+P` → Save as PDF
3. Upload the unlocked version

The parser extracts both debits (expenses) and credits (salary, reimbursements, UPI received) automatically.

## Syncing from Gmail

Run the sync script to import transactions from Gmail bank alerts:

```bash
SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/sync-gmail-transactions.mjs
```

## Deployment

Deployed on Vercel. Set all environment variables under Project → Settings → Environment Variables.

```bash
vercel --prod
```
