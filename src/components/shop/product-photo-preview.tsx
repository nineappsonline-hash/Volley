"use client";
import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { ZoomIn } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import styles from './shop.module.css';

export function ProductPhotoPreview({src,alt,children}:{src:string;alt:string;children:ReactNode}) {
 const [open,setOpen]=useState(false);const {lang}=useI18n();const ar=lang==='ar';
 return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><button type="button" className={styles.photoPreview} aria-label={ar?`تكبير صورة ${alt}`:`Enlarge photo of ${alt}`}>{children}<span className={styles.zoomHint} aria-hidden="true"><ZoomIn size={15}/>{ar?'تكبير':'Enlarge'}</span></button></DialogTrigger>
 <DialogContent className="gap-3 rounded-2xl p-4 sm:max-w-4xl" closeButtonClassName="flex h-9 w-9 items-center justify-center rounded-full border bg-card opacity-100"><DialogTitle className="pe-12 text-base leading-relaxed">{alt}</DialogTitle><DialogDescription className="sr-only">{ar?'صورة مكبرة للمنتج. اضغط إغلاق أو Escape للعودة.':'Enlarged product photo. Close or press Escape to return.'}</DialogDescription><Image src={src} alt={alt} width={1200} height={1200} unoptimized className="max-h-[65dvh] w-full rounded-xl bg-muted/30 object-contain"/><DialogClose asChild><Button type="button" variant="outline" className="justify-self-end">{ar?'إغلاق الصورة':'Close photo'}</Button></DialogClose></DialogContent></Dialog>;
}
