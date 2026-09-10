"use client";

import { useSessionPhotos, useUploadPhoto, useDeletePhoto } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Camera, Trash2, Upload } from "lucide-react";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function PhotoGallery({ sessionId }: { sessionId?: string }) {
  const { t: tk, lang } = useI18n();
  const t = (key: string) => tk(key as any);
  const { data: photos = [], isLoading } = useSessionPhotos(sessionId);
  const uploadPhoto = useUploadPhoto();
  const deletePhoto = useDeletePhoto();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const filePath = `photos/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("session-photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("session-photos")
        .getPublicUrl(filePath);

      await uploadPhoto.mutateAsync({
        session_id: sessionId,
        photo_url: urlData.publicUrl,
        caption: caption || undefined,
      });

      toast.success(t("photos_upload"));
      setCaption("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    await deletePhoto.mutateAsync(id);
    toast.success(t("photos_deleted"));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Camera className="h-4 w-4" />
          {t("photos_title")}
          {photos.length > 0 && (
            <span className="text-sm text-muted-foreground">({photos.length})</span>
          )}
        </h4>
      </div>

      {/* Upload area */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={t("photos_caption")}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-1" />
          {uploading ? t("photos_uploading") : t("photos_upload")}
        </Button>
      </div>

      {/* Photo grid */}
      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t("photos_empty")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative rounded-lg overflow-hidden border">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote gallery images without fixed dimensions; next/image is not used */}
              <img
                src={photo.photo_url}
                alt={photo.caption || "Session photo"}
                className="aspect-square w-full object-cover"
              />
              {photo.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs p-2 truncate">
                  {photo.caption}
                </div>
              )}
              <button
                onClick={() => handleDelete(photo.id)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
