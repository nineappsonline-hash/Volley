"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackPageView, trackView, trackCompletion, storageGet, storageSet, type AnalyticsContext, type BusinessEvent } from "@/lib/analytics/events";
import { confirmPendingSignup, confirmPendingGameRegistration } from "@/lib/analytics/registrations";
import { createClient } from "@/lib/supabase/client";

export function BusinessAnalytics() {
  const pathname=usePathname();const previous=useRef<string>();
  useEffect(()=>{if(previous.current!==pathname){previous.current=pathname;trackPageView();}},[pathname]);
  useEffect(()=>{
    void confirmPendingSignup();
    void confirmPendingGameRegistration();
    const check=()=>{void confirmPendingSignup();void confirmPendingGameRegistration();};
    const onVisible=()=>{if(document.visibilityState==="visible")check();};
    window.addEventListener("focus",check);
    document.addEventListener("visibilitychange",onVisible);
    const {data:{subscription}}=createClient().auth.onAuthStateChange(()=>{setTimeout(check,0);});
    return()=>{subscription.unsubscribe();window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",onVisible);};
  },[]);
  return null;
}
export function AnalyticsView({event,id,context={}}:{event:"game_view"|"academy_view";id:string;context?:AnalyticsContext}) {
  const serialized=JSON.stringify(context);
  useEffect(()=>{trackView(event,id,JSON.parse(serialized));},[event,id,serialized]);
  return null;
}
export function RegistrationStart({event}:{event:Extract<BusinessEvent,"venue_registration_started"|"academy_owner_registration_started">}) {
  useEffect(()=>{let id=storageGet("playza:ga4:start-session");if(!id){id=JSON.stringify(crypto.randomUUID());storageSet("playza:ga4:start-session",JSON.parse(id));}void trackCompletion(event,id);},[event]);
  return null;
}
