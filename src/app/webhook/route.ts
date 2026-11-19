import {createAdminClient} from '@/lib/supabase/admin';
import {amountInPiastres,kashierConfig,kashierRequest,verifyKashierSignature} from '@/lib/payments/kashier';
export const runtime='nodejs';
const PAID_TRANSACTION_STATUSES=/^(PAID|SUCCESS|SUCCEEDED|CAPTURED|APPROVED)$/i;
export async function POST(request:Request){
 try{
 const raw=await request.text();if(raw.length>65536)return new Response(null,{status:413});
 const event=JSON.parse(raw);const c=kashierConfig();const data=event?.data;
 if(!data||!verifyKashierSignature(data,request.headers.get('x-kashier-signature'),c.apiKey)){console.warn('Kashier webhook rejected: invalid signature or payload');return new Response(null,{status:401});}
 const successful=['pay','capture'].includes(String(event.event).toLowerCase()) && /^(SUCCESS|PAID|CAPTURED)$/i.test(String(data.status)) && String(data.method).toLowerCase()==='card' && /^(00|0)$/.test(String(data.transactionResponseCode));
 if(!successful){console.info('Kashier webhook ignored non-captured event',{event:event.event,status:data.status,method:data.method,responseCode:data.transactionResponseCode,orderId:data.merchantOrderId});return new Response(null,{status:200});}
 if(!/^[0-9a-f-]{36}$/i.test(data.merchantOrderId))return new Response(null,{status:400});
 if(typeof data.transactionId!=='string'||!data.transactionId.trim())return new Response(null,{status:400});
 const db=createAdminClient();const {data:order,error}=await db.from('kashier_orders').select('*').eq('id',data.merchantOrderId).maybeSingle();
 if(error)throw error;if(!order||order.mode!==c.mode){console.error('Kashier webhook order missing or mode mismatch',{orderId:data.merchantOrderId});return new Response(null,{status:400});}
 if(amountInPiastres(data.amount)!==amountInPiastres(order.amount)||data.currency!==order.currency){console.error('Kashier webhook amount/currency mismatch',{orderId:order.id});return new Response(null,{status:400});}
 // The HMAC-verified webhook is the payment authority. settle_kashier_order
 // re-checks the amount, currency, expiry and row state server-side and is
 // idempotent, so a retried or replayed event settles exactly once.
 const {error:settleError}=await db.rpc('settle_kashier_order',{p_order:order.id,p_transaction:String(data.transactionId),p_amount:data.amount,p_currency:data.currency});
 if(settleError)throw settleError;
 console.info('Kashier webhook settled',{orderId:order.id,kind:order.kind});
 // Best-effort independent confirmation, audit only. This is NOT a gate:
 // the read endpoint returns {message,data:{status,history,...}} and can
 // 404 for purged sessions, so blocking settlement on it left every paid
 // order stuck in "pending" with no confirmation sent.
 if(order.session_id){
  try{
   const read=await kashierRequest(`/v3/payment/sessions/${encodeURIComponent(order.session_id)}/payment`,undefined,{timeoutMs:8000});
   const session=read&&typeof read==='object'&&'data' in read?read.data:read;
   const sessionStatus=typeof session?.status==='string'?session.status:'';
   if(sessionStatus&&!PAID_TRANSACTION_STATUSES.test(sessionStatus))console.warn('Kashier session not confirmed paid after settlement',{orderId:order.id,sessionStatus,history:Array.isArray(session?.history)?session.history.length:0});
   else console.info('Kashier settlement',{orderId:order.id,sessionStatus:sessionStatus||null,history:Array.isArray(session?.history)?session.history.length:0});
  }catch(verifyError){console.warn('Kashier session read failed after settlement',{orderId:order.id,error:verifyError instanceof Error?verifyError.message:String(verifyError)});}
 }
 return new Response(null,{status:200});
 }catch(error){console.error('Kashier webhook failed',error);return new Response(null,{status:503});}
}
