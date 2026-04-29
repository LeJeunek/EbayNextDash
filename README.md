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
5. Under **Auth Accepted Scopes**, enable:
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

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database
# Optional: seed/view data
npm run db:studio
```

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
│   │   ├── listings/             # GET, POST + [id] PATCH/DELETE
│   │   ├── orders/               # GET with optional eBay sync
│   │   └── sales/                # Analytics aggregation
│   ├── dashboard/
│   │   ├── layout.tsx            # Auth guard + sidebar
│   │   ├── page.tsx              # Overview
│   │   ├── listings/page.tsx
│   │   ├── orders/page.tsx
│   │   └── sales/page.tsx
│   ├── login/page.tsx            # eBay OAuth landing
│   └── globals.css               # Design tokens
├── components/
│   ├── Sidebar.tsx
│   └── StatCard.tsx
├── lib/
│   ├── auth.ts                   # NextAuth config with eBay provider
│   ├── prisma.ts                 # Prisma singleton
│   └── ebay.ts                   # eBay API client + helpers
└── types/next-auth.d.ts          # Session type augmentation

prisma/
└── schema.prisma                 # User, Account, Listing, Order models
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
- **Profit calculation**: `profit = salePrice - shippingCost - ebayFee`. You can add item cost tracking to `Order` for a more accurate net margin.
