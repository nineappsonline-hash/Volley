import { CourtDirectory } from "@/components/public/court-directory";
import { courtDirectoryMetadata } from "@/lib/court-discovery";
export const revalidate = 300;
type Props = { searchParams: Promise<{ sport?: string }> };
export async function generateMetadata({ searchParams }: Props) { return courtDirectoryMetadata("en", (await searchParams).sport); }
export default async function Page({ searchParams }: Props) { return <CourtDirectory lang="en" slug={(await searchParams).sport} />; }
