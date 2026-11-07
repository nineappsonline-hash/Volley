"use client";
/* eslint-disable @next/next/no-img-element -- Product photos use administrator-provided storage URLs. */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, Pencil, Plus, ReceiptText, Shirt, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import { formatMoney } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { productGenderLabel } from '@/lib/shop';
import type { ShopProduct, ShopOrder } from '@/lib/shop';
import { ShopProductForm, blankProduct } from './shop-product-form';
import styles from './shop.module.css';

export function ShopAdmin() {
    const { lang } = useI18n();
    const ar = lang === 'ar';
    const cache = useQueryClient();
    const params = useSearchParams();
    const [tab, setTab] = useState(params.get('tab') === 'orders' ? 'orders' : 'products');
    const [product, setProduct] = useState<ShopProduct | null>(null);
    const editor = useRef<HTMLElement>(null);
    const editingId = product?.id;
    useEffect(() => { if (editingId) editor.current?.scrollIntoView({ block: 'start' }); }, [editingId]);
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const catalog = useQuery({ queryKey: ['shop-admin-products'], queryFn: async () => {
        const { data, error } = await createClient().from('shop_products').select('*,variants:shop_variants(*)').is('deleted_at', null).order('created_at', { ascending: false });
        if (error)
            throw error;
        return data as ShopProduct[];
    } });
    const cardOrders = useQuery({ queryKey: ['shop-admin-card-orders'], refetchInterval: 15000, queryFn: async () => {
        const { data, error } = await createClient().from('kashier_orders').select('id,target_id').eq('kind', 'shop').order('created_at', { ascending: false }).limit(200);
        if (error)
            throw error;
        return data as { id: string; target_id: string }[];
    } });
    const orders = useQuery({ queryKey: ['shop-admin-orders'], refetchInterval: 15000, queryFn: async () => {
        const { data, error } = await createClient().from('shop_orders').select('*').order('created_at', { ascending: false }).limit(200);
        if (error)
            throw error;
        return data as ShopOrder[];
    } });
    async function deleteProduct(entry: ShopProduct) {
        if (busy || !window.confirm(ar ? `حذف «${entry.name_ar || entry.name}» من المتجر؟ ستبقى الطلبات السابقة محفوظة.` : `Delete “${entry.name}” from the shop? Existing orders will be preserved.`)) return;
        setBusy(true);
        try {
            const { error } = await createClient().rpc('delete_shop_product', { p_product: entry.id });
            if (error) throw error;
            if (product?.id === entry.id) { setProduct(null); }
            await Promise.all(['shop-admin-products', 'shop-products', 'shop-featured'].map(key => cache.invalidateQueries({ queryKey: [key] })));
            toast.success(ar ? 'تم حذف المنتج' : 'Product deleted');
        } catch (error) { toast.error((error as Error).message); }
        finally { setBusy(false); }
    }
    async function review(order: ShopOrder, action: string) {
        if (busy)
            return;
        setBusy(true);
        try {
            const { error } = await createClient().rpc('review_shop_order', { p_order: order.id, p_action: action });
            if (error)
                throw error;
            await Promise.all([cache.invalidateQueries({ queryKey: ['shop-admin-orders'] }), cache.invalidateQueries({ queryKey: ['shop-admin-products'] })]);
        }
        catch (e) {
            toast.error((e as { message?: string }).message ?? 'Could not review order');
        }
        finally {
            setBusy(false);
        }
    }
    async function reviewCard(order: ShopOrder, approve: boolean) {
        const card = cardOrders.data?.find(entry => entry.target_id === order.id);
        if (!card)
            return;
        const message = approve
            ? text('Verify receipt of funds in Kashier before approving. This does not charge the card.', 'تأكد من وصول المبلغ في كاشير قبل الاعتماد. لن يتم خصم مبلغ جديد.')
            : text('Reject this record? This does not refund the card. Arrange any refund manually.', 'رفض السجل؟ هذا لا يعيد المبلغ للبطاقة. نفّذ الاسترداد يدويًا.');
        if (!window.confirm(message))
            return;
        setBusy(true);
        try {
            const response = await fetch('/api/platform-admin/card-payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'review', orderId: card.id, approve }) });
            const result = await response.json();
            if (!response.ok)
                throw Error(result.error ?? 'Could not review payment');
            await cache.invalidateQueries({ queryKey: ['shop-admin-orders'] });
            await cache.invalidateQueries({ queryKey: ['shop-admin-products'] });
        }
        catch (e) {
            toast.error((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    async function receipt(order: ShopOrder) {
        if (!order.receipt_url)
            return;
        setBusy(true);
        try {
            const { data, error } = await createClient().storage.from('game-fee-receipts').createSignedUrl(order.receipt_url, 600);
            if (error)
                throw error;
            setPreview(data.signedUrl);
        }
        catch (e) {
            toast.error((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    const text = (en: string, arabic: string) => ar ? arabic : en;
    return <div className={styles.admin}>
        <header className={styles.heading}>
            <div><h1>{text('Playza Shop management', 'إدارة متجر بلايزا')}</h1><p>{text('Products, color photos, sizes, stock and customer orders. Delivery is EGP 90.', 'المنتجات وصور الألوان والمقاسات والمخزون والطلبات. التوصيل ٩٠ جنيه.')}</p></div>
            <div className="flex gap-2"><Button variant={tab === 'products' ? 'default' : 'outline'} onClick={() => setTab('products')}>{text('Products', 'المنتجات')}</Button><Button variant={tab === 'orders' ? 'default' : 'outline'} onClick={() => setTab('orders')}>{text('Orders', 'الطلبات')}</Button></div>
        </header>
        {tab === 'products' ? <>
            <div className="flex flex-wrap gap-3">
                <Button onClick={() => { setProduct(blankProduct()); }}><Plus />{text('New product', 'منتج جديد')}</Button>
                <Button variant="outline" onClick={() => catalog.refetch()}>{text('Refresh catalog', 'تحديث المنتجات')}</Button>
            </div>
            {catalog.isError && <p role="alert">{text('Could not load catalog. Make sure the latest shop migrations are applied.', 'تعذر تحميل المنتجات. تأكد من تطبيق تحديث قاعدة البيانات.')}</p>}
            {catalog.isPending && <p role="status">{text('Loading products…', 'جاري تحميل المنتجات…')}</p>}
            <div className={styles.adminCatalog}>
                {catalog.data?.map(entry => {
                    const photo = entry.variants.flatMap(variant => variant.images)[0];
                    return <article key={entry.id} className={styles.adminProduct}>
                        {photo ? <img src={photo} alt={ar ? entry.name_ar || entry.name : entry.name} /> : <div className={styles.adminPlaceholder}><Shirt size={40}/></div>}
                        <div className="grid min-w-0 gap-2 p-4">
                            <div className={styles.row}><h2 className="font-bold">{ar ? entry.name_ar || entry.name : entry.name}</h2><span className="rounded-full bg-accent px-2 py-1 text-xs text-accent-foreground">{entry.published ? text('Published','منشور') : text('Draft','مسودة')}</span></div>
                            <p className="font-semibold text-secondary">{formatMoney(Number(entry.price), lang)} · {productGenderLabel(entry.gender, lang)}</p>
                            <p className={styles.muted}>{text(`${entry.variants.filter(v => v.active).length} variants`, `${entry.variants.filter(v => v.active).length} اختيار`)}</p>
                            <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => { setProduct({ ...entry }); }}><Pencil size={15}/>{text('Edit','تعديل')}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void deleteProduct(entry)}><Trash2 size={15}/>{text('Delete','حذف')}</Button></div>
                        </div>
                    </article>;
                })}
            </div>
            {!catalog.isPending && !catalog.isError && !catalog.data?.length && <p className={styles.muted}>{text('No products yet. Add your first product.', 'لا توجد منتجات بعد. أضف أول منتج.')}</p>}
            {product && <section ref={editor} className="grid scroll-mt-20 gap-3" aria-label={text('Product editor','تعديل المنتج')}><div className={styles.row}><h2 className="font-bold">{product.name || text('New product','منتج جديد')}</h2><Button variant="ghost" onClick={() => { setProduct(null); }}>{text('Close editor','إغلاق المحرر')}</Button></div><ShopProductForm key={product.id} product={product} onSaved={() => setProduct(null)}/></section>}
        </> : <div className="space-y-4">
            {orders.isError && <p role="alert">{text('Could not load orders.', 'تعذر تحميل الطلبات.')}</p>}
            {!orders.isPending && !orders.data?.length && <p>{text('No orders yet.', 'لا توجد طلبات بعد.')}</p>}
            {orders.data?.map(order => <article className={styles.order} key={order.id}>
                <div className={styles.row}><h2 className="font-bold">{order.product_name} · {order.color} / {order.size} × {order.quantity}</h2><strong>{formatMoney(Number(order.total), lang)}</strong></div>
                <p className="font-semibold text-secondary">{order.status.replaceAll('_', ' ')}</p>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p>{order.customer_name} · {order.phone}</p>
                    <p>{order.fulfillment === 'delivery' ? text('Delivery within Egypt · EGP 90', 'توصيل داخل مصر · ٩٠ جنيه') : text('Collection · Fifth Settlement, New Cairo', 'استلام · التجمع الخامس، القاهرة الجديدة')}</p>
                    {order.address && <p className="sm:col-span-2">{order.address}</p>}
                </div>
                <p className={styles.muted}>{text('Product subtotal', 'قيمة المنتجات')}: {formatMoney(Number(order.unit_price) * order.quantity, lang)} · {text('Delivery', 'التوصيل')}: {formatMoney(Number(order.delivery_fee), lang)} · {order.pay_method ?? '—'}</p>
                <p className="break-all font-mono text-[10px] text-muted-foreground">{order.id}</p>
                <div className="flex flex-wrap gap-2">
                    {order.receipt_url && <Button variant="outline" className="gap-2" disabled={busy} onClick={() => void receipt(order)}><ReceiptText size={16}/>{text('View receipt', 'عرض الإيصال')}</Button>}
                    {order.status === 'pending_review' && <><Button disabled={busy} onClick={() => void review(order, 'approve')}>{text('Approve payment', 'اعتماد الدفع')}</Button><Button variant="outline" disabled={busy} onClick={() => void review(order, 'reject')}>{text('Reject', 'رفض')}</Button></>}
                    {order.pay_method === 'kashier' && cardOrders.data?.some(card => card.target_id === order.id) && order.status !== 'fulfilled' && <><Button disabled={busy} variant="outline" onClick={() => void reviewCard(order, true)}>{text('Review card · approve', 'مراجعة البطاقة · اعتماد')}</Button><Button disabled={busy} variant="outline" onClick={() => void reviewCard(order, false)}>{text('Review card · reject', 'مراجعة البطاقة · رفض')}</Button></>}
                    {order.status === 'paid' && <Button disabled={busy} onClick={() => void review(order, 'fulfill')}>{text('Mark delivered / collected', 'تأكيد التسليم / الاستلام')}</Button>}
                    {order.status === 'review_required' && <p className={styles.muted}>{text('Review the collected charge and arrange fulfillment or a manual refund.', 'راجع المبلغ المحصل ونسّق التسليم أو الاسترداد اليدوي.')}</p>}
                </div>
            </article>)}
        </div>}
        <Dialog open={!!preview} onOpenChange={open => { if (!open)
            setPreview(null); }}>
            <DialogContent className="min-w-0 rounded-2xl sm:max-w-2xl">
                <DialogTitle>{text('Payment receipt', 'إيصال الدفع')}</DialogTitle>
                <DialogDescription>{text('Check the transfer before approving.', 'راجع التحويل قبل الاعتماد.')}</DialogDescription>
                {preview && (preview.split('?')[0].toLowerCase().endsWith('.pdf') ? <iframe title="Receipt" src={preview} className="h-[55dvh] w-full"/> : <img src={preview} alt="Payment receipt" className="mx-auto max-h-[60dvh] max-w-full object-contain"/>)}
                {preview && <div className="flex justify-end"><Button asChild variant="outline" size="sm"><a href={preview} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/>{text('Open full-size receipt', 'افتح الإيصال بحجمه الكامل')}</a></Button></div>}
            </DialogContent>
        </Dialog>
    </div>;
}
