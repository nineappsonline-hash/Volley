"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Volleyball } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function useLogo(academyId: string, enabled = true) {
  return useQuery({
    queryKey: ["academy-logo", academyId], enabled,
    queryFn: async () => {
      const { data, error } = await createClient().from("academies").select("logo_url").eq("id", academyId).single();
      if (error) throw error;
      return data.logo_url as string | null;
    },
  });
}

export function AcademyLogo({ academyId, name, logoUrl }: { academyId: string; name: string; logoUrl?: string | null }) {
  const { data } = useLogo(academyId, logoUrl === undefined || logoUrl === null);
  const url = (logoUrl === undefined || logoUrl === null) ? data : logoUrl;
  const [failed, setFailed] = useState<string | null>(null);
  return <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white p-1.5 shadow-sm">
    {url && failed !== url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={`${name} logo`} loading="lazy" className="h-full w-full object-contain" onError={() => setFailed(url)} />
    ) : <Volleyball aria-hidden="true" className="h-7 w-7 text-slate-500" />}
  </div>;
}

export function AcademyLogoEditor({ academyId, name, showHeading = true }: { academyId: string; name: string; showHeading?: boolean }) {
  const { lang } = useI18n(); const ar = lang === "ar";
  const { data: logo } = useLogo(academyId);
  const cache = useQueryClient(); const [busy, setBusy] = useState(false);
  return <section className="space-y-3 rounded-xl border p-4">
    {showHeading && <h3 className="font-semibold">{ar ? "شعار الأكاديمية" : "Academy logo"}</h3>}
    <AcademyLogo academyId={academyId} name={name} logoUrl={logo} />
    <label className="block space-y-2 text-sm">
      <span>{ar ? "رفع أو استبدال الشعار (PNG، JPG، WebP؛ حتى 5 ميجابايت). يُحفظ فورًا." : "Upload or replace logo (PNG, JPG, WebP; up to 5 MB). Saves immediately."}</span>
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="block w-full min-w-0 text-sm" onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
        const ext = ({"image/png":"png","image/jpeg":"jpg","image/webp":"webp"} as Record<string,string>)[file.type];
        if (!ext || file.size > 5*1024*1024) { toast.error(ar ? "اختار صورة PNG أو JPG أو WebP أصغر من 5 ميجابايت" : "Choose a PNG, JPG or WebP image under 5 MB"); return; }
        setBusy(true);
        try {
          const db = createClient(); const path = `academies/${academyId}/logo-${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await db.storage.from("academy-media").upload(path, file, {contentType:file.type});
          if (uploadError) throw uploadError;
          const url = db.storage.from("academy-media").getPublicUrl(path).data.publicUrl;
          const { error } = await db.from("academies").update({logo_url:url}).eq("id", academyId).select("id").single();
          if (error) throw error;
          await Promise.all([
            cache.invalidateQueries({ queryKey: ["academy-logo"] }),
            cache.invalidateQueries({ queryKey: ["academy"] }),
            cache.invalidateQueries({ queryKey: ["all-academies"] }),
            cache.invalidateQueries({ queryKey: ["public-academies"] }),
            cache.invalidateQueries({ queryKey: ["academy-training-programs"] }),
            cache.invalidateQueries({ queryKey: ["platform-records"] }),
          ]);
          toast.success(ar ? "تم حفظ الشعار" : "Logo saved");
        } catch (error) { toast.error(errorMessage(error, ar ? "تعذر حفظ الشعار" : "Could not save logo")); }
        finally { setBusy(false); }
      }} />
    </label>
    {busy && <p role="status" className="text-sm text-muted-foreground">{ar ? "جارٍ رفع الشعار…" : "Uploading logo…"}</p>}
  </section>;
}

export function AcademyLogoDialog({ academyId, name, open, onOpenChange }: { academyId: string; name: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { lang } = useI18n(); const ar = lang === "ar";
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{ar ? "شعار الأكاديمية" : "Academy logo"}</DialogTitle>
        <DialogDescription>{name}</DialogDescription>
      </DialogHeader>
      <AcademyLogoEditor academyId={academyId} name={name} showHeading={false} />
    </DialogContent>
  </Dialog>;
}
