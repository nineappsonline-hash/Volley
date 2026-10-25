export function oauthFailureReason(code: string | null | undefined): "expired" | "cancelled" | "provider" {
  if (["flow_state_not_found", "flow_state_expired", "bad_code_verifier", "pkce_verifier_mismatch"].includes(code ?? "")) return "expired";
  if (code === "access_denied") return "cancelled";
  return "provider";
}
