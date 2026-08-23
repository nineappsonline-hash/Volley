export type Role = "admin" | "member";

export type SessionStatus = "scheduled" | "completed" | "canceled";

export type MembershipType = "full" | "half";

export type PaymentMethod = "cash" | "card" | "wallet" | "bank_transfer" | "other";

export type SkillLevel = "beginner" | "intermediate" | "advanced";

export type ExpenseCategory =
  | "equipment"
  | "uniforms"
  | "tournament"
  | "travel"
  | "other";

export type TrialStatus = "new" | "contacted" | "converted" | "declined";

export interface Academy {
  id: string;
  name: string;
  invite_code: string;
  slug: string | null;
  description: string | null;
  is_public: boolean;
  calendar_token: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  academy_id: string | null;
  email: string;
  role: Role;
  name: string;
  phone: string | null;
  join_date: string | null;
  membership_type: MembershipType;
  subscription_sessions: number;
  sessions_attended: number;
  is_active: boolean;
  checkin_code: string | null;
  last_reminded_at: string | null;
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
}

export interface Venue {
  id: string;
  academy_id: string;
  name: string;
  address: string | null;
  capacity: number | null;
  created_at: string;
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
  profile: { id: string; name: string } | null;
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

export interface Tournament {
  id: string;
  academy_id: string;
  name: string;
  description: string | null;
  sport_id: string | null;
  start_date: string;
  end_date: string | null;
  status: "upcoming" | "in_progress" | "completed" | "canceled";
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

export interface MemberWithPayments extends Profile {
  payments: Payment[];
}

export interface SessionWithStats extends TrainingSession {
  calculation?: SessionCalculation | null;
  attendance_count: number;
  present_count: number;
}
