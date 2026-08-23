"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, KeyRound, Search, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { sessionsForMembership } from "@/lib/constants";
import { triggerEmail } from "@/lib/email-triggers";
import { cn, errorMessage, initials, todayInput } from "@/lib/utils";
import { usePendingProfiles, useUpdateMember } from "@/lib/queries";
import type { MembershipType, Profile } from "@/lib/types";

const createSchema = (t: (k: any) => string, isEdit: boolean) =>
  z.object({
    name: z.string().min(1, t("field_required")),
    email: isEdit
      ? z.string().email(t("field_invalid_email"))
      : z.string().min(1, t("field_required")).email(t("field_invalid_email")),
    password: isEdit
      ? z.string().optional()
      : z.string().min(6, t("field_min_password")),
    phone: z.string().optional(),
    join_date: z.string().optional(),
    membership_type: z.enum(["full", "half"]),
  });

type FormValues = z.infer<ReturnType<typeof createSchema>>;

interface MemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: Profile | null;
  onCreated?: () => void;
}

export function MemberFormDialog({
  open,
  onOpenChange,
  member,
  onCreated,
}: MemberFormDialogProps) {
  const { t } = useI18n();
  const isEdit = !!member;
  const updateMember = useUpdateMember();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(createSchema(t, isEdit)),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
      join_date: todayInput(),
      membership_type: "full",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: member?.name ?? "",
        email: member?.email ?? "",
        password: "",
        phone: member?.phone ?? "",
        join_date: member?.join_date ?? todayInput(),
        membership_type:
          member?.membership_type ??
          (member?.subscription_sessions && member.subscription_sessions <= 4
            ? "half"
            : "full"),
      });
    }
  }, [open, member, form]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      if (isEdit && member) {
        // Members without a payment have no plan yet — the plan is set when the
        // admin records a payment, so never grant one implicitly on a profile edit.
        const updates: Partial<Profile> & { id: string } = {
          id: member.id,
          name: values.name,
          phone: values.phone || null,
          join_date: values.join_date || null,
        };
        if ((member.subscription_sessions ?? 0) > 0) {
          updates.membership_type = values.membership_type;
          updates.subscription_sessions = sessionsForMembership(values.membership_type);
        }
        await updateMember.mutateAsync(updates);
      } else {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: values.email,
            password: values.password,
            name: values.name,
            phone: values.phone || "",
            join_date: values.join_date || todayInput(),
            membership_type: values.membership_type,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed");
        }
        onCreated?.();
        // Fire-and-forget welcome email
        triggerEmail("welcome", "pending");
      }
      toast.success(isEdit ? t("members_save_success") : t("signup_success"));
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e, t("common_error")));
    } finally {
      setSubmitting(false);
    }
  };

  // ── "Pick existing account" tab ──────────────────────────
  const { data: pendingProfiles, isLoading: pendingLoading } = usePendingProfiles();
  const [tab, setTab] = useState<"existing" | "create">("existing");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [joinDate, setJoinDate] = useState(todayInput());
  const [membershipType, setMembershipType] = useState<MembershipType>("full");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) {
      setTab("existing");
      setSelectedId(null);
      setSearch("");
      setJoinDate(todayInput());
      setMembershipType(member?.membership_type ?? "full");
    }
  }, [open, member]);

  const filteredPending = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (pendingProfiles ?? []).filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    );
  }, [pendingProfiles, search]);

  const handleAddExisting = async () => {
    if (!selectedId) {
      toast.error(t("members_pick_required"));
      return;
    }
    setAdding(true);
    try {
      await updateMember.mutateAsync({
        id: selectedId,
        is_active: true,
        join_date: joinDate || null,
        membership_type: membershipType,
        subscription_sessions: sessionsForMembership(membershipType),
      });
      toast.success(t("members_save_success"));
      onOpenChange(false);
      setSelectedId(null);
    } catch (e) {
      console.error("[member-form] add existing failed", e);
      toast.error(errorMessage(e, t("common_error")));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? (
              <>{t("members_edit")}</>
            ) : (
              <>
                <UserPlus className="h-5 w-5 text-primary" />
                {t("members_create")}
              </>
            )}
          </DialogTitle>
          {!isEdit && (
            <DialogDescription>{t("members_add_existing")}</DialogDescription>
          )}
        </DialogHeader>

        {isEdit ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signup_name")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("login_email")}</FormLabel>
                      <FormControl>
                        <Input type="email" dir="ltr" readOnly disabled {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("signup_phone")}</FormLabel>
                      <FormControl>
                        <Input dir="ltr" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="join_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("members_col_join")}</FormLabel>
                      <FormControl>
                        <Input type="date" dir="ltr" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {(member?.subscription_sessions ?? 0) > 0 ? (
                  <FormField
                    control={form.control}
                    name="membership_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("members_membership_label")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="full">
                              {t("membership_full")} · {t("membership_full_hint")}
                            </SelectItem>
                            <SelectItem value="half">
                              {t("membership_half")} · {t("membership_half_hint")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="space-y-2">
                    <Label>{t("members_membership_label")}</Label>
                    <p className="flex h-9 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
                      {t("membership_none")} — {t("members_set_plan_via_payment")}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t("common_cancel")}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? t("common_saving") : t("common_save")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "existing" | "create")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing">{t("members_add_existing")}</TabsTrigger>
              <TabsTrigger value="create">{t("members_add_create")}</TabsTrigger>
            </TabsList>

            {/* Pick an existing account by name */}
            <TabsContent value="existing" className="space-y-4">
              <div className="space-y-2">
                <Label>{t("members_pick_search_label")}</Label>
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="ps-9"
                    placeholder={t("members_search")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1">
                {pendingLoading ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {t("common_loading")}
                  </p>
                ) : filteredPending.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {t("members_no_pending")}
                  </p>
                ) : (
                  filteredPending.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-start text-sm transition-colors hover:bg-accent",
                        selectedId === p.id && "bg-accent"
                      )}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials(p.name)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.email}
                        </span>
                      </span>
                      {selectedId === p.id && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("members_col_join")}</Label>
                  <Input
                    type="date"
                    dir="ltr"
                    value={joinDate}
                    onChange={(e) => setJoinDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("members_membership_label")}</Label>
                  <Select
                    value={membershipType}
                    onValueChange={(v) => setMembershipType(v as MembershipType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">
                        {t("membership_full")} · {t("membership_full_hint")}
                      </SelectItem>
                      <SelectItem value="half">
                        {t("membership_half")} · {t("membership_half_hint")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t("common_cancel")}
                </Button>
                <Button type="button" onClick={handleAddExisting} disabled={adding}>
                  {adding ? t("common_saving") : t("members_approve")}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* Create a brand-new account */}
            <TabsContent value="create">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <KeyRound className="h-3 w-3" />
                    {t("members_credential_hint")}
                  </span>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("signup_name")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("login_email")}</FormLabel>
                          <FormControl>
                            <Input type="email" dir="ltr" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("login_password")}</FormLabel>
                          <FormControl>
                            <Input type="password" dir="ltr" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("signup_phone")}</FormLabel>
                          <FormControl>
                            <Input dir="ltr" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="join_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("members_col_join")}</FormLabel>
                          <FormControl>
                            <Input type="date" dir="ltr" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="membership_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("members_membership_label")}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="full">
                                {t("membership_full")} · {t("membership_full_hint")}
                              </SelectItem>
                              <SelectItem value="half">
                                {t("membership_half")} · {t("membership_half_hint")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      {t("common_cancel")}
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? t("common_saving") : t("common_save")}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
