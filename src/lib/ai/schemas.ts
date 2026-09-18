import { z } from "zod";

/**
 * Validation schemas for structured AI outputs. These keep provider output
 * strictly typed so a hallucinated field never reaches the database.
 */

export const aiExerciseSchema = z
  .object({
    name: z.string().min(1).max(120),
    purpose: z.string().max(300).nullish(),
    duration_min: z.coerce.number().min(1).max(180),
    num_players: z.coerce.number().min(1).max(40).nullish(),
    equipment: z.array(z.string().max(60)).default([]),
    setup: z.string().max(500).nullish(),
    instructions: z.array(z.string().min(1).max(400)).max(12).default([]),
    coaching_points: z.array(z.string().min(1).max(400)).max(8).default([]),
    difficulty: z.enum(["easy", "medium", "hard"]).nullish(),
  })
  .strict();

export const aiSectionSchema = z
  .object({
    section_type: z.enum(["warmup", "technical", "tactical", "fitness", "evaluation", "cooldown"]),
    title: z.string().min(1).max(150),
    purpose: z.string().max(300).nullish(),
    duration_min: z.coerce.number().min(1).max(240),
    skill_focus: z.array(z.string().max(60)).default([]),
    exercises: z.array(aiExerciseSchema).min(1).max(14),
  })
  .strict();

/** Full training plan structure expected from the AI. */
export const aiTrainingPlanSchema = z
  .object({
    title: z.string().min(1).max(160),
    main_objective: z.string().max(300).nullish(),
    secondary_objectives: z.array(z.string().max(160)).max(5).default([]),
    skill_focus: z.array(z.string().max(60)).max(8).default([]),
    intensity_theme: z.enum(["light", "moderate", "intense"]).default("moderate"),
    session_duration_min: z.coerce.number().min(5).max(360),
    num_players: z.coerce.number().min(1).max(40),
    num_coaches: z.coerce.number().min(1).max(12),
    age_group: z.string().max(60).nullish(),
    skill_level: z.enum(["beginner", "intermediate", "advanced"]).nullish(),
    gender: z.enum(["male", "female", "mixed", "all"]).nullish(),
    equipment: z.array(z.string().max(60)).default([]),
    space: z.string().max(120).nullish(),
    notes: z.string().max(600).nullish(),
    sections: z.array(aiSectionSchema).min(3).max(10),
  })
  .strict();

export type AiTrainingPlan = z.infer<typeof aiTrainingPlanSchema>;

/** Player development plan expected from the AI. */
export const aiDevelopmentPlanSchema = z
  .object({
    position: z.string().max(80).nullish(),
    strengths: z.array(z.string().max(200)).min(1).max(8),
    areas_to_improve: z.array(z.string().max(200)).min(1).max(8),
    short_term_goals: z.array(z.string().max(200)).min(1).max(6),
    long_term_goals: z.array(z.string().max(200)).min(1).max(5),
    recommended_drills: z.array(z.string().max(200)).max(10).default([]),
    weekly_focus: z.string().max(300).nullish(),
    progress_checkpoints: z.array(z.string().max(200)).max(6).default([]),
    review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  })
  .strict();

export type AiDevelopmentPlan = z.infer<typeof aiDevelopmentPlanSchema>;

/** Post-session report structure. */
export const aiPostSessionReportSchema = z
  .object({
    summary: z.string().max(800).nullish(),
    skills_improved: z.array(z.string().max(120)).default([]),
    skills_need_work: z.array(z.string().max(120)).default([]),
    performance_rating: z.coerce.number().min(1).max(5).nullish(),
    intensity_rating: z.coerce.number().min(1).max(5).nullish(),
    engagement_rating: z.coerce.number().min(1).max(5).nullish(),
    recommendations: z.array(z.string().max(400)).max(6).default([]),
  })
  .strict();

export type AiPostSessionReport = z.infer<typeof aiPostSessionReportSchema>;

export function stripMarkdownCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

export function parseJsonSafely<TSchema extends z.ZodTypeAny>(raw: string, schema: TSchema): z.output<TSchema> {
  const text = stripMarkdownCodeFence(raw);
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    // Try to salvage a JSON fragment wrapped inside prose.
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return schema.parse(JSON.parse(match[0]));
    throw new Error("AI returned non-JSON output");
  }
}