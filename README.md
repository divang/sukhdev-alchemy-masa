# Sukhdev Alchemy - Premium Masala E-Commerce

A sophisticated e-commerce platform for selling premium masalas and organic spices, built with React, TypeScript, and Tailwind CSS.

## 🌟 Features

- ✅ **Category Navigation** - Feature-flagged categories (Premium Masala, Raw Organic Spices, BYOM)
- ✅ **Product Catalog** - Beautiful product grid with details, ratings, and reviews
- ✅ **Shopping Cart** - Customizable gram quantities (100g, 250g, 500g, 1kg)
- ✅ **Checkout Flow** - Complete order booking with customer details
- ✅ **UPI Payment** - Payment page with UPI integration
- ✅ **Order Tracking** - Real-time order status tracking
- ✅ **Customer Testimonials** - Social proof and reviews
- ✅ **Responsive Design** - Mobile-first, works beautifully on all devices

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🧾 Supabase Order Persistence (Free Tier)

This project now supports cloud order persistence via Supabase while keeping local browser fallback.

### 1. Create a Supabase account

1. Go to https://supabase.com and click Start your project.
2. Sign in with GitHub (recommended).
3. Click New project.
4. Choose your organization.
5. Enter:
  - Project name: `sukhdevi-orders` (or any name)
  - Database password: choose a strong password and save it
  - Region: pick nearest to your users
6. Click Create new project and wait for provisioning.

### 2. Get project credentials

1. Open your Supabase project dashboard.
2. Go to Project Settings -> API.
3. Copy:
  - Project URL
  - `anon` public key

Create a `.env` file in project root (you can copy from `.env.example`):

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### 3. Create the orders table

In Supabase SQL Editor, run:

```sql
create table if not exists public.orders (
  id text primary key,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  customer_address text not null,
  customer_city text not null,
  customer_pincode text not null,
  items jsonb not null,
  total_amount numeric(10,2) not null,
  status text not null check (status in ('pending', 'processing', 'shipped', 'delivered')),
  payment_status text not null check (payment_status in ('pending', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 4. Enable write access for demo websites

For a basic public demo, run this in SQL Editor:

```sql
alter table public.orders enable row level security;

create policy "Allow anon insert" on public.orders
for insert to anon
with check (true);

create policy "Allow anon update" on public.orders
for update to anon
using (true)
with check (true);

create policy "Allow anon select" on public.orders
for select to anon
using (true);
```

Important: this is open access suitable only for basic/demo usage. For production, secure with auth and stricter RLS.

### 5. Secure Launch RLS (recommended)

For initial public launch, use strict policies where frontend (`anon`) can only create pending orders.

1. Run SQL from [supabase/sql/001_orders_secure_launch.sql](supabase/sql/001_orders_secure_launch.sql).
2. Keep this in `.env`:

```bash
VITE_ALLOW_CLIENT_ORDER_UPDATES=false
```

With this mode:
- Frontend can create new pending orders.
- Frontend cannot directly update payment or order status in DB.
- Trusted backend/service_role can update status later.

Validation note:
- In strict launch mode, anon role has no `select` privilege on `orders`.
- Writes should use minimal return semantics (for example `Prefer: return=minimal`).
- If a client requests representation data on insert/update, Supabase may return permission errors because row read access is intentionally blocked.

## 📄 Google Sheets Order Persistence (No VM / No Lambda)

If you want simpler operations than database + RLS, you can store orders in Google Sheets using a Google Apps Script Web App API.

### 1. Create a Google Sheet

Create columns in row 1:

`id, created_at, updated_at, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_pincode, total_amount, status, payment_status, items_json`

### 2. Add Apps Script

In the Sheet: Extensions -> Apps Script. Paste this code:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const payload = JSON.parse(e.postData.contents || '{}');

  if (payload.action === 'create_order' && payload.order) {
    const o = payload.order;
    sheet.appendRow([
      o.id,
      o.createdAt,
      o.updatedAt,
      o.customer.name,
      o.customer.email,
      o.customer.phone,
      o.customer.address,
      o.customer.city,
      o.customer.pincode,
      o.totalAmount,
      o.status,
      o.paymentStatus,
      JSON.stringify(o.items)
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  }

  if ((payload.action === 'update_payment' || payload.action === 'update_status') && payload.orderId) {
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === payload.orderId) {
        if (payload.paymentStatus) sheet.getRange(i + 1, 12).setValue(payload.paymentStatus);
        if (payload.status) sheet.getRange(i + 1, 11).setValue(payload.status);
        sheet.getRange(i + 1, 3).setValue(payload.updatedAt || new Date().toISOString());
        return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Order not found' })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Invalid payload' })).setMimeType(ContentService.MimeType.JSON);
}
```

### 3. Deploy as Web App

1. Click Deploy -> New deployment.
2. Type: Web app.
3. Execute as: Me.
4. Who has access: Anyone.
5. Deploy and copy the Web App URL.

### 4. Configure frontend

Set in `.env`:

```bash
VITE_GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

Notes:
- If `VITE_GOOGLE_SHEETS_WEBHOOK_URL` is configured, the app uses Google Sheets first.
- If not configured, it falls back to Supabase.
- Browser local order history remains enabled as a fallback.

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # Shadcn UI components
│   ├── CartDrawer.tsx
│   ├── CategorySidebar.tsx
│   ├── CheckoutView.tsx
│   ├── ProductCard.tsx
│   └── ...
├── lib/
│   ├── types.ts        # TypeScript type definitions
│   └── utils.ts        # Utility functions
├── hooks/              # Custom React hooks
├── assets/             # Static assets (images, etc.)
├── App.tsx            # Main application component
└── index.css          # Global styles and theme
```

## 🎨 Tech Stack

- **Framework**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Shadcn UI (Radix UI)
- **Icons**: Phosphor Icons
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Zod
- **Notifications**: Sonner
- **Data Persistence**: Spark KV Store (browser-based) + optional Supabase cloud sync

## 🎯 Current Status

This is a **Spark application** - a fully functional frontend prototype with browser-based data storage. It's perfect for:
- ✅ Demo and prototyping
- ✅ Testing user flows
- ✅ Showcasing design
- ✅ Frontend development

**Note**: For production use with real customers, you'll need to connect this frontend to your Java backend and database.

## 🌐 Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete instructions on deploying to https://sukhdevialchemy.com/

### Quick Deploy Options:
1. **Netlify** - Drag & drop `dist` folder (after `npm run build`)
2. **Vercel** - Connect your GitHub repository
3. **GitHub Pages** - Push to GitHub and enable Pages
4. **Traditional Hosting** - Upload `dist` folder contents to your web host

## 📸 Adding Your Product Images

For production-safe image paths, use one of these:

1. Put files in `public/images/products/` and set `image: 'images/products/garam-masala-premium.jpg'`
2. Import files from `src/assets/images/products/` and assign the imported value to `image`
3. Use a full CDN URL such as `https://...`

Do not use a local filesystem path like `C:\Users\...` or `/home/...` because it will not work on deployed websites.

The current seeded product data already points to files under `public/images/products/`.

## 🔧 Configuration

### Theme Customization
Edit colors in `src/index.css`:
```css
:root {
  --primary: oklch(0.65 0.18 45);    /* Deep Saffron */
  --secondary: oklch(0.55 0.15 35);  /* Rich Terracotta */
  --accent: oklch(0.78 0.15 85);     /* Golden Turmeric */
  /* ... more colors */
}
```

### Category Feature Flags
Categories can be enabled/disabled in the data. See category type in `src/lib/types.ts`:
```typescript
type Category = {
  id: string
  name: string
  enabled: boolean  // Toggle this
  slug: string
}
```

## 🗄️ Data Structure

This app uses Spark KV Store for data persistence. Key data structures:

- **Categories**: Product categories with feature flags
- **Products**: Product catalog with details
- **Cart**: Shopping cart items
- **Orders**: Order history and tracking
- **Reviews**: Customer reviews (per product)
- **Testimonials**: General customer testimonials

All data persists in the browser's storage and is user-specific.

## 📱 Responsive Design

- **Desktop**: Full sidebar navigation, 2-column product grid
- **Tablet**: Collapsible sidebar, 2-column grid
- **Mobile**: Hamburger menu, single-column grid, bottom sheet cart

## 🔐 Production Readiness Checklist

To make this production-ready for real e-commerce:

- [ ] Connect to Java backend APIs
- [ ] Integrate with MySQL/PostgreSQL database
- [ ] Add user authentication (login/signup)
- [ ] Implement real payment gateway (Razorpay/PayU)
- [ ] Add email notifications
- [ ] Add SMS notifications (OTP, order updates)
- [ ] Set up admin panel for order management
- [ ] Configure image CDN (Cloudinary/S3)
- [ ] Add analytics tracking
- [ ] Implement SEO optimization
- [ ] Add rate limiting and security
- [ ] Set up monitoring and error tracking

## 📚 Documentation

- [PRD.md](./PRD.md) - Product Requirements Document
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Deployment Instructions
- [SECURITY.md](./SECURITY.md) - Security Guidelines

## 🤝 Contributing

This is a custom project for Sukhdev Alchemy. For questions or support, please contact the development team.

## 📄 License For Spark Template Resources 

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.
