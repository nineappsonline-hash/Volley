import type { Metadata } from "next";
import AcademiesDirectoryPage from "@/app/academies/page";
export const metadata: Metadata = { title: "Academies" };
export default function DashboardAcademiesPage() { return <AcademiesDirectoryPage />; }
