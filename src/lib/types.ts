export type Role = "super_admin" | "admin" | "member";

export type MemberPlan = "free" | "premium";

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
  address: string | null;
  country: string | null;
  governorate: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  cover_url: string | null;
  is_public: boolean;
  calendar_token: string | null;
  is_trial: boolean;
  trial_ends_at: string | null;
  trial_extended_at: string | null;
  session_booking_enabled: boolean;
  platform_fee_percent: number | null;
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
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  sport_id: string | null;
  school_name: string | null;
  rental_cost: number | null;
  // Number of time units (hours) the academy rents this venue from the owner.
  rental_hours: number | null;
  created_at: string;
}

export type RentalPaymentMethod = "cash" | "bank_transfer" | "e_wallet";

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
  created_at: string;
  // Embedded select: venue name (via venues(name)).
  venues?: { name: string } | null;
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
}

export interface FriendlyGame {
  id: string;
  creator_id: string;
  creator_name: string;
  sport: string;
  title: string;
  description: string | null;
  area: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  game_date: string;
  start_time: string;
  max_players: number;
  skill_level: SkillLevel | null;
  is_public: boolean;
  status: CommunityGameStatus;
  recurrence: "weekly" | null;
  source_game_id: string | null;
  result_a: number | null;
  result_b: number | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface FriendlyGameWithDetails extends FriendlyGame {
  participants_count: number;
}

export interface FriendlyGameParticipant {
  id: string;
  game_id: string;
  member_id: string;
  role: "organizer" | "player";
  is_waitlisted: boolean;
  joined_at: string;
}

export type NotificationType =
  | "game_join"
  | "game_left"
  | "game_filled"
  | "game_alert"
  | "game_cancelled"
  | "game_result";

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
