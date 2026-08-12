export type Role = "admin" | "member";

export type SessionStatus = "scheduled" | "completed" | "canceled";

export type MembershipType = "full" | "half";

export interface Profile {
  id: string;
  email: string;
  role: Role;
  name: string;
  phone: string | null;
  join_date: string | null;
  membership_type: MembershipType;
  subscription_sessions: number;
  sessions_attended: number;
  created_at: string;
}

export interface Payment {
  id: string;
  member_id: string;
  amount: number;
  payment_date: string;
  membership_type: MembershipType;
  subscription_sessions: number;
  notes: string | null;
  created_at: string;
}

export interface TrainingSession {
  id: string;
  date: string;
  time: string;
  location: string | null;
  notes: string | null;
  is_completed: boolean;
  status: SessionStatus;
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
  month: number;
  year: number;
  coach_salary: number;
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

export interface MemberWithPayments extends Profile {
  payments: Payment[];
}

export interface SessionWithStats extends TrainingSession {
  calculation?: SessionCalculation | null;
  attendance_count: number;
  present_count: number;
}
