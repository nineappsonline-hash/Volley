const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks){const out={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>mocks[id]??require(id),out);return out;}
(async()=>{
 const {paymentReviewStatus}=load('src/lib/payments/review-status.ts',{});
 assert.equal(paymentReviewStatus('pending','kashier',{status:'paid'}),'approved');
 assert.equal(paymentReviewStatus('pending','kashier',{status:'pending'}),'awaiting_payment');
 assert.equal(paymentReviewStatus('pending','kashier',{status:'review_required'}),'review_required');
 assert.equal(paymentReviewStatus('approved','kashier',{status:'paid',details:{admin_review:'rejected'}}),'rejected');
 assert.equal(paymentReviewStatus('pending','instapay'),'pending');
 const order={id:'order',session_id:'session',mode:'live',amount:75,currency:'EGP'};
 let calls=[],session={merchantId:'merchant',merchantOrderId:'order',amount:'75.00',currency:'EGP',status:'PAID',transactionId:'tx'};
 const config={mode:'live',merchantId:'merchant'};
 let orderSearch={data:[{merchantOrderId:'order',status:'CAPTURED',totalCapturedAmount:'75',transactions:[{operation:'pay',status:'SUCCESS',transactionResponseCode:'00',transactionId:'tx-order'}]}]};
 let details={body:{merchantOrderId:'order',amount:'75',currency:'EGP',status:'SUCCESS',isReversed:false,isVoided:false}};
 const {verifiedCardTransaction}=load('src/lib/payments/reconcile.ts',{'./kashier':{
  kashierConfig:()=>config, amountInPiastres:v=>v==null?null:Number(v)*100,
  kashierRequest:async path=>{calls.push(path);if(path.startsWith('/v3/payment/orders'))return orderSearch;if(path.startsWith('/v2/aggregator/transactions'))return details;return {data:session};}
 }});
 assert.equal(await verifiedCardTransaction(order),'tx');
 for(const status of ['PENDING','AUTHORIZED','FAILED','EXPIRED','REFUNDED']){session.status=status;assert.equal(await verifiedCardTransaction(order),'tx-order');}
 session.status='PAID';
 for(const field of ['merchantId','merchantOrderId','amount','currency']){const old=session[field];session[field]='wrong';await assert.rejects(verifiedCardTransaction(order),/mismatch/);session[field]=old;}
 assert.equal(await verifiedCardTransaction({...order,session_id:null}),'tx-order');
 details.body.amount='30';await assert.rejects(verifiedCardTransaction({...order,session_id:null}),/amount mismatch/);details.body.amount='75';
 orderSearch.data[0].status='AUTHORIZED';assert.equal(await verifiedCardTransaction({...order,session_id:null}),null);orderSearch.data[0].status='CAPTURED';
 assert.equal(await verifiedCardTransaction({...order,mode:'test'}),null);
 let allowed=true,user={id:'actor'},rpcError=false,settles=0,reviews=0,proof='tx';
 const apiClient={auth:{getUser:async()=>({data:{user}})},rpc:async()=>({data:allowed})};
 const query={select(){return this},eq(){return this},not(){return this},order(){return this},limit:async()=>({data:[order]})};
 const db={from:()=>query,rpc:async(name,args)=>{if(name==='settle_kashier_order')settles++;if(name==='review_card_payment'){reviews++;assert.equal(args.p_actor,'actor');}return {error:rpcError?{message:'private database error'}:null}}};
 const {POST}=load('src/app/api/platform-admin/card-payments/route.ts',{
  'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},
  '@/lib/supabase/server':{createClient:()=>apiClient},'@/lib/supabase/admin':{createAdminClient:()=>db},
  '@/lib/payments/kashier':{kashierConfig:()=>config},'@/lib/payments/reconcile':{verifiedCardTransaction:async()=>proof}
 });
 const request=(body,origin='https://playza.test')=>new Request('https://playza.test/api/platform-admin/card-payments',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await POST(request({action:'refresh'},'https://evil.test'))).status,403);
 user=null;assert.equal((await POST(request({action:'refresh'}))).status,401);user={id:'actor'};
 allowed=false;assert.equal((await POST(request({action:'refresh'}))).status,403);allowed=true;
 proof=null;assert.equal((await POST(request({action:'refresh'}))).body.confirmed,0);assert.equal(settles,0);
 proof='tx';assert.equal((await POST(request({action:'refresh'}))).body.confirmed,1);assert.equal(settles,1);
 const input={action:'review',orderId:'00000000-0000-0000-0000-000000000001',approve:false};
 assert.equal((await POST(request(input))).status,200);assert.equal(reviews,1);
 rpcError=true;const result=await POST(request(input));assert.equal(result.status,409);assert.ok(!JSON.stringify(result).includes('private database'));
 console.log('PASS: payment statuses, authenticated admin actions, provider identity/amount/currency checks, no false success, fallback, review and safe errors');
})().catch(e=>{console.error(e);process.exit(1)});
