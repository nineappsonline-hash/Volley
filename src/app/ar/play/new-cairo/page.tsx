import { NewCairoGamesHub, newCairoGamesMeta } from "@/components/public/new-cairo-games-hub";
export const revalidate = 300;
export function generateMetadata() { return newCairoGamesMeta("ar"); }
export default function Page() { return <NewCairoGamesHub lang="ar" />; }
