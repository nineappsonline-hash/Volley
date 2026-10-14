import { VolleyballGuidePage } from "@/components/public/volleyball-guide-page";
import { guideMetadata, VOLLEYBALL_GUIDES } from "@/lib/volleyball-guides";
import { notFound } from "next/navigation";
export const dynamicParams = false;
export function generateStaticParams() { return VOLLEYBALL_GUIDES.map(g => ({ slug: g.slug })); }
export function generateMetadata({ params }: { params: { slug: string } }) { if (!VOLLEYBALL_GUIDES.some(g => g.slug === params.slug)) notFound(); return guideMetadata("en", params.slug); }
export default function Page({ params }: { params: { slug: string } }) { return <VolleyballGuidePage lang="en" slug={params.slug} />; }
