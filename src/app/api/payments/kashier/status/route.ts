import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ownsGuestShopPayment } from '@/lib/shop-guest';
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get('order');if(!id||!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Invalid order'},{status:400});
 try{const {data:{user}}=await createClient().auth.getUser();const {data:order,error}=await createAdminClient().from('kashier_orders').select('user_id,kind,target_id,status,expires_at').eq('id',id).maybeSingle();
 if(error||!order||((!user||order.user_id!==user.id)&&!await ownsGuestShopPayment(request,order)))return NextResponse.json({error:'Order not found'},{status:404});
 return NextResponse.json({status:order.status,expires_at:order.expires_at},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'Could not load payment status'},{status:503});}
}
