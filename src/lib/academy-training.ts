"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
export type TrainingMedia = { kind: "image" | "video" | "youtube"; url: string };
export type TrainingSlot = { session_date: string; starts_at: string; ends_at: string; seats_left: number };
export type TrainingProgram = {
 min_age: number | null; max_age: number | null; gender: "mixed" | "male" | "female"; media: TrainingMedia[];
 venue_lat: number | null; venue_lng: number | null; venue_area: string | null; venue_governorate: string | null; rating: number | null; rating_count: number;
 id: string; academy_id: string; academy_name: string; academy_slug: string; name: string;
 sport: string; venue_id: string; venue_name: string; venue_address: string | null;
 monthly_sessions: number; monthly_price: number; trial_price: number; capacity: number; active: boolean;
 schedule: { weekday: number; start: string; end: string }[]; slots: TrainingSlot[];
};
export type TrainingBooking = {
 id: string; program_id?: string; reviewed_at?: string | null; member_id: string; kind: "monthly" | "trial"; registered_on: string; expires_on: string; amount: number;
 status: "awaiting_payment" | "submitted" | "approved" | "rejected" | "cancelled";
 hold_until: string; receipt_path: string | null; pay_method: string | null; review_note: string | null;
 details: { program: string; academy: string; academy_slug: string; sport: string; playground: string; address: string | null; member: string; sessions: TrainingSlot[] };
};
export function useTrainingPrograms(academyId?: string) {
 return useQuery({ queryKey: ["academy-training-programs", academyId ?? "all"], queryFn: async () => {
  const {data,error} = await createClient().rpc("academy_training_catalog", {p_academy_id: academyId ?? null});
  if(error) throw error; return data as TrainingProgram[];
 }});
}
export function useTrainingBookings(admin = false) {
 return useQuery({queryKey:["academy-training-bookings",admin],queryFn:async()=>{
  const client=createClient();
  const {data:{user}}=await client.auth.getUser();
  if(!user) return [];
  let query=client.from("academy_training_bookings").select("*").order("created_at",{ascending:false});
  if(!admin) query=query.eq("member_id",user.id);
  const {data,error}=await query;
  if(error) throw error;return data as TrainingBooking[];
 }});
}
export function useRefreshTraining() {
 const cache=useQueryClient();
 return async()=>{await Promise.all([cache.invalidateQueries({queryKey:["academy-training-programs"]}),cache.invalidateQueries({queryKey:["academy-training-bookings"]}),cache.invalidateQueries({queryKey:["platform-records"]}),cache.invalidateQueries({queryKey:["all-academies"]}),cache.invalidateQueries({queryKey:["public-academies"]})]);};
}
