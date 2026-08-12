import Link from "next/link";
import { Volleyball } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-400 text-white shadow-lg shadow-blue-500/30">
        <Volleyball className="h-9 w-9" />
      </div>
      <div>
        <h1 className="text-4xl font-extrabold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </main>
  );
}
