"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import type { TrainingBooking } from "@/lib/academy-training";
export type WorkspaceMember = { id:string;name:string;has_account:boolean;email:string|null;phone:string|null;branch_id:string|null;guardian_id:string|null;frozen_until:string|null;sessions:number;details:{contact_email?:string;emergency_name?:string;emergency_phone?:string;consent_status?:string;consent_note?:string}|null };
export type WorkspaceAgenda = {booking_id:string;member_id:string;member:string;program:string;program_id:string;venue:string;date:string;time:string;end:string;present:boolean|null;frozen_until:string|null;branch_id:string|null;court:number};
export type WorkspaceLead = {id:string;name:string;email:string;phone:string;stage:string;member_id:string|null;branch_id:string|null;trial_date:string|null;followup_date:string|null;notes:string|null};
export type LedgerEntry={id:string;member_id:string;booking_id:string|null;payment_id:string|null;branch_id:string|null;kind:string;amount:number;reason:string;sessions:number;created_at:string};
export type WorkspaceData={academy:{id:string;name:string;slug:string|null;is_public:boolean};capabilities:Record<string,boolean>;credit_balance:number;setup:Record<string,boolean>;branches:{id:string;name:string}[];members:WorkspaceMember[];programs:{id:string;name:string;branch_id:string|null;active:boolean;venue_id:string}[];bookings:TrainingBooking[];agenda:WorkspaceAgenda[];sessions:{id:string;date:string;time:string;branch_id:string|null}[];renewal_requests:{id:string;member_id:string;plan_name:string;sessions:number;amount:number}[];payments:{id:string;member_id:string;amount:number;payment_date:string;branch_id:string|null}[];ledger:LedgerEntry[];staff:{profile_id:string;name:string;role:string;active:boolean}[];leads:WorkspaceLead[];renewals:{member_id:string;name:string;has_account:boolean;remaining:number;last_reminder:string|null;pending_request:boolean}[];audit:{id:number;actor_id:string;action:string;entity_id:string;details:Record<string,unknown>;created_at:string}[]};
export function useAcademyWorkspace(branch='',day?:string) {
 return useQuery({queryKey:['academy-workspace',branch,day],queryFn:async()=>{
  const {data,error}=await createClient().rpc('academy_workspace',{p_branch:branch||null,...(day?{p_day:day}:{})});if(error)throw error;return data as WorkspaceData;
 }});
}
export function useAcademyAction(){
 const cache=useQueryClient();const {lang}=useI18n();
 return useMutation({mutationFn:async({name,args}:{name:string;args:Record<string,unknown>})=>{const {data,error}=await createClient().rpc(name,args);if(error)throw error;return data;},onSuccess:async()=>{
 await Promise.all(['academy-workspace','academy-training-programs','academy-training-bookings','profiles','sessions','payments','academy-ledger','notifications'].map(key=>cache.invalidateQueries({queryKey:[key]})));
 toast.success(lang==='ar'?'تم الحفظ':'Saved');
 },onError:error=>toast.error(error.message)});
}
export function useAcademyCashLedger(){return useQuery({queryKey:['academy-ledger'],queryFn:async()=>{const {data,error}=await createClient().from('academy_member_ledger').select('kind,amount,created_at,branch_id').in('kind',['payment','refund']).order('created_at');if(error)throw error;return (data??[]) as Pick<LedgerEntry,'kind'|'amount'|'created_at'|'branch_id'>[];}});}
