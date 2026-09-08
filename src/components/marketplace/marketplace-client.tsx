"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock,
  Coins,
  MapPin,
  Star,
  Ticket,
  User,
  Wallet,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {  Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import {
  useBookableSessions,
  useBookSession,
  useMyBookings,
  useUpdateBookingStatus,
} from "@/lib/queries";
import type { Profile, TrainingSession } from "@/lib/types";

function SessionCard({
  session,
  onBook,
}: {
  session: TrainingSession & {
    sport: { id: string; name: string } | null;
    venue: { id: string; name: string; address: string | null } | null;
    coach: { id: string; name: string } | null;
    academy: { id: string; name: string; slug: string | null; address: string | null; session_booking_enabled: boolean } | null;
  };
  onBook: (sessionId: string) => void;
}) {
  const { t, lang, locale } = useI18n();
  const price = session.session_price;
  const hasPrice = price != null && price > 0;

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base truncate">
            {session.academy?.name ?? t("common_not_set")}
          </CardTitle>
          {hasPrice && (
            <span className="font-mono font-bold text-primary">
              {formatMoney(Number(price), lang)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {session.academy?.slug ? `/${session.academy.slug}` : ""}
          {session.location ? ` · ${session.location}` : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span>
            {format(new Date(session.date + "T00:00:00"), "EEE, MMM d", { locale })}
            {" · "}
            {session.time.slice(0, 5)}
          </span>
        </div>
        {session.sport && (
          <div className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-warning-ink shrink-0" />
            <span className="truncate">{session.sport.name}</span>
          </div>
        )}
        {session.venue && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{session.venue.name}</span>
            {session.venue.address && (
              <span className="truncate">{session.venue.address}</span>
            )}
          </div>
        )}
        {session.coach && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <span className="truncate">{session.coach.name}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={session.skill_level === "advanced" ? "default" : "outline"}>
            {session.skill_level ?? t("common_not_set")}
          </Badge>
          {session.age_group && (
            <Badge variant="secondary">{session.age_group}</Badge>
          )}
        </div>
        {hasPrice && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <Coins className="h-4 w-4 shrink-0 text-warning-ink" />
            <span className="flex-1 font-medium">{t("marketplace_bookable")}</span>
            <Button
              size="sm"
              onClick={() => onBook(session.id)}
              disabled={!price}
            >
              <Ticket className="mr-1 h-3.5 w-3.5" />
              {t("marketplace_book")}
            </Button>
          </div>
        )}
        {!hasPrice && (
          <p className="text-xs text-muted-foreground">
            {t("marketplace_no_price")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function MarketplaceClient({ profile }: { profile: Profile }) {
  const { t, lang, locale } = useI18n();
  const sessions = useBookableSessions();
  const myBookings = useMyBookings();
  const book = useBookSession();
  const updateStatus = useUpdateBookingStatus();
  const [search, setSearch] = useState("");
  const [bookNote, setBookNote] = useState("");
  const [bookingSession, setBookingSession] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions.data ?? [];
    return (sessions.data ?? []).filter((s) =>
      s.academy?.name.toLowerCase().includes(q) ||
      s.sport?.name.toLowerCase().includes(q) ||
      s.venue?.name.toLowerCase().includes(q)
    );
  }, [sessions.data, search]);

  const handleBook = async (sessionId: string) => {
    setBookingSession(sessionId);
  };

  const confirmBook = async () => {
    if (!bookingSession) return;
    try {
      await book.mutateAsync({ sessionId: bookingSession, notes: bookNote || undefined });
      toast.success(t("marketplace_booked"));
      setBookingSession(null);
      setBookNote("");
    } catch (err: any) {
      toast.error(err.message || t("common_error"));
    }
  };

  const handleCancel = async (bookingId: string) => {
    try {
      await updateStatus.mutateAsync({ bookingId, status: "cancelled" });
      toast.success(t("marketplace_cancelled"));
    } catch {
      toast.error(t("common_error"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("marketplace_title")}
        subtitle={t("marketplace_subtitle")}
      />

      {/* My bookings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" />
            {t("marketplace_my_bookings")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myBookings.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : myBookings.data?.length === 0 ? (
            <EmptyState message={t("marketplace_no_bookings")} />
          ) : (
            <div className="space-y-2">
              {(myBookings.data ?? []).map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {b.session?.date}
                      {" · "}
                      {b.session?.time}
                      {" · "}
                      {b.academy?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.status === 'pending' ? t('marketplace_status_pending') : b.status === 'confirmed' ? t('marketplace_status_confirmed') : b.status === 'cancelled' ? t('marketplace_status_cancelled') : b.status === 'completed' ? t('marketplace_status_completed') : b.status}
                      {b.session_price != null && (
                        <span className="ml-2">
                          {formatMoney(Number(b.session_price), lang)}
                          {" (fee: "}
                          {formatMoney(Number(b.platform_fee), lang)}
                          {")"}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {b.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancel(b.id)}
                      >
                        {t("marketplace_cancel")}
                      </Button>
                    )}
                    {b.status === "confirmed" && (
                      <Badge className="bg-success text-success-foreground">
                        {t("marketplace_checkin")}
                      </Badge>
                    )}
                    {b.status === "completed" && (
                      <Badge variant="success">
                        {t("marketplace_done")}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bookable sessions */}
      <div className="space-y-4">
        <div className="relative">
          <Input
            placeholder={t("marketplace_search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>

        {sessions.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState message={t("marketplace_no_sessions")} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <SessionCard key={s.id} session={s} onBook={handleBook} />
            ))}
          </div>
        )}
      </div>

      {/* Booking dialog */}
      {bookingSession && (sessions.data ?? []).find((s) => s.id === bookingSession) && (
        <Card className="rounded-lg border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("marketplace_confirm_booking")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(sessions.data ?? []).find((s) => s.id === bookingSession) && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span>
                    {format(new Date((sessions.data ?? []).find((s) => s.id === bookingSession)!.date + "T00:00:00"), "EEE, MMM d", { locale })}
                    {" · "}
                    {(sessions.data ?? []).find((s) => s.id === bookingSession)!.time.slice(0, 5)}
                  </span>
                </div>
                {(sessions.data ?? []).find((s) => s.id === bookingSession)!.session_price != null && (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm text-muted-foreground">
                      {t("marketplace_session_price")}
                    </span>
                    <span className="font-mono font-bold">
                      {formatMoney(Number((sessions.data ?? []).find((s) => s.id === bookingSession)!.session_price), lang)}
                    </span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t("marketplace_notes")}</Label>
                  <Input
                    value={bookNote}
                    onChange={(e) => setBookNote(e.target.value)}
                    placeholder={t("marketplace_notes_placeholder")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setBookingSession(null)}
                  >
                    {t("common_cancel")}
                  </Button>
                  <Button
                    onClick={confirmBook}
                    disabled={book.isPending}
                  >
                    {book.isPending ? t("common_saving") : t("marketplace_confirm")}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
