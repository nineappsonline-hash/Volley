export type Role = "super_admin" | "admin" | "member" | "playground_owner";

export type MemberPlan = "free" | "premium";

export type SessionStatus = "scheduled" | "completed" | "canceled";

export type MembershipType = "full" | "half";

export type PaymentMethod = "cash" | "card" | "wallet" | "bank_transfer" | "other";

export type PlanSubscriptionKind = "member" | "academy";
export type PlanSubscriptionPlan = "pro" | "plus" | "elite";
export type PlanSubscriptionCycle = "monthly" | "semi" | "yearly";
export type PlanSubscriptionMethod = "instapay" | "e_wallet" | "kashier";
export type PlanSubscriptionStatus = "pending" | "verified" | "rejected";

// ── AI Coach Assistant ──────────────────────────────────────
export type TrainingPlanStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "archived";

export type SectionType =
  | "warmup"
  | "technical"
  | "tactical"
  | "fitness"
  | "evaluation"
  | "cooldown";

export type IntensityTheme = "light" | "moderate" | "intense";

export interface TrainingExercise {
  id: string;
  section_id: string;
  name: string;
  purpose: string | null;
  duration_min: number;
  num_players: number | null;
  equipment: string[];
  setup: string | null;
  instructions: string[];
  coaching_points: string[];
  difficulty: "easy" | "medium" | "hard" | null;
  order_index: number;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainingSection {
  id: string;
  plan_id: string;
  section_type: SectionType;
  title: string;
  purpose: string | null;
  duration_min: number;
  skill_focus: string[];
  order_index: number;
  created_at: string;
  updated_at: string;
  exercises: TrainingExercise[];
}

export interface TrainingPlan {
  id: string;
  academy_id: string;
  branch_id: string | null;
  team_id: string | null;
  session_id: string | null;
  sport_id: string | null;
  sport: string | null;
  title: string;
  main_objective: string | null;
  secondary_objectives: string[];
  skill_focus: string[];
  intensity_theme: IntensityTheme;
  session_duration_min: number;
  num_players: number;
  num_coaches: number;
  age_group: string | null;
  skill_level: "beginner" | "intermediate" | "advanced" | null;
  gender: "male" | "female" | "mixed" | "all" | null;
  equipment: string[];
  space: string | null;
  notes: string | null;
  status: TrainingPlanStatus;
  approval_note: string | null;
  is_favorite: boolean;
  is_template: boolean;
  template_name: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  ai_generation_id: string | null;
  ai_estimated_cost: number;
  version: number;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  sections?: TrainingSection[];
}

export interface TrainingPlanVersion {
  id: string;
  plan_id: string;
  version: number;
  editor_id: string;
  action: "created" | "generated" | "edited" | "submitted" | "approved" | "rejected" | "restored" | "archived";
  snapshot: unknown;
  created_at: string;
}

export interface TrainingPlanAssignment {
  id: string;
  plan_id: string;
  session_id: string;
  scheduled_at: string | null;
  notes: string | null;
  assigned_by: string;
  created_at: string;
}

export interface PostSessionReport {
  id: string;
  academy_id: string;
  plan_id: string | null;
  session_id: string | null;
  team_id: string | null;
  coach_id: string | null;
  completed: boolean;
  actual_duration_min: number | null;
  exercises_performance: unknown[];
  performance_rating: number | null;
  intensity_rating: number | null;
  engagement_rating: number | null;
  skills_improved: string[];
  skills_need_work: string[];
  injuries: unknown[];
  notes: string | null;
  player_notes: unknown[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type DevPlanVisibility = "coach" | "academy" | "player" | "parent";

export interface PlayerDevelopmentGoal {
  id: string;
  plan_id: string;
  title: string;
  goal_type: "short_term" | "long_term";
  target_date: string | null;
  progress: number;
  achieved: boolean;
  notes: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface PlayerDevelopmentPlan {
  id: string;
  academy_id: string;
  player_id: string;
  coach_id: string | null;
  sport: string | null;
  position: string | null;
  strengths: string[];
  areas_to_improve: string[];
  short_term_goals: string[];
  long_term_goals: string[];
  recommended_drills: string[];
  weekly_focus: string | null;
  progress_checkpoints: string[];
  review_date: string | null;
  visibility: DevPlanVisibility;
  private_notes: string | null;
  status: "draft" | "approved" | "archived";
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  goals?: PlayerDevelopmentGoal[];
}

export interface AiUsageLog {
  id: string;
  academy_id: string;
  user_id: string;
  feature: string;
  provider: string | null;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost: number;
  latency_ms: number;
  success: boolean;
  error: string | null;
  created_at: string;
}

// ── Academy Insights & Predictions ──────────────────────────
export type PredictionScoreType =
  | "churn_risk"
  | "attendance_risk"
  | "utilization_risk"
  | "revenue_forecast"
  | "enrollment_forecast";

export type RiskLevel = "low" | "medium" | "high" | "not_enough_data";

export interface PredictionScore {
  id: string;
  academy_id: string;
  entity_type: "member" | "team" | "academy";
  entity_id: string;
  score_type: PredictionScoreType;
  score: number | null;
  level: RiskLevel;
  explanation: Record<string, unknown>;
  model_version: string;
  period_key: string;
  computed_at: string;
}

export interface PredictionFactor {
  id: string;
  score_id: string;
  factor_key: string;
  factor_label: string;
  direction: "positive" | "negative" | "neutral";
  weight: number;
  contribution: number;
  data_snapshot: Record<string, unknown>;
  created_at: string;
}

export type AlertStatus =
  | "new"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "dismissed";

export type AlertType =
  | "no_attendance"
  | "payment_overdue"
  | "retention_trajectory"
  | "utilization_low"
  | "revenue_drop"
  | "enrollment_decline";

export interface AcademyAlert {
  id: string;
  academy_id: string;
  alert_type: AlertType;
  severity: "low" | "medium" | "high";
  entity_type: "member" | "team" | "academy";
  entity_id: string;
  title: string;
  body: string | null;
  recommended_action: string | null;
  status: AlertStatus;
  dedupe_key: string;
  assigned_to: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertAction {
  id: string;
  alert_id: string;
  actor_id: string;
  action: string;
  note: string | null;
  created_at: string;
}

export interface AcademyInsight {
  id: string;
  academy_id: string;
  period_key: string;
  metrics: Record<string, unknown>;
  computed_at: string;
}

export interface PredictionSettings {
  academy_id: string;
  thresholds: {
    payment_gap_days?: number;
    attendance_gap_days?: number;
    utilization_low_pct?: number;
    revenue_drop_pct?: number;
    churn_high?: number;
    churn_medium?: number;
  };
  enabled_alerts: AlertType[];
  updated_at: string;
}

export interface DashboardPreferences {
  id: string;
  user_id: string;
  academy_id: string;
  default_filters: Record<string, unknown>;
  visible_kpis: string[];
  chart_prefs: Record<string, unknown>;
  updated_at: string;
}

export interface PlanSubscription {
  id: string;
  user_id: string;
  academy_id: string | null;
  kind: PlanSubscriptionKind;
  plan: PlanSubscriptionPlan;
  billing_cycle: PlanSubscriptionCycle;
  amount: number;
  method: PlanSubscriptionMethod;
  receipt_url: string | null;
  receipt_status: PlanSubscriptionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type SkillLevel = "beginner" | "intermediate" | "advanced";

export type ExpenseCategory =
  | "equipment"
  | "uniforms"
  | "tournament"
  | "travel"
  | "other";

export type TrialStatus = "new" | "contacted" | "converted" | "declined";

export interface Academy {
  monthly_sessions?: number | null;
  monthly_price?: number | null;
  tryout_price?: number | null;
  id: string;
  name: string;
  invite_code: string;
  slug: string | null;
  description: string | null;
  address: string | null;
  country: string | null;
  governorate: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  cover_url: string | null;
  logo_url: string | null;
  is_public: boolean;
  calendar_token: string | null;
  is_trial: boolean;
  trial_ends_at: string | null;
  trial_extended_at: string | null;
  session_booking_enabled: boolean;
  platform_fee_percent: number | null;
  plan: "starter" | "plus" | "elite";
  created_at: string;
}

export interface AcademyBranch {
  id: string;
  academy_id: string;
  name: string;
  address: string | null;
  country: string | null;
  governorate: string | null;
  area: string | null;
  phone: string | null;
  is_main: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  academy_id: string | null;
  // Null for family members (children) who have no login account.
  email: string | null;
  role: Role;
  name: string;
  // Unique lowercase handle (@username) used as the primary identifier.
  username: string;
  // Optional free-form display name ("الصقر", "Bebo") shown wherever the
  // member appears as a *participant* — game rosters, game chat, teams.
  // Falls back to `name` when unset (resolved server-side).
  nickname: string | null;
  phone: string | null;
  // Set when this profile is a family member managed by a parent (guardian).
  guardian_id: string | null;
  // Object path inside the public "avatars" bucket; null until the member
  // uploads a profile picture.
  avatar_url: string | null;
  // Preset emoji avatar shown when no photo is uploaded (see @/lib/avatars).
  avatar_id: string | null;
  join_date: string | null;
  membership_type: MembershipType;
  subscription_sessions: number;
  sessions_attended: number;
  is_active: boolean;
  checkin_code: string | null;
  last_reminded_at: string | null;
  member_plan: MemberPlan;
  premium_expires_at: string | null;
  community_visible: boolean;
  bio: string | null;
  lat: number | null;
  lng: number | null;
  skill_level: SkillLevel | null;
  position: string | null;
  availability_days: number[];
  interested_sports: string[] | null;
  notify_game_alerts: boolean;
  // Community join criteria (used to gate who can join a friendly game).
  gender: "male" | "female" | null;
  birth_date: string | null;
  created_at: string;
}

export interface MembershipPlan {
  id: string;
  academy_id: string;
  name: string;
  sessions_count: number;
  price: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Coach {
  id: string;
  academy_id: string;
  name: string;
  phone: string | null;
  specialty: string | null;
  monthly_salary: number | null;
  is_active: boolean;
  created_at: string;
  /** Set when the coach was created by accepting a coach invitation — links
   * the staff record to the member profile that joined the staff. */
  profile_id: string | null;
}

export type CoachInvitationStatus = "pending" | "accepted" | "declined";

export interface CoachInvitation {
  id: string;
  academy_id: string;
  member_id: string;
  invited_by: string;
  status: CoachInvitationStatus;
  created_at: string;
  responded_at: string | null;
}

export interface Venue {
  review_missing_fields?: string[];
  review_note?: string | null;
  approval_status?: "pending" | "approved" | "rejected";
  sport?: { id: string; name: string } | null;
  id: string;
  // Null when the venue sits in the platform's unassigned playground pool.
  academy_id: string | null;
  // Set when the venue belongs to an independent playground owner (not an academy).
  owner_profile_id: string | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  sport_id: string | null;
  school_name: string | null;
  rental_cost: number | null;
  booking_price?: { per_player: number; full_court: number; minimum_players: number; hours: number } | null;
  contact_phone?: string | null;
  court_availability?: (VenueUnavailableSlot & { court_number: number })[];
  // Number of time units (hours) the academy rents this venue from the owner.
  rental_hours: number | null;
  /** Map/navigation link (e.g. Google Maps share URL) shown to members as a
   * "Directions" button. */
  location_link: string | null;
  /** Playground photos (public URLs in the venue-photos bucket). Shown in the
   * playground's gallery; order is the upload order. */
  photos: string[];
  /** Explicit card thumbnail chosen by the super admin. Falls back to the
   * first gallery photo when null. */
  cover_url: string | null;
  country: string | null;
  governorate: string | null;
  area: string | null;
  /** Weekly windows when the playground is always unavailable.
   * weekday: 0 = Sunday … 6 = Saturday; start/end are "HH:MM" 24h. */
  unavailable_slots?: VenueUnavailableSlot[];
  /** Weekly working hours. Reservations are only allowed on the listed days,
   * within the listed windows; days without an entry are closed. An empty
   * list means no restriction (always open). Same shape as the excluded
   * times above. */
  working_hours?: VenueUnavailableSlot[];
  /** One-off blocked dates/times chosen by the owner from a calendar.
   * Each entry blocks a whole day (all_day) or a time window
   * (start/end as "HH:MM") on that date. */
  blocked_dates?: VenueBlockedDate[];
  // How many simultaneous courts the playground has (default 1).
  court_count?: number;
  created_at: string;
}

/** A single date (or time window within a date) the owner has blocked so no
 * bookings can be made then. ISO date "YYYY-MM-DD"; times "HH:MM" 24h. */
export interface VenueBlockedDate {
  date: string;
  all_day?: boolean;
  start?: string | null;
  end?: string | null;
}

export interface VenueUnavailableSlot {
  weekday: number;
  start: string;
  end: string;
}

export type RentalPaymentMethod = "cash" | "bank_transfer" | "e_wallet";

export interface AcademyPhoto {
  id: string;
  academy_id: string;
  photo_url: string;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface PlaygroundOwner {
  id: string;
  profile_id: string;
  status: "pending" | "approved" | "rejected";
  business_name: string | null;
  phone: string | null;
  country: string | null;
  governorate: string | null;
  area: string | null;
  review_note: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface VenueRental {
  id: string;
  academy_id: string;
  venue_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  // Rate charged per unit of time (1 unit = 1 hour).
  price: number;
  // Number of time units (hours) this rental lasts.
  hours: number;
  rental_date: string;
  start_time: string;
  is_paid: boolean;
  payment_method: RentalPaymentMethod | null;
  notes: string | null;
  // Which court this rental occupies (1 = first court, set automatically).
  court_number?: number;
  created_at: string;
  // Embedded select: venue name (via venues(name)).
  venues?: { name: string; rental_cost?: number | null } | null;
}

export interface Payment {
  id: string;
  academy_id: string | null;
  member_id: string;
  amount: number;
  payment_date: string;
  membership_type: MembershipType;
  subscription_sessions: number;
  plan_id: string | null;
  method: PaymentMethod;
  notes: string | null;
  created_at: string;
}

export interface TrainingSession {
  duration_minutes?: number;
  court_number?: number | null;
  recurring_schedule_id?: string | null;
  recurring_occurrence_date?: string | null;
  id: string;
  academy_id: string | null;
  date: string;
  time: string;
  location: string | null;
  notes: string | null;
  sport_id: string | null;
  venue_id: string | null;
  coach_id: string | null;
  age_group: string | null;
  skill_level: SkillLevel | null;
  is_completed: boolean;
  status: SessionStatus;
  session_price: number | null;
  created_at: string;
}

export interface Sport {
  id: string;
  academy_id: string;
  name: string;
  created_at: string;
}

export interface Team {
  id: string;
  academy_id: string;
  name: string;
  sport_id: string | null;
  coach_id: string | null;
  age_group: string | null;
  skill_level: SkillLevel | null;
  description: string | null;
  created_at: string;
}

export interface TeamMemberRow {
  member_id: string;
  profile: { id: string; name: string; nickname: string | null } | null;
}

export interface TeamWithDetails extends Team {
  sport: Pick<Sport, "id" | "name"> | null;
  team_members: TeamMemberRow[];
}

export interface Announcement {
  id: string;
  academy_id: string;
  title: string;
  body: string;
  created_by: string | null;
  created_at: string;
}

export interface AcademyFollow {
  id: string;
  member_id: string;
  academy_id: string;
  created_at: string;
}

export interface Expense {
  id: string;
  academy_id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  expense_date: string;
  created_at: string;
}

export interface PlayerEvaluation {
  id: string;
  academy_id: string;
  member_id: string;
  evaluated_by: string | null;
  evaluation_date: string;
  technique: number;
  tactics: number;
  fitness: number;
  attitude: number;
  notes: string | null;
  created_at: string;
}

export interface ScheduleTemplate {
  id: string;
  academy_id: string;
  name: string;
  weekday: number; // 0 = Sunday … 6 = Saturday
  time: string;
  sport_id: string | null;
  venue_id: string | null;
  coach_id: string | null;
  age_group: string | null;
  skill_level: SkillLevel | null;
  created_at: string;
}

export interface CoachAvailability {
  id: string;
  academy_id: string;
  coach_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

export type TournamentFormat = "knockout" | "league";

export interface Tournament {
  id: string;
  academy_id: string;
  name: string;
  description: string | null;
  prize: string | null;
  sport_id: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  // Entry fee per participant (in EGP). 0 = free.
  participant_fee: number | null;
  // Cap on the participant pool; null = unlimited.
  max_participants: number | null;
  // The playground where the tournament is held.
  venue_id: string | null;
  status: "upcoming" | "in_progress" | "completed" | "canceled";
  // knockout = seeded single-elimination bracket; league = round-robin
  // with points. NULL until the organizer picks a format.
  format: TournamentFormat | null;
  created_at: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round_name: string;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
  // Goal totals (can differ from score when the sport counts sub-goals);
  // default to the score when the organizer enters only a result.
  goals_a: number | null;
  goals_b: number | null;
  // Bracket wiring (knockout): which earlier matches feed this one.
  prev_match_a_id: string | null;
  prev_match_b_id: string | null;
  // Ordering slot within the round (knockout) or global order (league).
  slot: number | null;
  match_date: string | null;
  match_time: string | null;
  venue_id: string | null;
  status: "scheduled" | "completed" | "canceled";
  notes: string | null;
  created_at: string;
}

export interface TournamentWithMatches extends Tournament {
  sport: Pick<Sport, "id" | "name"> | null;
  tournament_matches: TournamentMatch[];
  /** Number of joined participants (embedded count). */
  participant_count?: number;
}

// ── Tournament runner (pool → teams → fixtures → standings) ──

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  member_id: string;
  added_at: string;
}

export interface TournamentTeam {
  id: string;
  tournament_id: string;
  name: string;
  created_at: string;
}

export interface TournamentTeamWithMembers extends TournamentTeam {
  members: {
    id: string;
    participant_id: string;
    member_id: string;
    display_name: string;
  }[];
}

export interface TournamentStanding {
  team_id: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

export interface AcademyRating {
  id: string;
  academy_id: string;
  member_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface TrialRequest {
  id: string;
  academy_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  sport_id: string | null;
  preferred_date: string | null;
  status: TrialStatus;
  created_at: string;
}

export interface Attendance {
  id: string;
  session_id: string;
  member_id: string;
  is_present: boolean;
  marked_at: string;
}

export interface MonthlyCost {
  id: string;
  academy_id: string;
  month: number;
  year: number;
  /** Monthly coach fee, prorated over coach_fee_basis sessions. */
  coach_fee: number;
  coach_fee_basis: MembershipType;
  court_rental: number;
  sessions_per_month: number;
  cost_per_session: number;
  created_at: string;
  updated_at: string;
}

export interface SessionCalculation {
  id: string;
  session_id: string;
  total_revenue: number;
  cost_per_session: number;
  profit_loss: number;
  calculated_at: string;
}

export interface SessionGuest {
  id: string;
  session_id: string;
  name: string;
  amount_paid: number;
  created_at: string;
}

export interface SessionWaitlist {
  id: string;
  session_id: string;
  member_id: string;
  position: number;
  status: "waiting" | "notified" | "promoted" | "cancelled";
  created_at: string;
}

export interface SessionRating {
  id: string;
  session_id: string;
  member_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface PlaygroundRating {
  id: string;
  venue_id: string;
  member_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompletedGameRatingTarget {
  gameId: string;
  gameDate: string;
  startTime: string | null;
  venue: {
    id: string;
    name: string;
    address: string | null;
    country: string | null;
    governorate: string | null;
    area: string | null;
    photos: string[];
    cover_url: string | null;
  };
}

export interface CompletedSessionRatingTarget {
  sessionId: string;
  sessionDate: string;
  sessionTime: string | null;
  academy: {
    id: string;
    name: string;
    cover_url: string | null;
    logo_url: string | null;
    governorate: string | null;
    area: string | null;
  };
}

export interface MemberBadge {
  id: string;
  member_id: string;
  badge_type: string;
  badge_name: string;
  description: string | null;
  icon: string;
  earned_at: string;
}

export interface SessionPhoto {
  id: string;
  session_id: string | null;
  announcement_id: string | null;
  photo_url: string;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface SessionBooking {
  id: string;
  session_id: string;
  member_id: string;
  academy_id: string;
  session_price: number;
  platform_fee: number;
  member_payment: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  booked_at: string;
  checked_in_at: string | null;
  notes: string | null;
  // Joined data
  session?: TrainingSession | null;
  academy?: Academy | null;
}

export interface ActivityFeedItem {
  id: string;
  academy_id: string;
  member_id: string;
  activity_type: "joined" | "attended" | "payment" | "badge" | "evaluation" | "rating" | "checkin";
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RecurringSchedule {
  duration_minutes?: number;
  id: string;
  academy_id: string;
  name: string;
  weekday: number;
  time: string;
  sport_id: string | null;
  venue_id: string | null;
  coach_id: string | null;
  age_group: string | null;
  skill_level: SkillLevel | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface MemberWithPayments extends Profile {
  payments: Payment[];
}

export interface SessionWithStats extends TrainingSession {
  calculation?: SessionCalculation | null;
  attendance_count: number;
  present_count: number;
}

export type CommunityGameStatus = "open" | "full" | "completed" | "cancelled";

export interface CommunityMember {
  id: string;
  name: string;
  // Display name (nickname → name) resolved by the community_members view.
  display_name: string;
  username: string | null;
  bio: string | null;
  academy_id: string | null;
  academy_name: string | null;
  area: string | null;
  skill_level: SkillLevel | null;
  position: string | null;
  availability_days: number[];
  interested_sports: string[] | null;
  lat: number | null;
  lng: number | null;
  avatar_url: string | null;
  avatar_id: string | null;
}

export interface FriendlyGame {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_username: string | null;
  // Snapshot of the creator's nickname when they set one (NULL otherwise).
  creator_nickname: string | null;
  sport: string;
  title: string;
  description: string | null;
  area: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  playground_id: string | null;
  // Which court this game occupies (NULL when no playground is assigned).
  court_number?: number | null;
  playground: {
    country?: string | null;
    name: string | null;
    area: string | null;
    governorate: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    location_link: string | null;
    photos: string[];
    cover_url: string | null;
  } | null;
  game_date: string;
  start_time: string;
  max_players: number;
  min_players: number;
  duration_hours: number;
  playground_hourly_rate: number | null;
  booking_total?: number | null;
  pricing_version?: number;
  skill_level: SkillLevel | null;
  is_public: boolean;
  status: CommunityGameStatus;
  recurrence: "weekly" | null;
  source_game_id: string | null;
  result_a: number | null;
  result_b: number | null;
  completed_by: string | null;
  completed_at: string | null;
  share_price: number | null;
  // When true, the creator covers the whole reservation (host_total below) and
  // everyone else joins for free (share_price is 0).
  host_pays: boolean;
  host_total: number | null;
  invite_code: string | null;
  gender: "male" | "female" | "mixed";
  min_age: number | null;
  max_age: number | null;
  created_at: string;
}

export interface FriendlyGameWithDetails extends FriendlyGame {
  participants_count: number;
  waitlist_count: number;
  participants: FriendlyGameParticipant[];
  // Amounts members topped up to cover the remaining court rent.
  rent_payments?: FriendlyGameRentPayment[];
}

export interface FriendlyGameParticipant {
  sponsor_participant_id?: string | null;
  id: string;
  game_id: string;
  member_id: string;
  role: "organizer" | "player";
  // Display name snapshotted at join time (nickname → name); renders without
  // a profile lookup so rosters work across academies.
  player_name: string;
  is_waitlisted: boolean;
  joined_at: string;
  share_amount: number | null;
  pay_method: "instapay" | "e_wallet" | "kashier" | "visa" | "cash" | null;
  pay_receipt_url: string | null;
  pay_status: "unpaid" | "pending" | "approved" | "rejected";
  // Personal kickoff-reminder toggle (defaults to TRUE).
  kickoff_remind_opt_in?: boolean;
}

export interface FriendlyGameRentPayment {
  id: string;
  game_id: string;
  member_id: string;
  amount: number;
  pay_method: "instapay" | "e_wallet" | null;
  pay_receipt_url: string | null;
  pay_status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface GameChatMessage {
  id: string;
  game_id: string;
  sender_id: string;
  sender_name: string;
  sender_username: string | null;
  body: string | null;
  image_url: string | null;
  is_pinned: boolean;
  created_at: string;
}

export type NotificationType =
  | "game_join"
  | "game_left"
  | "game_filled"
  | "game_alert"
  | "game_cancelled"
  | "game_result"
  | "tournament_announced"
  | "coach_invite";

export interface AppNotification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export type ReportStatus = "open" | "resolved" | "dismissed";

export interface CommunityReport {
  id: string;
  reporter_id: string;
  target_type: "member" | "game";
  target_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  reporter_name?: string;
  target_name?: string;
}

export interface Block {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface BlockedMember {
  id: string;
  blocker_id: string;
  blocked_id: string;
  blocked_name: string;
  created_at: string;
}

export interface CommunityLeaderboardRow {
  member_id: string;
  name: string;
  username: string | null;
  games_played: number;
  sessions_attended: number;
  points: number;
}

export interface SportLeaderboardRow {
  member_id: string;
  name: string;
  username: string | null;
  sport: string;
  games_played: number;
  points: number;
  rank: number;
}

export interface ScoutNote {
  id: string;
  scout_id: string;
  player_id: string;
  created_at: string;
}

export interface MonthCount {
  month: string;
  count: number;
}

export interface MonthFee {
  month: string;
  total: number;
  count: number;
}

export interface SportCount {
  sport: string;
  count: number;
}

export interface SuperAdminStats {
  members: {
    total: number;
    members: number;
    admins: number;
    by_month: MonthCount[];
  };
  games: {
    total: number;
    approved: number;
    by_month: MonthCount[];
    by_sport: SportCount[];
    by_status: { status: string; count: number }[];
  };
  academies: {
    total: number;
    trials: number;
    paid: number;
    by_plan: { starter: number; plus: number; elite: number };
    by_month: MonthCount[];
  };
  fees: {
    session_total: number;
    session_count: number;
    session_by_month: MonthFee[];
    game_count: number;
    game_by_month: MonthCount[];
    payments_total: number;
    payments_count: number;
    payments_by_month: MonthFee[];
  };
}
