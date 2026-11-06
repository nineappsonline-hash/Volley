export type ShopVariant = { id: string; product_id: string; color: string; color_ar: string; color_hex: string; size: string; images: string[]; stock: number; active: boolean };
export type SizeMeasurement = { size: string; chest: number; length: number };
export type ShopProduct = { id: string; name: string; name_ar: string; description: string; description_ar: string; price: number; size_chart: SizeMeasurement[]; published: boolean; variants: ShopVariant[] };
export type ShopOrder = { id: string; member_id: string; variant_id: string; product_name: string; color: string; size: string; quantity: number; unit_price: number; delivery_fee: number; total: number; fulfillment: string; customer_name: string; phone: string; address: string; status: string; pay_method: string | null; receipt_url: string | null; created_at: string; hold_until: string };
export const SHOP_DELIVERY_FEE = 90;
export function shopTotal(price: number, quantity: number, fulfillment: string) {
  return Math.round((price * quantity + (fulfillment === 'delivery' ? SHOP_DELIVERY_FEE : 0)) * 100) / 100;
}
export function colorImages(product: ShopProduct, color: string) {
  return [...new Set(product.variants.filter(v => v.active && v.color === color).flatMap(v => v.images))];
}
