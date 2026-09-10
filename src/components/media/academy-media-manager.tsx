"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import {
  useAcademy,
  useAcademyPhotos,
  useAddAcademyPhoto,
  useDeleteAcademyPhoto,
  useUpdateAcademy,
} from "@/lib/queries";

export function AcademyMediaManager() {
  const { t } = useI18n();
  const { data: academy } = useAcademy();
  const update = useUpdateAcademy();
  const { data: photos = [], isLoading: loadingPhotos } = useAcademyPhotos(
    academy?.id
  );
  const addPhoto = useAddAcademyPhoto();
  const deletePhoto = useDeleteAcademyPhoto();

  const logoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [caption, setCaption] = useState("");

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !academy) return;
    setLogoUploading(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const filePath = `academies/${academy.id}/logo-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("academy-media")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("academy-media")
        .getPublicUrl(filePath);
      await update.mutateAsync({ id: academy.id, logo_url: urlData.publicUrl });
      toast.success(t("media_logo_uploaded"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !academy) return;
    setPhotoUploading(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const filePath = `academies/${academy.id}/gallery-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("academy-media")
        .upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("academy-media")
        .getPublicUrl(filePath);
      await addPhoto.mutateAsync({
        academy_id: academy.id,
        photo_url: urlData.publicUrl,
        caption: caption.trim() || undefined,
      });
      setCaption("");
      toast.success(t("media_photo_added"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async (id: string) => {
    try {
      await deletePhoto.mutateAsync(id);
      toast.success(t("media_photo_deleted"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <div className="space-y-5">
      {/* Logo */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          {t("media_logo_label")}
        </Label>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted/50">
            {academy?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote logo/images without fixed dimensions; next/image is not used
              <img
                src={academy.logo_url}
                alt={t("media_logo_alt")}
                className="h-full w-full object-cover"
              />
            ) : (
              <Camera className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={uploadLogo}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading || !academy}
            >
              {logoUploading && <Loader2 className="animate-spin" />}
              <Upload className="h-4 w-4" />
              {logoUploading ? t("media_uploading") : t("media_logo_upload")}
            </Button>
            {academy?.logo_url && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!academy) return;
                  try {
                    await update.mutateAsync({ id: academy.id, logo_url: null });
                    toast.success(t("media_logo_removed"));
                  } catch (err) {
                    toast.error(errorMessage(err, t("common_error")));
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                {t("media_remove")}
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("media_logo_hint")}</p>
      </div>

      {/* Gallery */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <ImagePlus className="h-4 w-4 text-primary" />
          {t("media_photos_label")}
        </Label>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={t("media_photo_caption_placeholder")}
            className="flex-1"
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading || !academy}
              className="flex-1 sm:flex-none"
            >
              {photoUploading && <Loader2 className="animate-spin" />}
              <Upload className="h-4 w-4" />
              {photoUploading ? t("media_uploading") : t("media_photo_upload")}
            </Button>
          </div>
        </div>

        {loadingPhotos ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {t("common_loading")}
          </p>
        ) : photos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("media_photos_empty")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative overflow-hidden rounded-xl border"
              >
{/* eslint-disable-next-line @next/next/no-img-element -- remote gallery images without fixed dimensions; next/image is not used */}
                <img
                  src={photo.photo_url}
                  alt={photo.caption || t("media_photo_alt")}
                  className="aspect-square w-full object-cover"
                />
                {photo.caption && (
                  <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 p-2 text-xs text-white">
                    {photo.caption}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}