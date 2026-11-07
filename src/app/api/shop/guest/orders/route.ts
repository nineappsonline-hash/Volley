import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { guestToken, guestHash, newGuestToken, SHOP_GUEST_COOKIE, SHOP_ORDER_FIELDS, validShopOrigin } from '@/lib/shop-guest';
const input = z.object({variant:z.string().uuid(),quantity:z.number().int().min(1).max(10),fulfillment:z.enum(['collection','delivery']),name:z.string().trim().min(2).max(120),phone:z.string().trim().min(7).max(30),address:z.string().max(500),requestId:z.string().uuid()});
export async function GET(request: Request) {
 const token=guestToken(request); if(!token)return NextResponse.json({orders:[]},{headers:{'Cache-Control':'private, no-store'}});
 try {const {data,error}=await createAdminClient().from('shop_orders').select(SHOP_ORDER_FIELDS).eq('guest_hash',guestHash(token)).is('member_id',null).order('created_at',{ascending:false}).limit(100);if(error)throw error;return NextResponse.json({orders:data},{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'Could not load orders'},{status:503});}
}
export async function POST(request: Request) {
 if(!validShopOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
 const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Check your order details'},{status:400});
 const token=guestToken(request)??newGuestToken(); const p=parsed.data;
 const respond=(data:unknown,status=200)=>{const response=NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});response.cookies.set(SHOP_GUEST_COOKIE,token,{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'lax',path:'/',maxAge:60*60*24*90});return response;};
 try {
 const db=createAdminClient();
 const ip=request.headers.get('x-real-ip')??request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
 const {data:id,error}=await db.rpc('create_guest_shop_order',{p_guest_hash:guestHash(token),p_rate_key:ip?guestHash(`shop-rate:${ip}`):null,p_variant:p.variant,p_quantity:p.quantity,p_fulfillment:p.fulfillment,p_name:p.name,p_phone:p.phone,p_address:p.address,p_request:p.requestId});
 if(error)return respond({error:error.message},409);
 const {data:order,error:readError}=await db.from('shop_orders').select(SHOP_ORDER_FIELDS).eq('id',id).eq('guest_hash',guestHash(token)).single();if(readError)throw readError;
 return respond({order});
 }catch{return respond({error:'Could not create your order. Please retry.'},503);}
}
