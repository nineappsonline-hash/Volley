"use client";
import {useState} from 'react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {useI18n} from '@/lib/i18n';
export type CardPaymentTarget={kind:'academy'|'share'|'rent'|'subscription';targetId?:string;inviteCode?:string|null;planKind?:'academy'|'member';plan?:string;cycle?:string};
export function KashierButton({target,disabled=false}:{target:CardPaymentTarget;disabled?:boolean}) {
 const {lang}=useI18n();const [busy,setBusy]=useState(false);
 return <Button type="button" className="h-auto min-h-11 w-full whitespace-normal" disabled={busy||disabled} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/payments/kashier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...target,lang})});const data=await r.json();if(!r.ok)throw new Error(data.error??'Could not start card payment');window.location.assign(data.url);}catch(e){toast.error(e instanceof Error?e.message:'Could not start card payment');setBusy(false);}}}>{busy?(lang==='ar'?'جارٍ فتح صفحة الدفع…':'Opening checkout…'):(lang==='ar'?'ادفع بالبطاقة — Visa / Mastercard / Meeza':'Pay by card — Visa / Mastercard / Meeza')}</Button>;
}
