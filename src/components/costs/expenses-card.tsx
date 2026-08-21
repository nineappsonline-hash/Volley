"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { useI18n } from "@/lib/i18n";
import {
  EXPENSE_CATEGORIES,
  formatMoney,
} from "@/lib/constants";
import { errorMessage, todayInput } from "@/lib/utils";
import {
  useDeleteExpense,
  useExpenses,
  useSaveExpense,
} from "@/lib/queries";
import type { Expense } from "@/lib/types";

export function ExpensesCard() {
  const { t, lang, locale } = useI18n();
  const { data: expenses, isLoading } = useExpenses();
  const save = useSaveExpense();
  const remove = useDeleteExpense();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(todayInput());

  const now = new Date();
  const thisMonth = useMemo(() => {
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    return (expenses ?? [])
      .filter((e) => {
        const d = new Date(e.expense_date + "T00:00:00");
        return d.getMonth() + 1 === m && d.getFullYear() === y;
      })
      .reduce((s, e) => s + Number(e.amount), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses]);

  const sorted = useMemo(
    () =>
      [...(expenses ?? [])].sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
    [expenses]
  );

  const openNew = () => {
    setEditing(null);
    setDescription("");
    setAmount("");
    setCategory(EXPENSE_CATEGORIES[0]);
    setDate(todayInput());
    setOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setDescription(e.description);
    setAmount(String(e.amount));
    setCategory(e.category);
    setDate(e.expense_date);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!description.trim() || !amount) return;
    try {
      await save.mutateAsync({
        id: editing?.id,
        description: description.trim(),
        amount: Number(amount),
        category: category as Expense["category"],
        expense_date: date,
      });
      toast.success(t("expenses_saved"));
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success(t("expenses_deleted"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4 text-primary" />
          {t("expenses_title")}
        </CardTitle>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-sm text-muted-foreground sm:inline">
            {t("expenses_month_total")}:{" "}
            <span className="font-bold text-foreground">
              {formatMoney(thisMonth, lang)}
            </span>
          </span>
          <Button variant="outline" size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" />
            {t("expenses_add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("common_loading")}
          </p>
        ) : sorted.length === 0 ? (
          <EmptyState message={t("expenses_empty")} icon={Receipt} />
        ) : (
          sorted.slice(0, 8).map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{e.description}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(e.expense_date + "T00:00:00"), "MMM d, yyyy", {
                    locale,
                  })}
                  {" · "}
                  {t(`expense_cat_${e.category}`)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="me-2 font-mono font-bold text-destructive">
                  −{formatMoney(Number(e.amount), lang)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={t("common_edit")}
                  onClick={() => openEdit(e)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  aria-label={t("common_delete")}
                  disabled={remove.isPending}
                  onClick={() => handleDelete(e.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("expenses_edit") : t("expenses_add")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("expenses_desc")}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("expenses_amount")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("expenses_date")}</Label>
                <Input
                  type="date"
                  dir="ltr"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("expenses_category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`expense_cat_${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common_cancel")}
            </Button>
            <Button
              disabled={!description.trim() || !amount || save.isPending}
              onClick={handleSave}
            >
              {save.isPending ? t("common_saving") : t("common_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
