"use client";
import {Suspense,useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/client';
import {useI18n} from '@/lib/i18n';
import {Button} from '@/components/ui/button';
function Result(){
 const params=useSearchParams();const id=params.get('order');const {lang}=useI18n();const ar=lang==='ar';
 const [status,setStatus]=useState('checking');
useEffect(()=>{let active=true;let timer:ReturnType<typeof setTimeout>;let attempts=0;
  const check=async()=>{if(!id||!/^[0-9a-f-]{36}$/i.test(id)){setStatus('unknown');return;}const {data,error}=await createClient().from('kashier_orders').select('status,expires_at').eq('id',id).maybeSingle();if(!active)return;if(error||!data){setStatus('unknown');return;}setStatus(data.status==='pending'&&Date.parse(data.expires_at)<Date.now()?'expired':data.status);if(data.status==='pending'&&++attempts<30){if(attempts>=3){try{const r=await fetch('/api/payments/kashier/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:id})});if(active&&r.ok){const j=await r.json();if(j?.status==='paid'){setStatus('paid');return;}}}catch{}}timer=setTimeout(check,3000);}};void check();return()=>{active=false;clearTimeout(timer);};},[id]);
 const messages:Record<string,string>={checking:ar?'جارٍ التحقق من الدفع…':'Checking payment…',pending:ar?'ننتظر تأكيد الدفع. لا تدفع مرة أخرى إذا تم خصم المبلغ.':'Waiting for payment confirmation. Do not pay again if your card was charged.',paid:ar?'تم الدفع بنجاح وتأكيد طلبك.':'Payment successful. Your order is confirmed.',review_required:ar?'تم استلام المبلغ، لكن الحجز يحتاج مراجعة الإدارة. لا تدفع مرة أخرى.':'Payment received, but your booking needs admin review. Do not pay again.',expired:ar?'انتهت مهلة الدفع. إذا تم الخصم، انتظر التأكيد أو تواصل مع الدعم قبل إعادة الدفع.':'Checkout expired. If charged, wait for confirmation or contact support before paying again.',unknown:ar?'سجّل الدخول بالحساب الذي دفع لعرض النتيجة.':'Sign in with the paying account to view the payment result.'};
 return <main className="mx-auto max-w-lg space-y-5 p-5 py-12"><h1 className="text-2xl font-bold">{ar?'حالة الدفع':'Payment status'}</h1><p role="status">{messages[status]}</p><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={()=>window.location.reload()}>{ar?'تحديث':'Refresh'}</Button><Button asChild><Link href="/dashboard">{ar?'لوحة التحكم':'Dashboard'}</Link></Button><Button asChild variant="outline"><Link href="/academy-bookings">{ar?'حجوزاتي':'My bookings'}</Link></Button></div></main>;
}
export default function PaymentResult(){return <Suspense><Result/></Suspense>;}
