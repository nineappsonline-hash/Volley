import {NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {kashierConfig,kashierRequest} from '@/lib/payments/kashier';
const schema=z.object({kind:z.enum(['academy','share','rent','subscription']),targetId:z.string().uuid().optional(),inviteCode:z.string().max(100).nullish(),planKind:z.enum(['member','academy']).optional(),plan:z.enum(['pro','plus','elite']).optional(),cycle:z.enum(['monthly','semi','yearly']).optional(),lang:z.enum(['en','ar']).default('en')});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Invalid origin'},{status:403});
 const {data:{user}}=await createClient().auth.getUser();if(!user)return NextResponse.json({error:'Sign in first'},{status:401});
 const input=schema.safeParse(await request.json().catch(()=>null));if(!input.success)return NextResponse.json({error:'Invalid payment request'},{status:400});
 try{
 const c=kashierConfig();const db=createAdminClient();
 const {error:expiryError}=await db.rpc('expire_kashier_holds');if(expiryError)throw expiryError;
 const {data:order,error}=await db.rpc('prepare_kashier_order',{p_user:user.id,p_request:input.data,p_mode:c.mode});
 if(error)return NextResponse.json({error:error.message},{status:400});
 if(order.session_url)return NextResponse.json({url:order.session_url});
 if(!order.is_new)return NextResponse.json({error:'Checkout is being prepared. Please retry shortly.'},{status:409});
 const expiresAt=new Date(order.expires_at);if(Number.isNaN(expiresAt.getTime()))throw new Error('Kashier order has no valid expiry');
 const session=await kashierRequest('',{merchantId:c.merchantId,mode:c.mode,order:order.id,amount:Number(order.amount).toFixed(2),currency:'EGP',expireAt:expiresAt.toISOString(),paymentType:'credit',type:'one-time',maxFailureAttempts:3,allowedMethods:'card',defaultMethod:'card',manualCapture:false,enable3DS:true,retrieveSavedCard:false,display:input.data.lang,merchantRedirect:`${c.origin}/payment-result?order=${order.id}`,serverWebhook:`${c.origin}/webhook`,failureRedirect:true,customer:{email:user.email,reference:user.id},description:'Playza payment'});
 const sessionUrl=typeof session?.sessionUrl==='string'?session.sessionUrl:'';if(!sessionUrl)throw new Error('Kashier returned no checkout URL');
 const url=new URL(sessionUrl);if(url.protocol!=='https:'||!(url.hostname==='payments.kashier.io'||url.hostname.endsWith('.kashier.io')))throw new Error(`Untrusted checkout host: ${url.hostname}`);
 const sessionId=String(session?._id??session?.sessionId??url.pathname.split('/').filter(Boolean).pop()??'');if(!sessionId)throw new Error('Kashier returned no session id');
 const {error:saveError}=await db.from('kashier_orders').update({session_id:sessionId,session_url:url.toString()}).eq('id',order.id);
 if(saveError)throw saveError;
 return NextResponse.json({url:url.toString()});
 }catch(error){console.error('Kashier checkout failed',{userId:user.id,request:input.data,error});return NextResponse.json({error:'Could not open card checkout. Please retry later; do not pay again if your card was charged.'},{status:503});}
}
