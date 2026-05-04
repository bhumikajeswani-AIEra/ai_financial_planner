import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tjfolfsgzzyhvnjepyut.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Full L1/L2 taxonomy ─────────────────────────────────────────────────────
const TAXONOMY = [
  {
    name: 'food & drinks', type: 'expense', color: '#f59e0b', icon: 'utensils', order: 1,
    children: [
      'eating out', 'take away', 'tea & coffee', 'fast food', 'snacks',
      'swiggy', 'zomato', 'sweets', 'liquor', 'beverages', 'date',
      'pizza', 'tiffin', 'others',
    ],
  },
  {
    name: 'groceries', type: 'expense', color: '#22c55e', icon: 'shopping-basket', order: 2,
    children: [
      'staples', 'vegetables', 'fruits', 'meat', 'eggs',
      'bakery', 'dairy', 'zepto', 'blinkit', 'others',
    ],
  },
  {
    name: 'transport', type: 'expense', color: '#3b82f6', icon: 'car', order: 3,
    children: [
      'uber', 'rapido', 'auto', 'cab', 'train', 'metro', 'bus', 'bike',
      'fuel', 'EV charge', 'flights', 'parking', 'fastag', 'tolls',
      'lounge', 'fine/challan', 'others',
    ],
  },
  {
    name: 'shopping', type: 'expense', color: '#ec4899', icon: 'shopping-bag', order: 4,
    children: [
      'clothes', 'footwear', 'electronic', 'festival', 'video games',
      'books', 'plants', 'jewellery', 'furniture', 'appliances',
      'vehicle', 'cosmetics', 'toys', 'stationery', 'glasses',
      'devotional', 'others',
    ],
  },
  {
    name: 'entertainment', type: 'expense', color: '#f43f5e', icon: 'film', order: 5,
    children: [
      'movies', 'events', 'sports', 'gaming', 'concerts',
      'amusement park', 'streaming', 'others',
    ],
  },
  {
    name: 'health & wellness', type: 'expense', color: '#14b8a6', icon: 'heart', order: 6,
    children: [
      'doctor', 'pharmacy', 'hospital', 'fitness', 'gym',
      'lab tests', 'dental', 'mental health', 'others',
    ],
  },
  {
    name: 'personal care', type: 'expense', color: '#a855f7', icon: 'sparkles', order: 7,
    children: [
      'salon & spa', 'haircut', 'cosmetics', 'skincare', 'others',
    ],
  },
  {
    name: 'utilities & bills', type: 'expense', color: '#8b5cf6', icon: 'zap', order: 8,
    children: [
      'electricity', 'water', 'gas', 'internet', 'mobile recharge',
      'broadband', 'others',
    ],
  },
  {
    name: 'subscriptions', type: 'expense', color: '#6366f1', icon: 'repeat', order: 9,
    children: [
      'streaming', 'music', 'apps', 'news', 'cloud storage', 'others',
    ],
  },
  {
    name: 'education', type: 'expense', color: '#0ea5e9', icon: 'book', order: 10,
    children: [
      'courses', 'books', 'coaching', 'stationery', 'fees', 'others',
    ],
  },
  {
    name: 'travel', type: 'expense', color: '#f97316', icon: 'plane', order: 11,
    children: [
      'hotel', 'flights', 'cab', 'sightseeing', 'visa', 'forex', 'others',
    ],
  },
  {
    name: 'credit card bill', type: 'expense', color: '#ef4444', icon: 'credit-card', order: 12,
    children: ['HDFC', 'Axis', 'ICICI', 'SBI', 'Kotak', 'others'],
  },
  {
    name: 'transfers', type: 'expense', color: '#64748b', icon: 'arrow-right-left', order: 13,
    children: ['sent', 'rent', 'split', 'family', 'others'],
  },
  {
    name: 'income', type: 'income', color: '#10b981', icon: 'briefcase', order: 14,
    children: ['salary', 'freelance', 'bonus', 'reimbursement', 'transfer received', 'others'],
  },
];

// ── Merchant → { l1, l2 } mapping ──────────────────────────────────────────
const MERCHANT_MAP = [
  // food & drinks — zomato
  [/zomato|eternal limited/i,         { l1: 'food & drinks', l2: 'zomato' }],
  // food & drinks — swiggy
  [/swiggy/i,                          { l1: 'food & drinks', l2: 'swiggy' }],
  // food & drinks — tea & coffee
  [/starbucks|tan coffee/i,            { l1: 'food & drinks', l2: 'tea & coffee' }],
  // food & drinks — take away
  [/momo factory|bake n shake/i,       { l1: 'food & drinks', l2: 'take away' }],
  // food & drinks — eating out
  [/handcrafted cafe|thrive hospitality|lazeez hakeem|bhooka bangali|brown bascaed|999 feb|snow berry|yellow cubs/i,
                                        { l1: 'food & drinks', l2: 'eating out' }],
  // groceries — dairy
  [/punjab dairy|kuber dairy|suneel kumar|rakesh milk/i,
                                        { l1: 'groceries', l2: 'dairy' }],
  // groceries — bakery
  [/rajesh bakery|sharda bakery/i,     { l1: 'groceries', l2: 'bakery' }],
  // groceries — blinkit
  [/blinkit/i,                         { l1: 'groceries', l2: 'blinkit' }],
  // shopping — clothes
  [/myntra/i,                          { l1: 'shopping', l2: 'clothes' }],
  // shopping — stationery
  [/paper ink|artstroke/i,             { l1: 'shopping', l2: 'stationery' }],
  // shopping — electronic
  [/atomx corporation/i,               { l1: 'shopping', l2: 'electronic' }],
  // shopping — others (amazon)
  [/amazon/i,                          { l1: 'shopping', l2: 'others' }],
  // personal care
  [/rose beauty|beauty parlour/i,      { l1: 'personal care', l2: 'salon & spa' }],
  // entertainment
  [/cinepolis/i,                       { l1: 'entertainment', l2: 'movies' }],
  // health & wellness
  [/hospital|pharmacy|clinic|apollo|practo|1mg/i,
                                        { l1: 'health & wellness', l2: 'hospital' }],
  // subscriptions
  [/apple media/i,                     { l1: 'subscriptions', l2: 'apps' }],
  // credit card bill
  [/cred club/i,                       { l1: 'credit card bill', l2: 'others' }],
  // income
  [/finarkein/i,                       { l1: 'income', l2: 'salary' }],
  // income — reimbursement
  [/reimbursement/i,                   { l1: 'income', l2: 'reimbursement' }],
  // income — transfer received
  [/amol srivastava/i,                 { l1: 'income', l2: 'transfer received' }],
  // transfers — everything else (P2P UPI)
];

function resolveCategory(merchant, type) {
  if (type === 'income') {
    for (const [re, cat] of MERCHANT_MAP) {
      if (re.test(merchant) && cat.l1 === 'income') return cat;
    }
    return { l1: 'income', l2: 'others' };
  }
  for (const [re, cat] of MERCHANT_MAP) {
    if (re.test(merchant)) return cat;
  }
  return { l1: 'transfers', l2: 'sent' };
}

async function main() {
  // 1. Get user
  const { data: { users } } = await sb.auth.admin.listUsers();
  const userId = users[0].id;
  console.log('User:', users[0].email);

  // 2. Wipe existing categories for this user
  await sb.from('categories').delete().eq('user_id', userId);
  console.log('Cleared old categories');

  // 3. Seed L1 categories
  const l1Rows = TAXONOMY.map(t => ({
    name: t.name, type: t.type, color: t.color, icon: t.icon,
    display_order: t.order, user_id: userId,
  }));
  const { data: l1Data, error: l1Err } = await sb.from('categories').insert(l1Rows).select();
  if (l1Err) { console.error('L1 insert error:', l1Err.message); process.exit(1); }
  console.log(`Inserted ${l1Data.length} L1 categories`);

  // Build name → id map for L1
  const l1Map = {};
  for (const row of l1Data) l1Map[row.name] = row.id;

  // 4. Seed L2 categories
  const l2Rows = [];
  for (const t of TAXONOMY) {
    const parentId = l1Map[t.name];
    t.children.forEach((child, i) => {
      l2Rows.push({
        name: child, type: t.type, color: t.color, icon: t.icon,
        parent_id: parentId, display_order: i + 1, user_id: userId,
      });
    });
  }
  const { data: l2Data, error: l2Err } = await sb.from('categories').insert(l2Rows).select();
  if (l2Err) { console.error('L2 insert error:', l2Err.message); process.exit(1); }
  console.log(`Inserted ${l2Data.length} L2 categories`);

  // Build { l1Name_l2Name → id } map
  const l2Map = {};
  for (const row of l2Data) {
    const parentName = TAXONOMY.find(t => l1Map[t.name] === row.parent_id)?.name;
    if (parentName) l2Map[`${parentName}|${row.name}`] = row.id;
  }

  // 5. Fetch all transactions
  const { data: txns } = await sb.from('transactions').select('id,note,type').eq('user_id', userId);
  console.log(`\nRe-categorizing ${txns.length} transactions...`);

  // 6. Build updates
  let updated = 0;
  const updates = txns.map(tx => {
    const merchant = tx.note?.split('|')[1] ?? '';
    const { l1, l2 } = resolveCategory(merchant, tx.type);
    const catId = l2Map[`${l1}|${l2}`] ?? l1Map[l1] ?? null;
    return { id: tx.id, category_id: catId, _l1: l1, _l2: l2 };
  });

  // Update in batches
  for (const u of updates) {
    const { error } = await sb.from('transactions').update({ category_id: u.category_id }).eq('id', u.id);
    if (error) console.error(`  Failed ${u.id}:`, error.message);
    else updated++;
  }

  // 7. Summary
  const summary = {};
  for (const u of updates) {
    const key = `${u._l1} → ${u._l2}`;
    summary[key] = (summary[key] || 0) + 1;
  }

  console.log(`\nUpdated ${updated}/${txns.length} transactions`);
  console.log('\nCategory breakdown:');
  Object.entries(summary)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k.padEnd(40)} ${v} txns`));
}

main().catch(console.error);
