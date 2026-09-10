"use client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
export function QueryState({ queries, children }: { queries: {isPending: boolean; isError: boolean; refetch: () => unknown}[]; children: React.ReactNode }) {
 const {t, lang}=useI18n();
 if(queries.some(q=>q.isError)) return <div role="alert" className="rounded-xl border border-destructive/30 p-6"><p>{t("common_error")}</p><Button className="mt-3" onClick={()=>queries.forEach(q=>q.refetch())}>{t("common_retry")}</Button></div>;
 if(queries.some(q=>q.isPending)) return <div role="status" aria-label={lang==="ar"?"جاري التحميل":"Loading"} className="space-y-4"><Skeleton className="h-24"/><Skeleton className="h-48"/></div>;
 return <>{children}</>;
}
