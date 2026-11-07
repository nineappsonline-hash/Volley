# Playza Shop

The public shop lives at `/shop`, with featured products on the homepage and member dashboard. The existing training-session marketplace is unchanged.

## Activate and add products

1. Apply `supabase/migrations/20270119000000_playza_shop.sql` after the preceding migrations. It creates the catalog, variant stock, private orders, public product-photo bucket, validated order/review routines, stock-expiry schedule and extensions to the existing Kashier checkout.
2. Apply `supabase/migrations/20270120000000_shop_product_removal.sql` for the product grid and delete action. Deleted products leave the catalog while their orders and payments stay intact.
3. Open `/admin/shop` as a platform super admin. Create a product with its name, description and EGP price.
4. Enter size-chart measurements in **centimeters**: size, chest width measured flat, and garment length.
5. Add each color/size variant and its available stock. Upload that color's photos; matching color names share the photo gallery. Published variants must have photos and matching size measurements.
6. Check **Publish in the shop** and save. Unpublished products stay out of public reads. There are no seeded products or invented prices.

Product stock is checked again on the server when ordering. If stock changes while an administrator edits a product, saving fails rather than overwriting a customer's reservation; refresh the catalog before trying again.

## Orders and payment

- Checkout reserves the selected variant/quantity for 30 minutes. Customer details, selected color/size, price and fees are snapshotted on the order.
- Collection is from Fifth Settlement, New Cairo, with no collection fee. Delivery is available anywhere in Egypt, requires an address and adds **EGP 90 per order**, calculated on the server.
- Customers can use InstaPay, e-wallet transfers or the existing Kashier card checkout (Visa / Mastercard / Meeza). A transfer receipt must exist in private storage under the paying user's folder and cannot be reused for another shop order.
- `/shop/orders` shows the customer's orders and lets them resume unexpired checkout. Customers cannot read other customers' orders or update payment status directly.
- `/admin/shop?tab=orders` shows customer details, variant, quantity, total, fulfillment and receipt. Approve/reject transfer receipts there; mark paid orders delivered/collected after fulfillment. Card reviews reuse the existing authorized card-review endpoint and audit history; they do not charge or refund cards.
- Expired unpaid reservations and rejected transfer payments release stock exactly once. The shop expiry job runs once per minute when the existing `pg_cron` extension is available. Order creation and card housekeeping also perform expiry cleanup.
- A card payment arriving after a reservation expires is retained as `review_required`. Manual acceptance reserves stock again only if sufficient inventory remains. If unavailable, arrange a manual refund; collected charges are not silently discarded.

## Verification

`node tests/shop-orders.cjs` executes the real migration and payment routines in PostgreSQL via PGlite, including inventory, delivery, access control, transfer review, real card settlement, replay protection and late-payment review.

`node tests/shop-catalog.cjs` checks color/photo switching, size selection/reset, sold-out sizes and the size guide in both languages.

`node tests/shop-checkout.cjs` checks delivery checkout, server-calculated pricing inputs, card checkout targets, order resumption and expired payment controls.

The admin products tab lists every undeleted product automatically, including drafts. Use Edit on a card to open its editor or Delete to remove it from the shop. Color names are suggestions that can be edited in English and Arabic; duplicate names are flagged.

Apply `supabase/migrations/20270121000000_shop_product_gender.sql` to enable Men, Women and Unisex product fields (existing products default to Unisex).

Enabling a size does not create inventory. Enter the actual **Stock quantity per color / size** before generating combinations. For existing enabled sizes with zero inventory, use **Fill zero stock for selected sizes**, review Stock & visibility and save. This leaves existing positive stock untouched. Zero-stock sizes remain unavailable in the store.

## Guest checkout and order photographs

Apply `supabase/migrations/20270122000000_shop_guest_checkout.sql`. Customers can then order without signing in, using InstaPay, e-wallet receipts or Kashier cards. No anonymous Auth configuration or guest account is needed. Member checkout remains available.

Guest orders use a random, HttpOnly, Secure-in-production, SameSite=Lax browser cookie. Only a hash is stored with the order. The guest endpoints use server-only routines, do not expose this hash and check ownership before reading orders, accepting receipts or preparing/reconciling card payments. Customers should retain the browser/cookie to return to orders; signing in in the same browser also keeps those guest orders visible. Guest reservations are limited to three simultaneous unpaid orders per browser and ten orders per hour per server-provided IP hash. Guest orders retain the same server prices, EGP 90 delivery fee, 30-minute stock holds and admin approval workflow.

The selected color's first product photo is snapshotted on each order, backfilled for existing orders and displayed in checkout and order history, including resumed orders.

Validation: `node tests/shop-guest-api.cjs`, `node tests/shop-checkout.cjs`, `node tests/shop-orders.cjs` and the existing card-payment/webhook tests.
