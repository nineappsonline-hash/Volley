"use client";
/* eslint-disable @next/next/no-img-element -- Product photos use administrator-provided storage URLs. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MapPin, Pause, Play, Ruler, Shirt, Sparkles, Truck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';
import { formatMoney } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { colorImages, productGenderLabel, type ShopProduct } from '@/lib/shop';
import styles from './shop.module.css';
import { ProductPhotoPreview } from './product-photo-preview';
const GENDERS = [
    { id: 'all', en: 'All', ar: 'الكل' },
    { id: 'men', en: 'Men', ar: 'رجالي' },
    { id: 'women', en: 'Women', ar: 'حريمي' },
    { id: 'unisex', en: 'Unisex', ar: 'للجميع' },
] as const;
type GenderFilter = typeof GENDERS[number]['id'];
export function ShopTeaser() { const { lang } = useI18n(); return <section className={styles.teaser} aria-label="Playza Shop"><div><h2>{lang === 'ar' ? 'متجر بلايزا' : 'Wear your Playza spirit.'}</h2><p>{lang === 'ar' ? 'منتجات بلايزا. اختار لونك ومقاسك، واستلم أو اطلب توصيل بـ ٩٠ جنيه.' : 'Playza products. Your color. Your size. Collection or EGP 90 delivery.'}</p></div><Link href="/shop">{lang === 'ar' ? 'تسوق منتجات بلايزا' : 'Shop Playza'} →</Link></section>; }
export function ShopCatalog() {
    const { lang } = useI18n();
    const ar = lang === 'ar';
    const [gender, setGender] = useState<GenderFilter>('all');
    const q = useQuery({ queryKey: ['shop-products'], refetchInterval:60000, queryFn: async () => { const { data, error } = await createClient().from('shop_products').select('*,variants:shop_variants(*)').eq('published', true).order('created_at', { ascending: false }); if (error)
            throw error; return data as ShopProduct[]; } });
    const products = q.data ?? [];
    const genderOf = (product: ShopProduct) => product.gender ?? 'unisex';
    const filtered = gender === 'all' ? products : products.filter(product => genderOf(product) === gender);
    const countFor = (id: GenderFilter) => id === 'all' ? products.length : products.filter(product => genderOf(product) === id).length;
    return <main className={styles.shop}>
        <section className={styles.hero} aria-labelledby="shop-hero-title">
            <div className={styles.heroCopy}>
                <p className={styles.heroEyebrow}><Sparkles size={14}/>{ar ? 'متجر بلايزا · موسم جديد' : 'Playza Shop · New season'}</p>
                <h1 id="shop-hero-title" className={styles.heroTitle}>{ar ? <>البس شغفك. <em>وامتلك الملعب.</em></> : <>Wear your game. <em>Own the court.</em></>}</h1>
                <p className={styles.heroText}>{ar ? 'ملابس بلايزا الرياضية بألوانك المفضلة. اختار مقاسك ولونك، واستلم من التجمع الخامس أو وصّل لأي مكان في مصر.' : 'Premium Playza sportswear in the colors you love. Pick your fit and size, collect in New Cairo, or get it delivered anywhere in Egypt.'}</p>
                <div className={styles.heroActions}>
                    <a className={styles.heroPrimary} href="#shop-products">{ar ? 'تسوق الكولكشن' : 'Shop the collection'}<ArrowRight size={17}/></a>
                    <Link className={styles.heroSecondary} href="/shop/orders">{ar ? 'طلباتي' : 'My orders'}</Link>
                </div>
                <ul className={styles.heroPerks}>
                    <li><Ruler size={15}/>{ar ? 'مقاسات XS–XXXL' : 'Sizes XS–XXXL'}</li>
                    <li><MapPin size={15}/>{ar ? 'استلام من التجمع الخامس' : 'Collection in New Cairo'}</li>
                    <li><Truck size={15}/>{ar ? 'توصيل لكل مصر · ٩٠ جنيه' : 'Delivery across Egypt · EGP 90'}</li>
                </ul>
            </div>
            <div className={styles.heroArt}>
                <span className={styles.heroRing} aria-hidden="true"/>
                <img src="/images/shop/sportswear-model-white.webp" alt={ar ? 'عارض يرتدي تيشيرت بلايزا الرياضي' : 'Model wearing a Playza sports T-shirt'} className={styles.heroImage}/>
                <span className={`${styles.heroBadge} ${styles.heroBadgeTop}`}>{ar ? 'كولكشن جديد' : 'New drop'}</span>
                <span className={`${styles.heroBadge} ${styles.heroBadgeBottom}`}>{ar ? 'بلايزا' : 'Playza'}</span>
            </div>
        </section>
        <div className={styles.toolbar}>
            <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>{ar ? 'تسوق حسب' : 'Shop by'}</span>
                <div className={styles.filterChips} role="group" aria-label={ar ? 'فلترة حسب النوع' : 'Filter by gender'}>
                    {GENDERS.map(option => <button key={option.id} type="button" className={styles.filterChip} aria-pressed={gender === option.id} onClick={() => setGender(option.id)}>{ar ? option.ar : option.en}<span>{countFor(option.id)}</span></button>)}
                </div>
            </div>
            <p className={styles.filterCount} aria-live="polite">{ar ? `${filtered.length} قطعة` : `${filtered.length} ${filtered.length === 1 ? 'style' : 'styles'}`}</p>
        </div>
        <div id="shop-products" className="scroll-mt-24">
            {q.isPending ? <p role="status">{ar ? 'جاري تحميل المنتجات…' : 'Loading products…'}</p> : q.isError ? <p role="alert">{ar ? 'تعذر تحميل المنتجات. حاول مرة أخرى.' : 'Could not load the shop.'}<Button variant="link" onClick={() => q.refetch()}>{ar ? 'إعادة المحاولة' : 'Retry'}</Button></p> : !products.length ? <div className={`${styles.panel} space-y-3 py-12 text-center`}><Shirt className="mx-auto h-12 w-12 text-secondary"/><h2 className="text-xl font-bold">{ar ? 'منتجات بلايزا قريبًا' : 'The Playza collection is coming'}</h2><p className={styles.muted}>{ar ? 'المنتجات هتظهر هنا بمجرد إضافتها من الإدارة.' : 'Products will appear here when the collection is published.'}</p></div> : !filtered.length ? <div className={`${styles.panel} space-y-3 py-12 text-center`}><Shirt className="mx-auto h-12 w-12 text-secondary"/><h2 className="text-xl font-bold">{ar ? 'لا توجد منتجات في هذا القسم بعد' : 'Nothing in this category yet'}</h2><p className={styles.muted}>{ar ? 'جرّب قسمًا آخر أو اعرض كل المنتجات.' : 'Try another category or browse the full collection.'}</p><Button variant="outline" onClick={() => setGender('all')}>{ar ? 'اعرض كل المنتجات' : 'Show all products'}</Button></div> : <div className={styles.grid}>{filtered.map(product => <ShopProductCard key={product.id} product={product}/>)}</div>}
        </div>
    </main>;
}
export function ShopProductCard({ product: p }: {
    product: ShopProduct;
}) { const { lang } = useI18n(); const ar = lang === 'ar'; const variants = p.variants.filter(v => v.active); const colors = variants.filter((v, index) => variants.findIndex(other => other.color === v.color) === index); const [color, setColor] = useState(variants.find(v => v.stock > 0)?.color ?? colors[0]?.color ?? ''); const [size, setSize] = useState(''); const [photo, setPhoto] = useState(0); const [chart, setChart] = useState(false); const [paused,setPaused]=useState(false); const [hovered,setHovered]=useState(false); const [focused,setFocused]=useState(false); const [previewOpen,setPreviewOpen]=useState(false); const images = colorImages(p, color); const imageIndex = images.length ? photo % images.length : 0; const selected = variants.find(v => v.color === color && v.size === size); const sizes = [...new Set([...(p.size_chart ?? []).map(row => row.size), ...variants.map(v => v.size)])]; useEffect(()=>{
 if(images.length<2||paused||hovered||focused||previewOpen||chart)return;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const timer=window.setInterval(()=>{if(!document.hidden&&!reduced.matches)setPhoto(current=>(current+1)%images.length);},4500);
 return ()=>window.clearInterval(timer);
},[images.length,color,paused,hovered,focused,previewOpen,chart]);
 return <article className={styles.product} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setFocused(false);}}>{images[imageIndex] ? <ProductPhotoPreview onOpenChange={setPreviewOpen} src={images[imageIndex]} alt={`${ar ? p.name_ar || p.name : p.name} — ${color}`}><img key={images[imageIndex]} src={images[imageIndex]} alt={`${ar ? p.name_ar || p.name : p.name} — ${color}`} className={`${styles.photo} ${styles.autoPhoto}`}/></ProductPhotoPreview> : <div className={styles.placeholder}><Shirt size={70}/></div>}<div className={styles.body}>{images.length > 1 && <div className={styles.row}><div className={styles.thumbs}>{images.map((url, i) => <button key={url} type="button" aria-label={`${ar ? 'صورة' : 'Photo'} ${i + 1}`} aria-pressed={i === imageIndex} onClick={() => {setPhoto(i);setPaused(true);}}><img src={url} alt=""/></button>)}</div><button type="button" className={styles.carouselToggle} aria-label={paused?(ar?"تشغيل عرض الصور":"Play product slideshow"):(ar?"إيقاف عرض الصور":"Pause product slideshow")} aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?<Play size={15}/>:<Pause size={15}/>}<span>{imageIndex+1} / {images.length}</span></button></div>}<div className={styles.row}><h2>{ar ? p.name_ar || p.name : p.name}</h2><span className={styles.price}>{formatMoney(Number(p.price), lang)}</span></div><p className="text-xs font-semibold text-secondary">{productGenderLabel(p.gender, lang)}</p><p className={styles.muted}>{ar ? p.description_ar || p.description : p.description}</p><div><p className="mb-2 text-sm font-semibold">{ar ? 'اللون' : 'Color'} · {ar ? colors.find(v => v.color === color)?.color_ar || color : color}</p><div className={styles.colors}>{colors.map(v => <button key={v.color} style={{ background: v.color_hex }} title={ar ? v.color_ar || v.color : v.color} aria-label={ar ? v.color_ar || v.color : v.color} aria-pressed={color === v.color} onClick={() => { setColor(v.color); setPhoto(0); setSize(''); }}/>)}</div></div><div><div className={`${styles.row} mb-2`}><span className="text-sm font-semibold">{ar ? 'المقاس' : 'Size'}</span><button type="button" onClick={() => setChart(true)} className="flex items-center gap-1 text-xs font-semibold text-secondary"><Ruler size={15}/>{ar ? 'جدول المقاسات' : 'Size guide'}</button></div><div className={styles.sizes}>{sizes.map(s => <button key={s} title={variants.some(v => v.color === color && v.size === s && v.stock > 0) ? s : (ar ? "غير متاح لهذا اللون أو نفد المخزون" : "Unavailable for this color or out of stock")} aria-pressed={s === size} disabled={!variants.some(v => v.color === color && v.size === s && v.stock > 0)} onClick={() => setSize(s)}>{s}</button>)}</div>{!variants.some(v => v.color === color && v.stock > 0) && <p className="mt-2 text-xs text-muted-foreground">{ar ? "نفد مخزون هذا اللون. جرّب لونًا آخر." : "This color is out of stock. Try another color."}</p>}</div>{selected && <p className={styles.muted}>{ar ? `متاح ${selected.stock}` : `${selected.stock} in stock`}</p>}<Button asChild disabled={!selected || selected.stock < 1} className="h-11 w-full rounded-xl">{selected && selected.stock > 0 ? <Link href={`/shop/checkout?variant=${selected.id}`}>{ar ? 'اشتري الآن' : 'Buy now'} →</Link> : <span>{ar ? 'اختار المقاس المتاح' : 'Select an available size'}</span>}</Button></div><Dialog open={chart} onOpenChange={setChart}><DialogContent className="min-w-0 rounded-2xl"><DialogTitle>{ar ? 'جدول المقاسات' : 'Size guide'}</DialogTitle><DialogDescription>{ar ? 'القياسات بالسنتيمتر. قارن بتيشيرت مناسب لك.' : 'Measurements in centimeters. Compare with a shirt that fits you.'}</DialogDescription>{p.size_chart?.length ? <table className={styles.chart}><thead><tr><th>{ar ? 'المقاس' : 'Size'}</th><th>{ar ? 'عرض الصدر' : 'Chest width'}</th><th>{ar ? 'الطول' : 'Length'}</th></tr></thead><tbody>{p.size_chart.map(r => <tr key={r.size}><td>{r.size}</td><td>{r.chest} cm</td><td>{r.length} cm</td></tr>)}</tbody></table> : <p className={styles.muted}>{ar ? 'قياسات المنتج لم تُضف بعد.' : 'Size measurements have not been added yet.'}</p>}</DialogContent></Dialog></article>; }

export function ShopShowcase({ showTeaser = true }: { showTeaser?: boolean } = {}) {
    const { lang } = useI18n();
    const products = useQuery({ queryKey: ['shop-featured'], refetchInterval:60000, queryFn: async () => {
        const { data, error } = await createClient().from('shop_products').select('*,variants:shop_variants(*)').eq('published', true).order('created_at', { ascending: false }).limit(2);
        if (error) throw error;
        return data as ShopProduct[];
    }});
    return <section className={styles.showcase} aria-label="Playza products">{showTeaser && <ShopTeaser />}{!!products.data?.length && <div className={styles.grid}>{products.data.map(product => <ShopProductCard key={product.id} product={product} />)}</div>}</section>;
}
