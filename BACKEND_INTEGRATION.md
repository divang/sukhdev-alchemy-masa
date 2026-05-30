# Backend Integration Guide

This guide explains how to connect this frontend to your Java microservices backend.

## Current Architecture (Spark Application)

```
┌─────────────────┐
│   Web Browser   │
│                 │
│  React Frontend │◄─── All data stored here (Spark KV)
│   + Spark KV    │
│                 │
└─────────────────┘
```

**Current Data Flow:**
- Products, cart, orders stored in browser
- Each user has their own data
- No server communication
- No shared state between users

## Target Architecture (Production)

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Web Browser   │         │  Java Backend    │         │   Database   │
│                 │  REST   │                  │  JDBC   │              │
│  React Frontend │◄───────►│  Microservices   │◄───────►│ MySQL/Postgres│
│  (This App)     │  API    │                  │         │              │
└─────────────────┘         └──────────────────┘         └──────────────┘
```

## Required Backend APIs

### 1. Product Service

```java
// GET /api/products - List all products
// GET /api/products/{id} - Get product details
// GET /api/products/category/{categoryId} - List products by category
// GET /api/categories - List all categories

@RestController
@RequestMapping("/api")
public class ProductController {
    
    @GetMapping("/products")
    public ResponseEntity<List<ProductDTO>> getAllProducts() {
        // Return all products
    }
    
    @GetMapping("/products/{id}")
    public ResponseEntity<ProductDTO> getProduct(@PathVariable String id) {
        // Return single product
    }
    
    @GetMapping("/products/category/{categoryId}")
    public ResponseEntity<List<ProductDTO>> getProductsByCategory(
        @PathVariable String categoryId
    ) {
        // Return products for category
    }
    
    @GetMapping("/categories")
    public ResponseEntity<List<CategoryDTO>> getCategories() {
        // Return all categories with enabled flags
    }
}
```

**DTOs:**

```java
// ProductDTO.java
public class ProductDTO {
    private String id;
    private String name;
    private String categoryId;
    private BigDecimal price;
    private String imageUrl;
    private Double rating;
    private Integer reviewCount;
    private String description;
    private List<String> ingredients;
    private String youtubeUrl;
    private Boolean inStock;
    private List<String> tags;
    // getters, setters
}

// CategoryDTO.java
public class CategoryDTO {
    private String id;
    private String name;
    private Boolean enabled;
    private String slug;
    // getters, setters
}
```

### 2. Order Service

```java
// POST /api/orders - Create new order
// GET /api/orders/{id} - Get order details
// GET /api/orders/user/{userId} - Get user's orders
// PATCH /api/orders/{id}/status - Update order status (admin)

@RestController
@RequestMapping("/api/orders")
public class OrderController {
    
    @PostMapping
    public ResponseEntity<OrderDTO> createOrder(
        @RequestBody CreateOrderRequest request
    ) {
        // Create order in database
        // Return order with ID
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<OrderDTO> getOrder(@PathVariable String id) {
        // Return order details
    }
    
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<OrderDTO>> getUserOrders(
        @PathVariable String userId
    ) {
        // Return all orders for user
    }
    
    @PatchMapping("/{id}/status")
    public ResponseEntity<OrderDTO> updateOrderStatus(
        @PathVariable String id,
        @RequestBody UpdateStatusRequest request
    ) {
        // Update order status (admin only)
    }
}
```

**DTOs:**

```java
// CreateOrderRequest.java
public class CreateOrderRequest {
    private List<OrderItemDTO> items;
    private CustomerDTO customer;
    private BigDecimal totalAmount;
    // getters, setters
}

// OrderItemDTO.java
public class OrderItemDTO {
    private String productId;
    private String productName;
    private Integer quantity;
    private Integer grams;
    private BigDecimal pricePerUnit;
    // getters, setters
}

// CustomerDTO.java
public class CustomerDTO {
    private String name;
    private String email;
    private String phone;
    private String address;
    private String city;
    private String pincode;
    // getters, setters
}

// OrderDTO.java
public class OrderDTO {
    private String id;
    private List<OrderItemDTO> items;
    private CustomerDTO customer;
    private BigDecimal totalAmount;
    private String status; // pending, processing, shipped, delivered
    private String paymentStatus; // pending, paid
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    // getters, setters
}
```

### 3. Payment Service

```java
// POST /api/payments/initiate - Initiate Razorpay payment
// POST /api/payments/verify - Verify payment callback
// GET /api/payments/status/{orderId} - Check payment status

@RestController
@RequestMapping("/api/payments")
public class PaymentController {
    
    @PostMapping("/initiate")
    public ResponseEntity<PaymentInitiateResponse> initiatePayment(
        @RequestBody PaymentInitiateRequest request
    ) {
        // Create Razorpay order
        // Return payment details
    }
    
    @PostMapping("/verify")
    public ResponseEntity<PaymentVerifyResponse> verifyPayment(
        @RequestBody PaymentVerifyRequest request
    ) {
        // Verify Razorpay signature
        // Update order payment status
        // Return verification result
    }
    
    @GetMapping("/status/{orderId}")
    public ResponseEntity<PaymentStatusResponse> getPaymentStatus(
        @PathVariable String orderId
    ) {
        // Return payment status for order
    }
}
```

### 4. Review Service

```java
// GET /api/reviews/product/{productId} - Get reviews for product
// POST /api/reviews - Submit new review
// GET /api/testimonials - Get featured testimonials

@RestController
@RequestMapping("/api")
public class ReviewController {
    
    @GetMapping("/reviews/product/{productId}")
    public ResponseEntity<List<ReviewDTO>> getProductReviews(
        @PathVariable String productId
    ) {
        // Return reviews for product
    }
    
    @PostMapping("/reviews")
    public ResponseEntity<ReviewDTO> submitReview(
        @RequestBody SubmitReviewRequest request
    ) {
        // Create new review (after order verification)
    }
    
    @GetMapping("/testimonials")
    public ResponseEntity<List<TestimonialDTO>> getTestimonials() {
        // Return featured testimonials
    }
}
```

## Database Schema

### Tables

```sql
-- Categories Table
CREATE TABLE categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Products Table
CREATE TABLE products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category_id VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    image_url VARCHAR(500),
    description TEXT,
    youtube_url VARCHAR(500),
    in_stock BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Product Ingredients Table
CREATE TABLE product_ingredients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    ingredient VARCHAR(200) NOT NULL,
    display_order INT DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Product Tags Table
CREATE TABLE product_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    tag VARCHAR(50) NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Customers Table
CREATE TABLE customers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Orders Table
CREATE TABLE orders (
    id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'processing', 'shipped', 'delivered') DEFAULT 'pending',
    payment_status ENUM('pending', 'paid') DEFAULT 'pending',
    delivery_address TEXT NOT NULL,
    delivery_city VARCHAR(100) NOT NULL,
    delivery_pincode VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Order Items Table
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL,
    grams INT NOT NULL,
    price_per_unit DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Reviews Table
CREATE TABLE reviews (
    id VARCHAR(50) PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    order_id VARCHAR(50) NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Testimonials Table (featured reviews)
CREATE TABLE testimonials (
    id VARCHAR(50) PRIMARY KEY,
    customer_name VARCHAR(200) NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    location VARCHAR(100),
    featured BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments Table
CREATE TABLE payments (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    razorpay_signature VARCHAR(200),
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

## Frontend Modifications

### 1. Install HTTP Client

```bash
npm install @tanstack/react-query axios
```

### 2. Create API Client

```typescript
// src/lib/api.ts
import axios from 'axios'
import type { Product, Category, Order, Review, Testimonial } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Products
export const productApi = {
  getAll: () => apiClient.get<Product[]>('/products'),
  getById: (id: string) => apiClient.get<Product>(`/products/${id}`),
  getByCategory: (categoryId: string) => 
    apiClient.get<Product[]>(`/products/category/${categoryId}`),
}

// Categories
export const categoryApi = {
  getAll: () => apiClient.get<Category[]>('/categories'),
}

// Orders
export const orderApi = {
  create: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => 
    apiClient.post<Order>('/orders', order),
  getById: (id: string) => apiClient.get<Order>(`/orders/${id}`),
  getUserOrders: (userId: string) => 
    apiClient.get<Order[]>(`/orders/user/${userId}`),
}

// Reviews
export const reviewApi = {
  getProductReviews: (productId: string) => 
    apiClient.get<Review[]>(`/reviews/product/${productId}`),
  submit: (review: Omit<Review, 'id' | 'date'>) => 
    apiClient.post<Review>('/reviews', review),
}

// Testimonials
export const testimonialApi = {
  getAll: () => apiClient.get<Testimonial[]>('/testimonials'),
}
```

### 3. Update App.tsx to Use APIs

```typescript
// src/App.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productApi, categoryApi, orderApi } from '@/lib/api'

function App() {
  const queryClient = useQueryClient()
  
  // Replace useKV with useQuery
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoryApi.getAll()
      return response.data
    }
  })
  
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await productApi.getAll()
      return response.data
    }
  })
  
  // Keep cart in local storage for now
  const [cartItems, setCartItems] = useKV<CartItem[]>("cart", [])
  
  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: (orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) =>
      orderApi.create(orderData),
    onSuccess: (response) => {
      // Handle successful order creation
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    }
  })
  
  // Rest of component...
}
```

### 4. Setup React Query Provider

```typescript
// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
})

// Wrap app with provider
<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

### 5. Environment Variables

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:8080/api

# .env.production
VITE_API_BASE_URL=https://api.sukhdevialchemy.com/api
```

## Razorpay Integration

### Backend (Java)

```java
// Add Razorpay dependency to pom.xml
<dependency>
    <groupId>com.razorpay</groupId>
    <artifactId>razorpay-java</artifactId>
    <version>1.4.3</version>
</dependency>

// RazorpayService.java
@Service
public class RazorpayService {
    
    @Value("${razorpay.key.id}")
    private String keyId;
    
    @Value("${razorpay.key.secret}")
    private String keySecret;
    
    public RazorpayOrder createOrder(BigDecimal amount, String orderId) {
        try {
            RazorpayClient client = new RazorpayClient(keyId, keySecret);
            
            JSONObject orderRequest = new JSONObject();
            orderRequest.put("amount", amount.multiply(new BigDecimal(100)).intValue());
            orderRequest.put("currency", "INR");
            orderRequest.put("receipt", orderId);
            
            Order order = client.orders.create(orderRequest);
            
            return new RazorpayOrder(
                order.get("id"),
                order.get("amount"),
                order.get("currency")
            );
        } catch (RazorpayException e) {
            throw new PaymentException("Failed to create Razorpay order", e);
        }
    }
    
    public boolean verifySignature(String orderId, String paymentId, String signature) {
        try {
            String payload = orderId + "|" + paymentId;
            String generatedSignature = Utils.getHash(payload, keySecret);
            return generatedSignature.equals(signature);
        } catch (Exception e) {
            return false;
        }
    }
}
```

### Frontend

```typescript
// src/lib/razorpay.ts
declare global {
  interface Window {
    Razorpay: any
  }
}

export const initiateRazorpayPayment = async (
  amount: number,
  orderId: string,
  customerDetails: { name: string; email: string; phone: string }
): Promise<{ paymentId: string; signature: string }> => {
  
  // Get Razorpay order from backend
  const response = await fetch('/api/payments/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, orderId })
  })
  
  const { razorpayOrderId, razorpayKeyId } = await response.json()
  
  return new Promise((resolve, reject) => {
    const options = {
      key: razorpayKeyId,
      amount: amount * 100,
      currency: 'INR',
      name: 'Sukhdev Alchemy',
      description: `Order #${orderId}`,
      order_id: razorpayOrderId,
      prefill: {
        name: customerDetails.name,
        email: customerDetails.email,
        contact: customerDetails.phone,
      },
      handler: function (response: any) {
        resolve({
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        })
      },
      modal: {
        ondismiss: function () {
          reject(new Error('Payment cancelled'))
        }
      }
    }
    
    const razorpay = new window.Razorpay(options)
    razorpay.open()
  })
}
```

## Testing Checklist

- [ ] Products load from backend
- [ ] Categories filter works
- [ ] Add to cart persists locally
- [ ] Checkout creates order in database
- [ ] Razorpay payment opens correctly
- [ ] Payment verification updates order
- [ ] Order tracking shows correct status
- [ ] Reviews display for products
- [ ] Testimonials load from database
- [ ] Error handling works for failed requests
- [ ] Loading states display properly

## Security Considerations

1. **CORS**: Configure backend to allow frontend domain
2. **Authentication**: Add JWT tokens for user sessions
3. **Input Validation**: Validate all inputs on backend
4. **Rate Limiting**: Prevent abuse of APIs
5. **SQL Injection**: Use prepared statements
6. **XSS Protection**: Sanitize user inputs
7. **HTTPS**: Use SSL certificates for all communications
8. **API Keys**: Store Razorpay keys securely, never in frontend

## Deployment

1. **Backend**: Deploy to AWS, Azure, or Google Cloud
2. **Database**: Use RDS, Cloud SQL, or managed MySQL
3. **Frontend**: Deploy to Netlify/Vercel with env variables
4. **CDN**: Use Cloudinary for product images
5. **Monitoring**: Add error tracking (Sentry) and analytics

## Next Steps

1. Build Java microservices with above APIs
2. Create database with provided schema
3. Integrate Razorpay on backend
4. Modify frontend to use APIs instead of Spark KV
5. Test end-to-end flow
6. Deploy to production
