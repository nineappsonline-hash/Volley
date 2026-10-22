import { VolleyballGuidePage } from "@/components/public/volleyball-guide-page";
import { guideMetadata } from "@/lib/guides";
export const metadata = guideMetadata("en");
export default function Page() { return <VolleyballGuidePage lang="en" />; }
