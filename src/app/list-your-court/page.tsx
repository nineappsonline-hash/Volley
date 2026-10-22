import { ListYourCourtPage } from "@/components/marketing/list-your-court-page";
import { listYourCourtMetadata } from "@/lib/list-your-court";

export const metadata = listYourCourtMetadata("en");

export default function Page() {
  return <ListYourCourtPage lang="en" />;
}
