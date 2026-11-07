import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { guestToken, guestHash, validShopOrigin } from '@/lib/shop-guest';
export async function POST(request:Request){
 if(!validShopOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
 const token=guestToken(request);if(!token)return NextResponse.json({error:'Order not found in this browser'},{status:403});
 try{
 const body=await request.formData();const id=String(body.get('order')??'');const method=String(body.get('method')??'');const file=body.get('receipt');
 const types:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['instapay','e_wallet'].includes(method)||!(file instanceof File)||!types[file.type]||file.size<1||file.size>8*1024*1024)return NextResponse.json({error:'Choose a receipt image or PDF up to 8 MB'},{status:400});
 const db=createAdminClient();const hash=guestHash(token);const {data:order,error}=await db.from('shop_orders').select('id,hold_until,pay_method').eq('id',id).eq('guest_hash',hash).eq('status','awaiting_payment').is('member_id',null).maybeSingle();
 if(error||!order||Date.parse(order.hold_until)<=Date.now()||order.pay_method==='kashier')return NextResponse.json({error:'Order is no longer awaiting transfer payment'},{status:409});
 const path=`guest/${id}/${randomUUID()}.${types[file.type]}`;
 const {error:uploadError}=await db.storage.from('game-fee-receipts').upload(path,file,{contentType:file.type});if(uploadError)throw uploadError;
 const {error:submitError}=await db.rpc('submit_guest_shop_receipt',{p_guest_hash:hash,p_order:id,p_method:method,p_receipt:path});if(submitError){await db.storage.from('game-fee-receipts').remove([path]);return NextResponse.json({error:submitError.message},{status:409});}
 return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Could not submit receipt'},{status:503});}
}
