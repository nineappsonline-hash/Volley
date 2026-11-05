"use client";
import { KashierButton } from "@/components/payments/kashier-button";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  MapPin,
  Users,
  Check,
  Copy,
  CreditCard,
  Loader2,
  Link as LinkIcon,
  Upload,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  E_WALLET_NUMBER,
  INSTAPAY_LINK,
  formatMoney,
  formatTime12h,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { requestPushPrompt } from "@/lib/push";
import { useJoinFriendlyGame, usePayGameShare, usePayRentRemaining } from "@/lib/queries";
import { errorMessage } from "@/lib/utils";

type PayMethod = "instapay" | "e_wallet" | "kashier";

const PAY_METHODS: { value: PayMethod; icon: typeof Wallet; disabled?: boolean }[] =
  [
    { value: "instapay", icon: LinkIcon },
    { value: "e_wallet", icon: Wallet },
    { value: "kashier", icon: CreditCard },
  ];

export function JoinGameDialog({
  open,
  onOpenChange,
  game,
  inviteCode,
  mode = "join",
  rentRemaining,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: {
    id: string;
    title: string;
    share_price: number | null;
    host_pays?: boolean;
    host_total?: number | null;
    game_date?: string;
    start_time?: string;
    location?: string | null;
    area?: string | null;
    playground?: { name: string | null } | null;
    participants_count?: number;
    max_players?: number;
    status?: string;
    waitlist_count?: number;
    gender?: string; min_age?: number | null; max_age?: number | null;
  };
  inviteCode?: string | null;
  mode?: "join" | "pay" | "rent";
  rentRemaining?: number;
  onSuccess?: () => void;
}) {
  const { t, lang } = useI18n();
  const supabase = createClient();
  const join = useJoinFriendlyGame();
  const pay = usePayGameShare();
  const rentPay = usePayRentRemaining();
  const isPay = mode === "pay";
  const isRent = mode === "rent";

  const [guests, setGuests] = useState<{name:string;gender:string;age:string}[]>([]);
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setGuests([]);
      setPayMethod(null);
      setReceiptUrl("");
      setUploading(false);
      setCopied(null);
    }
  }, [open]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void uploadReceipt(file);
  };

  const uploadReceipt = async (file: File) => {
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("game-fee-receipts")
        .upload(path, file, { cacheControl: "3600", contentType: file.type });
      if (error) throw error;
      setReceiptUrl(path);
      toast.success(t("game_fee_receipt_ok"));
    } catch {
      toast.error(t("game_fee_receipt_fail"));
    } finally {
      setUploading(false);
    }
  };

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const waiting = mode === "join" && (game.status === "full" || (game.max_players != null && game.participants_count != null && game.participants_count >= game.max_players));
  const amount = isRent
    ? (rentRemaining ?? 0)
    : game.host_pays
      ? mode === "pay"
        ? game.host_total ?? 0
        : 0
      : (game.share_price ?? 0) * (mode === "join" && !waiting ? 1 + guests.length : 1);
  const isFree = game.host_pays === true && mode === "join";
  const busy = join.isPending || pay.isPending || rentPay.isPending;

  const noPlaces = waiting ? (game.waitlist_count ?? 0) >= 2 : mode === "join" && (game.status === "full" || (game.max_players != null && game.participants_count != null && game.participants_count + 1 + guests.length > game.max_players));

  const submit = async () => {
    if (noPlaces) return;
    if (isFree) {
      try {
        const added = await join.mutateAsync({
          gameId: game.id,
          guests: waiting ? [] : guests,
          inviteCode,
          payMethod: null,
          payReceiptUrl: null,
        });
        toast.success(added ? (lang === "ar" ? "انضمّيت لقائمة الانتظار" : "You joined the waiting list") : `${game.title} · ${t("community_joined")}`);
        requestPushPrompt();
        onOpenChange(false);
        onSuccess?.();
      } catch (err) {
        toast.error(errorMessage(err, t("common_error")));
      }
      return;
    }
    if (!payMethod || payMethod === "kashier") return;
    if (!receiptUrl) {
      toast.error(t("game_fee_receipt_required"));
      return;
    }
    try {
      if (isPay) {
        await pay.mutateAsync({
          gameId: game.id,
          payMethod,
          payReceiptUrl: receiptUrl,
        });
        toast.success(t("games_share_submitted"));
      } else if (isRent) {
        await rentPay.mutateAsync({
          gameId: game.id,
          payMethod,
          payReceiptUrl: receiptUrl,
        });
        toast.success(t("games_rent_submitted"));
      } else {
        const added = await join.mutateAsync({
          gameId: game.id,
          guests: waiting ? [] : guests,
          inviteCode,
          payMethod,
          payReceiptUrl: receiptUrl,
        });
        toast.success(added ? (lang === "ar" ? "انضمّيت لقائمة الانتظار" : "You joined the waiting list") : `${game.title} · ${t("community_joined")}`);
        requestPushPrompt();
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const guestsValid = guests.every(g => g.name.trim().length > 0 && g.name.trim().length <= 100 && (!game.gender || game.gender === "mixed" || g.gender === game.gender) && ((game.min_age == null && game.max_age == null) || (g.age !== "" && Number.isInteger(Number(g.age)) && Number(g.age) >= (game.min_age ?? 0) && Number(g.age) <= (game.max_age ?? 100))));
  const canSubmit = !noPlaces && (waiting || guestsValid) && (isFree
    ? !busy
    : !!payMethod &&
      payMethod !== "kashier" &&
      !!receiptUrl &&
      !uploading &&
      !busy &&
      amount > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto overflow-x-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isPay
              ? t("games_share_pay_title")
              : isRent
                ? t("games_rent_title")
                : waiting
                  ? (lang === "ar" ? "قائمة انتظار الماتش" : "Game waiting list")
                  : isFree
                  ? t("games_free_join_title")
                  : t("games_share_join_title")}
          </DialogTitle>
          <DialogDescription>
            {waiting
              ? (lang === "ar" ? "قائمة الانتظار فيها مكانين فقط وبنفس نصيب اللاعب. الدفع لا يضمن مكانًا في الماتش؛ لو ما اتنقلتش للماتش، تواصل مع المنظّم لاسترداد المبلغ يدويًا." : "Only 2 waiting places, at the normal player price. Payment does not guarantee a player place. If you are not promoted, contact the organizer for a manual refund.")
              : isFree
              ? t("games_free_join_desc")
              : isRent
                ? t("games_rent_desc")
                : t("games_share_join_desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {waiting && <p className="rounded-xl border bg-accent p-3 text-sm text-accent-foreground">{game.title} · {lang === "ar" ? "قائمة الانتظار" : "Waiting list"}: {game.waitlist_count ?? 0}/2{noPlaces ? (lang === "ar" ? " — مكتملة" : " — full") : ""}</p>}
          {mode === "join" && !waiting && <section aria-label={lang === "ar" ? "ملخص الحجز" : "Booking summary"} className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <h3 className="text-base font-bold">{game.title}</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              {game.game_date && <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0" />{game.game_date}{game.start_time ? ` · ${formatTime12h(game.start_time, lang)}` : ""}</p>}
              {(game.playground?.name || game.location || game.area) && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" />{[game.playground?.name ?? game.location, game.area].filter(Boolean).join(" · ")}</p>}
              {game.max_players != null && game.participants_count != null && <p className="flex items-center gap-2"><Users className="h-4 w-4 shrink-0" />{Math.max(0, game.max_players - game.participants_count)} {lang === "ar" ? "مكان متاح" : "spots available"}</p>}
              {noPlaces && <p className="font-medium text-destructive">{lang === "ar" ? "الماتش كامل. لا يمكن الانضمام." : "This game is full. Joining is not available."}</p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/15 pt-3">
              <span className="text-sm font-semibold">{lang === "ar" ? "الإجمالي لك ولضيوفك" : "Total for you and your guests"} · {1 + guests.length} {lang === "ar" ? "لاعب" : "players"}</span>
              <span aria-live="polite" className="text-lg font-extrabold text-primary">{formatMoney(amount, lang)}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t("community_leave_confirm_desc")}</p>
            {!isFree && <p className="text-xs leading-relaxed text-muted-foreground">{lang === "ar" ? "الدفع بالتحويل يحتاج إيصالًا ومراجعة. يتم تأكيد المكان عند إتمام الانضمام حسب التوفر." : "Bank and wallet transfers need a receipt and review. Your place is confirmed when joining completes, subject to availability."}</p>}
          </section>}
          {mode === "join" && !waiting && <section className="space-y-3 rounded-lg border p-3">
            <h3 className="font-semibold">{lang === "ar" ? "ضيوفك" : "Bring guests"}</h3>
            <p className="text-xs text-muted-foreground">{isFree ? (lang === "ar" ? "المنظّم متكفّل بالتكلفة. كل ضيف بيتحسب مكان في الماتش." : "The host covers the cost. Each guest takes one player place.") : (lang === "ar" ? "إنت بتدفع عن نفسك وضيوفك. كل ضيف بيتحسب مكان في الماتش." : "You pay for yourself and your guests. Each guest takes one player place.")}</p>
            {guests.map((guest,index)=><div key={index} className="space-y-2 rounded border p-3">
              <label className="block text-sm">{lang === "ar" ? "اسم الضيف" : "Guest name"} {index+1}<input maxLength={100} disabled={busy} className="mt-1 min-h-11 w-full rounded border bg-background p-2" value={guest.name} onChange={e=>setGuests(rows=>rows.map((r,i)=>i===index?{...r,name:e.target.value}:r))}/></label>
              {game.gender && game.gender !== "mixed" && <label className="block text-sm">{lang === "ar" ? "النوع" : "Gender"}<select disabled={busy} className="mt-1 min-h-11 w-full rounded border bg-background p-2" value={guest.gender} onChange={e=>setGuests(rows=>rows.map((r,i)=>i===index?{...r,gender:e.target.value}:r))}><option value="">{lang === "ar" ? "اختار" : "Choose"}</option><option value="male">{lang === "ar" ? "ذكر" : "Male"}</option><option value="female">{lang === "ar" ? "أنثى" : "Female"}</option></select></label>}
              {(game.min_age != null || game.max_age != null) && <label className="block text-sm">{lang === "ar" ? "العمر" : "Age"}<input disabled={busy} type="number" min={game.min_age??0} max={game.max_age??100} className="mt-1 min-h-11 w-full rounded border bg-background p-2" value={guest.age} onChange={e=>setGuests(rows=>rows.map((r,i)=>i===index?{...r,age:e.target.value}:r))}/></label>}
              <Button type="button" variant="ghost" disabled={busy} onClick={()=>setGuests(rows=>rows.filter((_,i)=>i!==index))}>{lang === "ar" ? "إزالة الضيف" : "Remove guest"}</Button>
            </div>)}
            <Button type="button" variant="outline" disabled={busy||guests.length>=20} onClick={()=>setGuests(rows=>[...rows,{name:"",gender:"",age:""}])}>{lang === "ar" ? "إضافة ضيف" : "Add guest"}</Button>
            {guests.length>0&&<p className="text-sm font-medium">{lang === "ar" ? "عدد الأماكن" : "Total places"}: {guests.length+1} · {formatMoney(amount,lang)}</p>}
          </section>}
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {isFree
                  ? t("games_free_price")
                  : isRent
                    ? t("games_rent_label")
                    : game.host_pays
                      ? t("games_host_pays")
                      : t("games_share_per_player")}
              </p>
              <p className="truncate text-sm font-semibold">{game.title}</p>
            </div>
            {isFree ? (
              <span className="shrink-0 text-lg font-extrabold text-success-ink">
                {t("games_free_label")}
              </span>
            ) : (
              <span className="shrink-0 text-lg font-extrabold text-primary">
                {formatMoney(amount, lang)}
              </span>
            )}
          </div>

          {!isFree && amount <= 0 && (
            <p className="text-xs text-muted-foreground">
              {t("games_share_unavailable")}
            </p>
          )}

          {!isFree && (
            <>
            <div className="grid grid-cols-3 gap-2">
            {PAY_METHODS.map(({ value, icon: Icon, disabled }) => {
              const selected = payMethod === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled || busy || uploading}
                  onClick={() => setPayMethod(value)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 text-center transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">
                    {t(`game_fee_method_${value}`)}
                  </span>
                  {disabled && (
                    <span className="text-[9px] text-muted-foreground">
                      {t("game_fee_kashier_soon")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {payMethod === "instapay" && (
            <div className="space-y-2 rounded-lg bg-muted/50 p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("checkout_instapay_link")}
                </p>
                <p className="break-all text-sm font-medium leading-relaxed text-primary">
                  {INSTAPAY_LINK}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild className="flex-1">
                  <a
                    href={INSTAPAY_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    {t("checkout_open_link")}
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() => copy("instapay", INSTAPAY_LINK)}
                >
                  {copied === "instapay" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {t("checkout_copy")}
                </Button>
              </div>
            </div>
          )}
          {payMethod === "e_wallet" && (
            <div className="space-y-2 rounded-lg bg-muted/50 p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("checkout_e_wallet_number")}
                </p>
                <p
                  className="break-all text-lg font-extrabold text-primary"
                  dir="ltr"
                >
                  {E_WALLET_NUMBER}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1"
                onClick={() => copy("ewallet", E_WALLET_NUMBER)}
              >
                {copied === "ewallet" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {t("checkout_copy")}
              </Button>
            </div>
          )}

          {payMethod && payMethod !== "kashier" && (
            <div className="space-y-2">
              <Label>{t("game_fee_receipt")}</Label>
              <label
                className={cn(
                  "flex h-10 w-full items-center justify-center gap-2 rounded-md border bg-card px-3 text-sm font-medium transition-colors",
                  uploading
                    ? "cursor-wait border-input text-muted-foreground"
                    : receiptUrl
                      ? "cursor-default border-primary/30 bg-primary/5 text-success-ink"
                      : "cursor-pointer border-border text-foreground hover:border-primary/40",
                )}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : receiptUrl ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Upload className="h-4 w-4 text-primary" />
                )}
                {uploading
                  ? t("common_saving")
                  : receiptUrl
                    ? t("game_fee_receipt_ok")
                    : t("game_fee_receipt")}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFile}
                  disabled={uploading}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                {t("game_fee_receipt_hint")}
              </p>
            </div>
          )}
            </>
          )}

          {isPay && game.host_pays && (
            <p className="rounded-lg border border-attention-300/60 bg-attention-50 p-2.5 text-[11px] text-warning-ink ">
              {t("games_host_cover_note")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          {!isFree && payMethod === "kashier" ? <KashierButton target={{kind:isRent?"rent":"share",targetId:game.id,inviteCode,guests:mode==="join"&&!waiting?guests:undefined}} disabled={busy || noPlaces || !guestsValid || amount <= 0} /> : <Button onClick={submit} disabled={!canSubmit} className="gap-1">
            <Wallet className="h-4 w-4" />
            {busy
              ? t("common_saving")
              : waiting
                ? (lang === "ar" ? "انضم لقائمة الانتظار" : "Join waiting list")
                : isFree
                ? t("games_free_join")
                : isPay
                  ? t("games_share_pay_submit")
                  : isRent
                    ? t("games_rent_submit_button")
                    : t("games_share_pay_join").replace(
                        "{amount}",
                        formatMoney(amount, lang)
                      )}
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}