# Facet — Digital Product Marketplace

## Project Idea & Purpose

**Facet** is a full-stack digital product marketplace platform—similar to Gumroad, Creative Market, or Lemon Squeezy—where creators, designers, and developers can upload, sell, and distribute downloadable digital assets.

The platform is built around four core pillars:

1. **Direct Creator-to-Buyer Digital Commerce**
   - **Multi-Vendor Marketplace:** Users can browse the catalog as buyers or upgrade their profile into a **Seller Studio** to publish digital goods across categories like UI kits, code templates, icon sets, fonts, Notion templates, e-books, photo presets, and audio packs.
   - **Frictionless Checkout:** Buyers can purchase paid assets via **Stripe Checkout** (with a built-in demo card fallback for local testing) or claim free lead-magnet products with one click.

2. **Secure File Hosting & Expiring Delivery**
   - **Private Asset Storage:** Product archives (`.zip`, source files, PDFs) are stored privately in S3-compatible object storage (`files/...`), while cover thumbnails and screenshots are served via public media keys (`media/...`).
   - **Protected Downloads:** Purchased items live in a permanent buyer **Library**, where downloads are generated on demand using short-lived, signed URLs (expiring after 5 minutes) once order ownership is verified.

3. **AI-Assisted Discovery & Listing Creation (Google Gemini)**
   - **AI Listing Generator for Sellers:** Sellers can upload a product archive (`.zip` or text file) alongside brief notes, and **Google Gemini** inspects the `README`, `package.json`, and file tree to automatically generate the title, tagline, Markdown description, feature bullets, SEO metadata, tags, and market-benchmarked pricing.
   - **AI Shopping Assistant for Buyers:** Buyers can describe what they are building in plain language, and the assistant searches the catalog using PostgreSQL full-text search to recommend matching products with tailored explanations (gracefully falling back to keyword heuristics if no API key is configured).

4. **Seller Analytics & Storefront Management**
   - **Studio Dashboard:** Creators get a dedicated workspace (`/studio`) to manage drafts and published listings, configure time-limited discounts, monitor views and conversion rates, track revenue across 7-, 30-, or 90-day windows, and read buyer reviews.

---

## Architecture & Tech Stack

- **Backend:** Node.js (ESM), Express 5, Zod validation, Multer (in-memory multipart uploads), AdmZip, Neon-Auth
- **Database:** PostgreSQL (`pg`) with full-text search (`tsvector` / `websearch_to_tsquery`), transactions, and JSON recordset bulk seeding
- **Storage:** S3-compatible object storage (Neon Object Storage / MinIO) via `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
- **Payments:** Stripe Checkout Sessions & Webhooks (`stripe`), plus a built-in demo card payment service
- **AI Integration:** Google Gemini (`@google/genai`) with structured JSON schema outputs and automatic heuristic fallbacks
- **Frontend:** React 19, Vite, React Router, TanStack Query, Tailwind CSS, Lucide Icons, Neon-Auth

---

## Environment Variables Setup (`.env.example`)

Create a `.env` file inside `backend/src/.env` (or `backend/.env` depending on your `--env-file` script flag) with the following variables:

```env
# Server & Client
PORT=4000
CLIENT_ORIGIN=http://localhost:5173

# PostgreSQL Database (Neon / Local Postgres)
DATABASE_URL=postgresql://user:password@host:5432/facet_marketplace?sslmode=require

# Neon Auth / JWT Verification
NEON_AUTH_URL=https://your-project.neonauth.region.aws.neon.tech/neondb/auth

# S3-Compatible Object Storage (Neon Object Storage / MinIO / AWS S3)
S3_ENDPOINT=https://your-s3-endpoint.example.com
S3_REGION=us-east-1
S3_BUCKET=facet-marketplace
S3_ACCESS_KEY_ID=your_access_key_id
S3_SECRET_ACCESS_KEY=your_secret_access_key

# Stripe Payments (Optional — falls back to Demo Card Processor if omitted)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret

# Google Gemini AI (Optional — falls back to Keyword Heuristics if omitted)
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODEL=gemini-2.5-flash-lite
```

---

| Table | Purpose | Key Columns |
| :--- | :--- | :--- |
| **`profiles`** | Stores buyers and sellers synced from Neon Auth | `id`, `email`, `name`, `is_seller`, `store_name`, `bio`, `avatar_url`, `created_at` |
| **`categories`** | Product taxonomy for browsing and filtering | `id`, `slug`, `name`, `description`, `sort_order` |
| **`products`** | Digital assets, pricing, media keys, and search vectors | `id`, `seller_id`, `category_id`, `slug`, `title`, `tagline`, `description`, `features`, `tags`, `price_cents`, `discount_percent`, `discount_ends_at`, `file_key`, `thumbnail_key`, `screenshot_keys`, `status`, `sales_count`, `rating_avg`, `view_count`, `search` (`tsvector`) |
| **`orders`** | Checkout transactions and payment status | `id`, `receipt_number`, `buyer_id`, `status` (`pending`, `paid`, `failed`), `subtotal_cents`, `discount_cents`, `total_cents`, `payment_provider`, `payment_ref`, `payment_last4`, `paid_at` |
| **`order_items`** | Line items linking paid orders to products and sellers | `id`, `order_id`, `product_id`, `seller_id`, `title`, `unit_price_cents`, `list_price_cents` |
| **`reviews`** | Verified buyer ratings and written feedback | `id`, `product_id`, `user_id`, `rating` (1–5), `title`, `body`, `created_at` |
| **`wishlist_items`** | Saved products per user | `user_id`, `product_id`, `created_at` |
| **`download_events`** | Audit log of signed download link generations | `id`, `user_id`, `product_id`, `created_at` |

---

## Backend Modules & Services Implemented

### Storage & Media (`src/services/storage.js`)
- Sanitizes filenames (`safeName`) and organizes S3 keys into `media/{productId}/...` (public previews) and `files/{productId}/...` (private downloadable assets).
- Generates presigned URLs for viewing media (`signedMediaUrl`, 1-hour expiry) and forcing attachment downloads (`signedDownloadUrl`, 5-minute expiry).
- Cleans up orphaned objects from storage when products or thumbnails are replaced or deleted.

### Catalog & Public Discovery (`src/routes/catalog.js`)
- `GET /api/categories` — Lists categories with published product counts.
- `GET /api/stats` — Aggregates marketplace totals (products, sellers, sales, average rating, free items).
- `GET /api/products` — Supports full-text search (`q`), category, tag, seller, price range, rating, free/on-sale filters, sorting (`popular`, `rating`, `newest`, `price_asc`, `price_desc`, `relevance`), pagination, and viewer wishlist flags.
- `GET /api/products/:slug` — Fetches product details, increments `view_count`, computes 1–5 star rating breakdowns, finds related products, and checks viewer ownership/wishlist/review status.
- `GET /api/products/:id/reviews` & `GET /api/sellers/:id` — Public reviews and seller storefront profiles.
- `GET /api/media/*key` — Redirects public media keys to presigned S3 URLs with private cache headers.

### Seller Studio (`src/routes/seller.js` & `src/middleware/upload.js`)
- Protected by `requireAuth` and `requireSeller`.
- Handles multipart uploads (`file` up to 150 MB, `thumbnail`, and up to 6 `screenshots`).
- `GET /api/seller/products` & `GET /api/seller/products/:id` — Lists and inspects the seller's catalog with view counts and revenue.
- `POST /api/seller/products` & `PATCH /api/seller/products/:id` — Creates and updates listings, manages screenshot additions/removals, and cleans up replaced S3 assets.
- `PATCH /api/seller/products/:id/pricing` & `DELETE /api/seller/products/:id` — Quick pricing/discount updates; archives products with existing sales or deletes unsold ones.
- `GET /api/seller/stats`, `GET /api/seller/orders`, & `GET /api/seller/reviews` — Time-series revenue analytics, conversion rates, recent sales, and customer feedback.

### Checkout, Orders, Library & Webhooks (`src/routes/orders.js`, `src/routes/webhooks.js`, `src/services/stripe.js`, `src/services/payments.js`, `src/services/fulfillment.js`)
- `POST /api/checkout` — Validates cart items, prevents self-purchases or duplicate ownership, calculates effective discounted prices, and creates a pending order transactionally.
- `POST /api/checkout/:orderId/stripe` & `POST /api/checkout/:orderId/confirm` — Creates Stripe Checkout sessions and verifies/fulfills completed sessions.
- `POST /api/checkout/:orderId/pay` — Processes demo card payments or $0 orders when Stripe is not active.
- `POST /api/products/:id/claim` — Instant one-click claiming for free (`$0`) products.
- `GET /api/orders`, `GET /api/orders/:id`, & `GET /api/library` — Order history, itemized receipts, and buyer library.
- `POST /api/downloads/:productId` — Verifies ownership, logs a download event, and returns a 5-minute presigned download URL.
- `POST /api/webhooks/stripe` — Verifies Stripe webhook signatures (`checkout.session.completed`) and triggers transactional order fulfillment (`markPaid`).

### AI Listing Generator & Shopping Assistant (`src/services/ai.js` & `src/routes/ai.js`)
- `GET /api/ai/status` — Reports whether Gemini is enabled and which model is active.
- `POST /api/ai/listing` — Inspects uploaded `.zip` archives (file list, `README`, `package.json`) or text files alongside seller notes to draft titles, taglines, Markdown descriptions, features, tags, SEO fields, target audience, and suggested pricing.
- `POST /api/ai/assistant` — Queries PostgreSQL full-text search for candidate products and uses Gemini to recommend up to 4 matches with tailored reasons and a follow-up question.
- Includes `heuristicListing` and `heuristicRecommend` rule-based fallbacks when `GEMINI_API_KEY` is absent or rate-limited.

### Database Seeding (`src/db/seed.js`, `src/db/seed-data.js`, `src/db/covers.js`, `src/db/avatars.js`)
- Populates 9 categories, 4 seller studios, 19 realistic digital products, 32 buyers, historical orders, and star-weighted reviews.
- Supports `--owner <email>` to transfer **Northlight Studio** products and order history to a signed-in developer account.
- Generates demo `.zip` archives (`README.md` + `LICENSE.txt`) and uploads `.webp` product covers and buyer avatars to object storage.

---

## Summary of Bugs Diagnosed & Fixed

1. **Stripe Checkout Confirmation Stuck & Empty Order Receipts (`src/routes/orders.js` & `src/services/stripe.js`)**
   - *Cause:* Missing array index `[0]` on `const o = rows[0]` in `loadOwnOrder`, `GET /api/orders/:id`, and `fulfillCheckoutSession`, returning an Array instead of the order object so `order.status === 'paid'` never matched.
   - *Fix:* Added `[0]` indexing to single-row query lookups across `orders.js` and `stripe.js`.

2. **Broken Image Previews in React 19 StrictMode (`StudioProductEdit.jsx`)**
   - *Cause:* `ImagePreview` created a `blob:` URL inside `useMemo` and revoked it in `useEffect` cleanup; StrictMode's simulated unmount revoked the URL immediately while keeping the stale URL cached in `useMemo`.
   - *Fix:* Moved `URL.createObjectURL` and `URL.revokeObjectURL` into the same `useEffect` backed by `useState`.

3. **Infinite Spinner on Failed Login (`frontend/src/pages/Auth.jsx`)**
   - *Cause:* `authClient.signIn.email` threw an `AuthApiError` on `401 Invalid email or password`, skipping `setPending(false)` because there was no `try / catch / finally` block.
   - *Fix:* Wrapped `SignIn` and `SignUp` form submissions in `try / catch / finally` blocks to reset loading state and display auth error alerts cleanly.

---

## Quick Reference Commands

```bash
# Run database migrations
npm run db:migrate

# Seed database with demo products, orders, covers, and avatars
npm test

# Seed and assign Northlight Studio products to your account
node --env-file=src/.env src/db/seed.js --owner your-email@example.com

# Start backend development server
npm run dev

# Start frontend development server
npm run dev
Open http://localhost:5173/

- **Checkout** uses a demo card form: `4242 4242 4242 4242` succeeds and `4000 0000 0000 0002` is declined.
- Your changes (purchases, wishlist, reviews, listings) are saved in the browser. To start over, run `resetMockData()` in the browser console.

```
