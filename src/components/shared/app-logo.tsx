import Image from "next/image";
import { cn } from "@/lib/utils";

/** Original Playza wordmark, kept legible on both light and dark surfaces. */
export function AppLogo({ className }: { className?: string }) {
  return <Image src="/logo.webp" alt="Playza" width={1792} height={896}
    className={cn("h-auto w-32 shrink-0 rounded-lg bg-white object-contain", className)} />;
}
