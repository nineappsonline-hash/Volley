import { ownsGuestShopPayment } from '@/lib/shop-guest';
import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {kashierConfig} from '@/lib/payments/kashier';
import {verifiedCardTransaction} from '@/lib/payments/reconcile';


// Reconciles a payment that was completed on Kashier but whose webhook never
// reached us. The webhook is normally the authority; this is the fallback for
// the return landing page. It only settles after Kashier itself confirms the
// session is paid, so nothing is released without proof of funds. Combined
// with settle_kashier_order being idempotent, a late webhook is a no-op.
export async function POST(request:Request){
 try{
 const c=kashierConfig();
 const body=await request.json().catch(()=>null);
 const id=typeof body?.orderId==='string'?body.orderId.trim():'';
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Invalid order'},{status:400});
 const supabase=createClient();const {data:{user}}=await supabase.auth.getUser();
 const db=createAdminClient();
 const {data:order,error}=await db.from('kashier_orders').select('id,user_id,kind,target_id,mode,status,amount,currency,expires_at,session_id,transaction_id').eq('id',id).maybeSingle();
 if(error||!order||order.mode!==c.mode)return NextResponse.json({error:'Order not found'},{status:404});
 if((!user||order.user_id!==user.id)&&!await ownsGuestShopPayment(request,order))return NextResponse.json({error:'Forbidden'},{status:403});
 if(order.status==='paid'||order.status==='review_required')return NextResponse.json({status:order.status,paid:true,transaction_id:order.transaction_id});
 if(order.status!=='pending')return NextResponse.json({status:order.status});
 if(!order.session_id)return NextResponse.json({status:order.status});
 // Late successful payments must still be recorded; settlement routes released
 // reservations to review_required rather than silently reinstating them.
 let transactionId:string|null;
 try{transactionId=await verifiedCardTransaction(order);}
 catch{return NextResponse.json({status:order.status,pending:true},{status:503});}
 if(!transactionId)return NextResponse.json({status:order.status,pending:true});
 const {error:settleError}=await db.rpc('settle_kashier_order',{p_order:order.id,p_transaction:transactionId,p_amount:order.amount,p_currency:order.currency});
 if(settleError)return NextResponse.json({error:settleError.message,pending:true},{status:409});
 console.info('Kashier reconciled from return landing',{orderId:order.id});
 const {data:settled,error:readError}=await db.from('kashier_orders').select('status').eq('id',order.id).single();
 if(readError)return NextResponse.json({pending:true},{status:503});
 return NextResponse.json({status:settled.status,paid:['paid','review_required'].includes(settled.status)});
 }catch(error){console.error('Kashier reconcile failed',error);return NextResponse.json({error:'Could not confirm payment now. Try again shortly.'},{status:500});}
}
