"use client";

import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { avatarSrc } from "@/lib/avatars";
import { cn, initials } from "@/lib/utils";

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

  const src = useMemo(() => {
    if (url) return undefined;
    return avatarSrc(avatarId);
  }, [url, avatarId]);

  return (
    <Avatar className={cn("[container-type:inline-size]", className)}>
      {src || uploadedSrc ? (
        <AvatarImage
          src={src ?? uploadedSrc}
          alt={name}
          title={name}
          loading="lazy"
        />
      ) : (
        <AvatarFallback className={fallbackClassName}>
          {initials(name) || "U"}
        </AvatarFallback>
      )}
    </Avatar>
  );
}