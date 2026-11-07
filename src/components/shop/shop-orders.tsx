"use client";
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import { formatMoney } from '@/lib/constants';
import Image from 'next/image';
import { ProductPhotoPreview } from './product-photo-preview';
import type { ShopOrder } from '@/lib/shop';
import styles from './shop.module.css';
const statuses: Record<string, [
    string,
    string
]> = { awaiting_payment: ['Awaiting payment', 'بانتظار الدفع'], pending_review: ['Receipt under review', 'الإيصال قيد المراجعة'], paid: ['Paid — preparing your order', 'تم الدفع — جاري تجهيز الطلب'], fulfilled: ['Fulfilled', 'تم التسليم'], rejected: ['Payment rejected', 'تم رفض الدفع'], expired: ['Payment reservation expired', 'انتهت مهلة الدفع'], review_required: ['Payment needs review — do not pay again', 'الدفع يحتاج مراجعة — لا تدفع مرة أخرى'] };
export function ShopOrders() { const { lang } = useI18n(); const ar = lang === 'ar'; const q = useQuery({ queryKey: ['shop-my-orders'], refetchInterval: 15000, queryFn: async () => { const db = createClient(); const { data: { user } } = await db.auth.getUser(); const guestResponse=await fetch('/api/shop/guest/orders',{cache:'no-store'});const guestResult=await guestResponse.json();
    if(!guestResponse.ok)throw Error(guestResult.error);
    const guestOrders=guestResult.orders as ShopOrder[];
    if(!user)return guestOrders;
    const {data,error}=await db.from('shop_orders').select('*').eq('member_id',user.id).order('created_at',{ascending:false}).limit(100);if(error)throw error;
    return [...(data as ShopOrder[]),...guestOrders].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)); } }); return <main className={styles.shop}><header className={styles.heading}><h1>{ar ? 'طلباتي من المتجر' : 'My shop orders'}</h1><Link href="/shop">{ar ? 'متابعة التسوق' : 'Continue shopping'} →</Link></header><div className="space-y-4">{q.isPending ? <p role="status">{ar ? 'جاري التحميل…' : 'Loading…'}</p> : q.isError ? <p role="alert">{ar ? 'تعذر تحميل الطلبات' : 'Could not load orders'}</p> : !q.data?.length ? <p>{ar ? 'لسه مفيش طلبات.' : 'No orders yet.'}</p> : q.data.map(o => <article key={o.id} className={styles.order}><div className={styles.row}>{o.product_image && <span className="w-24 shrink-0"><ProductPhotoPreview src={o.product_image} alt={`${o.product_name} — ${o.color}`}><Image src={o.product_image} alt={`${o.product_name} — ${o.color}`} width={100} height={100} unoptimized className="h-24 w-24 rounded-xl bg-muted/30 object-contain"/></ProductPhotoPreview></span>}<h2 className="font-bold">{o.product_name}</h2><strong className="text-secondary">{formatMoney(Number(o.total), lang)}</strong></div><p>{o.color} · {o.size} · {ar ? 'الكمية' : 'Qty'} {o.quantity}</p><p className="text-sm font-semibold">{statuses[o.status]?.[ar ? 1 : 0] ?? o.status}</p><p className={styles.muted}>{o.fulfillment === 'delivery' ? (ar ? 'توصيل داخل مصر — ٩٠ جنيه' : 'Delivery within Egypt — EGP 90') : (ar ? 'استلام — التجمع الخامس، القاهرة الجديدة' : 'Collection — Fifth Settlement, New Cairo')} · {o.phone}</p>{o.address && <p className={styles.muted}>{o.address}</p>}{o.status === 'awaiting_payment' && Date.parse(o.hold_until) > Date.now() && <Link className="text-sm font-semibold text-secondary" href={`/shop/checkout?order=${o.id}`}>{ar ? 'متابعة الدفع' : 'Continue payment'} →</Link>}<p className="break-all font-mono text-[10px] text-muted-foreground">{o.id}</p></article>)}</div></main>; }
