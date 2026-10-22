import { VolleyballGuidePage } from "@/components/public/volleyball-guide-page";
import { ALL_GUIDES, guideMetadata, findGuide } from "@/lib/guides";
import { notFound } from "next/navigation";
export const dynamicParams = false;
export function generateStaticParams() { return ALL_GUIDES.map(g => ({ slug: g.slug })); }
export function generateMetadata({ params }: { params: { slug: string } }) { if (!findGuide(params.slug)) notFound(); return guideMetadata("en", params.slug); }
export default function Page({ params }: { params: { slug: string } }) { return <VolleyballGuidePage lang="en" slug={params.slug} />; }
