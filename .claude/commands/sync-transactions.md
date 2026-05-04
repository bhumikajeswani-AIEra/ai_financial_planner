# /sync-transactions

Sync Gmail payment emails → parse → insert into Supabase FinPlan DB.

## Steps

### 1. FETCH — Search Gmail in parallel for two query groups:

**Group A — Bank alerts (HDFC):**
```
from:(alerts@hdfcbank.net OR hdfcbank@alerts.hdfcbank.com OR noreply@hdfcbank.com) after:2025/12/01
```

**Group B — Paytm & UPI receipts:**
```
from:(noreply@paytm.com OR alerts@paytm.com OR payments@paytm.com) after:2025/12/01
```

**Group C — Credit card bills & statements:**
```
subject:(credit card statement OR cc bill OR payment due OR minimum due OR total amount due) after:2025/12/01
```

Use `mcp__claude_ai_Gmail__search_threads` for all three in parallel. Fetch up to 50 threads per group. Then use `mcp__claude_ai_Gmail__get_thread` to get full thread details for each result.

---

### 2. PARSE — Extract structured data from each email

For each thread/message, extract from subject + snippet:

**HDFC debit alert pattern:**
- Subject contains: "debited", "debit alert", "INR", "UPI"
- Extract: amount (after "INR" or "Rs."), merchant (after "at" or "to"), date (from email date header)
- Example: "INR 450.00 debited from a/c XX1234 on 03-05-26 at Zomato" → amount=450, merchant=Zomato, date=2026-05-03

**HDFC credit alert pattern:**
- Subject contains: "credited"
- Mark as type=income, extract amount and source

**Paytm pattern:**
- Subject contains: "payment successful", "paid to", "transaction"
- Extract: amount (after "Rs." or "INR"), merchant (after "paid to" or "at")

**CC bill pattern:**
- Extract: total due amount, due date
- Mark as category=Credit Card Bill, type=expense

**Skip these (they would double-count or are not transactions):**
- Subjects containing: "OTP", "login", "signup", "offer", "cashback credited to wallet", "promotional", "statement generated" (without amount)
- CC bill payment confirmations (you already log the underlying transactions)
- Refunds/reversals

---

### 3. CATEGORIZE — Map merchant to category

Use this mapping:
- Zomato, Swiggy, McDonald's, Domino's, restaurant → Food & Dining
- Uber, Ola, Metro, IRCTC, petrol, fuel → Transport
- Amazon, Flipkart, Myntra, Ajio, Nykaa → Shopping
- Netflix, Spotify, Hotstar, Prime, Jio, Airtel → Subscriptions
- Electricity, water, gas bill, BESCOM, MSEB → Utilities
- Hospital, pharmacy, Apollo, 1mg, Practo → Healthcare
- Credit card bill, CC bill → Credit Card Bill
- HDFC, Axis, SBI (credited) → Salary or Income
- Paytm wallet add money → skip (not an expense)
- Default fallback → Shopping

---

### 4. STRUCTURE — Build transaction objects

For each parsed email create:
```json
{
  "id": "<bank>_<DDMMYY>_<last4ofamount>",
  "amount": 450.00,
  "type": "expense",
  "category": "Food & Dining",
  "merchant": "Zomato",
  "date": "2026-05-03",
  "source": "hdfc_alert",
  "gmail_thread_id": "<thread_id>"
}
```

ID format examples:
- `hdfc_030526_4500` (HDFC, 03 May 2026, amount ends in 4500 paise)
- `paytm_030526_200`
- `ccbill_030526_15000`

---

### 5. DEDUPLICATE

Before inserting, check Supabase `transactions` table for existing rows where `note LIKE 'gmail:%'`. Extract thread IDs already imported. Skip any transaction whose `gmail_thread_id` is already in the DB.

Also deduplicate within the current batch by ID.

---

### 6. INSERT into Supabase

Use the Supabase REST API or `@supabase/supabase-js` to insert transactions.

Map category name → category_id by querying `categories` table first.
Use the first account in `accounts` table as default account_id.
Set `note = 'gmail:<gmail_thread_id>'` for dedup tracking.
Set `user_id` from the authenticated user.

**Supabase project URL:** `https://tjfolfsgzzyhvnjepyut.supabase.co`

Use the service role key from env `SUPABASE_SERVICE_ROLE_KEY` if available, otherwise anon key from `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

### 7. REPORT — Print summary

After inserting, print:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Gmail Sync Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Emails scanned:     XX
Transactions found: XX
Already imported:   XX (skipped)
New imported:       XX

Top categories:
  Food & Dining     ₹X,XXX  (X txns)
  Transport         ₹X,XXX  (X txns)
  Subscriptions     ₹X,XXX  (X txns)

Total new spend: ₹XX,XXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dashboard: https://ai-financial-planner-seven.vercel.app
```

---

## Notes
- Run from the financial-planner project directory
- Gmail MCP must be connected (check with `claude mcp list`)
- HDFC alert emails are the most reliable source — prioritize them
- CC bill amounts should NOT include individual transactions already logged (log only the bill total as one entry if underlying txns aren't in DB)
- If a thread has multiple messages, only process the latest message in the thread
