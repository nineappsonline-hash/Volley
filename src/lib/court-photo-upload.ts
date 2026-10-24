/** Guest signup uses the bounded server upload; signed-in court editors keep normal RLS uploads. */
export async function uploadSignupCourtPhoto(file: File): Promise<string> {
  if (file.size > 4 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WebP image under 4 MB");
  const body = new FormData(); body.append("file", file);
  const response = await fetch("/api/court-signup/photos", { method: "POST", body });
  const result = await response.json();
  if (!response.ok || typeof result.url !== "string") throw new Error(result.error || "Could not upload court photo");
  return result.url;
}
