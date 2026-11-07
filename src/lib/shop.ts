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
  const exact = COLOR_NAMES.find(named => named.hex.toLowerCase() === `#${full.toLowerCase()}`);
  if (exact) return { color: exact.en, color_ar: exact.ar };
  const r = red / 255, g = green / 255, b = blue / 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), delta = max-min;
  const light = (max+min)/2;
  const named = (color: string, color_ar: string) => ({color,color_ar});
  if (light < .10) return named('Black','أسود');
  if (light > .94) return named('White','أبيض');
  const saturation = delta === 0 ? 0 : delta/(1-Math.abs(2*light-1));
  if (saturation < .14) return light < .3 ? named('Charcoal','فحمي') : light > .72 ? named('Light gray','رمادي فاتح') : named('Gray','رمادي');
  let hue = delta === 0 ? 0 : max === r ? ((g-b)/delta)%6 : max === g ? (b-r)/delta+2 : (r-g)/delta+4;
  hue = (hue*60+360)%360;
  if (hue >= 15 && hue < 50 && light < .4) return named('Brown','بني');
  if (hue >= 30 && hue < 60 && saturation < .55 && light > .6) return named('Beige','بيج');
  if (hue >= 200 && hue < 260 && light < .3) return named('Navy','كحلي');
  const base = hue < 15 || hue >= 345 ? named('Red','أحمر') : hue < 45 ? named('Orange','برتقالي') : hue < 65 ? named('Yellow','أصفر') : hue < 90 ? named('Lime','ليموني') : hue < 165 ? named('Green','أخضر') : hue < 185 ? named('Teal','أزرق مخضر') : hue < 205 ? named('Cyan','سماوي') : hue < 260 ? named('Blue','أزرق') : hue < 290 ? named('Purple','بنفسجي') : hue < 320 ? named('Magenta','أرجواني') : named('Pink','وردي');
  return light < .28 ? named(`Dark ${base.color.toLowerCase()}`,`${base.color_ar} داكن`) : light > .73 ? named(`Light ${base.color.toLowerCase()}`,`${base.color_ar} فاتح`) : base;
}
export function shopTotal(price: number, quantity: number, fulfillment: string) {
  return Math.round((price * quantity + (fulfillment === 'delivery' ? SHOP_DELIVERY_FEE : 0)) * 100) / 100;
}
export function colorImages(product: ShopProduct, color: string) {
  return [...new Set(product.variants.filter(v => v.active && v.color === color).flatMap(v => v.images))];
}
