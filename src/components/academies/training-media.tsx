"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { type TrainingMedia } from "@/lib/academy-training";

function youtubeId(url: string) {
 try { const u = new URL(url); const id = u.hostname === "youtu.be" ? u.pathname.slice(1) : ["youtube.com", "www.youtube.com"].includes(u.hostname) ? u.searchParams.get("v") ?? u.pathname.split("/")[2] : null; return id && /^[\w-]{11}$/.test(id) ? id : null; } catch { return null; }
}
export function TrainingMediaGallery({media=[]}:{media?:TrainingMedia[]}) {
 const {lang}=useI18n();
 return <div tabIndex={media.length>1?0:undefined} aria-label={lang==="ar"?"صور وفيديوهات التدريب؛ اسحب لعرض المزيد":"Training photos and videos; swipe for more"} className="flex w-full min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain">{media.map((m,i)=><div key={`${m.url}-${i}`} className="w-full min-w-0 shrink-0 snap-start overflow-hidden rounded-xl bg-muted">
  {m.kind==="image" ? (
   // eslint-disable-next-line @next/next/no-img-element
   <img src={m.url} alt={lang==="ar"?"صور التدريب":"Training photo"} loading="lazy" className="aspect-video w-full object-cover" />
  ) : m.kind==="video" ? <video controls preload="none" playsInline className="aspect-video w-full" src={m.url}/> : youtubeId(m.url) ? <iframe loading="lazy" title={lang==="ar"?"فيديو التدريب":"Training video"} className="aspect-video w-full" src={`https://www.youtube-nocookie.com/embed/${youtubeId(m.url)}`} allowFullScreen/> : null}
 </div>)}</div>;
}
export function TrainingMediaEditor({value,onChange,onBusy}:{value:TrainingMedia[];onChange:(media:TrainingMedia[])=>void;onBusy:(busy:boolean)=>void}) {
 const {lang}=useI18n();const ar=lang==="ar";const [url,setUrl]=useState("");const [busy,setBusy]=useState(false);
 return <div className="training-mobile space-y-3"><p className="text-sm font-medium">{ar?"صور وفيديوهات المجموعة (حتى ١٢ ملفًا، ٥٠ ميجابايت لكل ملف)":"Group photos & videos (up to 12 items, 50 MB each)"}</p>
 <Input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={busy||value.length>=12} aria-label={ar?"رفع صورة أو فيديو":"Upload photo or video"} onChange={async e=>{
 const file=e.target.files?.[0];e.target.value="";if(!file)return;if(file.size>50*1024*1024){toast.error(ar?"الحد الأقصى ٥٠ ميجابايت":"Maximum size is 50 MB");return;}
 setBusy(true);onBusy(true);try{const client=createClient();const {data:{user}}=await client.auth.getUser();if(!user)throw new Error("Sign in first");const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","video/mp4":"mp4","video/webm":"webm"} as Record<string,string>)[file.type];if(!ext)throw new Error("Unsupported file type");const path=`${user.id}/${crypto.randomUUID()}.${ext}`;const {error}=await client.storage.from("training-media").upload(path,file);if(error)throw error;onChange([...value,{kind:file.type.startsWith("image/")?"image":"video",url:client.storage.from("training-media").getPublicUrl(path).data.publicUrl}]);}catch(error){toast.error(error instanceof Error?error.message:String(error));}finally{setBusy(false);onBusy(false);}
 }}/>
 <div className="flex flex-wrap gap-2"><Input className="min-w-0 flex-1" placeholder="https://www.youtube.com/watch?v=…" aria-label={ar?"رابط يوتيوب":"YouTube link"} value={url} onChange={e=>setUrl(e.target.value)}/><Button type="button" variant="outline" disabled={busy||value.length>=12} onClick={()=>{if(!youtubeId(url)){toast.error(ar?"أدخل رابط يوتيوب صحيح":"Enter a valid YouTube link");return;}onChange([...value,{kind:"youtube",url:`https://www.youtube.com/watch?v=${youtubeId(url)}`}]);setUrl("");}}>{ar?"إضافة الفيديو":"Add video"}</Button></div>
 <TrainingMediaGallery media={value}/>{value.map((m,i)=><div key={m.url} className="flex items-center gap-2 text-xs"><span className="min-w-0 flex-1 truncate">{i+1}. {m.url}</span><Button type="button" variant="ghost" disabled={busy} onClick={()=>onChange(value.filter((_,index)=>index!==i))}>{ar?"إزالة":"Remove"}</Button></div>)}
 </div>;
}
