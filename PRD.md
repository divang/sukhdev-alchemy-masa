# Sukhdev Alchemy - Premium Masala E-Commerce Platform

A sophisticated e-commerce platform for selling premium masalas and organic spices with a seamless shopping experience from browsing to order tracking.

**Experience Qualities**:
1. **Trustworthy** - Professional design with authentic product information, customer reviews, and transparent ingredient lists builds confidence in quality
2. **Intuitive** - Clear navigation, straightforward cart operations, and smooth checkout flow make purchasing effortless
3. **Authentic** - Rich cultural aesthetic with warm colors and traditional elements reflects the heritage of Indian spices

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
This is a full-featured e-commerce platform with product catalog, cart management, checkout flow, payment integration, order tracking, reviews, and feature flag system for gradual category rollout.

## Essential Features

### Feature-Flagged Category Navigation
- **Functionality**: Left sidebar with toggleable product categories (Premium Masala, Raw Organic Spices, BYOM)
- **Purpose**: Allow phased rollout of product categories as inventory and features are developed
- **Trigger**: User clicks category in sidebar
- **Progression**: Click category → Filter products → Display category-specific items → Update active state
- **Success criteria**: Categories can be enabled/disabled via admin settings, filtered products display correctly

### Product Grid Display
- **Functionality**: 2-column responsive grid showing 4 premium masala products with images, names, prices, and ratings
- **Purpose**: Present products in an organized, scannable format that highlights key information
- **Trigger**: Page load or category selection
- **Progression**: Load products → Render grid → Display product cards → Enable interactions
- **Success criteria**: Products display with proper spacing, images load, ratings visible, responsive on mobile

**Current Product Lineup**:
1. Garam Masala Premium Blend - ₹350/100g
2. Bharwa Masala Premium - ₹300/100g
3. Chat Masala Premium - ₹330/100g
4. Chhole Masala Premium - ₹330/100g

### Product Detail View
- **Functionality**: Detailed product page with ingredients, YouTube video link, reviews, ratings, and add-to-cart
- **Purpose**: Provide comprehensive information to help customers make informed purchase decisions
- **Trigger**: Click "Details" link on product card
- **Progression**: Click details → Navigate to detail view → Display ingredients, video, reviews → Select quantity → Add to cart
- **Success criteria**: All product information displays, video link opens correctly, quantity selection works, cart updates

### Shopping Cart with Gram Selection
- **Functionality**: Cart displays selected products with customizable gram quantities (100g, 250g, 500g, 1kg options)
- **Purpose**: Allow customers to purchase desired quantities before checkout
- **Trigger**: Click "Add to Cart" or view cart icon
- **Progression**: Add item → Select grams → Update quantity → Calculate total → Proceed to checkout
- **Success criteria**: Cart persists across sessions, quantities update prices correctly, removal works

### Order Booking Flow
- **Functionality**: Multi-step checkout with customer details, delivery address, and order summary
- **Purpose**: Collect necessary information for order fulfillment
- **Trigger**: Click "Checkout" in cart
- **Progression**: View cart → Enter details → Confirm address → Review order → Submit
- **Success criteria**: Form validation works, data persists between steps, order creates successfully

### UPI Payment Integration
- **Functionality**: Payment page with UPI ID display and payment confirmation
- **Purpose**: Enable digital payments through popular UPI apps
- **Trigger**: Submit order from checkout
- **Progression**: Complete checkout → Display UPI details → Customer pays externally → Confirm payment → Generate order ID
- **Success criteria**: UPI ID displays, payment instructions clear, order confirms after payment

### Order Tracking
- **Functionality**: View order status with tracking information (Pending, Processing, Shipped, Delivered)
- **Purpose**: Keep customers informed about their order progress
- **Trigger**: Access tracking page with order ID or view past orders
- **Progression**: Enter order ID → Fetch order → Display status timeline → Show delivery details
- **Success criteria**: Order status displays accurately, timeline shows progress, updates reflect correctly

### Customer Reviews and Testimonials
- **Functionality**: Display customer testimonials at page bottom, show product-specific reviews on detail pages
- **Purpose**: Build trust through social proof and authentic customer feedback
- **Trigger**: Scroll to testimonials section or view product details
- **Progression**: Load testimonials → Display ratings → Show review text → Enable pagination if needed
- **Success criteria**: Testimonials display with ratings, reviews show on correct products, formatting is readable

## Edge Case Handling

- **Empty Cart Checkout**: Display friendly message with "Continue Shopping" button when cart is empty
- **Out of Stock Items**: Show "Notify Me" button instead of "Add to Cart" when stock is unavailable
- **Invalid Order ID**: Show error message with option to browse products when tracking unknown order
- **Disabled Categories**: Hide or show "Coming Soon" badge for feature-flagged categories that are off
- **Network Failures**: Show toast notifications for failed operations with retry options
- **Invalid Quantities**: Prevent adding zero or negative quantities to cart
- **Payment Timeout**: Provide clear instructions to retry payment or contact support
- **Duplicate Cart Items**: Merge quantities when same product added multiple times

## Design Direction

The design should evoke warmth, authenticity, and premium quality - like stepping into a traditional spice bazaar elevated with modern sophistication. Rich earthy tones, elegant typography, and subtle Indian-inspired patterns create a shopping experience that feels both culturally rooted and contemporary. The interface should feel tactile and organic, with smooth interactions that mirror the careful craft of spice blending.

## Color Selection

A warm, earthy palette inspired by spices themselves - burnt orange, deep reds, rich browns, and golden yellows balanced with neutral backgrounds for readability.

- **Primary Color**: Deep Saffron (oklch(0.65 0.18 45)) - Communicates warmth, tradition, and premium quality like the prized spice itself
- **Secondary Colors**: 
  - Rich Terracotta (oklch(0.55 0.15 35)) - Earthy, grounding accent for secondary actions
  - Warm Cream (oklch(0.96 0.02 75)) - Soft background that doesn't compete with products
- **Accent Color**: Golden Turmeric (oklch(0.78 0.15 85)) - Bright, appetizing highlight for CTAs and important elements
- **Foreground/Background Pairings**:
  - Primary (Deep Saffron oklch(0.65 0.18 45)): White text (oklch(0.99 0 0)) - Ratio 5.1:1 ✓
  - Accent (Golden Turmeric oklch(0.78 0.15 85)): Dark Brown text (oklch(0.25 0.05 40)) - Ratio 8.2:1 ✓
  - Background (Warm Cream oklch(0.96 0.02 75)): Rich Brown text (oklch(0.28 0.04 35)) - Ratio 11.5:1 ✓
  - Secondary (Rich Terracotta oklch(0.55 0.15 35)): White text (oklch(0.99 0 0)) - Ratio 6.8:1 ✓

## Font Selection

Typography should blend traditional warmth with modern clarity - a serif for headings that conveys heritage and craftsmanship paired with a clean sans-serif for readability in product details and UI elements.

- **Typographic Hierarchy**:
  - H1 (Site Title): Playfair Display Bold/36px/tight letter-spacing/-0.02em - Elegant, traditional feel
  - H2 (Section Headers): Playfair Display SemiBold/28px/normal letter-spacing
  - H3 (Product Names): Playfair Display Medium/22px/normal letter-spacing
  - Body (Product Details): Inter Regular/16px/line-height 1.6
  - UI Elements (Buttons, Labels): Inter Medium/14px/line-height 1.4
  - Small Text (Prices, Meta): Inter SemiBold/13px/tracking-wide

## Animations

Animations should feel organic and unhurried, like the gentle settling of ground spices. Use subtle fade-ins for content loading, smooth scale transforms for hover states on product cards (1.02x), and gentle slide transitions when navigating between pages. Cart additions should have a satisfying bounce effect. Keep timings between 200-400ms with ease-out curves to maintain a premium, refined feel without slowing down the shopping experience.

## Component Selection

- **Components**:
  - **Sidebar**: Custom component with collapsible sections and badge indicators for feature flags
  - **Card**: Shadcn Card for product display with hover effects and custom image containers
  - **Dialog**: For product detail modal views with scroll areas for long ingredient lists
  - **Button**: Primary (filled saffron), Secondary (outlined terracotta), Ghost for less prominent actions
  - **Badge**: For "New", "Organic", "Coming Soon", category tags with custom color variants
  - **Form**: React Hook Form with Shadcn Input, Label, Textarea for checkout
  - **Select**: Quantity/gram selection with custom styling
  - **Tabs**: For switching between product details, reviews, ingredients
  - **Separator**: Subtle dividers between sections using border-border
  - **Sheet**: Mobile drawer for cart and navigation
  - **Toast**: Sonner for add-to-cart confirmations and error messages
  - **Scroll Area**: For long review lists and ingredient sections
  - **Progress**: For order tracking status indicator
  
- **Customizations**:
  - **Product Card Component**: Custom with image zoom effect, rating stars display, price formatting
  - **Quantity Selector**: Custom button group for gram selection (100g/250g/500g/1kg)
  - **Review Card**: Custom layout with avatar, rating stars, date, and review text
  - **Order Timeline**: Custom stepper component showing order status progression
  - **Category Badge**: Custom badge with feature flag indicator dot
  
- **States**:
  - **Buttons**: Default with shadow, hover lifts slightly with deeper shadow, active scales down 0.98x, disabled faded 50%
  - **Product Cards**: Default flat, hover shadow-lg with 2px lift, active maintains hover state
  - **Inputs**: Default border-input, focus ring-2 ring-primary/20 with border-primary, error border-destructive with shake animation
  - **Cart Icon**: Pulse animation when item added, badge shows count
  
- **Icon Selection**:
  - ShoppingCart, Plus, Minus for cart operations
  - Star, StarHalf for ratings
  - MapPin for location/delivery
  - Package for order tracking
  - CreditCard for payment
  - Eye for view details
  - X for close/remove
  - Check for confirmations
  - Truck for delivery status
  
- **Spacing**:
  - Page padding: px-4 md:px-8 lg:px-12
  - Section gaps: gap-8 (32px) for major sections, gap-4 (16px) within components
  - Card padding: p-6 for content, p-4 for compact cards
  - Button padding: px-6 py-3 for primary, px-4 py-2 for secondary
  - Grid gaps: gap-6 for product grid, gap-3 for form fields
  
- **Mobile**:
  - Sidebar collapses to hamburger menu in Sheet component
  - Product grid switches from 2 columns to 1 column below 768px
  - Cart becomes bottom sheet on mobile
  - Sticky header with mobile-optimized cart icon
  - Touch-friendly buttons (min 44px height)
  - Simplified product cards with essential info only on mobile
  - Order tracking timeline switches to vertical layout

## Deployment Notes

This application is built as a Spark application with client-side data persistence. See `DEPLOYMENT_GUIDE.md` for complete deployment instructions to https://sukhdevialchemy.com/.

### Current Architecture
- **Frontend**: React + TypeScript (this application)
- **Data Storage**: Spark KV (browser-based, per-user)
- **Hosting**: Static hosting (Netlify, Vercel, GitHub Pages recommended)

### Production Migration Path
For production e-commerce, this frontend will be connected to:
- **Backend**: Java microservices (planned)
- **Database**: MySQL/PostgreSQL (planned)
- **Payment Gateway**: Razorpay/PayU integration (planned)
- **Image CDN**: Cloudinary or AWS S3 (planned)

### Adding Product Images
Place product images in `src/assets/images/products/` and import them in your data initialization code. See deployment guide for details.
