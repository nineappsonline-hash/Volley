/** A checkout or uploaded receipt is not a confirmed place until payment is approved.
 * Host-covered/free places are also stored as approved by the booking flow.
 */
export function splitGameParticipants<T extends { is_waitlisted?: boolean | null; pay_status?: string | null }>(participants: readonly T[]) {
  return {
    confirmed: participants.filter(p => !p.is_waitlisted && p.pay_status === "approved"),
    awaitingPayment: participants.filter(p => !p.is_waitlisted && p.pay_status !== "approved"),
    waitlisted: participants.filter(p => p.is_waitlisted),
  };
}
