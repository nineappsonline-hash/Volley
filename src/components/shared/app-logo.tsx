import Image from "next/image";
import { cn } from "@/lib/utils";

/** Load the bundled wordmark directly so every page is independent of image optimization. */
export function AppLogo({ className }: { className?: string }) {
  return <Image src="/logo.png" alt="Playza" width={1774} height={887}
    sizes="(max-width: 640px) 112px, 128px"
    loading="eager"
    className={cn("playza-logo h-auto w-32 shrink-0 object-contain", className)} />;
}
