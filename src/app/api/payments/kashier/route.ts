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
 const session=await kashierRequest('',{merchantId:c.merchantId,mode:c.mode,order:order.id,amount:Number(order.amount).toFixed(2),currency:'EGP',expireAt:order.expires_at,paymentType:'credit',type:'one-time',maxFailureAttempts:3,allowedMethods:'card',defaultMethod:'card',manualCapture:false,enable3DS:true,retrieveSavedCard:false,display:input.data.lang,merchantRedirect:`${c.origin}/payment-result?order=${order.id}`,serverWebhook:`${c.origin}/webhook`,failureRedirect:true,customer:{email:user.email,reference:user.id},description:'Playza payment'});
 const url=new URL(session.sessionUrl);if(url.protocol!=='https:'||url.hostname!=='payments.kashier.io'||!session._id)throw new Error('Unexpected checkout response');
 const {error:saveError}=await db.from('kashier_orders').update({session_id:session._id,session_url:url.toString()}).eq('id',order.id);
 if(saveError)throw new Error('Checkout could not be saved');
 return NextResponse.json({url:url.toString()});
 }catch{return NextResponse.json({error:'Could not open card checkout. Please retry later; do not pay again if your card was charged.'},{status:503});}
}
