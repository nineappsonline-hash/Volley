"use client";
import { useState } from "react";
type Props={src?:string|null;fallback?:string;className?:string;alt:string};
export function AcademyHeroPhoto({src,fallback="/images/academy-design/sparkle/hero-volleyball.jpg",className,alt}:Props){
 const [failed,setFailed]=useState(false);
 const safeSrc=(!failed&&src?.trim())||fallback;
 return <img className={className} src={safeSrc} alt={alt} onError={()=>{if(!failed)setFailed(true)}} fetchPriority="high" decoding="async" />;
}
