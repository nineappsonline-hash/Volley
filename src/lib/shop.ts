export type ShopVariant = { id: string; product_id: string; color: string; color_ar: string; color_hex: string; size: string; images: string[]; stock: number; active: boolean };
export type SizeMeasurement = { size: string; chest: number; length: number };
export type ShopProduct = { id: string; name: string; name_ar: string; description: string; description_ar: string; price: number; size_chart: SizeMeasurement[]; published: boolean; variants: ShopVariant[] };
export type ShopOrder = { id: string; member_id: string; variant_id: string; product_name: string; color: string; size: string; quantity: number; unit_price: number; delivery_fee: number; total: number; fulfillment: string; customer_name: string; phone: string; address: string; status: string; pay_method: string | null; receipt_url: string | null; created_at: string; hold_until: string };
export const SHOP_DELIVERY_FEE = 90;
const COLOR_NAMES: { hex: string; en: string; ar: string }[] = [
  { hex: '#000000', en: 'Black', ar: 'أسود' },
  { hex: '#ffffff', en: 'White', ar: 'أبيض' },
  { hex: '#9ca3af', en: 'Gray', ar: 'رمادي' },
  { hex: '#d1d5db', en: 'Light gray', ar: 'رمادي فاتح' },
  { hex: '#374151', en: 'Charcoal', ar: 'فحمي' },
  { hex: '#ef4444', en: 'Red', ar: 'أحمر' },
  { hex: '#7f1d1d', en: 'Maroon', ar: 'أحمر داكن' },
  { hex: '#f97316', en: 'Orange', ar: 'برتقالي' },
  { hex: '#f59e0b', en: 'Amber', ar: 'كهرماني' },
  { hex: '#eab308', en: 'Yellow', ar: 'أصفر' },
  { hex: '#c6ff00', en: 'Lime', ar: 'ليموني' },
  { hex: '#22c55e', en: 'Green', ar: 'أخضر' },
  { hex: '#166534', en: 'Dark green', ar: 'أخضر داكن' },
  { hex: '#808000', en: 'Olive', ar: 'زيتوني' },
  { hex: '#14b8a6', en: 'Teal', ar: 'أزرق مخضر' },
  { hex: '#06b6d4', en: 'Cyan', ar: 'سماوي' },
  { hex: '#0ea5e9', en: 'Sky blue', ar: 'أزرق سماوي' },
  { hex: '#2563eb', en: 'Blue', ar: 'أزرق' },
  { hex: '#1e3a8a', en: 'Navy', ar: 'كحلي' },
  { hex: '#7c3aed', en: 'Purple', ar: 'بنفسجي' },
  { hex: '#35116b', en: 'Dark purple', ar: 'بنفسجي داكن' },
  { hex: '#8b5cf6', en: 'Violet', ar: 'بنفسجي فاتح' },
  { hex: '#ec4899', en: 'Pink', ar: 'وردي' },
  { hex: '#f43f5e', en: 'Rose', ar: 'وردي محمر' },
  { hex: '#92400e', en: 'Brown', ar: 'بني' },
  { hex: '#d6c7a1', en: 'Beige', ar: 'بيج' },
  { hex: '#f5f0e1', en: 'Cream', ar: 'كريمي' },
  { hex: '#d4af37', en: 'Gold', ar: 'ذهبي' },
  { hex: '#c0c0c0', en: 'Silver', ar: 'فضي' },
];
export function colorNames(hex: string) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map(char => char + char).join('') : value.padEnd(6, '0');
  const red = parseInt(full.slice(0, 2), 16) || 0;
  const green = parseInt(full.slice(2, 4), 16) || 0;
  const blue = parseInt(full.slice(4, 6), 16) || 0;
  let closest = COLOR_NAMES[0];
  let closestDistance = Infinity;
  for (const named of COLOR_NAMES) {
    const target = named.hex.replace('#', '');
    const distance = (red - parseInt(target.slice(0, 2), 16)) ** 2 + (green - parseInt(target.slice(2, 4), 16)) ** 2 + (blue - parseInt(target.slice(4, 6), 16)) ** 2;
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = named;
    }
  }
  return { color: closest.en, color_ar: closest.ar };
}
export function shopTotal(price: number, quantity: number, fulfillment: string) {
  return Math.round((price * quantity + (fulfillment === 'delivery' ? SHOP_DELIVERY_FEE : 0)) * 100) / 100;
}
export function colorImages(product: ShopProduct, color: string) {
  return [...new Set(product.variants.filter(v => v.active && v.color === color).flatMap(v => v.images))];
}
