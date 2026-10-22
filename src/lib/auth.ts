"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { startSignup, cancelSignup, rememberSignupUser, confirmPendingSignup } from "@/lib/analytics/registrations";
import { createClient } from "@/lib/supabase/client";

export type SignupVenue =
  | { id: string }
  | {
      name: string;
      address?: string | null;
      country?: string | null;
      governorate?: string | null;
      area?: string | null;
      capacity?: number | null;
      school_name?: string | null;
      sport?: string | null;
      location_link?: string | null;
      photos?: string[];
      court_availability?: { weekday: number; start: string; end: string; court_number: number }[];
      working_hours?: { weekday: number; start: string; end: string }[];
      rental_cost?: number | null;
      rental_hours?: number | null;
      court_count?: number;
    };

export function useAuth() {
  const queryClient = useQueryClient();
  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await createClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      queryClient.clear();
    },
    [queryClient]
  );

  const signInWithGoogle = useCallback(
    async (destination = "/dashboard") => {
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", destination);
      startSignup("player", "google");
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback.toString(),
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) { cancelSignup(); throw error; }
    },
    []
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      username: string,
      phone?: string,
      academy?: {
        code?: string;
        newName?: string;
        sports?: string;
        country?: string;
        governorate?: string;
        city?: string;
        gender?: string;
        birth_date?: string;
        venues?: SignupVenue[];
        ownerMode?: boolean;
        businessName?: string;
        ownerVenues?: SignupVenue[];
      },
      destination = "/dashboard"
    ) => {
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", destination);
      startSignup(academy?.ownerMode ? "venue" : academy?.newName ? "academy_owner" : "player", "email", {sport:academy?.sports,sports:academy?.ownerVenues?.flatMap(v => "sport" in v && typeof v.sport === "string" ? [v.sport] : []),country:academy?.country,governorate:academy?.governorate,city:academy?.city});
      const { data, error } = await createClient().auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callback.toString(),
          data: {
            name,
            username,
            phone,
            ...(academy?.gender ? { gender: academy.gender } : {}),
            ...(academy?.birth_date ? { birth_date: academy.birth_date } : {}),
            ...(academy?.code ? { academy_code: academy.code } : {}),
            ...(academy?.newName ? { new_academy_name: academy.newName } : {}),
            ...(academy?.sports ? { sports: academy.sports } : {}),
            ...(academy?.country ? { country: academy.country } : {}),
            ...(academy?.country ? { new_academy_country: academy.country } : {}),
            ...(academy?.governorate
              ? { new_academy_governorate: academy.governorate }
              : {}),
            ...(academy?.city ? { new_academy_area: academy.city } : {}),
            ...(academy?.venues?.length
              ? { new_academy_venues: academy.venues }
              : {}),
            ...(academy?.ownerMode ? { owner_mode: true } : {}),
            ...(academy?.businessName
              ? { business_name: academy.businessName }
              : {}),
            ...(academy?.ownerVenues?.length
              ? { new_owner_venues: academy.ownerVenues }
              : {}),
          },
        },
      });
      if (error) { cancelSignup(); throw error; }
      if (data.user && data.user.identities?.length !== 0) {
        rememberSignupUser(data.user.id);
        if (data.session) void confirmPendingSignup();
      } else { cancelSignup(); }
      // When email confirmation is enabled, no session is returned —
      // the caller should tell the user to check their inbox.
      return { session: data.session };
    },
    []
  );

  const signOut = useCallback(async () => {
    const { error } = await createClient().auth.signOut();
    if (error) throw error;
    queryClient.clear();
  }, [queryClient]);

  return { signIn, signInWithGoogle, signUp, signOut };
}
