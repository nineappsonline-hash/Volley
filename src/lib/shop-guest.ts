import { createHash, randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
export const SHOP_GUEST_COOKIE = 'playza_shop_guest';
export function guestToken(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${SHOP_GUEST_COOKIE}=`))?.slice(SHOP_GUEST_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function guestHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
export function newGuestToken() { return randomBytes(32).toString('hex'); }
export function validShopOrigin(request: Request) { return request.headers.get('origin') === new URL(request.url).origin; }
export const SHOP_ORDER_FIELDS = 'id,member_id,variant_id,product_name,product_image,color,size,quantity,unit_price,delivery_fee,total,fulfillment,customer_name,phone,address,status,pay_method,receipt_url,created_at,hold_until';
export async function ownsGuestShopPayment(request: Request, order: {kind?: string;target_id?: string;user_id?: string|null}) {
  const token = guestToken(request);
  if (!token || order.kind !== 'shop' || order.user_id != null || !order.target_id) return false;
  const {data,error} = await createAdminClient().from('shop_orders').select('id').eq('id',order.target_id).eq('guest_hash',guestHash(token)).is('member_id',null).maybeSingle();
  return !error && !!data;
}
