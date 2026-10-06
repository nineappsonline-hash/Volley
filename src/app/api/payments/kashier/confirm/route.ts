import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {kashierConfig,kashierRequest} from '@/lib/payments/kashier';

const PAID_TRANSACTION_STATUSES=/^(PAID|SUCCESS|SUCCEEDED|CAPTURED|APPROVED)$/i;

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
 if(!user)return NextResponse.json({error:'Sign in first'},{status:401});
 const db=createAdminClient();
 const {data:order,error}=await db.from('kashier_orders').select('id,user_id,mode,status,amount,currency,expires_at,session_id,transaction_id').eq('id',id).maybeSingle();
 if(error||!order||order.mode!==c.mode)return NextResponse.json({error:'Order not found'},{status:404});
 if(order.user_id!==user.id)return NextResponse.json({error:'Forbidden'},{status:403});
 if(order.status==='paid'||order.status==='review_required')return NextResponse.json({status:order.status,paid:true,transaction_id:order.transaction_id});
 if(order.status!=='pending')return NextResponse.json({status:order.status});
 if(!order.session_id||new Date(order.expires_at).getTime()<Date.now())return NextResponse.json({status:order.status});
 // Ask Kashier whether the session actually settled before touching anything.
 let session:any;
 try{
  const read=await kashierRequest(`/v3/payment/sessions/${encodeURIComponent(order.session_id)}/payment`,undefined,{timeoutMs:8000});
  session=read&&typeof read==='object'&&'data' in read?read.data:read;
 }catch(err){console.warn('Kashier reconcile session unreadable',{orderId:order.id,error:err instanceof Error?err.message:String(err)});return NextResponse.json({status:order.status,pending:true},{status:503});}
 const sessionStatus=String(session?.status??'').toUpperCase();
 if(!PAID_TRANSACTION_STATUSES.test(sessionStatus))return NextResponse.json({status:order.status,pending:true});
 const transactionId=typeof session?.transactionId==='string'?session.transactionId:(Array.isArray(session?.history)?session.history.map((h:any)=>h?.transactionId).find((t:unknown)=>typeof t==='string'):undefined);
 if(!transactionId)return NextResponse.json({status:order.status,pending:true});
 const {error:settleError}=await db.rpc('settle_kashier_order',{p_order:order.id,p_transaction:transactionId,p_amount:order.amount,p_currency:order.currency});
 if(settleError)return NextResponse.json({error:settleError.message,pending:true},{status:409});
 console.info('Kashier reconciled from return landing',{orderId:order.id});
 return NextResponse.json({status:'paid',paid:true});
 }catch(error){console.error('Kashier reconcile failed',error);return NextResponse.json({error:'Could not confirm payment now. Try again shortly.'},{status:500});}
}
