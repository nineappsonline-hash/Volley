import { Skeleton } from "@/components/ui/skeleton";

export default function ReceiptLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-lg space-y-6 p-8">
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-8 w-48" />
          <Skeleton className="mx-auto h-4 w-32" />
        </div>
        <Skeleton className="h-px w-full" />
        <div className="space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-full" />
        </div>
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-32 mx-auto" />
      </div>
    </div>
  );
}
