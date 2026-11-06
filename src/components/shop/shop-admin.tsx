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
import type { ShopProduct, ShopVariant, ShopOrder } from '@/lib/shop';
import styles from './shop.module.css';
type EditableVariant = ShopVariant & {
    original_stock?: number;
};
const blank = () => ({ id: crypto.randomUUID(), name: '', name_ar: '', description: '', description_ar: '', price: 0, size_chart: [], published: false, variants: [] } as ShopProduct);
export function ShopAdmin() {
    const { lang } = useI18n();
    const ar = lang === 'ar';
    const cache = useQueryClient();
    const params = useSearchParams();
    const [tab, setTab] = useState(params.get('tab')==='orders'?'orders':'products');
    const [selected, setSelected] = useState('');
    const [product, setProduct] = useState<ShopProduct | null>(null);
    const [variants, setVariants] = useState<EditableVariant[]>([]);
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const catalog = useQuery({ queryKey: ['shop-admin-products'], queryFn: async () => { const { data, error } = await createClient().from('shop_products').select('*,variants:shop_variants(*)').order('created_at', { ascending: false }); if (error)
            throw error; return data as ShopProduct[]; } });
    const cardOrders = useQuery({queryKey:['shop-admin-card-orders'],refetchInterval:15000,queryFn:async()=>{const {data,error}=await createClient().from('kashier_orders').select('id,target_id').eq('kind','shop').order('created_at',{ascending:false}).limit(200);if(error)throw error;return data as {id:string;target_id:string}[];}});
    const orders = useQuery({ queryKey: ['shop-admin-orders'], refetchInterval: 15000, queryFn: async () => { const { data, error } = await createClient().from('shop_orders').select('*').order('created_at', { ascending: false }).limit(200); if (error)
            throw error; return data as ShopOrder[]; } });
    useEffect(() => { const p = catalog.data?.find(p => p.id === selected); if (p) {
        setProduct({ ...p });
        setVariants(p.variants.map(v => ({ ...v, original_stock: v.stock })));
    } }, [selected, catalog.data]);
    function updateVariant(id: string, patch: Partial<EditableVariant>) { setVariants(rows => { const current = rows.find(v => v.id === id); const matching = patch.color ? rows.find(v => v.id !== id && v.color === patch.color) : undefined; return rows.map(v => v.id === id ? { ...v, ...(matching ? { images: matching.images, color_hex: matching.color_hex, color_ar: matching.color_ar } : {}), ...patch } : patch.images && current?.color && v.color === current.color ? { ...v, images: patch.images } : v); }); }
    async function upload(id: string, files: FileList | null) { if (!files)
        return; setBusy(true); try {
        const db = createClient();
        const urls: string[] = [];
        for (const file of Array.from(files)) {
            if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 8 * 1024 * 1024)
                throw Error(ar ? 'صور فقط، بحد أقصى ٨ ميجا للصورة' : 'Images only, up to 8 MB each');
            const ext = file.type.split('/')[1];
            const path = `${product?.id}/${crypto.randomUUID()}.${ext}`;
            const { error } = await db.storage.from('shop-images').upload(path, file);
            if (error)
                throw error;
            urls.push(db.storage.from('shop-images').getPublicUrl(path).data.publicUrl);
        }
        setVariants(rows => { const color = rows.find(v => v.id === id)?.color; return rows.map(v => v.id === id || (color && v.color === color) ? { ...v, images: [...v.images, ...urls] } : v); });
    }
    catch (e) {
        toast.error((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function save(e: React.FormEvent) { e.preventDefault(); if (!product)
        return; setBusy(true); try {
        const { error } = await createClient().rpc('save_shop_product', { p_product: product, p_variants: variants });
        if (error)
            throw error;
        setSelected(product.id);
        await cache.invalidateQueries({ queryKey: ['shop-admin-products'] });
        await cache.invalidateQueries({ queryKey: ['shop-products'] });
            await cache.invalidateQueries({queryKey:['shop-featured']});
        toast.success(ar ? 'تم حفظ المنتج' : 'Product saved');
    }
    catch (e) {
        toast.error((e as {
            message?: string;
        }).message ?? 'Could not save product');
    }
    finally {
        setBusy(false);
    } }
    async function review(o: ShopOrder, action: string) { if (busy)
        return; setBusy(true); try {
        const { error } = await createClient().rpc('review_shop_order', { p_order: o.id, p_action: action });
        if (error)
            throw error;
        await Promise.all([cache.invalidateQueries({ queryKey: ['shop-admin-orders'] }), cache.invalidateQueries({ queryKey: ['shop-admin-products'] })]);
    }
    catch (e) {
        toast.error((e as {
            message?: string;
        }).message ?? 'Could not review order');
    }
    finally {
        setBusy(false);
    } }
    async function reviewCard(o:ShopOrder,approve:boolean){const card=cardOrders.data?.find(c=>c.target_id===o.id);if(!card)return;const message=approve?text('Verify receipt of funds in Kashier before approving. This does not charge the card.','تأكد من وصول المبلغ في كاشير قبل الاعتماد. لن يتم خصم مبلغ جديد.'):text('Reject this record? This does not refund the card. Arrange any refund manually.','رفض السجل؟ هذا لا يعيد المبلغ للبطاقة. نفّذ الاسترداد يدويًا.');if(!window.confirm(message))return;setBusy(true);try{const response=await fetch('/api/platform-admin/card-payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'review',orderId:card.id,approve})});const result=await response.json();if(!response.ok)throw Error(result.error??'Could not review payment');await cache.invalidateQueries({queryKey:['shop-admin-orders']});await cache.invalidateQueries({queryKey:['shop-admin-products']});}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}
    async function receipt(o: ShopOrder) { if (!o.receipt_url)
        return; setBusy(true); try {
        const { data, error } = await createClient().storage.from('game-fee-receipts').createSignedUrl(o.receipt_url, 600);
        if (error)
            throw error;
        setPreview(data.signedUrl);
    }
    catch (e) {
        toast.error((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    const text = (en: string, arabic: string) => ar ? arabic : en;
    return <div className={styles.admin}><header className={styles.heading}><div><h1>{text('Playza Shop management', 'إدارة متجر بلايزا')}</h1><p>{text('Products, color photos, sizes, stock and customer orders. Delivery is EGP 90.', 'المنتجات وصور الألوان والمقاسات والمخزون والطلبات. التوصيل ٩٠ جنيه.')}</p></div><div className="flex gap-2"><Button variant={tab === 'products' ? 'default' : 'outline'} onClick={() => setTab('products')}>{text('Products', 'المنتجات')}</Button><Button variant={tab === 'orders' ? 'default' : 'outline'} onClick={() => setTab('orders')}>{text('Orders', 'الطلبات')}</Button></div></header>{tab === 'products' ? <><div className="flex flex-wrap gap-3"><select className="max-w-full rounded-lg border bg-card p-2" value={selected} onChange={e => setSelected(e.target.value)}><option value="">{text('Select a product', 'اختار منتج')}</option>{catalog.data?.map(p => <option key={p.id} value={p.id}>{p.name} {p.published ? '' : '(draft)'}</option>)}</select><Button onClick={() => { setSelected(''); setProduct(blank()); setVariants([]); }}><Plus />{text('New product', 'منتج جديد')}</Button><Button variant="outline" onClick={() => catalog.refetch()}>{text('Refresh catalog', 'تحديث المنتجات')}</Button></div>{catalog.isError && <p role="alert">{text('Could not load catalog. Apply the shop migration first.', 'تعذر تحميل المنتجات. تأكد من تطبيق تحديث قاعدة البيانات.')}</p>}{product ? <form onSubmit={save} className={`${styles.panel} ${styles.fields}`}><h2 className="text-xl font-bold">{text('Product details', 'تفاصيل المنتج')}</h2><label>{text('Name (English)', 'الاسم بالإنجليزية')}<input required maxLength={120} value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })}/></label><label>{text('Name (Arabic)', 'الاسم بالعربية')}<input value={product.name_ar} onChange={e => setProduct({ ...product, name_ar: e.target.value })}/></label><label>{text('Description (English)', 'الوصف بالإنجليزية')}<textarea value={product.description} onChange={e => setProduct({ ...product, description: e.target.value })}/></label><label>{text('Description (Arabic)', 'الوصف بالعربية')}<textarea value={product.description_ar} onChange={e => setProduct({ ...product, description_ar: e.target.value })}/></label><label>{text('Price (EGP)', 'السعر بالجنيه')}<input required type="number" min="0.01" step="0.01" value={product.price || ''} onChange={e => setProduct({ ...product, price: Number(e.target.value) })}/></label><h3 className="font-bold">{text('Size chart · centimeters', 'جدول المقاسات · سنتيمتر')}</h3>{product.size_chart.map((r, i) => <div key={i} className="grid grid-cols-3 gap-2">{(['size', 'chest', 'length'] as const).map(k => <label key={k}>{k === 'size' ? text('Size', 'المقاس') : k === 'chest' ? text('Chest width (cm)', 'عرض الصدر') : text('Length (cm)', 'الطول')}<input required type={k === 'size' ? 'text' : 'number'} min={k === 'size' ? undefined : 1} value={r[k]} onChange={e => setProduct({ ...product, size_chart: product.size_chart.map((m, j) => j === i ? { ...m, [k]: k === 'size' ? e.target.value : Number(e.target.value) } : m) })}/></label>)}<button type="button" className="col-span-3 text-start text-xs text-secondary" onClick={() => setProduct({ ...product, size_chart: product.size_chart.filter((_, j) => j !== i) })}>{text('Remove this size', 'إزالة المقاس')}</button></div>)}<Button type="button" variant="outline" onClick={() => setProduct({ ...product, size_chart: [...product.size_chart, { size: '', chest: 0, length: 0 }] })}>{text('Add size measurements', 'إضافة قياسات مقاس')}</Button><h3 className="font-bold">{text('Color and size variants', 'الألوان والمقاسات')}</h3><p className={styles.muted}>{text('Add a variant for each color/size. Upload photos for that color. Use the same color name for all matching sizes.', 'أضف اختيارًا لكل لون ومقاس وارفع صور اللون. استخدم نفس اسم اللون للمقاسات المتشابهة.')}</p>{variants.map(v => <section className={styles.variant} key={v.id}><div className="grid gap-3 sm:grid-cols-2"><label>{text('Color name', 'اسم اللون')}<input required value={v.color} onChange={e => updateVariant(v.id, { color: e.target.value })}/></label><label>{text('Color name (Arabic)', 'اسم اللون بالعربية')}<input value={v.color_ar} onChange={e => updateVariant(v.id, { color_ar: e.target.value })}/></label><label>{text('Swatch color', 'لون العينة')}<input type="color" value={v.color_hex} onChange={e => updateVariant(v.id, { color_hex: e.target.value })}/></label><label>{text('Size', 'المقاس')}<input required value={v.size} onChange={e => updateVariant(v.id, { size: e.target.value })}/></label><label>{text('Stock available', 'المخزون المتاح')}<input required type="number" min={0} value={v.stock} onChange={e => updateVariant(v.id, { stock: Number(e.target.value) })}/></label><label>{text('Visible', 'ظاهر')}<select value={v.active ? 'yes' : 'no'} onChange={e => updateVariant(v.id, { active: e.target.value === 'yes' })}><option value="yes">{text('Active', 'نشط')}</option><option value="no">{text('Hidden', 'مخفي')}</option></select></label></div><label>{text('Upload color photos', 'ارفع صور اللون')}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={busy} onChange={e => void upload(v.id, e.target.files)}/></label><label>{text('Image URLs · one per line', 'روابط الصور · رابط لكل سطر')}<textarea value={v.images.join('\n')} onChange={e => updateVariant(v.id, { images: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}/></label><div className={styles.thumbs}>{v.images.map(url => <img key={url} src={url} alt={v.color} className="h-16 w-16 rounded object-cover"/>)}</div><Button type="button" variant="ghost" onClick={() => v.original_stock == null ? setVariants(rows => rows.filter(x => x.id !== v.id)) : updateVariant(v.id,{active:false})}>{v.original_stock == null ? text('Remove variant','إزالة الاختيار') : text('Hide variant','إخفاء الاختيار')}</Button></section>)}<Button type="button" variant="outline" onClick={() => setVariants(rows => [...rows, { id: crypto.randomUUID(), product_id: product.id, color: '', color_ar: '', color_hex: '#4c1d95', size: '', images: [], stock: 0, active: true }])}>{text('Add color / size', 'إضافة لون / مقاس')}</Button><label className="!flex items-center gap-2"><input className="!w-4" type="checkbox" checked={product.published} onChange={e => setProduct({ ...product, published: e.target.checked })}/>{text('Publish in the shop (photos and measurements required)', 'نشر في المتجر (الصور والقياسات مطلوبة)')}</label><Button type="submit" className="h-11" disabled={busy}>{busy ? text('Saving…', 'جاري الحفظ…') : text('Save product', 'حفظ المنتج')}</Button></form> : <div className={`${styles.panel} text-center`}><Shirt className="mx-auto mb-4 h-10 w-10 text-secondary"/>{text('Create a product or select one to edit.', 'أنشئ منتجًا أو اختار منتج لتعديله.')}</div>}</> : <div className="space-y-4">{orders.isError && <p role="alert">{text('Could not load orders.', 'تعذر تحميل الطلبات.')}</p>}{!orders.isPending && !orders.data?.length && <p>{text('No orders yet.', 'لا توجد طلبات بعد.')}</p>}{orders.data?.map(o => <article className={styles.order} key={o.id}><div className={styles.row}><h2 className="font-bold">{o.product_name} · {o.color} / {o.size} × {o.quantity}</h2><strong>{formatMoney(Number(o.total), lang)}</strong></div><p className="font-semibold text-secondary">{o.status.replaceAll('_', ' ')}</p><div className="grid gap-2 text-sm sm:grid-cols-2"><p>{o.customer_name} · {o.phone}</p><p>{o.fulfillment === 'delivery' ? text('Delivery · EGP 90', 'توصيل · ٩٠ جنيه') : text('Collection', 'استلام')}</p>{o.address && <p className="sm:col-span-2">{o.address}</p>}</div><p className={styles.muted}>{text('Product subtotal', 'قيمة المنتجات')}: {formatMoney(Number(o.unit_price) * o.quantity, lang)} · {text('Delivery', 'التوصيل')}: {formatMoney(Number(o.delivery_fee), lang)} · {o.pay_method ?? '—'}</p><p className="break-all font-mono text-[10px] text-muted-foreground">{o.id}</p><div className="flex flex-wrap gap-2">{o.receipt_url && <Button variant="outline" disabled={busy} onClick={() => void receipt(o)}>{text('View receipt', 'عرض الإيصال')}</Button>}{o.status === 'pending_review' && <><Button disabled={busy} onClick={() => void review(o, 'approve')}>{text('Approve payment', 'اعتماد الدفع')}</Button><Button variant="outline" disabled={busy} onClick={() => void review(o, 'reject')}>{text('Reject', 'رفض')}</Button></>}{o.pay_method==='kashier'&&cardOrders.data?.some(c=>c.target_id===o.id)&&o.status!=='fulfilled'&&<><Button disabled={busy} variant="outline" onClick={()=>void reviewCard(o,true)}>{text('Review card · approve','مراجعة البطاقة · اعتماد')}</Button><Button disabled={busy} variant="outline" onClick={()=>void reviewCard(o,false)}>{text('Review card · reject','مراجعة البطاقة · رفض')}</Button></>}{o.status === 'paid' && <Button disabled={busy} onClick={() => void review(o, 'fulfill')}>{text('Mark delivered / collected', 'تأكيد التسليم / الاستلام')}</Button>}{o.status === 'review_required' && <p className={styles.muted}>{text('Review the collected charge and arrange fulfillment or a manual refund.', 'راجع المبلغ المحصل ونسّق التسليم أو الاسترداد اليدوي.')}</p>}</div></article>)}</div>}<Dialog open={!!preview} onOpenChange={open => { if (!open)
        setPreview(null); }}><DialogContent className="min-w-0 rounded-2xl sm:max-w-2xl"><DialogTitle>{text('Payment receipt', 'إيصال الدفع')}</DialogTitle><DialogDescription>{text('Check the transfer before approving.', 'راجع التحويل قبل الاعتماد.')}</DialogDescription>{preview && (preview.split('?')[0].toLowerCase().endsWith('.pdf') ? <iframe title="Receipt" src={preview} className="h-[55dvh] w-full"/> : <img src={preview} alt="Payment receipt" className="mx-auto max-h-[60dvh] max-w-full object-contain"/>)}{preview && <a href={preview} target="_blank" rel="noopener noreferrer" className="text-sm text-secondary underline">{text('Open full-size receipt', 'افتح الإيصال بحجمه الكامل')}</a>}</DialogContent></Dialog></div>;
}
