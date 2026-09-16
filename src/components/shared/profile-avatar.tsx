"use client";

import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { avatarStyles, isAvatarPreset } from "@/lib/avatars";
import { cn, initials } from "@/lib/utils";

interface ProfileAvatarProps {
  name: string;
  /** Object path inside the public "avatars" bucket (profiles.avatar_url). */
  url?: string | null;
  /** Preset emoji avatar (profiles.avatar_id); rendered when no url is set. */
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

  return (
    <Avatar className={cn("[container-type:inline-size]", className)}>
      {src ? (
        <AvatarImage src={src} alt={name} title={name} loading="lazy" />
      ) : null}
      <AvatarFallback className={fallbackClassName} style={presetStyle}>
        {isAvatarPreset(avatarId) ? avatarId : initials(name) || "U"}
      </AvatarFallback>
    </Avatar>
  );
}