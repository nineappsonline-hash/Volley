"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export interface MemberRow extends Profile {
  totalPaid: number;
  active: boolean;
}

type SortKey = "name" | "join_date" | "totalPaid";

interface MemberTableProps {
  members: MemberRow[];
  onEdit: (member: MemberRow) => void;
  onDelete: (member: MemberRow) => void;
}

const PAGE_SIZE = 8;

export function MemberTable({ members, onEdit, onDelete }: MemberTableProps) {
  const { t, lang, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = members.filter((m) => {
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.phone ?? "").toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" ||
        (filter === "paid" && m.active) ||
        (filter === "unpaid" && !m.active);
      return matchesSearch && matchesFilter;
    });
    list = [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "join_date")
        return (a.join_date ?? "").localeCompare(b.join_date ?? "") * dir;
      return (a.totalPaid - b.totalPaid) * dir;
    });
    return list;
  }, [members, search, filter, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("members_search")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="ps-9"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(v) => {
            setFilter(v as typeof filter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("members_filter_all")}</SelectItem>
            <SelectItem value="paid">{t("members_filter_paid")}</SelectItem>
            <SelectItem value="unpaid">{t("members_filter_unpaid")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>
                <button
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("name")}
                >
                  {t("members_col_name")}
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {t("members_col_phone")}
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                <button
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("join_date")}
                >
                  {t("members_col_join")}
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort("totalPaid")}
                >
                  {t("members_col_payments")}
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="hidden sm:table-cell">{t("members_col_membership")}</TableHead>
              <TableHead>{t("members_col_status")}</TableHead>
              <TableHead className="text-end">{t("members_col_actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8">
                  <EmptyState message={t("members_no_results")} />
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials(m.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {m.phone || t("common_not_set")}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {m.join_date
                      ? format(new Date(m.join_date + "T00:00:00"), "MMM d, yyyy", { locale })
                      : t("common_not_set")}
                  </TableCell>
                  <TableCell className="font-mono font-medium">
                    {formatMoney(m.totalPaid, lang)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={m.membership_type === "half" ? "outline" : "default"} className="gap-1">
                      {m.membership_type === "half" ? t("membership_half") : t("membership_full")}
                      <span className="font-mono text-[10px] opacity-80">
                        {m.subscription_sessions}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.active ? "success" : "warning"}>
                      {m.active ? t("members_status_active") : t("members_status_expired")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" aria-label={t("members_view")}>
                        <Link href={`/members/${m.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(m)}
                        aria-label={t("common_edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(m)}
                        aria-label={t("common_delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} {t("nav_members").toLowerCase()}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            disabled={current <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm text-muted-foreground">
            {current} / {pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={current >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
