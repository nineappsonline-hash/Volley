import { type CourtReviewField } from "./court-review";
import type { Venue } from "./types";

/** Required for a new listing; existing correction requests retain their selected scope. */
export function missingCourtSubmissionFields(venue: Partial<Venue>): CourtReviewField[] {
  const missing: CourtReviewField[] = [];
  if (!venue.name?.trim()) missing.push("name");
  if (!venue.sport_id) missing.push("sport");
  if (!venue.address?.trim()) missing.push("address");
  if (![venue.country, venue.governorate, venue.area].every(value => value?.trim())) missing.push("location");
  if (!venue.location_link || !/^https?:\/\/[^\s]+$/i.test(venue.location_link)) missing.push("directions");
  if (!venue.contact_phone || !/^[+()\d\s.-]+$/.test(venue.contact_phone) || !/^\d{7,15}$/.test(venue.contact_phone.replace(/\D/g, ""))) missing.push("phone");
  if (venue.rental_cost == null || !Number.isFinite(venue.rental_cost) || venue.rental_cost < 0 || venue.rental_hours == null || !Number.isFinite(venue.rental_hours) || venue.rental_hours <= 0) missing.push("price");
  if (!Number.isInteger(venue.court_count) || (venue.court_count ?? 0) < 1 || (venue.court_count ?? 0) > 100) missing.push("courts");
  if (![venue.cover_url, ...(venue.photos ?? [])].some(url => url && /^https?:\/\/[^\s]+$/i.test(url))) missing.push("photos");
  if (!venue.court_availability?.length || venue.court_availability.some(slot => !Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.end) || slot.start >= slot.end || slot.court_number < 1 || slot.court_number > (venue.court_count ?? 1))) missing.push("hours");
  return missing;
}
