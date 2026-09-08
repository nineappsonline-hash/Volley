import { requireSession } from "@/lib/session";
import { AttendancePage } from "@/components/attendance/attendance-page";

export default async function Page() {
  const { profile } = await requireSession();
  return <AttendancePage canScan={profile.role === "admin" && profile.is_active} />;
}
