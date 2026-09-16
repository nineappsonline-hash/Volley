"use client";

import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { avatarStyles, avatarSVG, isAvatarPreset } from "@/lib/avatars";
import { cn, initials } from "@/lib/utils";

interface ProfileAvatarProps {
  name: string;
  /** Object path inside the public "avatars" bucket (profiles.avatar_url). */
  url?: string | null;
  /** Illustrated config string or legacy emoji (profiles.avatar_id). */
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
  const src = useMemo(() => {
    if (!url) return null;
    const { data } = createClient()
      .storage.from("avatars")
      .getPublicUrl(url);
    return data.publicUrl;
  }, [url]);

  const presetStyle = useMemo(
    () => (url ? undefined : avatarStyles(avatarId)),
    [url, avatarId]
  );

  const illustrated = useMemo(() => {
    if (url) return null;
    return avatarSVG(avatarId);
  }, [url, avatarId]);

  const isEmoji = !url && !illustrated && isAvatarPreset(avatarId);

  return (
    <Avatar className={cn("[container-type:inline-size]", className)}>
      {src ? (
        <AvatarImage src={src} alt={name} title={name} loading="lazy" />
      ) : null}
      {illustrated ? (
        <AvatarFallback className={cn("overflow-hidden", fallbackClassName)}>
          <span
            className="block h-full w-full [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: illustrated }}
          />
        </AvatarFallback>
      ) : isEmoji ? (
        <AvatarFallback className={fallbackClassName} style={presetStyle}>
          {avatarId}
        </AvatarFallback>
      ) : (
        <AvatarFallback className={fallbackClassName}>
          {initials(name) || "U"}
        </AvatarFallback>
      )}
    </Avatar>
  );
}