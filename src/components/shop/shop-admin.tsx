"use client";
/* eslint-disable @next/next/no-img-element -- Product photos use administrator-provided storage URLs. */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Shirt } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import { formatMoney } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { ShopProduct, ShopOrder } from '@/lib/shop';
import { ShopProductForm, blankProduct } from './shop-product-form';
import styles from './shop.module.css';

export function ShopAdmin() {
    const { lang } = useI18n();
    const ar = lang === 'ar';
    const cache = useQueryClient();
    const params = useSearchParams();
    const [tab, setTab] = useState(params.get('tab') === 'orders' ? 'orders' : 'products');
    const [selected, setSelected] = useState('');
    const [product, setProduct] = useState<ShopProduct | null>(null);
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const catalog = useQuery({ queryKey: ['shop-admin-products'], queryFn: async () => {
        const { data, error } = await createClient().from('shop_products').select('*,variants:shop_variants(*)').order('created_at', { ascending: false });
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
    useEffect(() => {
        const found = catalog.data?.find(entry => entry.id === selected);
        if (found)
            setProduct({ ...found });
    }, [selected, catalog.data]);
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
                <select className="max-w-full rounded-lg border bg-card p-2" value={selected} onChange={e => setSelected(e.target.value)}>
                    <option value="">{text('Select a product', 'اختار منتج')}</option>
                    {catalog.data?.map(entry => <option key={entry.id} value={entry.id}>{entry.name} {entry.published ? '' : '(draft)'}</option>)}
                </select>
                <Button onClick={() => { setSelected(''); setProduct(blankProduct()); }}><Plus />{text('New product', 'منتج جديد')}</Button>
                <Button variant="outline" onClick={() => catalog.refetch()}>{text('Refresh catalog', 'تحديث المنتجات')}</Button>
            </div>
            {catalog.isError && <p role="alert">{text('Could not load catalog. Apply the shop migration first.', 'تعذر تحميل المنتجات. تأكد من تطبيق تحديث قاعدة البيانات.')}</p>}
            {product
                ? <ShopProductForm key={product.id} product={product} onSaved={id => setSelected(id)}/>
                : <div className={`${styles.panel} text-center`}><Shirt className="mx-auto mb-4 h-10 w-10 text-secondary"/>{text('Create a product or select one to edit.', 'أنشئ منتجًا أو اختار منتج لتعديله.')}</div>}
        </> : <div className="space-y-4">
            {orders.isError && <p role="alert">{text('Could not load orders.', 'تعذر تحميل الطلبات.')}</p>}
            {!orders.isPending && !orders.data?.length && <p>{text('No orders yet.', 'لا توجد طلبات بعد.')}</p>}
            {orders.data?.map(order => <article className={styles.order} key={order.id}>
                <div className={styles.row}><h2 className="font-bold">{order.product_name} · {order.color} / {order.size} × {order.quantity}</h2><strong>{formatMoney(Number(order.total), lang)}</strong></div>
                <p className="font-semibold text-secondary">{order.status.replaceAll('_', ' ')}</p>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p>{order.customer_name} · {order.phone}</p>
                    <p>{order.fulfillment === 'delivery' ? text('Delivery · EGP 90', 'توصيل · ٩٠ جنيه') : text('Collection', 'استلام')}</p>
                    {order.address && <p className="sm:col-span-2">{order.address}</p>}
                </div>
                <p className={styles.muted}>{text('Product subtotal', 'قيمة المنتجات')}: {formatMoney(Number(order.unit_price) * order.quantity, lang)} · {text('Delivery', 'التوصيل')}: {formatMoney(Number(order.delivery_fee), lang)} · {order.pay_method ?? '—'}</p>
                <p className="break-all font-mono text-[10px] text-muted-foreground">{order.id}</p>
                <div className="flex flex-wrap gap-2">
                    {order.receipt_url && <Button variant="outline" disabled={busy} onClick={() => void receipt(order)}>{text('View receipt', 'عرض الإيصال')}</Button>}
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
                {preview && <a href={preview} target="_blank" rel="noopener noreferrer" className="text-sm text-secondary underline">{text('Open full-size receipt', 'افتح الإيصال بحجمه الكامل')}</a>}
            </DialogContent>
        </Dialog>
    </div>;
}
