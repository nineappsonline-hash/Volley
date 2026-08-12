import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ClipboardCheck,
  LineChart,
  Users,
  Volleyball,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  const features = [
    {
      icon: Users,
      title: "Members & payments",
      desc: "Manage players, subscriptions and payment history in one place.",
    },
    {
      icon: ClipboardCheck,
      title: "One-tap attendance",
      desc: "Mark attendance with live profit/loss for every session.",
    },
    {
      icon: Wallet,
      title: "Automatic finances",
      desc: "Revenue, costs and profit are calculated automatically.",
    },
    {
      icon: LineChart,
      title: "Reports & charts",
      desc: "Track revenue vs costs with beautiful monthly charts.",
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-40 start-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl rtl:translate-x-1/2" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 text-white shadow-lg shadow-blue-500/30">
              <Volleyball className="h-6 w-6" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-extrabold">Volley Academy</span>
              <span className="text-[11px] text-muted-foreground">
                Volleyball academy management
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Join as member</Link>
            </Button>
          </div>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-20 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            🏐 Built for volleyball academies
          </span>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Manage your academy with{" "}
            <span className="text-gradient">automatic profit tracking</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Members, attendance, payments and finances — everything a volleyball
            academy needs, in one beautiful dashboard.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link href="/signup">
                <Users className="h-5 w-5" />
                Sign up as a member
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">
                <CalendarDays className="h-5 w-5" />
                Sign in as admin
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 pb-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
