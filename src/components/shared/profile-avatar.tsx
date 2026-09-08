"use client";

import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";

interface ProfileAvatarProps {
  name: string;
  /** Object path inside the public "avatars" bucket (profiles.avatar_url). */
  url?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function ProfileAvatar({
  name,
  url,
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

  return (
    <Avatar className={className}>
      {src ? (
        <AvatarImage src={src} alt={name} title={name} loading="lazy" />
      ) : null}
      <AvatarFallback className={fallbackClassName}>
        {initials(name) || "U"}
      </AvatarFallback>
    </Avatar>
  );
}