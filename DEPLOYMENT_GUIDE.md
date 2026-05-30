# Deployment Guide for Sukhdev Alchemy

## Important: Understanding This Application

This is a **Spark application** - a special type of web application that runs entirely in the browser. It uses:
- **React** for the user interface
- **Spark KV Store** for data persistence (stores data in browser)
- **No traditional backend** - all data is stored client-side

⚠️ **This means**: 
- Data is stored in the user's browser only
- Each visitor sees their own data
- No shared database between users
- Perfect for prototyping and personal use
- **Not suitable for production e-commerce** without modifications

## Deploying to sukhdevialchemy.com

Since this is a Spark application with browser-based storage, you have several deployment options:

### Option 1: GitHub Pages (Recommended - Free & Easy)

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/sukhdev-alchemy.git
   git push -u origin main
   ```

2. **Build the application**:
   ```bash
   npm run build
   ```

3. **Deploy to GitHub Pages**:
   - Go to your repository settings
   - Navigate to "Pages" section
   - Select "Deploy from a branch"
   - Choose "main" branch and "/docs" or "/dist" folder
   - Save

4. **Configure Custom Domain**:
   - In GitHub Pages settings, add `sukhdevialchemy.com` as custom domain
   - In your domain registrar (where you bought the domain):
     - Add a CNAME record pointing to `YOUR_USERNAME.github.io`
     - Or add A records pointing to GitHub's IPs:
       - 185.199.108.153
       - 185.199.109.153
       - 185.199.110.153
       - 185.199.111.153

### Option 2: Netlify (Recommended - Free with CI/CD)

1. **Create account** at https://netlify.com

2. **Connect your repository** or drag & drop your build folder

3. **Build settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`

4. **Configure custom domain**:
   - In Netlify: Add custom domain `sukhdevialchemy.com`
   - In your domain registrar, add Netlify's nameservers or:
     - CNAME record: `www` → `YOUR_SITE.netlify.app`
     - A record: `@` → Netlify's Load Balancer IP

### Option 3: Vercel (Recommended - Free with CI/CD)

1. **Create account** at https://vercel.com

2. **Import your Git repository**

3. **Build settings** (auto-detected):
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Add custom domain**:
   - In Vercel dashboard: Add `sukhdevialchemy.com`
   - Follow DNS configuration instructions
   - CNAME record: `www` → `cname.vercel-dns.com`
   - A record: `@` → `76.76.21.21`

### Option 4: Traditional Web Hosting (cPanel, etc.)

1. **Build your application locally**:
   ```bash
   npm run build
   ```

2. **Upload files**:
   - The `dist` folder contains all your static files
   - Upload everything inside `dist/` to your web host's public directory
   - Usually named `public_html`, `www`, or `htdocs`

3. **Configure domain**:
   - Point your domain to your hosting provider
   - Follow their specific DNS instructions

## Post-Deployment Configuration

### SSL Certificate (HTTPS)
- GitHub Pages: Automatic with custom domain
- Netlify/Vercel: Automatic Let's Encrypt SSL
- Traditional hosting: Enable through cPanel or contact support

### Testing After Deployment
1. Visit https://sukhdevialchemy.com
2. Test adding products to cart
3. Test order flow
4. Verify data persists after page reload
5. Test on mobile devices

## Adding Your Own Product Images

Currently the app uses placeholder data. To add your own images:

### Method 1: Use the `public/` Folder (Recommended for deployed websites)

This is the simplest option when you want image paths to work both locally and after deployment.

1. **Create a public images folder**:
    ```
    public/
       images/
          products/
             garam-masala.jpg
             chat-masala.jpg
             rajma-masala.jpg
             pav-bhaji-masala.jpg
    ```

2. **Store relative paths in product data**:
    ```typescript
    const products = [
       {
          id: 'garam-masala-premium',
          name: 'Garam Masala Premium Blend',
          image: 'images/products/garam-masala-premium.jpg',
          // ...rest of product data
       }
    ]
    ```

    In this project, put your files here:
    ```
    public/images/products/
    ```

    The current seeded products expect these filenames:
    - `garam-masala-premium.jpg`
    - `bharwa-masala-premium.jpg`
    - `chat-masala-premium.jpg`
    - `chhole-masala-premium.jpg`

3. **Why this works**:
    - Vite copies everything in `public/` into the final build unchanged
    - The app can serve the same files locally and on your public website
    - Relative public paths are safer than hard-coded local filesystem paths like `C:\\photos\\masala.jpg`

### Method 2: Import Local Images From `src/assets/`

1. **Add images to your project**:
   ```
   src/
     assets/
       images/
         products/
           garam-masala.jpg
           chaat-masala.jpg
           rajma-masala.jpg
           pav-bhaji-masala.jpg
   ```

2. **Update the data initialization code** (you'll need to create a setup script):
   ```typescript
   import garamMasala from '@/assets/images/products/garam-masala.jpg'
   import chaatMasala from '@/assets/images/products/chaat-masala.jpg'
   // ... import other images
   
   const products = [
     {
       id: 'gm001',
       name: 'Garam Masala',
       image: garamMasala,
       // ... rest of product data
     }
   ]
   ```

This is also valid for production because Vite fingerprints the file and rewrites the final URL during build.

### Method 3: Use External URLs

If you have images hosted elsewhere (like Cloudinary, S3, etc.):
- Use full URLs: `https://your-image-host.com/garam-masala.jpg`
- Update product data with these URLs

### Method 4: Admin Uploads in This Spark App

- The Admin Panel currently stores uploaded images in browser storage as base64 data
- This is useful for local testing on your machine
- Those uploads are **not a shared production image library** for real users
- For a public website, prefer `public/images/...`, imported assets, or external storage

### Method 5: Base64 Encoded (Small Images Only)
- Convert images to base64
- Embed directly in the data
- Not recommended for large product images

### Important Rule

- Do **not** use your local computer path in product data, for example `C:\\Users\\...\\photo.jpg` or `/home/you/photo.jpg`
- Browsers on public websites cannot read files from your computer
- Use one of these instead: `images/products/file.jpg`, imported assets, or `https://...`

## Testing Images Locally Before Deployment

1. Add one image to `public/images/products/`
2. Set one product `image` field to `images/products/your-file.jpg`
3. Run:
   ```bash
   npm install
   npm run dev
   ```
4. Open the app and verify the image in:
   - product card
   - product detail dialog
   - cart drawer
5. Build the production bundle:
   ```bash
   npm run build
   npm run preview
   ```
6. Test again in preview mode to confirm the same image path still works after build

## Current Limitations & Important Notes

### Data Storage
- **All data is stored in the browser** using Spark KV Store
- Each user has their own data (not shared)
- Clearing browser data will delete everything
- No central database

### For Production E-Commerce You Need:
1. **Backend Service**: Your Java microservices
2. **Shared Database**: MySQL/PostgreSQL for products, orders, users
3. **Real Payment Gateway**: Razorpay, Stripe, PayU integration
4. **Order Management**: Admin panel to manage orders
5. **Email Notifications**: Order confirmations, tracking updates
6. **SMS Integration**: For OTP, order updates
7. **Image Storage**: CDN for product images (Cloudinary, S3)
8. **Analytics**: Track visitors, conversions

### Migration Path to Production:

1. **Keep this frontend** (it's already built!)
2. **Build Java backend** with REST APIs:
   - `GET /api/products` - List products
   - `POST /api/orders` - Create order
   - `GET /api/orders/{id}` - Track order
   - `POST /api/payments/verify` - Verify UPI payment

3. **Replace Spark KV with API calls**:
   ```typescript
   // Instead of: const [products] = useKV('products', [])
   // Use: const { data: products } = useQuery('products', fetchProducts)
   ```

4. **Add authentication**:
   - User login/signup
   - OTP verification
   - JWT tokens

5. **Integrate real payment**:
   - Razorpay for UPI/Cards
   - Payment verification webhooks
   - Automatic order confirmation

## Quick Start Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

## Environment Setup for Production

Create `.env` file (when you add backend):
```env
VITE_API_BASE_URL=https://api.sukhdevialchemy.com
VITE_RAZORPAY_KEY=your_razorpay_key
```

## Support & Next Steps

### Immediate (Current Spark App):
✅ Works for demo/prototype
✅ Can deploy to your domain
✅ Users can browse and "test" ordering
❌ Not suitable for real customer orders

### Short-term (Add Backend):
- Set up Java microservices
- Add MySQL database
- Connect frontend to real APIs
- Integrate Razorpay for payments

### Long-term (Scale):
- Add admin dashboard
- Implement inventory management
- Customer accounts and order history
- Email/SMS notifications
- Analytics and reporting

## Questions?

This guide covers deployment of the current Spark application. For production e-commerce with your Java backend, you'll need to:
1. Deploy this frontend (as described above)
2. Deploy your Java services separately
3. Modify the frontend to call your APIs instead of using browser storage

Would you like help with any specific deployment step?
