import type { AiDevelopmentPlan, AiTrainingPlan } from "./schemas";

/**
 * Deterministic fallback generators, used when no AI provider is configured
 * or an AI call fails. These produce safe, rule-based plans so the AI Coach
 * Assistant remains a working manual workflow without external keys.
 */

const STANDARD_SECTIONS = (duration: number, sport: string) => {
  const wu = Math.max(10, Math.round(duration * 0.12));
  const cool = Math.max(5, Math.round(duration * 0.08));
  const body = Math.max(10, duration - wu - cool);
  return { wu, cool, body };
};

const GENERIC_EXERCISES: Record<string, { name: string; points: string[] }[]> = {
  warmup: [
    { name: "Light mobility & pulse raiser", points: ["Progressively raise heart rate", "Full range of motion"] },
    { name: "Dynamic stretching", points: ["Keep movements controlled", "Focus on the sport's primary joints"] },
  ],
  technical: [
    { name: "Ball mastery circuit", points: ["Quality over speed", "Both sides / both feet-and-hands"] },
    { name: "Small-sided pairing drill", points: ["High repetitions per player", "Short, focused rest"] },
  ],
  tactical: [
    { name: "Positional game 4v4 (+gk)", points: ["Compact shape", "Quick transitions"] },
    { name: "Restarts & scenarios", points: ["Repeat key routines", "Vary attacking angles"] },
  ],
  fitness: [
    { name: "Interval shuttle work", points: ["Team intensity targets", "Good recovery discipline"] },
    { name: "Core & coordination block", points: ["Correct form cues", "Avoid fatigue-driven breakdown"] },
  ],
  cooldown: [
    { name: "Low-intensity possession", points: ["Keep the ball moving", "Focus on relaxed breathing"] },
    { name: "Static stretching", points: ["20-30s holds", "No stretching through pain"] },
  ],
};

export function generateFallbackPlan(
  input: { sport: string; session_duration_min?: number; num_players?: number; main_objective?: string | null; skill_level?: string | null; age_group?: string | null; intensity_theme?: "light" | "moderate" | "intense" }
): AiTrainingPlan {
  const sport = input.sport || "Volleyball";
  const duration = input.session_duration_min || 90;
  const { wu, cool, body } = STANDARD_SECTIONS(duration, sport);
  const players = input.num_players || 12;
  const intensity = input.intensity_theme || "moderate";

  const sections: AiTrainingPlan["sections"] = [
    {
      section_type: "warmup",
      title: "Warm-up",
      purpose: "Prepare the body and mind for training.",
      duration_min: wu,
      skill_focus: ["mobility", "activation"],
      exercises: GENERIC_EXERCISES.warmup.map((e, i) => ({
        name: e.name,
        purpose: "Raise body temperature and prepare joints",
        duration_min: Math.max(4, Math.floor(wu / 2.5)),
        num_players: null,
        equipment: [],
        setup: "Open space, cones if available",
        instructions: ["Follow the coaches' demonstration", "Move at a brisk but controlled pace"],
        coaching_points: e.points,
        difficulty: "easy" as const,
      })),
    },
    {
      section_type: "technical",
      title: "Core skills block",
      purpose: "Build the fundamental skills needed for game situations.",
      duration_min: Math.round(body * 0.55),
      skill_focus: ["passing", "reception", "control"],
      exercises: GENERIC_EXERCISES.technical.map((e, i) => ({
        name: e.name,
        purpose: "Repetitive skill development",
        duration_min: Math.max(6, Math.round((body * 0.55) / 2)),
        num_players: players,
        equipment: [sport, "cones"],
        setup: "Station-based setup across the facility",
        instructions: ["Rotate stations every 5-8 minutes", "Emphasize technique cues from the coach"],
        coaching_points: e.points,
        difficulty: "medium" as const,
      })),
    },
    {
      section_type: "tactical",
      title: "Game application",
      purpose: "Apply the practiced skills under game conditions.",
      duration_min: Math.round(body * 0.3),
      skill_focus: ["game understanding", "decision making"],
      exercises: GENERIC_EXERCISES.tactical.map((e, i) => ({
        name: e.name,
        purpose: "Reinforce principles in a realistic setting",
        duration_min: Math.max(8, Math.round((body * 0.3) / 2)),
        num_players: Math.min(players, 12),
        equipment: [sport],
        setup: "Full or scaled court/pitch with goals or lines",
        instructions: ["Play at match tempo", "Rotate positions frequently"],
        coaching_points: e.points,
        difficulty: "hard" as const,
      })),
    },
    {
      section_type: "cooldown",
      title: "Cool-down & review",
      purpose: "Recover and recap the session's key takeaways.",
      duration_min: cool,
      skill_focus: ["recovery", "reflection"],
      exercises: GENERIC_EXERCISES.cooldown.map((e, i) => ({
        name: e.name,
        purpose: "Gradual recovery and session review",
        duration_min: Math.max(4, Math.floor(cool / 2)),
        num_players: null,
        equipment: [],
        setup: "Relaxed area",
        instructions: ["Stretch gently", "Discuss what went well and what to work on"],
        coaching_points: e.points,
        difficulty: "easy" as const,
      })),
    },
  ];

  return {
    title: `${sport} training — ${input.main_objective ? input.main_objective.slice(0, 60) : "General"}`,
    main_objective: input.main_objective ?? `Improve core ${sport.toLowerCase()} fundamentals`,
    secondary_objectives: ["Build confidence", "Increase game understanding"],
    skill_focus: ["passing", "reception", "game awareness"],
    intensity_theme: intensity,
    session_duration_min: duration,
    num_players: players,
    num_coaches: 2,
    age_group: input.age_group ?? null,
    skill_level: (input.skill_level as AiTrainingPlan["skill_level"]) ?? null,
    gender: null,
    equipment: [sport, "cones", "bib/pinnies"],
    space: "Indoor court",
    notes: "Fallback template — replace with AI-generated plan when an AI provider is configured.",
    sections,
  };
}

export function generateFallbackDevPlan(input: { player_name: string; sport: string }): AiDevelopmentPlan {
  const sport = input.sport || "Volleyball";
  return {
    position: null,
    strengths: ["Consistent attendance", "Positive attitude in training"],
    areas_to_improve: [`Core ${sport.toLowerCase()} technique`, "Game decision-making under pressure"],
    short_term_goals: ["Attend all scheduled sessions this month", "Complete the weekly technique drill block"],
    long_term_goals: [`Reach a reliable, coachable level of ${sport.toLowerCase()} gameplay`],
    recommended_drills: ["Weekly wall/target repetition routine", "Small-sided match-play scenarios"],
    weekly_focus: "Technique fundamentals with a game application at the end of each week",
    progress_checkpoints: ["First coach review in 6 weeks", "Mid-season skills assessment"],
    review_date: null,
  };
}

export function generateFallbackReport(notes: string): {
  summary: string;
  skills_improved: string[];
  skills_need_work: string[];
  performance_rating: number | null;
  intensity_rating: number | null;
  engagement_rating: number | null;
  recommendations: string[];
} {
  return {
    summary: notes || "Session completed. See notes for details.",
    skills_improved: [],
    skills_need_work: [],
    performance_rating: null,
    intensity_rating: null,
    engagement_rating: null,
    recommendations: [],
  };
}