import { SportDiscoveryIndex } from "@/components/public/sport-discovery-page";
import { discoveryMetadata } from "@/lib/sport-discovery";

export const metadata = discoveryMetadata("ar");
export default function Page() { return <SportDiscoveryIndex lang="ar" />; }
