"use client";

import { createClient } from "@/lib/supabase/client";
import { allowed, analyticsContext, storageGet, storageSet, storageRemove, trackBusinessEvent, trackCompletion, type AnalyticsContext } from "./events";
const PENDING = "playza:ga4:signup:v1";
const GAME = "playza:ga4:game-intent:v1";
type SignupKind = "player" | "venue" | "academy_owner";
type PendingSignup = {kind:SignupKind; method:"email"|"google"; started:number; context:AnalyticsContext; userId?:string};
export function startSignup(kind:SignupKind, method:"email"|"google", context:AnalyticsContext = {}): void {
  storageSet(PENDING,{kind,method,started:Date.now(),context:analyticsContext(context)});
}
export function cancelSignup(): void { storageRemove(PENDING); }
export function rememberSignupUser(userId:string): void {
  try { const pending=JSON.parse(storageGet(PENDING)??"null"); if(pending) storageSet(PENDING,{...pending,userId}); } catch { /* Optional tracking. */ }
}
/** Called only after an authenticated session exists; never treats ordinary login as signup. */
export async function confirmPendingSignup(): Promise<void> {
  if (!allowed()) return;
  try {
    const pending:PendingSignup|null=JSON.parse(storageGet(PENDING)??"null");
    if(!pending || Date.now()-pending.started>7*86400000) return;
    const client=createClient();
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user || (pending.userId && pending.userId!==user.id)) return;
    // Existing Google users can sign in through the same button. They are not new accounts.
    if(Date.parse(user.created_at)<pending.started-60000) {cancelSignup();return;}
    const {data:p,error:profileError}=await client.from("profiles").select("role,academy_id,phone,gender,birth_date").eq("id",user.id).maybeSingle();
    if(profileError||!p) return;
    if(pending.kind==="player" && (p.role!=="member" || !p.phone || !p.gender || !p.birth_date)) return;
    if(pending.kind==="venue" && p.role!=="playground_owner") return;
    if(pending.kind==="academy_owner" && (p.role!=="admin" || !p.academy_id)) return;
    const event=pending.kind==="venue"?"venue_registration_completed":pending.kind==="academy_owner"?"academy_owner_registration_completed":"player_signup_completed";
    await trackCompletion(event,user.id,{...pending.context,method:pending.method});
    if(pending.kind==="player" && p.academy_id) void confirmAcademyRegistration(p.academy_id);
    cancelSignup();
  } catch { /* Do not affect authentication. */ }
}
export function rememberGameJoin(gameId:string): void { storageSet(GAME,{gameId,started:Date.now()}); }
/** Registration means a persisted non-waitlisted seat, not payment approval or a receipt upload. */
export async function confirmGameRegistration(gameId:string): Promise<void> {
  if(!allowed())return;
  try {
    const client=createClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)return;
    const {data:seat,error:seatError}=await client.from("friendly_game_participants").select("is_waitlisted,pay_status").eq("game_id",gameId).eq("member_id",user.id).maybeSingle();
    if(seatError||!seat||seat.is_waitlisted||!["pending","approved"].includes(seat.pay_status))return;
    const {data:game,error:gameError}=await client.from("friendly_games").select("sport,area,playground:venues(country,governorate,area)").eq("id",gameId).maybeSingle();
    if(gameError||!game)return;
    const venue=Array.isArray(game.playground)?game.playground[0]:game.playground;
    await trackCompletion("game_registration_completed",`${user.id}:${gameId}`,{sport:game.sport,...venue,city:venue?.area??game.area});
    storageRemove(GAME);
  }catch { /* Read-only analytics cannot affect registration. */ }
}
export async function confirmPendingGameRegistration(): Promise<void> {
  try {const p=JSON.parse(storageGet(GAME)??"null");if(p&&Date.now()-p.started<86400000)await confirmGameRegistration(p.gameId);}catch{ /* Optional. */ }
}
export async function academyContext(id:string):Promise<AnalyticsContext> {
  try {
    const client=createClient();const [{data:a},{data:sports}]=await Promise.all([client.from("academies").select("country,governorate,area").eq("id",id).maybeSingle(),client.from("sports").select("name").eq("academy_id",id)]);
    return {...a,sports:(sports??[]).map(s=>s.name)};
  }catch{return {};}
}
export async function confirmAcademyRegistration(academyId:string):Promise<void> {
  if(!allowed())return;
  try {const {data:{user},error}=await createClient().auth.getUser();if(error||!user)return;const {data:p,error:profileError}=await createClient().from("profiles").select("academy_id").eq("id",user.id).maybeSingle();if(profileError||p?.academy_id!==academyId)return;await trackCompletion("academy_registration_completed",`${user.id}:${academyId}:membership`,{...await academyContext(academyId),registration_type:"academy_membership"});}catch{ /* Optional. */ }
}
export function academyRegistrationClick(academyId:string,context:AnalyticsContext={}):void {
  // Send intent synchronously so navigation to signup cannot drop the event.
  trackBusinessEvent("academy_registration_click",context);
  void academyId; // IDs stay in application data, never GA payloads.
}
