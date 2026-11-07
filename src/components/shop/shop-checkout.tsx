"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import Image from 'next/image';
import { CreditCard, Wallet, ArrowLeftRight, MapPin, Truck, UploadCloud, FileCheck2, LoaderCircle } from 'lucide-react';
import { ProductPhotoPreview } from './product-photo-preview';
import { formatMoney, INSTAPAY_LINK, E_WALLET_NUMBER } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { KashierButton } from '@/components/payments/kashier-button';
import { shopTotal, type ShopProduct, type ShopOrder } from '@/lib/shop';
import styles from './shop.module.css';
export function ShopCheckout() {
    const { lang } = useI18n();
    const ar = lang === 'ar';
    const params = useSearchParams();
    const router = useRouter();
    const variantId = params.get('variant');
    const resumeId = params.get('order');
    const request = useRef<string>();
    const receiptInput = useRef<HTMLInputElement>(null);
    const [quantity, setQuantity] = useState(1);
    const [fulfillment, setFulfillment] = useState('collection');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [busy, setBusy] = useState(false);
    const [createdOrder, setOrder] = useState<ShopOrder | null>(null);
    const [method, setMethod] = useState('instapay');
    const [receipt, setReceipt] = useState('');
    const [guestSession, setGuest] = useState(false);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [now,setNow]=useState(Date.now());
    const q = useQuery({ queryKey: ['shop-checkout', variantId, resumeId], queryFn: async () => { const db = createClient(); const { data: { user } } = await db.auth.getUser(); setGuest(!user); if (resumeId) {
            let o: ShopOrder; let e: unknown;
            const memberResult = user ? await db.from('shop_orders').select('*').eq('id', resumeId).eq('member_id', user.id).maybeSingle() : null;
            if (memberResult?.data) { o=memberResult.data; e=memberResult.error; }
            else { const response = await fetch('/api/shop/guest/orders', {cache:'no-store'}); const result = await response.json(); o = result.orders?.find((entry: ShopOrder) => entry.id === resumeId); e = !response.ok || !o ? Error('Order not found in this browser') : null; if(o)setGuest(true); }
            if (e)
                throw e;
            if (o.status !== 'awaiting_payment' || Date.parse(o.hold_until) <= Date.now())
                throw Error(ar ? 'الطلب لم يعد بانتظار الدفع' : 'Order is no longer awaiting payment');
            return { id: '', name: o.product_name, price: o.unit_price, variants: [{ id: o.variant_id, color: o.color, size: o.size, stock: o.quantity, images: o.product_image ? [o.product_image] : [] }], resumeOrder: o } as ShopProduct & {
                resumeOrder: ShopOrder;
            };
        } const { data, error } = await db.from('shop_products').select('*,variants:shop_variants(*)').eq('published', true); if (error)
            throw error; const p = (data as ShopProduct[]).find(p => p.variants.some(v => v.id === variantId)); return p ?? null; } });
    useEffect(() => { request.current = crypto.randomUUID(); setOrder(null); }, [variantId, resumeId]);
    const product = q.data;
    const order = createdOrder ?? (product && 'resumeOrder' in product ? product.resumeOrder as ShopOrder : null);
    const guest = order ? order.member_id == null : guestSession;
    const variant = product?.variants.find(v => v.id === (order?.variant_id ?? variantId));
    const photo = order?.product_image || variant?.images?.[0];
    const money = (n: number) => formatMoney(n, lang);
    const expired = !!order && Date.parse(order.hold_until)<=now;
    const orderId = order?.id;
    useEffect(()=>{if(!orderId)return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return ()=>window.clearInterval(timer);},[orderId]);
    async function createOrder(e: React.FormEvent) { e.preventDefault(); if (!variant || !request.current)
        return; setBusy(true); try {
        const db = createClient();
        const {data:{user}}=await db.auth.getUser();
        if (!user) {
            setGuest(true);
            const response = await fetch('/api/shop/guest/orders', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({variant:variant.id,quantity,fulfillment,name,phone,address:fulfillment==='delivery'?address:'',requestId:request.current})});
            const result = await response.json(); if(!response.ok) throw Error(result.error || 'Could not create order'); setOrder(result.order);
        } else {
            const { data, error } = await db.rpc('create_shop_order', { p_variant: variant.id, p_quantity: quantity, p_fulfillment: fulfillment, p_name: name, p_phone: phone, p_address: fulfillment === 'delivery' ? address : '', p_request: request.current });
            if (error) throw error;
            const result = await db.from('shop_orders').select('*').eq('id', data).single();
            if (result.error) throw result.error;
            setOrder(result.data as ShopOrder);
        }
    }
    catch (e) {
        toast.error(e instanceof Error ? e.message : (e as {
            message?: string;
        })?.message ?? 'Could not create order');
    }
    finally {
        setBusy(false);
    } }
    async function upload(file: File) { if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 8 * 1024 * 1024) {
        toast.error(ar ? 'ارفع صورة أو PDF بحد أقصى ٨ ميجا.' : 'Use a receipt image or PDF up to 8 MB.');
        return;
    } if (guest) { setReceiptFile(file); setReceipt(file.name); return; } setBusy(true); try {
        const db = createClient();
        const { data: { user } } = await db.auth.getUser();
        if (!user)
            throw Error('Sign in first');
        const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${user.id}/shop-${crypto.randomUUID()}.${ext}`;
        const { error } = await db.storage.from('game-fee-receipts').upload(path, file);
        if (error)
            throw error;
        setReceipt(path);
        setReceiptFile(file);
    }
    catch {
        toast.error(ar ? 'تعذر رفع الإيصال' : 'Could not upload receipt');
    }
    finally {
        setBusy(false);
    } }
    async function submitReceipt() { if (!order)
        return; setBusy(true); try {
        if(guest) {
            if(!receiptFile) throw Error('Choose your receipt');
            const body=new FormData(); body.set('order',order.id);body.set('method',method);body.set('receipt',receiptFile);
            const response=await fetch('/api/shop/guest/receipt',{method:'POST',body}); const result=await response.json();if(!response.ok)throw Error(result.error);
        } else {
            const {error}=await createClient().rpc('submit_shop_receipt',{p_order:order.id,p_method:method,p_receipt:receipt});if(error)throw error;
        }
        router.push('/shop/orders');
    }
    catch (e) {
        toast.error((e as {
            message?: string;
        })?.message ?? 'Could not submit payment');
    }
    finally {
        setBusy(false);
    } }
    return <main className={styles.shop}><header className={styles.heading}><h1>{ar ? 'إتمام طلبك' : 'Checkout'}</h1><Link href="/shop">← {ar ? 'المتجر' : 'Back to shop'}</Link></header>{q.isPending ? <p role="status">{ar ? 'جاري التحميل…' : 'Loading…'}</p> : q.isError ? <p role="alert">{ar ? 'تعذر تحميل الطلب' : 'Could not load checkout'}</p> : !product || !variant ? <p>{ar ? 'هذا المنتج غير متاح.' : 'This product is unavailable.'}</p> : <div className={styles.checkout}><div className={styles.panel}>{!order ? <form onSubmit={createOrder} className={styles.fields}><h2 className="text-xl font-bold">{ar ? 'بيانات الاستلام' : 'Collection or delivery'}</h2>{guest && <p className={styles.muted}>{ar ? 'اطلب كضيف بدون تسجيل دخول. احتفظ بنفس المتصفح لمتابعة طلبك.' : 'Order as a guest, no sign-in needed. Use this browser to return to your order.'}</p>}<label>{ar ? 'الاسم' : 'Full name'}<input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e => setName(e.target.value)}/></label><label>{ar ? 'الموبايل' : 'Phone'}<input required type="tel" minLength={7} maxLength={30} autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)}/></label><label>{ar ? 'الكمية' : 'Quantity'}<input type="number" required min={1} max={Math.min(10, variant.stock)} value={quantity} onChange={e => setQuantity(Number(e.target.value))}/></label><fieldset className={styles.paymentOptions}><legend>{ar ? 'طريقة الاستلام' : 'Fulfillment'}</legend>{[
 {id:'collection',title:ar?'استلام من التجمع الخامس':'Collect in Fifth Settlement',description:ar?'القاهرة الجديدة · بدون رسوم استلام':'New Cairo · Free collection',Icon:MapPin},
 {id:'delivery',title:ar?'توصيل لأي مكان في مصر':'Delivery anywhere in Egypt',description:ar?'٩٠ جنيه رسوم توصيل للطلب':'EGP 90 delivery per order',Icon:Truck}
].map(({id,title,description,Icon})=><label key={id} className={styles.paymentOption} data-selected={fulfillment===id}><span className={styles.paymentIcon}><Icon size={22}/></span><span className={styles.paymentCopy}><strong>{title}</strong><small>{description}</small></span><input type="radio" name="shop-fulfillment" value={id} checked={fulfillment===id} disabled={busy} onChange={()=>setFulfillment(id)}/></label>)}</fieldset>{fulfillment === 'delivery' && <label>{ar ? 'العنوان بالكامل' : 'Full delivery address'}<textarea required minLength={10} maxLength={500} autoComplete="street-address" value={address} onChange={e => setAddress(e.target.value)}/></label>}<p className={styles.muted}>{ar ? 'بعد اعتماد الدفع، سنتواصل معك لتنسيق الاستلام من التجمع الخامس بالقاهرة الجديدة أو التوصيل لعنوانك في أي مكان في مصر.' : 'After payment approval, we will contact you to arrange collection in Fifth Settlement, New Cairo, or delivery to your address anywhere in Egypt.'}</p><Button disabled={busy || variant.stock < 1} type="submit" className="h-11">{busy ? (ar ? 'جاري حفظ الطلب…' : 'Saving order…') : (ar ? 'متابعة للدفع' : 'Continue to payment')}</Button></form> : expired ? <div className="space-y-3"><p role="alert" className="text-warning-ink">{ar?'انتهت مهلة الطلب. لا تدفع الآن. لو دفعت بالفعل تواصل مع الدعم لمراجعة التحويل.':'This reservation expired. Do not pay now. If you already transferred funds, contact support for review.'}</p><Link href="/shop/orders" className="text-secondary underline">{ar?'طلباتي':'My orders'}</Link></div> : <div className={styles.fields}><h2 className="text-xl font-bold">{ar ? 'اختار طريقة الدفع' : 'Choose payment method'}</h2><p className={styles.muted}>{ar?'المخزون محجوز حتى':'Stock reserved until'} {new Date(order.hold_until).toLocaleTimeString(ar?'ar-EG':'en-GB',{hour:'2-digit',minute:'2-digit'})}</p><fieldset className={styles.paymentOptions}><legend>{ar ? 'طريقة الدفع' : 'Payment method'}</legend>{[
 {id:'instapay',title:'InstaPay',description:ar?'تحويل فوري ثم إرسال إيصال الدفع':'Instant transfer, then upload your receipt',Icon:ArrowLeftRight},
 {id:'e_wallet',title:ar?'محفظة إلكترونية':'Mobile wallet',description:ar?'حوّل للمحفظة ثم أرسل الإيصال للمراجعة':'Transfer to the wallet and submit your receipt',Icon:Wallet},
 {id:'kashier',title:ar?'بطاقة بنكية':'Credit / debit card',description:'Visa · Mastercard · Meeza',Icon:CreditCard}
].map(({id,title,description,Icon})=><label key={id} className={styles.paymentOption} data-selected={method===id}><span className={styles.paymentIcon}><Icon size={22}/></span><span className={styles.paymentCopy}><strong>{title}</strong><small>{description}</small></span><input type="radio" name="shop-payment-method" value={id} checked={method===id} disabled={busy} onChange={()=>setMethod(id)}/></label>)}</fieldset>{method === 'kashier' ? <KashierButton target={{ kind: 'shop', targetId: order.id }} disabled={busy}/> : <><div className="rounded-xl border bg-accent p-4 text-accent-foreground">{method === 'instapay' ? <a href={INSTAPAY_LINK} target="_blank" rel="noopener noreferrer" className="font-semibold underline">{ar ? 'افتح InstaPay للتحويل' : 'Open InstaPay to transfer'}</a> : <p dir="ltr" className="font-mono text-lg font-bold">{E_WALLET_NUMBER}</p>}<p className="mt-2 font-bold">{money(Number(order.total))}</p></div><div className={styles.receiptUpload} data-selected={!!receipt}>
 <span className={styles.receiptIcon}>{busy?<LoaderCircle size={25} className="animate-spin"/>:receipt?<FileCheck2 size={25}/>:<UploadCloud size={25}/>}</span>
 <div className={styles.receiptCopy}><strong>{ar?'إيصال الدفع':'Payment receipt'}</strong><p>{receiptFile?.name || (ar?'أرفق إثبات التحويل لإكمال طلبك':'Attach your transfer receipt to complete your order')}</p><small>{ar?'صورة JPG أو PNG أو WebP أو ملف PDF · حتى ٨ ميجا':'JPG, PNG, WebP or PDF · up to 8 MB'}</small></div>
 <input ref={receiptInput} className="hidden" type="file" aria-label={ar?'اختيار إيصال الدفع':'Choose payment receipt'} accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);}}/>
 <Button type="button" variant="outline" disabled={busy} onClick={()=>receiptInput.current?.click()} className="w-full sm:w-auto"><UploadCloud size={16}/>{busy?(ar?'جاري المعالجة…':'Processing…'):receipt?(ar?'تغيير الإيصال':'Replace receipt'):(ar?'رفع إيصال الدفع':'Upload receipt')}</Button>
 {receipt&&<p role="status" className="text-xs font-medium text-success-ink">{guest?(ar?'الإيصال جاهز للإرسال':'Receipt ready to submit'):(ar?'تم رفع الإيصال بنجاح':'Receipt uploaded successfully')}</p>}
 </div><Button onClick={() => void submitReceipt()} disabled={busy || !receipt}>{ar ? 'إرسال الإيصال للمراجعة' : 'Submit receipt for review'}</Button></>}<Link href="/shop/orders" className="text-sm text-secondary">{ar ? 'عرض طلباتي' : 'View my orders'}</Link></div>}</div><aside className={`${styles.panel} ${styles.summary}`}><h2 className="text-xl font-bold">{ar ? 'ملخص الطلب' : 'Order summary'}</h2>{photo && <ProductPhotoPreview src={photo} alt={`${order?.product_name ?? product.name} — ${variant.color}`}><Image src={photo} alt={`${order?.product_name ?? product.name} — ${variant.color}`} width={320} height={240} unoptimized className="h-48 w-full rounded-xl bg-muted/30 object-contain"/></ProductPhotoPreview>}<p className="font-semibold">{order?.product_name ?? product.name}</p><div><span>{ar ? 'اللون / المقاس' : 'Color / size'}</span><strong>{variant.color} / {variant.size}</strong></div><div><span>{ar ? 'المنتجات' : 'Products'}</span><strong>{money(Number(order?.unit_price ?? product.price) * Number(order?.quantity ?? quantity))}</strong></div><div><span>{ar ? 'التوصيل' : 'Delivery'}</span><strong>{money(order ? Number(order.delivery_fee) : fulfillment === 'delivery' ? 90 : 0)}</strong></div><div className={styles.total}><span>{ar ? 'الإجمالي' : 'Total'}</span><strong>{money(order ? Number(order.total) : shopTotal(Number(product.price), quantity, fulfillment))}</strong></div>{order&&<div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="font-semibold">{order.customer_name}</p><p>{order.phone}</p><p>{order.fulfillment==='delivery'?order.address:(ar?'استلام من التجمع الخامس، القاهرة الجديدة — سنتواصل معك للتنسيق':'Collection — Fifth Settlement, New Cairo. We will contact you to arrange pickup.')}</p></div>}<p className={styles.muted}>{ar ? 'الدفع بالتحويل يحتاج مراجعة الإيصال.' : 'Transfer payments are confirmed after receipt review.'}</p></aside></div>}</main>;
}
