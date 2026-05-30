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
- **Data Persistence**: Spark KV Store (browser-based)

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

1. Place images in `src/assets/images/products/`
2. Import in your component:
   ```typescript
   import garamMasala from '@/assets/images/products/garam-masala.jpg'
   ```
3. Use in your product data initialization

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
