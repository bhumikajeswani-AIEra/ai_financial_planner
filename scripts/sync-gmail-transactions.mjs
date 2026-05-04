import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tjfolfsgzzyhvnjepyut.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqZm9sZnNnenp5aHZuamVweXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3OTc0OTIsImV4cCI6MjA5MzM3MzQ5Mn0.7VqaA3Vf5UeaAZ8STMRNQjnA7ATJ7gRs5M5qGpzcsxo';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Parsed transactions from HDFC Gmail alerts ──────────────────────────────
const RAW_TRANSACTIONS = [
  // Dec 2025
  { threadId: '19b36f00ff254f54', date: '2025-12-19', amount: 241.00, merchant: 'Blinkit', type: 'income', note: 'Blinkit refund' }, // skip - refund
  { threadId: '19b3a957b82cbf6e', date: '2025-12-20', amount: 560.00, merchant: 'Blinkit', type: 'expense' },
  { threadId: '19b3a957b82cbf6e', date: '2025-12-20', amount: 1912.00, merchant: 'Zomato', type: 'expense' },
  { threadId: '19b3a957b82cbf6e', date: '2025-12-20', amount: 166.00, merchant: 'RAJKUMAR', type: 'expense' },
  { threadId: '19b3a957b82cbf6e', date: '2025-12-20', amount: 1400.00, merchant: 'AMRITA KUMARI', type: 'expense' },
  { threadId: '19b3a957b82cbf6e', date: '2025-12-20', amount: 138.00, merchant: 'RAVI SHANKAR RAY', type: 'expense' },
  { threadId: '19b4b18a481d330a', date: '2025-12-23', amount: 90.00, merchant: 'RAMESH', type: 'expense' },
  { threadId: '19b4b18a481d330a', date: '2025-12-23', amount: 429.00, merchant: 'Swiggy', type: 'expense' },
  { threadId: '19b50abb7e900735', date: '2025-12-24', amount: 100.00, merchant: 'SEEMA KESHARWANI', type: 'expense' },
  { threadId: '19b50abb7e900735', date: '2025-12-24', amount: 20.00, merchant: 'SHARDA BAKERY AND NUTS', type: 'expense' },
  { threadId: '19b55267a094225f', date: '2025-12-25', amount: 1326.00, merchant: 'THRIVE HOSPITALITY', type: 'expense' },
  { threadId: '19b55267a094225f', date: '2025-12-25', amount: 250.00, merchant: 'SNOW BERRY', type: 'expense' },
  { threadId: '19b55267a094225f', date: '2025-12-25', amount: 200.00, merchant: 'YELLOW CUBS', type: 'expense' },
  { threadId: '19b55267a094225f', date: '2025-12-25', amount: 20.00, merchant: 'PAPER INK ENTERPRISES', type: 'expense' },
  { threadId: '19b55267a094225f', date: '2025-12-25', amount: 20.00, merchant: 'PAPER INK ENTERPRISES 2', type: 'expense' },
  { threadId: '19b5a9debae1bbf7', date: '2025-12-26', amount: 410.00, merchant: 'STAFF GUILD PRIVATE LIMITED', type: 'expense' },
  { threadId: '19b5f7f743c53a42', date: '2025-12-27', amount: 40.00, merchant: 'Mr AMAN ALI', type: 'expense' },
  { threadId: '19b5f7f743c53a42', date: '2025-12-27', amount: 200.00, merchant: 'KANHAIA RAIKWAR', type: 'expense' },
  { threadId: '19b6463070f2da64', date: '2025-12-28', amount: 3635.00, merchant: 'MALAY BHAVIN VASHI', type: 'expense' },
  { threadId: '19b6463070f2da64', date: '2025-12-28', amount: 273.00, merchant: 'Swiggy', type: 'expense' },
  { threadId: '19b6aad71dde492d', date: '2025-12-29', amount: 381.00, merchant: 'Blinkit', type: 'expense' },
  { threadId: '19b6dcfa05c604b6', date: '2025-12-30', amount: 11168.00, merchant: 'CRED Club', type: 'expense' },
  { threadId: '19b74efbc5034584', date: '2025-12-31', amount: 261.00, merchant: 'THRIVE HOSPITALITY', type: 'expense' },
  { threadId: '19b74efbc5034584', date: '2026-01-01', amount: 219.00, merchant: 'Apple Media Services', type: 'expense' },

  // Jan 2026
  { threadId: '19b7b28233678591', date: '2026-01-02', amount: 175449.00, merchant: 'FINARKEIN ANALYTICS', type: 'income', note: 'Salary Dec 2025' },
  { threadId: '19b79f5954857885', date: '2026-01-01', amount: 150.00, merchant: 'STAFF GUILD PRIVATE LIMITED', type: 'expense' },
  // skip 80000 self-transfer on 19b79f5954857885
  { threadId: '19b7e8dc855c72d4', date: '2026-01-02', amount: 760.00, merchant: 'HANDCRAFTED CAFE AND ROASTERY', type: 'expense' },
  { threadId: '19b7e8dc855c72d4', date: '2026-01-02', amount: 199.00, merchant: 'Blinkit', type: 'expense' },
  { threadId: '19b7e8dc855c72d4', date: '2026-01-02', amount: 120.00, merchant: 'Rakesh milk parlour', type: 'expense' },
  { threadId: '19b82ec26d0c3cab', date: '2026-01-03', amount: 86.00, merchant: 'Shivam Ahirwar', type: 'expense' },
  { threadId: '19b82ec26d0c3cab', date: '2026-01-03', amount: 1570.00, merchant: 'MS BAKE N SHAKE', type: 'expense' },
  { threadId: '19b82ec26d0c3cab', date: '2026-01-03', amount: 120.00, merchant: 'THE MOMO FACTORY', type: 'expense' },
  { threadId: '19b82ec26d0c3cab', date: '2026-01-03', amount: 960.00, merchant: 'SPARSH GOYAL', type: 'expense' },
  // skip 80000 self-transfer on 19b82ec26d0c3cab
  { threadId: '19b8edd43f9e3499', date: '2026-01-05', amount: 1895.00, merchant: 'HANDCRAFTED CAFE AND ROASTERY', type: 'expense' },
  { threadId: '19b989e4a5c06b9f', date: '2026-01-07', amount: 651.00, merchant: 'RAJENDRA SO RAMPRASAD', type: 'expense' },
  { threadId: '19b989e4a5c06b9f', date: '2026-01-07', amount: 260.00, merchant: 'SURYANSH SHRIVASTAVA', type: 'expense' },
  { threadId: '19b9e781a4dca2dd', date: '2026-01-08', amount: 236.00, merchant: 'Blinkit', type: 'expense' },
  { threadId: '19b9e781a4dca2dd', date: '2026-01-09', amount: 184.00, merchant: 'Swiggy', type: 'expense' },
  { threadId: '19ba134d79235944', date: '2026-01-09', amount: 16988.00, merchant: 'FINARKEIN ANALYTICS', type: 'income', note: 'FT Reimbursement' },
  { threadId: '19ba6d9f29da6762', date: '2026-01-10', amount: 1006.00, merchant: 'Amazon Pay on Delivery', type: 'expense' },
  { threadId: '19ba6d9f29da6762', date: '2026-01-10', amount: 100.00, merchant: 'SUNEEL KUMAR', type: 'expense' },
  { threadId: '19ba6d9f29da6762', date: '2026-01-10', amount: 50.00, merchant: 'SUNEEL KUMAR', type: 'expense' },
  { threadId: '19babb8938a5c5d1', date: '2026-01-11', amount: 100.00, merchant: 'ARTSTROKE INDIA', type: 'expense' },
  { threadId: '19babb8938a5c5d1', date: '2026-01-11', amount: 100.00, merchant: 'SUNEEL KUMAR', type: 'expense' },
  { threadId: '19bb30e68a422b0a', date: '2026-01-12', amount: 11000.00, merchant: 'SACHIN RAI', type: 'expense' },
  { threadId: '19bb637a986384fb', date: '2026-01-13', amount: 78.00, merchant: 'REENA PRASAD', type: 'expense' },
  { threadId: '19bb637a986384fb', date: '2026-01-13', amount: 782.00, merchant: 'SOUMYA MISHRA', type: 'expense' },
  { threadId: '19bbbda454ba96e5', date: '2026-01-14', amount: 130.00, merchant: 'Ashok Kumar Chouhan', type: 'expense' },
  { threadId: '19bbbda454ba96e5', date: '2026-01-14', amount: 277.00, merchant: 'Swiggy', type: 'expense' },
  { threadId: '19bbbda454ba96e5', date: '2026-01-14', amount: 500.00, merchant: 'RAJESH BAKERY', type: 'expense' },
  { threadId: '19bbbda454ba96e5', date: '2026-01-14', amount: 317.40, merchant: 'RIP ENTERPRISES', type: 'expense' },
  { threadId: '19bc73c0cce01339', date: '2026-01-16', amount: 100.00, merchant: 'SUNEEL KUMAR', type: 'expense' },
  { threadId: '19bcb0fa334cddf7', date: '2026-01-17', amount: 8500.00, merchant: 'SURYANSH SHRIVASTAVA', type: 'expense' },
  { threadId: '19bcb0fa334cddf7', date: '2026-01-17', amount: 1377.00, merchant: 'TAN COFFEE', type: 'expense' },
  { threadId: '19bcb0fa334cddf7', date: '2026-01-17', amount: 927.00, merchant: 'LAZEEZ HAKEEM', type: 'expense' },
  { threadId: '19bd0b72e5d09ae4', date: '2026-01-18', amount: 76.00, merchant: 'Mr DHANRAJ SINGH DHAKER', type: 'expense' },
  { threadId: '19bd0b72e5d09ae4', date: '2026-01-18', amount: 650.00, merchant: 'ROSE BEAUTY PARLOUR', type: 'expense' },
  { threadId: '19bd0b72e5d09ae4', date: '2026-01-18', amount: 95.00, merchant: 'MOHAMMAD CHAND', type: 'expense' },
  { threadId: '19bd6733fb0a732b', date: '2026-01-19', amount: 115.00, merchant: 'DALVEER PAL', type: 'expense' },
  { threadId: '19bd6733fb0a732b', date: '2026-01-19', amount: 100.00, merchant: 'SUNEEL KUMAR', type: 'expense' },
  { threadId: '19bd6733fb0a732b', date: '2026-01-19', amount: 75.00, merchant: 'SHIV KUMAR', type: 'expense' },
  { threadId: '19be1b4bbe7d8f12', date: '2026-01-21', amount: 1922.00, merchant: 'Myntra', type: 'expense' },
  { threadId: '19be59b0f45d7bce', date: '2026-01-22', amount: 1600.00, merchant: 'PRANEETA SUJITH', type: 'expense' },
  { threadId: '19be59b0f45d7bce', date: '2026-01-22', amount: 100.00, merchant: 'SUNEEL KUMAR', type: 'expense' },
  { threadId: '19bea61ea6edffeb', date: '2026-01-23', amount: 288.00, merchant: 'Neeraj Kurmi', type: 'expense' },
  { threadId: '19bea61ea6edffeb', date: '2026-01-23', amount: 5250.00, merchant: 'AMOL SRIVASTAVA', type: 'expense' },
  { threadId: '19bea61ea6edffeb', date: '2026-01-24', amount: 2025.00, merchant: 'APOORVA RIJHWANEY', type: 'expense' },
  { threadId: '19bebc2fd37e7e5c', date: '2026-01-23', amount: 5250.00, merchant: 'AMOL SRIVASTAVA', type: 'income', note: 'UPI received' },
  { threadId: '19bef76b552bba95', date: '2026-01-24', amount: 1529.50, merchant: 'ATOMX CORPORATION', type: 'expense' },
  { threadId: '19bef76b552bba95', date: '2026-01-24', amount: 278.65, merchant: 'Zomato', type: 'expense' },
  { threadId: '19bf8fa123faf3e9', date: '2026-01-26', amount: 420.00, merchant: 'PUSHPA BAI', type: 'expense' },
  { threadId: '19c092d47331e2c5', date: '2026-01-29', amount: 130.00, merchant: 'ASHWANI KUMAR SINGH', type: 'expense' },
  { threadId: '19c092d47331e2c5', date: '2026-01-29', amount: 538.00, merchant: 'BHOOKA BANGALI', type: 'expense' },
  { threadId: '19c18eee4dfedfae', date: '2026-02-01', amount: 2023.00, merchant: 'Cinepolis', type: 'expense' },
  { threadId: '19c1460071abdb5a', date: '2026-01-31', amount: 500.00, merchant: 'BROWN BASCAED', type: 'expense' },
  { threadId: '19c1460071abdb5a', date: '2026-01-31', amount: 50.00, merchant: 'BROWN BASCAED', type: 'expense' },
  { threadId: '19c1ee67e2e2cbed', date: '2026-02-02', amount: 130.00, merchant: 'RAJESH SAHANI', type: 'expense' },

  // Feb 2026
  // skip 80000 self-transfer on 19c22724670f8900
  { threadId: '19c22724670f8900', date: '2026-02-03', amount: 1348.00, merchant: 'HANDCRAFTED CAFE AND ROASTERY', type: 'expense' },
  { threadId: '19c2df7aeb21aff2', date: '2026-02-05', amount: 96.00, merchant: 'PUNJAB DAIRY CENTAR', type: 'expense' },
  { threadId: '19c2df7aeb21aff2', date: '2026-02-05', amount: 250.00, merchant: '999 FEB', type: 'expense' },
  { threadId: '19c481711f8409e4', date: '2026-02-10', amount: 722.07, merchant: 'Zomato', type: 'expense' },
  { threadId: '19c576c0a898735f', date: '2026-02-13', amount: 120.00, merchant: 'SUNEEL KUMAR', type: 'expense' },

  // Mar 2026
  { threadId: '19cb3ed4e5bf69a8', date: '2026-03-03', amount: 470.00, merchant: 'Swiggy', type: 'expense' },
  { threadId: '19ce28ee72b4697f', date: '2026-03-12', amount: 500.00, merchant: 'ANUSHREE HOSPITAL', type: 'expense' },
  { threadId: '19ce777907ab4489', date: '2026-03-13', amount: 650.00, merchant: 'ROSE BEAUTY PARLOUR', type: 'expense' },
  { threadId: '19ce777907ab4489', date: '2026-03-13', amount: 352.00, merchant: 'Starbucks', type: 'expense' },
  { threadId: '19ce777907ab4489', date: '2026-03-13', amount: 228.00, merchant: 'PUNJAB DAIRY CENTAR', type: 'expense' },
  { threadId: '19cec9343c88b3aa', date: '2026-03-14', amount: 120.00, merchant: 'SUNEEL KUMAR', type: 'expense' },
  { threadId: '19cec9343c88b3aa', date: '2026-03-14', amount: 182.00, merchant: 'Swiggy', type: 'expense' },
  { threadId: '19d069974f50ce14', date: '2026-03-19', amount: 105.00, merchant: 'KUBER DAIRY', type: 'expense' },
  { threadId: '19d10976214a1d26', date: '2026-03-21', amount: 120.00, merchant: 'SUNEEL KUMAR', type: 'expense' },
  { threadId: '19d39cfe2b2803b4', date: '2026-03-29', amount: 228.00, merchant: 'PUNJAB DAIRY CENTRE', type: 'expense' },
  { threadId: '19d443c7bfaca30f', date: '2026-03-31', amount: 70.00, merchant: 'ABDUL HAMID KHAN', type: 'expense' },
];

// ── Category mapping ────────────────────────────────────────────────────────
function categorize(merchant) {
  const m = merchant.toLowerCase();
  if (/zomato|swiggy|mcdonald|domino|restaurant|cafe|roastery|starbucks|bhooka bangali|lazeez|thrive hospitality|snow berry|yellow cubs|bake n shake|momo factory|rajesh bakery|sharda bakery|kuber dairy|punjab dairy|milk parlour|paper ink/.test(m)) return 'Food & Dining';
  if (/blinkit/.test(m)) return 'Food & Dining';
  if (/uber|ola|metro|irctc|petrol|fuel/.test(m)) return 'Transport';
  if (/amazon|flipkart|myntra|ajio|nykaa/.test(m)) return 'Shopping';
  if (/netflix|spotify|hotstar|prime|jio|airtel|apple media/.test(m)) return 'Subscriptions';
  if (/electricity|water|gas bill|bescom|mseb/.test(m)) return 'Utilities';
  if (/hospital|pharmacy|apollo|1mg|practo/.test(m)) return 'Healthcare';
  if (/cred club/.test(m)) return 'Credit Card Bill';
  if (/finarkein/.test(m)) return 'Income';
  return 'Shopping';
}

// ── Build dedup ID ──────────────────────────────────────────────────────────
function buildId(tx) {
  const d = tx.date.replace(/-/g, '').slice(2); // YYMMDD
  const amtStr = Math.round(tx.amount * 100).toString().slice(-4).padStart(4, '0');
  return `hdfc_${d}_${amtStr}`;
}

async function main() {
  // 1. Fetch categories
  const { data: cats, error: catErr } = await supabase.from('categories').select('id, name');
  if (catErr) { console.error('Error fetching categories:', catErr.message); process.exit(1); }
  const categoryMap = {};
  for (const c of cats) categoryMap[c.name] = c.id;
  console.log('Categories found:', Object.keys(categoryMap).join(', '));

  // 2. Fetch first account
  const { data: accounts, error: accErr } = await supabase.from('accounts').select('id, name').limit(5);
  if (accErr) { console.error('Error fetching accounts:', accErr.message); process.exit(1); }
  if (!accounts || accounts.length === 0) { console.error('No accounts found'); process.exit(1); }
  const defaultAccountId = accounts[0].id;
  console.log('Using account:', accounts[0].name, '(' + defaultAccountId + ')');

  // 3. Fetch existing gmail-imported transactions for dedup
  const { data: existing, error: exErr } = await supabase
    .from('transactions')
    .select('note')
    .like('note', 'gmail:%');
  if (exErr) { console.error('Error fetching existing transactions:', exErr.message); process.exit(1); }
  const importedThreadIds = new Set((existing || []).map(r => r.note?.replace('gmail:', '').split('|')[0]));
  console.log(`Already imported thread IDs: ${importedThreadIds.size}`);

  // 4. Get user_id — list all auth users (service role only)
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const userId = users?.[0]?.id ?? null;
  if (!userId) { console.error('No auth user found'); process.exit(1); }
  console.log('User ID:', userId);

  // 5. Build transactions, skip refunds, skip self-transfers
  const SKIP_MERCHANTS = ['bhumika jeswani'];
  const SKIP_NOTES = ['Blinkit refund'];

  const filtered = RAW_TRANSACTIONS.filter(tx => {
    if (SKIP_NOTES.includes(tx.note)) return false;
    if (SKIP_MERCHANTS.some(s => tx.merchant.toLowerCase().includes(s))) return false;
    return true;
  });

  // Deduplicate within batch by composite key (threadId + amount + date)
  const seen = new Set();
  const dedupedBatch = [];
  for (const tx of filtered) {
    const key = `${tx.threadId}_${tx.amount}_${tx.date}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedupedBatch.push(tx);
    }
  }

  // Skip already-imported by threadId
  const newTransactions = dedupedBatch.filter(tx => !importedThreadIds.has(tx.threadId));
  const skippedCount = dedupedBatch.length - newTransactions.length;

  console.log(`\nTotal parsed: ${filtered.length}`);
  console.log(`After batch dedup: ${dedupedBatch.length}`);
  console.log(`Already imported (skipped): ${skippedCount}`);
  console.log(`New to insert: ${newTransactions.length}`);

  if (newTransactions.length === 0) {
    printReport(filtered.length, 0, dedupedBatch.length - newTransactions.length, 0, []);
    return;
  }

  // 6. Map to DB schema
  const rows = newTransactions.map(tx => {
    const catName = tx.type === 'income' ? 'Income' : categorize(tx.merchant);
    const catId = categoryMap[catName] || categoryMap['Shopping'] || null;
    return {
      amount: tx.amount,
      type: tx.type,
      category_id: catId,
      date: tx.date,
      account_id: defaultAccountId,
      note: `gmail:${tx.threadId}|${tx.merchant}`,
      ...(userId ? { user_id: userId } : {}),
    };
  });

  // 7. Insert in batches of 50
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error: insErr } = await supabase.from('transactions').insert(batch);
    if (insErr) {
      console.error(`Insert error (batch ${i}):`, insErr.message);
    } else {
      inserted += batch.length;
    }
  }

  // 8. Category summary
  const catSummary = {};
  for (const tx of newTransactions.filter(t => t.type === 'expense')) {
    const cat = categorize(tx.merchant);
    if (!catSummary[cat]) catSummary[cat] = { total: 0, count: 0 };
    catSummary[cat].total += tx.amount;
    catSummary[cat].count++;
  }

  printReport(filtered.length, newTransactions.length, skippedCount, inserted, catSummary);
}

function printReport(scanned, found, skipped, inserted, catSummary) {
  const totalSpend = Object.values(catSummary).reduce((s, v) => s + v.total, 0);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Gmail Sync Complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Emails scanned:     ${scanned}`);
  console.log(`Transactions found: ${found}`);
  console.log(`Already imported:   ${skipped} (skipped)`);
  console.log(`New imported:       ${inserted}`);
  if (Object.keys(catSummary).length > 0) {
    console.log('\nTop categories:');
    const sorted = Object.entries(catSummary).sort((a, b) => b[1].total - a[1].total);
    for (const [cat, { total, count }] of sorted.slice(0, 5)) {
      console.log(`  ${cat.padEnd(20)} ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}  (${count} txns)`);
    }
    console.log(`\nTotal new spend: ₹${totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Dashboard: https://ai-financial-planner-seven.vercel.app');
}

main().catch(console.error);
