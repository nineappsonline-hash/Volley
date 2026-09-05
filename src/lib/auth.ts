"use client";

import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

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
      phone?: string,
      academy?: {
        code?: string;
        newName?: string;
        sports?: string;
        country?: string;
        governorate?: string;
        city?: string;
      }
    ) => {
      const { data, error } = await createClient().auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone,
            ...(academy?.code ? { academy_code: academy.code } : {}),
            ...(academy?.newName ? { new_academy_name: academy.newName } : {}),
            ...(academy?.sports ? { sports: academy.sports } : {}),
            ...(academy?.country ? { new_academy_country: academy.country } : {}),
            ...(academy?.governorate
              ? { new_academy_governorate: academy.governorate }
              : {}),
            ...(academy?.city ? { new_academy_area: academy.city } : {}),
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
