import { createHmac, timingSafeEqual } from "node:crypto";

export function kashierConfig() {
 const apiKey=process.env.KASHIER_API_KEY, secret=process.env.KASHIER_SECRET_KEY, merchantId=process.env.KASHIER_MERCHANT_ID;
 const mode=process.env.KASHIER_MODE;
 if(!apiKey||!secret||!merchantId||!['live','test'].includes(mode??'')) throw new Error('Card payments are not configured');
 const origin=process.env.KASHIER_SITE_URL ?? 'https://playza.nineapps.online';
 if(new URL(origin).protocol!=='https:') throw new Error('Payment site must use HTTPS');
 return {apiKey,secret,merchantId,mode,origin,api:mode==='live'?'https://api.kashier.io':'https://test-api.kashier.io'};
}
export function verifyKashierSignature(data:Record<string,unknown>,signature:string|null,key:string) {
 const keys=data.signatureKeys;
 const required=['amount','currency','merchantOrderId','status','transactionId','method','transactionResponseCode'];
 if(!signature||! /^[a-f0-9]{64}$/i.test(signature)||!Array.isArray(keys)||keys.length>30||new Set(keys).size!==keys.length||!required.every(k=>keys.includes(k)))return false;
 if(!keys.every(k=>typeof k==='string'&&Object.hasOwn(data,k)&&['string','number','boolean'].includes(typeof data[k])))return false;
 const payload=[...keys].sort().map(k=>`${k}=${encodeURIComponent(String(data[k]))}`).join('&');
 return timingSafeEqual(createHmac('sha256',key).update(payload).digest(),Buffer.from(signature,'hex'));
}
export function amountInPiastres(value:unknown):number|null {
 const raw=String(value);if(!/^\d+(\.\d{1,2})?$/.test(raw))return null;
 const [whole,fraction='']=raw.split('.');const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(result)&&result>0?result:null;
}
export async function kashierRequest(path:string,body?:unknown,options?:{timeoutMs?:number}) {
 const c=kashierConfig();
 let response:Response;
 try{
  response=await fetch(`${c.api}${path}`,{method:body?'POST':'GET',headers:{Authorization:c.secret,'api-key':c.apiKey,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(options?.timeoutMs??15000)});
 }catch(error){throw new Error(`Kashier request failed: ${error instanceof Error?error.message:'network error'}`);}
 const text=await response.text();
 if(!response.ok)throw new Error(`Kashier responded ${response.status}: ${text.slice(0,500)}`);
 try{return JSON.parse(text);}catch{throw new Error('Kashier returned an unreadable response');}
}
