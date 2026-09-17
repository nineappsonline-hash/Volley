"use client";

import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type SignupVenue =
  | { id: string }
  | {
      name: string;
      address?: string | null;
      capacity?: number | null;
      school_name?: string | null;
      rental_cost?: number | null;
      rental_hours?: number | null;
    };

export function useAuth() {
  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await createClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
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
      },
      destination = "/dashboard"
    ) => {
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", destination);
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
          },
        },
      });
      if (error) throw error;
      // When email confirmation is enabled, no session is returned —
      // the caller should tell the user to check their inbox.
      return { session: data.session };
    },
    []
  );

  const signOut = useCallback(async () => {
    const { error } = await createClient().auth.signOut();
    if (error) throw error;
  }, []);

  return { signIn, signUp, signOut };
}
