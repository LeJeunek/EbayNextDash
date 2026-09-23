# eBay Seller Dashboard

A full-stack Next.js dashboard for managing your eBay listings, tracking orders by ID, and visualizing 30-day sales profit.

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Auth | NextAuth.js v4 + eBay OAuth2 |
| Database | PostgreSQL via Prisma ORM |
| Charts | Recharts |
| Styling | CSS Modules |

---

## Setup Guide

### 1. Clone & Install

```bash
git clone <your-repo>
cd ebay-dashboard
npm install
```

### 2. Set Up Database

Use any PostgreSQL provider (recommended: [Supabase](https://supabase.com), [Railway](https://railway.app), or [Neon](https://neon.tech)).

```bash
# Copy env file
cp .env.local.example .env.local
# Edit DATABASE_URL with your connection string
```

### 3. Set Up eBay Developer App

1. Go to [https://developer.ebay.com/my/keys](https://developer.ebay.com/my/keys)
2. Create a new application (choose **Sandbox** for testing, **Production** for real data)
3. Copy your **App ID (Client ID)** and **Cert ID (Client Secret)**
4. In your app settings, add the OAuth redirect URI:
   ```
   http://localhost:3000/api/auth/callback/ebay
   ```
   For production:
   ```
   https://yourdomain.com/api/auth/callback/ebay
   ```
5. Copy your **RuName** (same page, under **User Tokens**) into `EBAY_RUNAME`.
   eBay uses the RuName as the `redirect_uri` value in both OAuth steps — the
   callback URL above is what the RuName *maps to*, not what you send.
6. Under **Auth Accepted Scopes**, enable:
   - `https://api.ebay.com/oauth/api_scope`
   - `https://api.ebay.com/oauth/api_scope/sell.inventory`
   - `https://api.ebay.com/oauth/api_scope/sell.fulfillment`
   - `https://api.ebay.com/oauth/api_scope/sell.account`

### 4. Configure Environment Variables

Edit `.env.local`:

```env
DATABASE_URL="postgresql://user:password@host:5432/ebay_dashboard"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="run: openssl rand -base64 32"

EBAY_CLIENT_ID="your-app-id-from-developer-portal"
EBAY_CLIENT_SECRET="your-cert-id-from-developer-portal"

# The RuName from your app's "User Tokens" section — NOT a URL. eBay expects
# this as redirect_uri in both the authorize and token steps; a missing or
# wrong value fails sign-in with an opaque 400.
EBAY_RUNAME="your-runame"

# Optional. Defaults to the scopes this app actually calls. eBay rejects the
# whole authorize request if any requested scope is not enabled for your app,
# so only widen this to scopes you have approved in the portal.
# EBAY_SCOPES="space separated scopes"

# Use sandbox for testing:
EBAY_ENVIRONMENT="sandbox"
EBAY_AUTH_URL="https://auth.sandbox.ebay.com/oauth2/authorize"
EBAY_TOKEN_URL="https://api.sandbox.ebay.com/identity/v1/oauth2/token"
EBAY_API_BASE="https://api.sandbox.ebay.com"

# Switch to production when ready:
# EBAY_AUTH_URL="https://auth.ebay.com/oauth2/authorize"
# EBAY_TOKEN_URL="https://api.ebay.com/identity/v1/oauth2/token"
# EBAY_API_BASE="https://api.ebay.com"
```

### 5. Run Database Migrations

> **The Prisma CLI reads `.env`, not `.env.local`.** Next.js reads
> `.env.local`, so the two need the connection string in different places.
> Without a `.env`, `db:push` fails with
> `P1012: Environment variable not found: DATABASE_URL` even though the app
> itself runs fine. Simplest fix — give the CLI its own file:
>
> ```bash
> echo 'DATABASE_URL="<same value as in .env.local>"' > .env
> echo 'DIRECT_URL="<the non-pooled value>"' >> .env
> ```
>
> Both files are gitignored.

**Two connection strings.** `DATABASE_URL` is the pooled connection the app
uses at runtime; `DIRECT_URL` is the same database without the pooler, which
Prisma uses for `db push` and migrations. A transaction-mode pooler
(PgBouncer) cannot run DDL reliably, which shows up as a hang or a baffling
error rather than a clean failure.

| Provider | Pooled (`DATABASE_URL`) | Direct (`DIRECT_URL`) |
|----------|-------------------------|------------------------|
| Neon     | host contains `-pooler` | drop `-pooler`         |
| Supabase | port `6543`             | port `5432`            |

Not behind a pooler? Set both to the same value. `prisma generate` does not
read `DIRECT_URL`, so a build with only `DATABASE_URL` still succeeds — but
`npm run db:push` will fail with
`P1012: Environment variable not found: DIRECT_URL`.

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database
# Optional: seed/view data
npm run db:studio
```

> Already deployed? The inventory ledger adds one table (`InventoryItem`) and
> one enum (`InventoryStatus`). Re-run `npm run db:push` (or
> `npm run db:migrate`) against your database before deploying — nothing
> existing is altered, so no data migration is needed.

### 6. Run the App

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Features

### 🏠 Dashboard Overview
- Welcome with your eBay username
- At-a-glance stats: active listings, total orders, 30-day revenue & profit
- Recent orders table

### 📦 Listings
- View all current listings in a card grid
- Create new listings (pushed to eBay API)
- Sync from eBay with one click
- Delete listings (removes from eBay too)
- Status badges: ACTIVE, ENDED, SOLD, DRAFT, SUSPENDED

### 🧾 Orders
- Full order table with `orderId` as the primary key
- Click any row for a detail drawer (profit breakdown, tracking, buyer info)
- Search by order ID, item title, or buyer username
- Filter by status
- Sync orders from the last 30 days from eBay

### 🧮 Inventory & Profit  — `/dashboard/inventory`
The hand-kept ledger of what you bought to resell. One row per item, with
**original cost**, **sell price**, **packing cost**, shipping, eBay fees and
other costs — and a **profit** column computed from all of them.

- **Edit in place.** Click any cell and type; it saves on blur or Enter,
  Escape reverts. Nothing is a modal.
- **Add by hand** with the "+ Add Item" form, or bulk-load:
  - **↓ From eBay orders** — turns orders you have already synced into
    inventory rows (sale price, shipping and fees come across; original cost
    and packing are left at 0 for you to fill in, since eBay never knew them).
    Re-running it will not duplicate rows.
  - **⇪ Import CSV** — paste a spreadsheet export. Only `Title` is required;
    common header spellings (`Item`, `Cost`, `Sold For`, `Packaging`,
    `Date Sold`, …) are recognised, and `$1,234.56` parses fine.
- **Filter** by tax year (the year the item *sold*), status, or a search over
  title / SKU / category / source / notes. Every total and both exports follow
  the filter you are looking at.
- **⇩ Export CSV** for your own spreadsheet or your accountant.

### 🖨 Printable summary — `/print/inventory`
A compact one-page **Sales & Cost Summary** for tax paperwork: gross sales,
cost of goods, packing, shipping, fees, total expenses and net profit, above a
numbered line-item table. Hit **Print / Save as PDF** and pick "Save as PDF" as
the destination to get a file.

The page respects the same `?year=` / `?status=` / `?q=` filters as the
inventory table, so `/print/inventory?year=2026` prints just that tax year.

> A W-9 itself only collects your name and TIN — it has no income or expense
> lines. This summary is the supporting arithmetic you actually need when
> filling in a Schedule C or reconciling a 1099-K. It is a working record, not
> a filed tax document.

### 📈 Sales Analytics
- Area or bar chart: Revenue & Profit over last 7 / 14 / 30 / 90 days
- Summary cards: Total Revenue, Profit, Margin %, eBay Fees, Orders, Avg Order Value
- Per-user — each seller sees only their own data

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth route
│   │   ├── inventory/            # GET/POST + [id], /import, /export
│   │   ├── listings/             # GET, POST + [id] PATCH/DELETE
│   │   ├── orders/               # GET with optional eBay sync
│   │   └── sales/                # Analytics aggregation
│   ├── dashboard/
│   │   ├── layout.tsx            # Auth guard + sidebar
│   │   ├── page.tsx              # Overview
│   │   ├── inventory/page.tsx    # Editable cost/profit ledger
│   │   ├── listings/page.tsx
│   │   ├── orders/page.tsx
│   │   └── sales/page.tsx
│   ├── print/inventory/page.tsx  # Print/PDF summary (no sidebar)
│   ├── login/page.tsx            # eBay OAuth landing
│   └── globals.css               # Design tokens
├── components/
│   ├── Sidebar.tsx
│   └── StatCard.tsx
├── lib/
│   ├── auth.ts                   # NextAuth config with eBay provider
│   ├── prisma.ts                 # Prisma singleton
│   ├── inventory.ts              # Profit maths, CSV, shared query filter
│   └── ebay.ts                   # eBay API client + helpers
└── types/next-auth.d.ts          # Session type augmentation

prisma/
└── schema.prisma                 # User, Account, Listing, Order, InventoryItem
```

---

## Deploying to Production

1. Deploy to [Vercel](https://vercel.com) (recommended for Next.js)
2. Set all environment variables in Vercel's dashboard
3. Update `NEXTAUTH_URL` to your production URL
4. Update the eBay redirect URI in your developer portal
5. Switch `EBAY_*` URLs to production endpoints
6. Run `npm run db:migrate` against your production DB

---

## Notes

- **Multi-user**: All data is scoped to `userId` — any eBay seller who logs in sees only their own listings, orders, and sales.
- **Sync vs. Local**: The dashboard stores a local copy in Postgres for fast queries. Use the "Sync from eBay" button to pull the latest data.
- **Two profit numbers, on purpose**:
  - `Order.profit` (Orders, Sales) is `salePrice - shippingCost - ebayFee`.
    It comes from eBay, which never knows what you paid for the item.
  - `InventoryItem` profit (Inventory, printable summary) is
    `sellPrice - (originalCost + packingCost + shippingCost + ebayFee + otherCost)`.
    This is the real number, because you supply the cost side.

  The inventory figure is **derived on read, never stored**, so it cannot drift
  out of sync with the fields it is computed from.
- **Unsold rows**: an item with no sell price has a profit of `null` and prints
  as `—` rather than a misleading negative. Its invested cost is still tracked
  and shown as "tied up in N unsold".
- **Tax year** means the year the item *sold*, so unsold rows only appear under
  "All years".
