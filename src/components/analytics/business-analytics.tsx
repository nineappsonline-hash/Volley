"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackPageView, trackView, trackCompletion, storageGet, storageSet, type AnalyticsContext, type BusinessEvent } from "@/lib/analytics/events";
// Conversion verification is uncommon on ordinary page views. Avoid shipping
// the registration + Supabase queries in the initial shared analytics bundle.
const PENDING_CONVERSIONS = [
  "playza:ga4:signup:v1",
  "playza:ga4:game-intent:v1",
  "playza:ga4:owner-venue-intent:v1",
] as const;

function checkPendingConversions(): void {
  try {
    if (!PENDING_CONVERSIONS.some(key => localStorage.getItem(key))) return;
  } catch {
    return;
  }
  void import("@/lib/analytics/registrations")
    .then(async ({ confirmPendingSignup, confirmPendingGameRegistration, confirmPendingOwnerVenueSubmission }) => {
      await Promise.allSettled([
        confirmPendingSignup(),
        confirmPendingGameRegistration(),
        confirmPendingOwnerVenueSubmission(),
      ]);
    })
    .catch(() => { /* Analytics must never block navigation or sign-in. */ });
}
import { createClient } from "@/lib/supabase/client";

export function BusinessAnalytics() {
  const pathname=usePathname();const previous=useRef<string>();
  useEffect(()=>{if(previous.current!==pathname){previous.current=pathname;trackPageView();}},[pathname]);
  useEffect(()=>{
    checkPendingConversions();
    const check = checkPendingConversions;
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
