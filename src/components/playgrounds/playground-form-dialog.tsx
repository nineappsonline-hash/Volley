"use client";

import { uploadSignupCourtPhoto } from "@/lib/court-photo-upload";
import { missingCourtSubmissionFields } from "@/lib/court-submission";
import { COURT_REVIEW_FIELDS } from "@/lib/court-review";
import { CourtCorrectionsDialog, needsCourtCorrections } from "./court-corrections";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { CourtAvailabilityEditor } from "./court-availability-editor";
import { workingHoursFromCourtAvailability } from "@/lib/venue-slots";
import { LocationFields } from "@/components/shared/location-fields";
import { MapPicker } from "@/components/shared/map-picker";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { useSaveVenue, useSports } from "@/lib/queries";
import type { Venue } from "@/lib/types";

export type CourtSubmissionDraft = Partial<Venue> & { name: string; sport_name: string };

interface PlaygroundFormDialogProps {
  onSaveDraft?: (details: CourtSubmissionDraft) => void;
  draftMode?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue: Venue | null;
  ownerProfileId?: string | null;
  ownerPhone?: string | null;
}

export function PlaygroundFormDialog(props: PlaygroundFormDialogProps) {
  if (props.venue && needsCourtCorrections(props.venue)) return <CourtCorrectionsDialog venue={props.venue} open={props.open} onOpenChange={props.onOpenChange} />;
  return <FullPlaygroundFormDialog {...props} />;
}

function FullPlaygroundFormDialog({
  open,
  onOpenChange,
  venue,
  ownerProfileId,
  ownerPhone,
  onSaveDraft,
  draftMode,
}: PlaygroundFormDialogProps) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const save = useSaveVenue();
  const { data: sports } = useSports();
  const { data: courtSports } = useQuery({queryKey:["court-sports"],queryFn:async()=>{const {data,error}=await createClient().rpc("court_sports");if(error)throw error;return data as {id:string;name:string}[];}});
  const [location,setLocation]=useState({country:venue?.country??"",governorate:venue?.governorate??"",city:venue?.area??""});
  const [phone,setPhone]=useState(venue?.contact_phone??ownerPhone??"");
  const [courtAvailability,setCourtAvailability]=useState(venue?.court_availability??[]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [name, setName] = useState(venue?.name ?? "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const [capacity, setCapacity] = useState(venue?.capacity != null ? String(venue.capacity) : "");
  const [sportId, setSportId] = useState(venue?.sport_id ?? "none");
  const [schoolName, setSchoolName] = useState(venue?.school_name ?? "");
  const [rentalCost, setRentalCost] = useState(venue?.rental_cost != null ? String(venue.rental_cost) : "");
  const [rentalHours, setRentalHours] = useState(venue?.rental_hours != null ? String(venue.rental_hours) : "1");
  const [courtCount, setCourtCount] = useState(venue?.court_count != null ? String(venue.court_count) : "1");
  const [lat, setLat] = useState<number | null>(venue?.lat ?? null);
  const [lng, setLng] = useState<number | null>(venue?.lng ?? null);
  const [locationLink, setLocationLink] = useState(venue?.location_link ?? "");
  const [photos, setPhotos] = useState<string[]>(venue?.photos ?? []);
  const [coverUrl, setCoverUrl] = useState<string | null>(venue?.cover_url ?? null);

  const displayPhotos = Array.from(new Set([...(coverUrl ? [coverUrl] : []), ...photos]));

  const handleSave = async () => {
    const missing = missingCourtSubmissionFields({ name, address, sport_id: sportId === "none" ? null : sportId,
      contact_phone: phone, country: location.country, governorate: location.governorate, area: location.city,
      location_link: locationLink, rental_cost: rentalCost === "" ? null : Number(rentalCost), rental_hours: rentalHours === "" ? null : Number(rentalHours),
      court_count: Number(courtCount), photos, cover_url: coverUrl, court_availability: courtAvailability });
    if (missing.length) {
      toast.error(`${ar ? "المعلومات المطلوبة" : "Required information"}: ${missing.map(field => COURT_REVIEW_FIELDS[field][ar ? "ar" : "en"]).join(" · ")}`);
      return;
    }
    try {
      const details = {
        id: venue?.id,
        owner_profile_id: ownerProfileId ?? venue?.owner_profile_id ?? null,
        name: name.trim(),
        address: address.trim() || null,
        capacity: capacity ? Number(capacity) : null,
        sport_id: sportId === "none" ? null : sportId,
        contact_phone: phone.trim() || null,
        ...(location.country ? {country:location.country,governorate:location.governorate,area:location.city} : {}),
        court_availability: courtAvailability,
        working_hours: workingHoursFromCourtAvailability(courtAvailability),
        school_name: schoolName.trim() || null,
        rental_cost: rentalCost ? Number(rentalCost) : null,
        rental_hours: rentalHours ? Number(rentalHours) : null,
        court_count: Number(courtCount) || 1,
        lat,
        lng,
        location_link: locationLink.trim() || null,
        photos,
        cover_url: coverUrl,
      };
      if (onSaveDraft) {
        onSaveDraft({ ...details, sport_name: (courtSports ?? sports ?? []).find(sport => sport.id === sportId)?.name ?? "" });
        onOpenChange(false);
        return;
      }
      await save.mutateAsync(details);
      toast.success(t("venue_submitted_review"));
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const supabase = createClient();
      const urls: string[] = [];
      for (const file of files) {
        if (draftMode) { urls.push(await uploadSignupCourtPhoto(file)); continue; }
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `venues/photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from("venue-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from("venue-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      return urls;
    },
    onSuccess: (urls) => {
      setPhotos((prev) => [...prev, ...urls]);
      setCoverUrl((prev) => prev ?? urls[0] ?? null);
    },
    onError: (err) => toast.error(errorMessage(err, t("sa_photo_failed"))),
  });

  const handlePhotoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (files.some(file => file.size > 4 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      toast.error(ar ? "اختر صور JPG أو PNG أو WebP بحجم أقل من ٤ ميجابايت" : "Choose JPG, PNG or WebP images under 4 MB"); return;
    }
    setUploadingPhoto(true);
    upload.mutate(files, {
      onSettled: () => {
        setUploadingPhoto(false);
        if (photoInputRef.current) photoInputRef.current.value = "";
      },
    });
  };

  const removePhoto = (url: string) => {
    setPhotos((prev) => prev.filter((p) => p !== url));
    setCoverUrl((prev) => (prev === url ? photos.find((p) => p !== url) ?? null : prev));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{venue ? t("playgrounds_edit") : t("playgrounds_add")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="rounded-lg bg-muted p-3 text-sm">{ar ? "جميع بيانات الملعب مطلوبة، بما فيها رقم التواصل والموقع والصور ومواعيد العمل. اسم المنشأة والسعة اختياريان." : "Court details, contact phone, location, photos and working hours are required. School / facility and player capacity are optional."}</p>
          <div className="space-y-2">
            <Label>{t("venues_name")} <span aria-hidden="true">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          { (
            <div className="space-y-2">
              <Label>{t("venues_sport")} <span aria-hidden="true">*</span></Label>
              <Select value={sportId} onValueChange={setSportId}>
                <SelectTrigger aria-label={t("venues_sport")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("venues_no_sport")}</SelectItem>
                  {(ownerProfileId || draftMode ? courtSports ?? [] : sports ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{t("venues_rental_cost")} <span aria-hidden="true">*</span></Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                value={rentalCost}
                onChange={(e) => setRentalCost(e.target.value)}
                placeholder="0"
              />
              <p className="text-[11px] text-muted-foreground">{t("venues_rental_cost_hint")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("venues_rental_hours")} <span aria-hidden="true">*</span></Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                dir="ltr"
                value={rentalHours}
                onChange={(e) => setRentalHours(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("venues_court_count")} <span aria-hidden="true">*</span></Label>
              <Input
                type="number"
                min="1"
                step="1"
                dir="ltr"
                value={courtCount}
                onChange={(e) => setCourtCount(e.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("venues_school")}</Label>
              <Input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder={t("venues_school")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("venues_capacity")}</Label>
              <Input
                type="number"
                min="0"
                dir="ltr"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("venues_address")} <span aria-hidden="true">*</span></Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <MapPicker
            lat={lat}
            lng={lng}
            onChange={(loc) => {
              setLat(loc.lat);
              setLng(loc.lng);
              if (loc.label) setAddress(loc.label);
            }}
            hint={t("venues_map_hint")}
          />

          <div className="space-y-2">
            <Label>{t("sa_location_link")} <span aria-hidden="true">*</span></Label>
            <Input
              dir="ltr"
              value={locationLink}
              onChange={(e) => setLocationLink(e.target.value)}
              placeholder={t("sa_location_link_placeholder")}
            />
          </div>

          <div className="space-y-2"><Label>{ar ? "رقم التواصل للملعب" : "Court contact phone"} *</Label><Input type="tel" dir="ltr" value={phone} onChange={e=>setPhone(e.target.value)} /></div>
          <p className="text-sm font-medium">{ar ? "الدولة والمحافظة والمدينة" : "Country, governorate and city"} *</p>
          <LocationFields country={location.country} governorate={location.governorate} city={location.city} onCountryChange={v=>setLocation(l=>({...l,country:v,governorate:"",city:""}))} onGovernorateChange={v=>setLocation(l=>({...l,governorate:v,city:""}))} onCityChange={v=>setLocation(l=>({...l,city:v}))}/>
          <p className="text-sm font-medium">{ar ? "مواعيد عمل الملاعب" : "Court working hours"} *</p>
          <CourtAvailabilityEditor value={courtAvailability} onChange={setCourtAvailability} courtCount={Math.max(1,Number(courtCount)||1)} />
          <div className="space-y-2">
            <Label>{t("venues_photos")} <span aria-hidden="true">*</span></Label>
            <div className="flex flex-wrap gap-2">
              {displayPhotos.map((url) => (
                <div key={url} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={name || t("venues_name")} className="h-20 w-24 rounded-lg object-cover" />
                  <button
                    type="button"
                    aria-label={t("common_delete")}
                    onClick={() => removePhoto(url)}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 text-destructive shadow"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {url === coverUrl && (
                    <span className="absolute bottom-0 start-0 rounded-tl-lg rounded-br-lg bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                      {t("venues_cover_badge")}
                    </span>
                  )}
                </div>
              ))}
              <label
                className="flex h-20 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:text-foreground"
              >
                {uploadingPhoto ? t("common_loading") : <ImagePlus className="h-5 w-5" />}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handlePhotoInput}
                />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("venues_photos_hint")}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button disabled={uploadingPhoto || save.isPending} onClick={handleSave}>
            {save.isPending ? t("common_saving") : t("common_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}