"use client";
/* eslint-disable @next/next/no-img-element -- Product photos use administrator-provided storage URLs. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { colorNames } from '@/lib/shop';
import type { ShopProduct, ShopVariant, SizeMeasurement } from '@/lib/shop';
import styles from './shop.module.css';

type EditableVariant = ShopVariant & {
    original_stock?: number;
    color_id?: string;
};
type ColorDraft = {
    id: string;
    color: string;
    color_ar: string;
    color_hex: string;
    checked: boolean;
    images: string[];
};
type Props = {
    product: ShopProduct;
    onSaved: (id: string) => void;
};

export function blankProduct(): ShopProduct {
    return { id: crypto.randomUUID(), name: '', name_ar: '', description: '', description_ar: '', price: 0, size_chart: [], published: false, variants: [] };
}

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

function detectedSizes(chart: SizeMeasurement[], rows: EditableVariant[]) {
    return [...new Set([...chart.map(row => row.size.trim()), ...rows.map(row => row.size.trim())].filter(Boolean))];
}

function sizeList(chart: SizeMeasurement[], rows: EditableVariant[]) {
    const detected = detectedSizes(chart, rows);
    return [...STANDARD_SIZES, ...detected.filter(size => !STANDARD_SIZES.some(standard => standard.toLowerCase() === size.toLowerCase()))];
}

function buildInitial(variants: ShopVariant[]) {
    const colors: ColorDraft[] = [];
    const byColor = new Map<string, ColorDraft>();
    const rows = variants.map(variant => {
        let draft = byColor.get(`${variant.color}|${variant.color_hex.toLowerCase()}`);
        if (!draft) {
            const automatic = colorNames(variant.color_hex);
            draft = { id: `color-${colors.length}`, color: variant.color || automatic.color, color_ar: variant.color_ar || automatic.color_ar, color_hex: variant.color_hex, checked: true, images: [] };
            byColor.set(`${variant.color}|${variant.color_hex.toLowerCase()}`, draft);
            colors.push(draft);
        }
        draft.images.push(...variant.images);
        return { ...variant, color_id: draft.id, original_stock: variant.stock } as EditableVariant;
    });
    for (const color of colors)
        color.images = [...new Set(color.images)];
    return { colors, rows };
}

export function ShopProductForm({ product: initialProduct, onSaved }: Props) {
    const { lang } = useI18n();
    const ar = lang === 'ar';
    const cache = useQueryClient();
    const [initial] = useState(() => buildInitial(initialProduct.variants));
    const [product, setProduct] = useState<ShopProduct>(() => ({ ...initialProduct }));
    const [colors, setColors] = useState<ColorDraft[]>(initial.colors);
    const [rows, setRows] = useState<EditableVariant[]>(initial.rows);
    const [pending, setPending] = useState<string[]>([]);
    const [customSize, setCustomSize] = useState('');
    const [selectedSizes, setSelectedSizes] = useState<Set<string>>(() => new Set(detectedSizes(initialProduct.size_chart, initial.rows)));
    const [busy, setBusy] = useState(false);
    const text = (en: string, arabic: string) => ar ? arabic : en;
    const sizes = useMemo(() => sizeList(product.size_chart, rows), [product.size_chart, rows]);
    const knownSizes = useRef(new Set(sizes));
    const photos = useMemo(() => [...new Set([...colors.flatMap(color => color.images), ...pending])], [colors, pending]);

    useEffect(() => {
        const added = sizes.filter(size => !knownSizes.current.has(size));
        if (!added.length)
            return;
        knownSizes.current = new Set(sizes);
        setSelectedSizes(current => new Set([...current, ...added]));
    }, [sizes]);

    function updateColor(id: string, patch: Partial<Omit<ColorDraft, 'id'>>) {
        const current = colors.find(color => color.id === id);
        if (!current)
            return;
        const draft = { ...current, ...patch };
        setColors(list => list.map(color => color.id === id ? draft : color));
        setRows(list => list.map(variant => variant.color_id !== id ? variant : {
            ...variant,
            ...(patch.color !== undefined ? { color: draft.color } : {}),
            ...(patch.color_ar !== undefined ? { color_ar: draft.color_ar } : {}),
            ...(patch.color_hex !== undefined ? { color_hex: draft.color_hex } : {}),
            ...(patch.images !== undefined ? { images: draft.images } : {}),
        }));
    }

    function addColor() {
        const color_hex = ['#000000','#ffffff','#2563eb','#ef4444','#22c55e','#7c3aed'].find(hex => !colors.some(color => color.color_hex.toLowerCase() === hex)) ?? '#4c1d95';
        setColors(list => [...list, { id: `new-${crypto.randomUUID()}`, ...uniqueColorName(color_hex), color_hex, checked: true, images: [] }]);
    }

    function uniqueColorName(hex: string, excludingId?: string) {
        const suggested = colorNames(hex);
        const others = colors.filter(color => color.id !== excludingId);
        let suffix = '', index = 1;
        while (others.some(color => color.color.trim().toLowerCase() === `${suggested.color}${suffix}`.toLowerCase())) {
            suffix = ` (${hex.toUpperCase()}${index > 1 ? ` · ${index}` : ''})`;
            index++;
        }
        return { color: suggested.color + suffix, color_ar: suggested.color_ar + suffix };
    }
    function pickColor(id: string, color_hex: string) {
        updateColor(id, { color_hex, ...uniqueColorName(color_hex, id) });
    }

    function removeColor(id: string) {
        const persisted = rows.some(variant => variant.color_id === id && variant.original_stock != null);
        if (persisted) {
            if (!window.confirm(text('Hide every size of this color? Existing orders keep their history.', 'إخفاء كل مقاسات هذا اللون؟ الطلبات الحالية تبقى محفوظة.')))
                return;
            setRows(list => list.map(variant => variant.color_id === id ? { ...variant, active: false } : variant));
            setColors(list => list.map(color => color.id === id ? { ...color, checked: false } : color));
            return;
        }
        setRows(list => list.filter(variant => variant.color_id !== id));
        setColors(list => list.filter(color => color.id !== id));
    }

    function generate() {
        const chosenColors = colors.filter(color => color.checked && color.color.trim());
        const chosenSizes = sizes.filter(size => selectedSizes.has(size));
        if (!chosenColors.length || !chosenSizes.length) {
            toast.error(text('Select at least one color and one size.', 'اختار لون ومقاس على الأقل.'));
            return;
        }
        const names = chosenColors.map(color => color.color.trim().toLowerCase());
        if (new Set(names).size !== names.length) {
            toast.error(text('Each color name must be unique.', 'كل اسم لون يجب أن يكون مختلفًا.'));
            return;
        }
        const additions: EditableVariant[] = [];
        for (const color of chosenColors) {
            for (const size of chosenSizes) {
                if (rows.some(variant => variant.color_id === color.id && variant.size === size))
                    continue;
                additions.push({ id: crypto.randomUUID(), product_id: product.id, color: color.color.trim(), color_ar: color.color_ar, color_hex: color.color_hex, size, images: [...color.images], stock: 0, active: true, color_id: color.id });
            }
        }
        if (additions.length)
            setRows(prev => [...prev, ...additions]);
        toast.success(additions.length ? text(`Added ${additions.length} combinations.`, `تمت إضافة ${additions.length} اختيار.`) : text('All selected combinations already exist.', 'كل الاختيارات المحددة موجودة بالفعل.'));
    }

    function updateVariant(id: string, patch: Partial<EditableVariant>) {
        setRows(list => list.map(variant => variant.id === id ? { ...variant, ...patch } : variant));
    }

    function removeVariant(variant: EditableVariant) {
        if (variant.original_stock == null) {
            setRows(list => list.filter(row => row.id !== variant.id));
            return;
        }
        updateVariant(variant.id, { active: false });
    }

    function assignPhoto(url: string, colorId: string, on: boolean) {
        const color = colors.find(entry => entry.id === colorId);
        if (!color)
            return;
        updateColor(colorId, { images: on ? [...new Set([...color.images, url])] : color.images.filter(image => image !== url) });
    }

    function removePhoto(url: string) {
        setColors(list => list.map(color => ({ ...color, images: color.images.filter(image => image !== url) })));
        setRows(list => list.map(variant => ({ ...variant, images: variant.images.filter(image => image !== url) })));
        setPending(list => list.filter(image => image !== url));
    }

    async function upload(files: FileList | null) {
        if (!files?.length)
            return;
        setBusy(true);
        try {
            const db = createClient();
            const urls: string[] = [];
            for (const file of Array.from(files)) {
                if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 8 * 1024 * 1024)
                    throw Error(text('Images only, up to 8 MB each.', 'صور فقط، بحد أقصى ٨ ميجا للصورة.'));
                const ext = file.type.split('/')[1];
                const path = `${product.id}/${crypto.randomUUID()}.${ext}`;
                const { error } = await db.storage.from('shop-images').upload(path, file);
                if (error)
                    throw error;
                urls.push(db.storage.from('shop-images').getPublicUrl(path).data.publicUrl);
            }
            setPending(list => [...list, ...urls]);
        }
        catch (e) {
            toast.error((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }

    function updateMeasurement(size: string, key: 'chest' | 'length', value: string) {
        const amount = Number(value);
        setProduct(current => {
            const index = current.size_chart.findIndex(row => row.size.trim().toLowerCase() === size.toLowerCase());
            if (index === -1)
                return { ...current, size_chart: [...current.size_chart, { size, chest: 0, length: 0, [key]: amount }] };
            return { ...current, size_chart: current.size_chart.map((row, position) => position === index ? { ...row, [key]: amount } : row) };
        });
    }

    function addCustomSize() {
        const size = customSize.trim();
        if (!size)
            return;
        if (sizes.some(existing => existing.toLowerCase() === size.toLowerCase())) {
            toast.error(text('This size already exists.', 'هذا المقاس موجود بالفعل.'));
            return;
        }
        setProduct(current => ({ ...current, size_chart: [...current.size_chart, { size, chest: 0, length: 0 }] }));
        setSelectedSizes(current => new Set([...current, size]));
        setCustomSize('');
    }

    function removeSize(size: string) {
        if (rows.some(variant => variant.size === size) && !window.confirm(text('Remove this size and hide its variants?', 'إزالة هذا المقاس وإخفاء اختياراته؟')))
            return;
        setProduct(current => ({ ...current, size_chart: current.size_chart.filter(row => row.size.trim().toLowerCase() !== size.toLowerCase()) }));
        setRows(list => list.filter(variant => variant.size !== size));
        setSelectedSizes(current => {
            const next = new Set(current);
            next.delete(size);
            return next;
        });
    }

    async function save(e: React.FormEvent) {
        e.preventDefault();
        const names = colors.filter(color => color.color.trim()).map(color => color.color.trim().toLowerCase());
        if (new Set(names).size !== names.length) {
            toast.error(text('Each color name must be unique.', 'كل اسم لون يجب أن يكون مختلفًا.'));
            return;
        }
        setBusy(true);
        try {
            const payloadVariants = rows.map(variant => {
                const color = colors.find(entry => entry.id === variant.color_id);
                return {
                    id: variant.id,
                    product_id: variant.product_id,
                    color: color?.color.trim() || variant.color,
                    color_ar: color?.color_ar ?? variant.color_ar,
                    color_hex: color?.color_hex ?? variant.color_hex,
                    size: variant.size,
                    images: color ? color.images : variant.images,
                    stock: variant.stock,
                    active: variant.active,
                    original_stock: variant.original_stock ?? null,
                };
            });
            const payloadProduct = { ...product, size_chart: product.size_chart.filter(row => row.size.trim()) };
            const { error } = await createClient().rpc('save_shop_product', { p_product: payloadProduct, p_variants: payloadVariants });
            if (error)
                throw error;
            setPending([]);
            await cache.invalidateQueries({ queryKey: ['shop-admin-products'] });
            await cache.invalidateQueries({ queryKey: ['shop-products'] });
            await cache.invalidateQueries({ queryKey: ['shop-featured'] });
            toast.success(text('Product saved', 'تم حفظ المنتج'));
            onSaved(product.id);
        }
        catch (e) {
            toast.error((e as { message?: string }).message ?? 'Could not save product');
        }
        finally {
            setBusy(false);
        }
    }

    return <form onSubmit={save} className={`${styles.panel} ${styles.fields} ${styles.compact}`}>
        <h2 className="text-xl font-bold">{text('Product details', 'تفاصيل المنتج')}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
            <label>{text('Name (English)', 'الاسم بالإنجليزية')}<input required maxLength={120} value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })}/></label>
            <label>{text('Name (Arabic)', 'الاسم بالعربية')}<input value={product.name_ar} onChange={e => setProduct({ ...product, name_ar: e.target.value })}/></label>
            <label>{text('Description (English)', 'الوصف بالإنجليزية')}<textarea value={product.description} onChange={e => setProduct({ ...product, description: e.target.value })}/></label>
            <label>{text('Description (Arabic)', 'الوصف بالعربية')}<textarea value={product.description_ar} onChange={e => setProduct({ ...product, description_ar: e.target.value })}/></label>
            <label className="sm:max-w-[12rem]">{text('Price (EGP)', 'السعر بالجنيه')}<input required type="number" min="0.01" step="0.01" value={product.price || ''} onChange={e => setProduct({ ...product, price: Number(e.target.value) })}/></label>
        </div>

        <div className={styles.editorGrid}>
        <details className={styles.editorSection} open>
        <summary>{text('Colors', 'الألوان')} <span>{colors.length}</span></summary>
        <p className={styles.muted}>{text('Pick a shade, then check or edit its English and Arabic names. Each color needs a unique name.', 'اختار الدرجة وراجع أو عدّل اسم اللون بالعربي والإنجليزي. كل لون يحتاج اسمًا مختلفًا.')}</p>
        <div className="grid gap-3">
            {colors.map(color => <div key={color.id} className={styles.variant}>
                <div className="flex flex-wrap items-center gap-4">
                    <input type="color" className={styles.swatch} value={color.color_hex} aria-label={text('Pick color', 'اختار اللون')} onChange={e => pickColor(color.id, e.target.value)}/>
                    <div className="min-w-0 flex-1">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label>{text('Color name (English)','اسم اللون بالإنجليزية')}<input required maxLength={60} value={color.color} onChange={e => updateColor(color.id, {color:e.target.value})}/></label>
                          <label>{text('Color name (Arabic)','اسم اللون بالعربية')}<input maxLength={60} value={color.color_ar} onChange={e => updateColor(color.id, {color_ar:e.target.value})}/></label>
                        </div>
                        {colors.some(other => other.id !== color.id && other.color.trim().toLowerCase() === color.color.trim().toLowerCase()) && <p role="alert" className="text-xs text-error-ink">{text('Duplicate color name. Give this shade a different name.','اسم اللون مكرر. اختار اسمًا مختلفًا لهذه الدرجة.')}</p>}
                        <span className="block text-xs text-muted-foreground">{color.color_hex} · {text(`${color.images.length} photos assigned`, `${color.images.length} صورة مخصصة`)}</span>
                    </div>
                    <label className="!flex items-center gap-2">
                        <input className="!w-4" type="checkbox" checked={color.checked} onChange={e => updateColor(color.id, { checked: e.target.checked })}/>
                        {text('Include this color', 'تضمين هذا اللون')}
                    </label>
                    <Button type="button" variant="ghost" onClick={() => removeColor(color.id)}>{text('Hide / remove color', 'إخفاء / إزالة اللون')}</Button>
                </div>
            </div>)}
        </div>
        <Button type="button" variant="outline" onClick={addColor}><Plus />{text('Add color', 'إضافة لون')}</Button>

        </details>
        <details className={styles.editorSection}>
        <summary>{text('Sizes & measurements (cm)', 'المقاسات والقياسات (سم)')} <span>{selectedSizes.size}</span></summary>
        <p className={styles.muted}>{text('Check the sizes you sell, then enter width and long for each one. Checked sizes are used when generating combinations.', 'حدد المقاسات المتاحة واكتب العرض والطول لكل مقاس. المقاسات المحددة هي التي تُستخدم عند إنشاء الاختيارات.')}</p>
        <label className="!flex items-center gap-2">
            <input className="!w-4" type="checkbox" checked={sizes.length > 0 && sizes.every(size => selectedSizes.has(size))} onChange={e => setSelectedSizes(e.target.checked ? new Set(sizes) : new Set())}/>
            {text('Select all sizes', 'تحديد كل المقاسات')}
        </label>
        <div className="grid gap-2">
            {sizes.map(size => {
                const measurement = product.size_chart.find(row => row.size.trim().toLowerCase() === size.toLowerCase());
                return <div key={size} className="grid items-end gap-2 rounded-md border px-2 py-1 sm:grid-cols-[5rem_1fr_1fr_auto]">
                    <label className="!flex items-center gap-2">
                        <input className="!w-4" type="checkbox" checked={selectedSizes.has(size)} onChange={e => setSelectedSizes(current => {
                            const next = new Set(current);
                            if (e.target.checked)
                                next.add(size);
                            else
                                next.delete(size);
                            return next;
                        })}/>
                        <strong>{size}</strong>
                    </label>
                    <label>{text('Width (cm)', 'العرض (سم)')}<input type="number" min={0} value={measurement?.chest ?? ''} onChange={e => updateMeasurement(size, 'chest', e.target.value)}/></label>
                    <label>{text('Length (cm)', 'الطول (سم)')}<input type="number" min={0} value={measurement?.length ?? ''} onChange={e => updateMeasurement(size, 'length', e.target.value)}/></label>
                    <Button type="button" variant="ghost" onClick={() => removeSize(size)}><Trash2 size={14}/>{text('Remove', 'إزالة')}</Button>
                </div>;
            })}
        </div>
        <div className="flex flex-wrap items-end gap-2">
            <label className="!max-w-xs">{text('Custom size', 'مقاس مخصص')}<input value={customSize} onChange={e => setCustomSize(e.target.value)} placeholder="3XL" onKeyDown={e => { if (e.key === 'Enter') {
                e.preventDefault();
                addCustomSize();
            } }}/></label>
            <Button type="button" variant="outline" onClick={addCustomSize}><Plus />{text('Add size', 'إضافة مقاس')}</Button>
        </div>
        <Button type="button" variant="outline" onClick={generate}>{text('Generate selected combinations', 'إنشاء الاختيارات المحددة')}</Button>

        </details>
        <details className={styles.editorSection}>
        <summary>{text('Stock & visibility', 'المخزون والظهور')} <span>{rows.length}</span></summary>
        {colors.map(color => {
            const variants = rows.filter(variant => variant.color_id === color.id);
            if (!variants.length)
                return null;
            return <section key={color.id} className={styles.variant}>
                <div className={styles.row}>
                    <h4 className="font-bold">{color.color || text('Untitled color', 'لون بدون اسم')}</h4>
                    {color.color_hex && <span className="h-5 w-5 rounded border" style={{ background: color.color_hex }}/>}
                </div>
                <div className="grid gap-2">
                    {variants.map(variant => <div key={variant.id} className="grid items-end gap-2 rounded-md border px-2 py-1 sm:grid-cols-[1fr_7rem_auto_auto]">
                        <strong>{variant.size}</strong>
                        <label>{text('Stock', 'المخزون')}<input type="number" min={0} value={variant.stock} onChange={e => updateVariant(variant.id, { stock: Number(e.target.value) })}/></label>
                        <label className="!flex items-center gap-2">
                            <input className="!w-4" type="checkbox" checked={variant.active} onChange={e => updateVariant(variant.id, { active: e.target.checked })}/>
                            {text('Visible', 'ظاهر')}
                        </label>
                        <Button type="button" variant="ghost" onClick={() => removeVariant(variant)}>{variant.original_stock == null ? text('Remove', 'إزالة') : text('Hide', 'إخفاء')}</Button>
                    </div>)}
                </div>
            </section>;
        })}

        </details>
        <details className={styles.editorSection} open>
        <summary>{text('Photos', 'الصور')} <span>{photos.length}</span></summary>
        <p className={styles.muted}>{text('Upload photos, then tick each color that uses them. All sizes of a color share its photos.', 'ارفع الصور ثم حدد الألوان التي تستخدمها. كل مقاسات اللون تشترك في الصور.')}</p>
        <label>{text('Upload photos', 'ارفع الصور')}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={busy} onChange={e => void upload(e.target.files)}/></label>
        <div className="grid gap-2 sm:grid-cols-3">
            {photos.map(url => <div key={url} className={styles.variant}>
                <img src={url} alt="" className="h-20 w-full rounded object-contain"/>
                <div className="flex flex-wrap gap-2">
                    {colors.map(color => <label key={color.id} className="flex items-center gap-2 rounded-lg border px-2 py-1 text-xs">
                        <input type="checkbox" disabled={!color.color.trim()} checked={color.images.includes(url)} onChange={e => assignPhoto(url, color.id, e.target.checked)}/>
                        {color.color || text('Untitled', 'بدون اسم')}
                    </label>)}
                </div>
                <Button type="button" variant="ghost" onClick={() => removePhoto(url)}>{text('Remove photo', 'إزالة الصورة')}</Button>
            </div>)}
            {!photos.length && <p className={styles.muted}>{text('No photos uploaded yet.', 'لم تُرفع صور بعد.')}</p>}
        </div>

        </details>
        </div>
        <div className={styles.editorActions}>
        <label className="!flex items-center gap-2">
            <input className="!w-4" type="checkbox" checked={product.published} onChange={e => setProduct({ ...product, published: e.target.checked })}/>
            {text('Publish in the shop (photos and measurements required)', 'نشر في المتجر (الصور والقياسات مطلوبة)')}
        </label>
        <Button type="submit" className="h-9 shrink-0" disabled={busy}>{busy ? text('Saving…', 'جاري الحفظ…') : text('Save product', 'حفظ المنتج')}</Button>
        </div>
    </form>;
}
