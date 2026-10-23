-- Keep courts and owner-application history when an administrator deletes an account.
-- These optional ownership/reviewer references must not block the existing atomic
-- profile + auth account deletion, or cascade into court bookings and payments.
ALTER TABLE public.venues
  DROP CONSTRAINT venues_owner_profile_id_fkey,
  ADD CONSTRAINT venues_owner_profile_id_fkey
    FOREIGN KEY (owner_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.playground_owners
  DROP CONSTRAINT playground_owners_approved_by_fkey,
  ADD CONSTRAINT playground_owners_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
