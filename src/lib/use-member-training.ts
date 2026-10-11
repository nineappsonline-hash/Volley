"use client";
import { useTrainingBookings, useTrainingPrograms } from "./academy-training";
import { useRecurringSchedules, useSessions } from "./queries";
import { trainingAgenda } from "./member-training";
import type { Profile } from "./types";
export function useMemberTraining(profile?: Profile) {
  const bookings = useTrainingBookings();
  const programs = useTrainingPrograms();
  const sessions = useSessions();
  const recurring = useRecurringSchedules();
  const queries = [bookings, programs, sessions, recurring];
  return { bookings, programs, sessions, recurring, queries, agenda: profile ? trainingAgenda(profile, bookings.data ?? [], sessions.data ?? [], recurring.data ?? [], programs.data ?? []) : [], isLoading: queries.some(q => q.isPending), isError: queries.some(q => q.isError), refetch: () => Promise.all(queries.map(q => q.refetch())) };
}
