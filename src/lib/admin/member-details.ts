import { z } from "zod";
const text = (max: number) => z.string().trim().max(max).nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
 const d = new Date(`${v}T00:00:00Z`);
 return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === v;
}, "Enter a valid date");
export const memberDetailsAction = z.object({
 action:z.literal("member_details"), id:z.string().uuid(),
 name:z.string().trim().min(1).max(100), nickname:text(100), phone:text(40),
 gender:z.enum(["male","female"]).nullable(),
 birth_date:date.refine(v=>v<=new Date().toISOString().slice(0,10)&&v>="1900-01-01", "Enter a valid birth date").nullable(),
 country:text(100), bio:text(2000),
 academy_id:z.string().uuid().nullable(), join_date:date.nullable(),
 subscription_sessions:z.number().int().min(0).max(10000),
 is_active:z.boolean(), member_plan:z.enum(["free","premium"]), premium_expires_at:z.string().datetime().nullable(),
});
export function memberAge(birthDate: string | null | undefined, today = new Date()) {
 if (!birthDate || !date.safeParse(birthDate).success) return null;
 const birth=new Date(`${birthDate}T00:00:00Z`);
 const years=today.getUTCFullYear()-birth.getUTCFullYear()-Number(today.getUTCMonth()<birth.getUTCMonth() || (today.getUTCMonth()===birth.getUTCMonth()&&today.getUTCDate()<birth.getUTCDate()));
 return years<0?null:years;
}
