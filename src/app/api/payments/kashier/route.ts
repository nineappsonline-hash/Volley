import {NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {kashierConfig,kashierHostedCheckoutUrl,kashierRequest} from '@/lib/payments/kashier';
const schema=z.object({kind:z.enum(['academy','share','rent','subscription','shop']),targetId:z.string().uuid().optional(),guests:z.array(z.object({name:z.string().trim().min(1).max(100),gender:z.enum(['','male','female']),age:z.string().regex(/^([0-9]{1,3})?$/)})).max(20).optional(),inviteCode:z.string().max(100).nullish(),planKind:z.enum(['member','academy']).optional(),plan:z.enum(['pro','plus','elite']).optional(),cycle:z.enum(['monthly','semi','yearly']).optional(),lang:z.enum(['en','ar']).default('en')});
export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin && origin!==new URL(request.url).origin)return NextResponse.json({error:'Invalid origin'},{status:403});
 const {data:{user}}=await createClient().auth.getUser();if(!user)return NextResponse.json({error:'Sign in first'},{status:401});
 const input=schema.safeParse(await request.json().catch(()=>null));if(!input.success)return NextResponse.json({error:'Invalid payment request'},{status:400});
 try{
 const c=kashierConfig();const db=createAdminClient();
 const {error:expiryError}=await db.rpc('expire_kashier_holds');if(expiryError)throw expiryError;
 let prepared:any;
 try{
  prepared=await db.rpc('prepare_kashier_order',{p_user:user.id,p_request:input.data,p_mode:c.mode});
 }catch(err:any){
  const msg=err?.message||String(err);
  return NextResponse.json({error:msg},{status:400});
 }
 if(prepared?.error)return NextResponse.json({error:prepared.error.message},{status:400});
 let order=prepared.data;
 if(!order.session_url&&!order.is_new){
  // A previous attempt reserved this order but never stored a checkout session
  // (e.g. Kashier/network failure). Expire it, release any provisional hold and
  // reserve a fresh order so a new session can open without colliding with the
  // abandoned one.
  console.warn('Kashier re-reserving an order with no checkout session',{orderId:order.id});
  const {error:resetError}=await db.from('kashier_orders').update({expires_at:new Date().toISOString()}).eq('id',order.id).is('session_url',null);
  if(resetError)throw resetError;
  const {error:releaseError}=await db.rpc('expire_kashier_holds');if(releaseError)throw releaseError;
  let retry:any;
  try{
   retry=await db.rpc('prepare_kashier_order',{p_user:user.id,p_request:input.data,p_mode:c.mode});
  }catch(err:any){
   const msg=err?.message||String(err);
   return NextResponse.json({error:msg},{status:400});
  }
  if(retry?.error)return NextResponse.json({error:retry.error.message},{status:400});
  order=retry.data;
 }
 if(order.session_url)return NextResponse.json({url:order.session_url});
 const expiresAt=new Date(order.expires_at);if(Number.isNaN(expiresAt.getTime()))throw new Error('Kashier order has no valid expiry');
 const merchantRedirect=`${c.origin}/payment-result?order=${order.id}`;
 const serverWebhook=`${c.origin}/webhook`;
 let checkoutUrl:string;
 try{
  const session=await kashierRequest('/v3/payment/sessions',{merchantId:c.merchantId,order:order.id,amount:Number(order.amount).toFixed(2),currency:'EGP',expireAt:expiresAt.toISOString(),paymentType:'credit',type:'one-time',maxFailureAttempts:3,allowedMethods:'card',defaultMethod:'card',manualCapture:false,enable3DS:true,retrieveSavedCard:false,display:input.data.lang,merchantRedirect,serverWebhook,failureRedirect:true,customer:{email:user.email,reference:user.id},description:'Playza payment'});
  const sessionUrl=typeof session?.sessionUrl==='string'?session.sessionUrl:'';if(!sessionUrl)throw new Error('Kashier returned no checkout URL');
  const url=new URL(sessionUrl);if(url.protocol!=='https:'||!(url.hostname==='payments.kashier.io'||url.hostname.endsWith('.kashier.io')))throw new Error(`Untrusted checkout host: ${url.hostname}`);
  const sessionId=String(session?._id??session?.sessionId??url.pathname.split('/').filter(Boolean).pop()??'');if(!sessionId)throw new Error('Kashier returned no session id');
  const {error:saveError}=await db.from('kashier_orders').update({session_id:sessionId,session_url:url.toString()}).eq('id',order.id);
  if(saveError)throw saveError;
  checkoutUrl=url.toString();
 }catch(sessionError){
  console.warn('Kashier session API unavailable; using signed hosted checkout URL',{orderId:order.id,error:sessionError});
  const hosted=kashierHostedCheckoutUrl({orderId:order.id,amount:Number(order.amount).toFixed(2),lang:input.data.lang,merchantRedirect,serverWebhook});
  const {error:saveError}=await db.from('kashier_orders').update({session_url:hosted.toString()}).eq('id',order.id);
  if(saveError)throw saveError;
  checkoutUrl=hosted.toString();
 }
 return NextResponse.json({url:checkoutUrl});
 }catch(error){console.error('Kashier checkout failed',{userId:user.id,request:input.data,error});return NextResponse.json({error:'Could not open card checkout. Please retry later; do not pay again if your card was charged.'},{status:503});}
}
