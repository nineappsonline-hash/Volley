/** One GA4 destination; no SDK or second tag. Never pass arbitrary payloads here. */
import { COUNTRIES, COUNTRIES_AR, STATES_BY_COUNTRY, CITIES_BY_STATE } from "@/lib/locations";

export const GA_MEASUREMENT_ID = "G-XJPEX3WY2B";
export type BusinessEvent = "game_view" | "join_game_click" | "game_registration_completed" | "player_signup_completed" | "academy_view" | "academy_registration_click" | "academy_registration_completed" | "venue_registration_started" | "venue_registration_completed" | "academy_owner_registration_started" | "academy_owner_registration_completed";
export type AnalyticsContext = { sport?: string | null; sports?: string[]; country?: string | null; governorate?: string | null; city?: string | null; area?: string | null; registration_type?: "academy_membership" | "training_reservation"; method?: "email" | "google" };
type Params = Record<string, string | number | boolean>;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; navigator: Navigator & { globalPrivacyControl?: boolean }; playzaGaConfigured?: boolean; playzaGaQueue?: unknown[][]; playzaAnalyticsConsent?: "granted" | "denied" };
const JOURNEY = "playza:ga4:journey:v1";
const LEDGER = "playza:ga4:completed:v1";
const seen = new Set<string>();
let serial: Promise<unknown> = Promise.resolve();
const sports: Record<string,string> = {tennis:"tennis",padel:"padel",basketball:"basketball",volleyball:"volleyball","beach volleyball":"beach-volleyball","beach-volleyball":"beach-volleyball",archery:"archery","التنس":"tennis","البادل":"padel","كرة السلة":"basketball","الكرة الطائرة":"volleyball","الطائرة الشاطئية":"beach-volleyball","الرماية بالقوس":"archery","كرة الطائرة الشاطئية":"beach-volleyball","كرة طائرة":"volleyball","تنس":"tennis","بادل":"padel"};
const countries = new Set([...COUNTRIES, ...Object.values(COUNTRIES_AR)]);
const states = new Set(Object.values(STATES_BY_COUNTRY).flat());
const cities = new Set(Object.values(CITIES_BY_STATE).flat());
export function allowed(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as AnalyticsWindow;
  return !(w as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] && w.playzaAnalyticsConsent !== "denied" && !w.navigator.globalPrivacyControl && !["1", "yes"].includes(w.navigator.doNotTrack ?? "");
}
export function storageGet(key: string): string | null { try { return window.sessionStorage.getItem(key); } catch { return null; } }
export function storageSet(key: string, value: unknown): void { if (!allowed()) return; try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Analytics storage is optional. */ } }
export function storageRemove(key: string): void { try { window.sessionStorage.removeItem(key); } catch { /* Optional. */ } }
export function analyticsContext(input: AnalyticsContext = {}): Params {
  const result: Params = {};
  const list = [...new Set([input.sport, ...(input.sports ?? [])].flatMap(value => typeof value === "string" ? value.split(",").map(s => sports[s.trim().toLowerCase()]).filter(Boolean) : []))].sort();
  if (list.length) result.sport = list.join(",");
  if (input.country && countries.has(input.country)) result.country = input.country;
  if (input.governorate && states.has(input.governorate)) result.governorate = input.governorate;
  const city = input.city ?? input.area;
  if (city && cities.has(city)) result.city = city;
  if (input.registration_type === "academy_membership" || input.registration_type === "training_reservation") result.registration_type = input.registration_type;
  if (input.method === "email" || input.method === "google") result.method = input.method;
  return result;
}
/** Do not transmit arbitrary slugs, redirect URLs, invite tokens, payment IDs or query strings. */
export function safePath(path: string): string {
  const parts = path.split(/[?#]/)[0].split("/").filter(Boolean);
  const fixed = new Set(["ar","dashboard","games","my-games","academies","signup","owner","tenant","login","auth","continue","callback","complete-profile","onboarding","sports","guides","tournaments","playgrounds","academy-management","academy-bookings","payment-result","checkout","plans","tennis","padel","basketball","volleyball","beach-volleyball","archery","faq","solutions","list-your-court","book-courts","courts","football","swimming","update-password","forgot-password","volleyball-cairo","join-volleyball-without-team","beach-volleyball-beginners"]);
  return "/" + parts.map((p,i) => fixed.has(p) ? p : i === 0 && p === "a" ? "a" : "detail").join("/");
}
// Only operational campaign identifiers are accepted. Raw search terms/content are never sent.
function campaign(value: string | null): string | undefined {
  return value && /^[a-z][a-z0-9_-]{0,63}$/i.test(value) && !/\d{7}|email|phone|@/i.test(value) ? value.toLowerCase() : undefined;
}
type Journey = { entry_page: string; journey_source: string; journey_medium: string; journey_campaign?: string; campaign_id?: string; campaign_content?: string; campaign_term?: string; created: number };
export function journey(): Journey {
  let previous: Journey | undefined;
  try { previous = JSON.parse(storageGet(JOURNEY) ?? "null") ?? undefined; } catch { /* Ignore corrupt storage. */ }
  if (previous && (typeof previous.entry_page !== "string" || !Number.isFinite(previous.created) || Date.now() - previous.created > 30 * 86400000)) previous = undefined;
  if(previous) {previous.entry_page=safePath(previous.entry_page);previous.journey_source=campaign(previous.journey_source)??"direct";previous.journey_medium=campaign(previous.journey_medium)??"none";previous.journey_campaign=campaign(previous.journey_campaign??null);previous.campaign_id=campaign(previous.campaign_id??null);previous.campaign_content=campaign(previous.campaign_content??null);previous.campaign_term=sports[previous.campaign_term??""];}
  const url = new URL(window.location.href);
  const source = campaign(url.searchParams.get("utm_source"));
  const medium = campaign(url.searchParams.get("utm_medium"));
  const currentCampaign = campaign(url.searchParams.get("utm_campaign"));
  const campaignId = campaign(url.searchParams.get("utm_id"));
  const content = campaign(url.searchParams.get("utm_content"));
  const term = sports[(url.searchParams.get("utm_term")??"").toLowerCase()];
  if (previous && (!source || (source === previous.journey_source && medium === previous.journey_medium && currentCampaign === previous.journey_campaign && campaignId === previous.campaign_id && content === previous.campaign_content && term === previous.campaign_term))) return previous;
  let referrer = "";
  try { referrer = new URL(document.referrer).hostname; } catch { /* Direct visit. */ }
  const search = /(^|\.)(google\.[a-z.]+|bing.com|duckduckgo.com|search.yahoo.com)$/.test(referrer);
  const result: Journey = { entry_page: safePath(url.pathname), journey_source: source ?? (search ? referrer.includes("google.") ? "google" : referrer.includes("bing.") ? "bing" : referrer.includes("duckduckgo.") ? "duckduckgo" : "yahoo" : referrer && referrer !== url.hostname ? "referral" : "direct"), journey_medium: medium ?? (search ? "organic" : referrer && referrer !== url.hostname ? "referral" : "none"), ...(currentCampaign ? {journey_campaign: currentCampaign} : {}), ...(campaignId ? {campaign_id:campaignId} : {}), ...(content ? {campaign_content:content} : {}), ...(term ? {campaign_term:term} : {}), created: Date.now() };
  storageSet(JOURNEY, result);
  return result;
}
function command(...args: unknown[]): void {
  if (!allowed()) return;
  const w = window as AnalyticsWindow;
  if (!w.playzaGaConfigured) {
    (w.playzaGaQueue ||= []).push(args);
    return;
  }
  w.dataLayer = w.dataLayer || [];
  // Match Google's Arguments-based queue so events sent before afterInteractive are retained.
  w.gtag = w.gtag || function () { w.dataLayer!.push(arguments); };
  w.gtag(...args);
}
function pageContext(): Params {
  const j = journey();
  const url = new URL(safePath(window.location.pathname), window.location.origin);
  // Restore safe campaign attribution after auth/redirects without copying sensitive URL parameters.
  if (j.journey_source !== "direct" && j.journey_source !== "referral") {
    url.searchParams.set("utm_source", j.journey_source);
    url.searchParams.set("utm_medium", j.journey_medium);
    if (j.journey_campaign) url.searchParams.set("utm_campaign", j.journey_campaign);
    if (j.campaign_id) url.searchParams.set("utm_id", j.campaign_id);
    if (j.campaign_content) url.searchParams.set("utm_content", j.campaign_content);
    if (j.campaign_term) url.searchParams.set("utm_term", j.campaign_term);
  }
  let referrer = "";
  try { const parsed = new URL(document.referrer); if (!/(^|\.)(accounts.google.com|kashier.io)$/.test(parsed.hostname)) referrer = parsed.origin + "/"; } catch { /* No referrer. */ }
  return {page_location:url.toString(), page_referrer:referrer, page_title:`Playza ${safePath(window.location.pathname)}`, entry_page:j.entry_page, journey_source:j.journey_source, journey_medium:j.journey_medium, ...(j.journey_campaign ? {journey_campaign:j.journey_campaign} : {})};
}
export function trackPageView(): void {
  if (!allowed()) return;
  const url=new URL(window.location.href);
  const context=analyticsContext({sport:url.searchParams.get("sport")??url.pathname.split("/").at(-1)});
  if(context.sport) storageSet("playza:ga4:intent",context);
  const params={...pageContext(),...context};
  command("set",params);
  command("event","page_view",{...params,send_to:GA_MEASUREMENT_ID});
}
export function trackBusinessEvent(name: BusinessEvent, context: AnalyticsContext = {}): boolean {
  if (!allowed()) return false;
  try {
    let intent: AnalyticsContext = {};
    try { intent = JSON.parse(storageGet("playza:ga4:intent") ?? "{}"); } catch { /* Optional. */ }
    const clean=analyticsContext(context);
    if (["game_view","join_game_click","academy_view","academy_registration_click"].includes(name) && Object.keys(clean).length) storageSet("playza:ga4:intent",clean);
    const inheritIntent=["player_signup_completed","venue_registration_started","academy_owner_registration_started"].includes(name);
    command("event",name,{...pageContext(),...(inheritIntent?analyticsContext(intent):{}),...clean,send_to:GA_MEASUREMENT_ID}); return true;
  } catch { return false; }
}
export function trackView(name: "game_view" | "academy_view", id: string, context: AnalyticsContext): void {
  const key = `${name}:${id}`;
  if (seen.has(key)) return;
  if (trackBusinessEvent(name, context)) seen.add(key);
}
/** IDs are used only in a local SHA-256 dedupe key, never as GA parameters. */
export function trackCompletion(name: BusinessEvent, localIdentity: string, context: AnalyticsContext = {}): Promise<void> {
  const run = async () => {
    if (!allowed()) return;
    const bytes = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${name}:${localIdentity}`));
    const key = Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,"0")).join("");
    const send = () => {
      let ledger: Record<string,number> = {};
      try { ledger = JSON.parse(window.localStorage.getItem(LEDGER) ?? "{}"); } catch { /* Memory fallback. */ }
      if (ledger[key] || seen.has(key)) return;
      if (!trackBusinessEvent(name, context)) return;
      seen.add(key); ledger[key] = Date.now();
      try { window.localStorage.setItem(LEDGER,JSON.stringify(ledger)); } catch { /* In-memory dedupe still works. */ }
    };
    if (window.navigator.locks) await window.navigator.locks.request(`playza:ga4:${key}`, send); else send();
  };
  serial = serial.then(run,run).catch(()=>{ /* Analytics cannot break registrations. */ });
  return serial as Promise<void>;
}
