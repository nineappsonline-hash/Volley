import Image from "next/image";
import { cn } from "@/lib/utils";

/** Load the bundled wordmark directly so every page is independent of image optimization. */
export function AppLogo({ className }: { className?: string }) {
  return <Image src="/logo.webp" alt="Playza" width={1792} height={896}
    unoptimized
    loading="eager"
    className={cn("h-auto w-32 shrink-0 rounded-lg bg-white object-contain", className)} />;
}
