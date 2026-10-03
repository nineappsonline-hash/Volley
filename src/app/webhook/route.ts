import {createAdminClient} from '@/lib/supabase/admin';
import {amountInPiastres,kashierConfig,kashierRequest,verifyKashierSignature} from '@/lib/payments/kashier';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
 const raw=await request.text();if(raw.length>65536)return new Response(null,{status:413});
 const event=JSON.parse(raw);const c=kashierConfig();const data=event?.data;
 if(!data||!verifyKashierSignature(data,request.headers.get('x-kashier-signature'),c.apiKey))return new Response(null,{status:401});
 if(!['pay','capture'].includes(event.event)||data.status!=='SUCCESS'||data.method!=='card'||String(data.transactionResponseCode)!=='00')return new Response(null,{status:200});
 if(!/^[0-9a-f-]{36}$/i.test(data.merchantOrderId))return new Response(null,{status:400});
 const db=createAdminClient();const {data:order,error}=await db.from('kashier_orders').select('*').eq('id',data.merchantOrderId).maybeSingle();
 if(error)throw error;if(!order||order.mode!==c.mode)return new Response(null,{status:400});
 if(amountInPiastres(data.amount)!==amountInPiastres(order.amount)||data.currency!=='EGP')return new Response(null,{status:400});
 if(!order.session_id)return new Response(null,{status:503});
 // Independently confirm captured funds; the event name is not part of the HMAC.
 const session=await kashierRequest(`/${encodeURIComponent(order.session_id)}`);
 if(session.status!=='PAID'||session.merchantId!==c.merchantId||session.paymentParams?.order!==order.id||session.paymentParams?.currency!=='EGP'||amountInPiastres(session.capturedAmount)!==amountInPiastres(order.amount)||Number(session.refundedAmount)!==0)return new Response(null,{status:503});
 const {error:settleError}=await db.rpc('settle_kashier_order',{p_order:order.id,p_transaction:String(data.transactionId),p_amount:data.amount,p_currency:data.currency});if(settleError)throw settleError;
 return new Response(null,{status:200});
 }catch{return new Response(null,{status:503});}
}
