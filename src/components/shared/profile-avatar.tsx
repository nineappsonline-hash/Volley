"use client";

import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { avatarSrc, AVATAR_COUNT } from "@/lib/avatars";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  name: string;
  /** Object path inside the public "avatars" bucket (profiles.avatar_url). */
  url?: string | null;
  /** Character slot id like "char-07" (profiles.avatar_id). */
  avatarId?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function ProfileAvatar({
  name,
  url,
  avatarId,
  className,
  fallbackClassName,
}: ProfileAvatarProps) {
  const uploadedSrc = useMemo(() => {
    if (!url) return undefined;
    const { data } = createClient()
      .storage.from("avatars")
      .getPublicUrl(url);
    return data.publicUrl;
  }, [url]);

  const defaultSrc = useMemo(() => {
    let hash = 0;
    for (const char of name || "Playza") hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return avatarSrc(`char-${String((hash % AVATAR_COUNT) + 1).padStart(2, "0")}`);
  }, [name]);

  const src = useMemo(() => {
    if (url) return undefined;
    if (avatarSrc(avatarId)) return avatarSrc(avatarId);
    return defaultSrc;
  }, [url, avatarId, defaultSrc]);

  return (
    <Avatar className={cn("[container-type:inline-size]", className)}>
      {(src || uploadedSrc) && <AvatarImage src={src ?? uploadedSrc} alt={name} title={name} loading="eager" />}
      <AvatarFallback delayMs={0} className={cn("overflow-hidden bg-purple-100", fallbackClassName)}>
        <img src={defaultSrc} alt="" className="h-full w-full object-cover" />
      </AvatarFallback>
    </Avatar>
  );
}