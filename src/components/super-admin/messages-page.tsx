"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CheckCheck,
  Inbox,
  Mail,
  MailOpen,
  MailWarning,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useI18n } from "@/lib/i18n";
import {
  useContactMessages,
  useMarkContactRead,
} from "@/lib/queries";
import { useRealtime } from "@/lib/useRealtime";
import { createClient } from "@/lib/supabase/client";
import type { ContactMessage } from "@/lib/types";

type Filter = "all" | "unread";

export function MessagesPage() {
  const { t, locale } = useI18n();
  const { data: messages, isLoading } = useContactMessages(200);
  const markRead = useMarkContactRead();
  useRealtime(["contact_messages"]);
  const [filter, setFilter] = useState<Filter>("unread");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const client = createClient();
    const channel = client
      .channel("contact-messages-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contact_messages" },
        (payload) => {
          const row = payload.new as ContactMessage;
          toast.info(t("messages_new_toast").replace("{name}", row.name));
        }
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [t]);

  const unread = useMemo(
    () => (messages ?? []).filter((m) => !m.is_read).length,
    [messages]
  );
  const filtered = useMemo(() => {
    if (filter === "unread") return (messages ?? []).filter((m) => !m.is_read);
    return messages ?? [];
  }, [filter, messages]);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const markOne = async (id: string) => {
    try {
      await markRead.mutateAsync([id]);
    } catch {
      toast.error(t("common_error"));
    }
  };

  const markAll = async () => {
    try {
      await markRead.mutateAsync(undefined);
    } catch {
      toast.error(t("common_error"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("messages_title")}
        subtitle={t("messages_subtitle")}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4 text-primary" />
            {t("messages_title")}
            {unread > 0 && (
              <Badge variant="destructive">{unread} {t("messages_unread")}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
              {(["all", "unread"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    filter === f
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(f === "all" ? "messages_filter_all" : "messages_filter_unread")}
                  {f === "unread" && unread > 0 && (
                    <span className="ms-1 text-primary">({unread})</span>
                  )}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={markAll}
              disabled={unread === 0 || markRead.isPending}
              className="gap-1"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t("messages_mark_all")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-48 animate-pulse rounded bg-muted" />
          ) : filtered.length === 0 ? (
            <EmptyState
              message={t("messages_empty")}
              hint={t("messages_empty_hint")}
              icon={Mail}
            />
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("messages_sender")}</TableHead>
                    <TableHead>{t("messages_message")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("messages_received")}</TableHead>
                    <TableHead className="text-end">{t("super_admin_actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => {
                    const isExpanded = expanded.has(m.id);
                    return (
                      <TableRow
                        key={m.id}
                        className={m.is_read ? undefined : "bg-primary/5"}
                      >
                        <TableCell className="align-top">
                          <div className="flex min-w-0 items-start gap-2">
                            {m.is_read ? (
                              <MailOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            )}
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 font-medium">
                                {m.name}
                                {!m.is_read && (
                                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                                )}
                              </p>
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <a
                                  href={`tel:${m.phone}`}
                                  dir="ltr"
                                  className="hover:text-foreground hover:underline"
                                >
                                  {m.phone}
                                </a>
                              </p>
                              {m.email && (
                                <p className="text-xs text-muted-foreground">
                                  <a
                                    href={`mailto:${m.email}`}
                                    dir="ltr"
                                    className="hover:text-foreground hover:underline"
                                  >
                                    {m.email}
                                  </a>
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[26rem] align-top">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(m.id)}
                            className="block w-full text-start text-sm"
                          >
                            <span
                              className={
                                isExpanded ? "" : "line-clamp-3 text-muted-foreground"
                              }
                            >
                              {m.message}
                            </span>
                          </button>
                        </TableCell>
                        <TableCell className="hidden align-top text-muted-foreground sm:table-cell">
                          {format(new Date(m.created_at), "MMM d, yyyy · HH:mm", { locale })}
                        </TableCell>
                        <TableCell className="align-top text-end">
                          {!m.is_read && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => markOne(m.id)}
                              disabled={markRead.isPending}
                            >
                              <CheckCheck className="h-3.5 w-3.5" />
                              {t("messages_mark_read")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}