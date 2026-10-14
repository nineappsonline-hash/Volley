import { AcademyManagementPage } from "@/components/marketing/academy-management-page";
import { academyManagementMetadata } from "@/lib/academy-management";
export const metadata = academyManagementMetadata("ar");
export default function Page() { return <AcademyManagementPage lang="ar" />; }
