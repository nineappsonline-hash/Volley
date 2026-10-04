"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { academyShareLink, academyShareText, programShareLink } from "@/lib/academy-share";
import { errorMessage } from "@/lib/utils";

type ShareTarget = {
  /** Absolute URL. Already absolute so pasted links work outside the app. */
  url: string;
  title: string;
  text: string;
};

/**
 * Shares an academy, or one of its plans, using the OS share sheet and falling
 * back to WhatsApp. Copying is offered as a separate action because the share
 * sheet is unavailable on desktop browsers.
 */
export function ShareMenu({
  target,
  label,
  trigger,
  align = "end",
  variant = "outline",
  size = "sm",
  className,
}: {
  target: ShareTarget;
  label: string;
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: target.title, text: target.text, url: target.url });
        return;
      } catch (error) {
        // A dismissed share sheet should not trigger the fallback, but a real
        // failure should, so only an explicit abort stops here.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const wa = `https://wa.me/?text=${encodeURIComponent(`${target.text}\n${target.url}`)}`;
    window.open(wa, "_blank", "noopener,noreferrer");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(target.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("academy_share_copied"));
    } catch (error) {
      toast.error(errorMessage(error, t("common_error")));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button variant={variant} size={size} className={className}>
            <Share2 className="me-1.5 h-3.5 w-3.5" />
            {label}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuItem onSelect={() => void share()}>
          <Share2 className="h-4 w-4" />
          {t("academy_share")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copy()}>
          {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {copied ? t("academy_share_copied") : t("academy_share_copy")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Icon-only share affordance for dense rows and card headers. */
export function ShareIconButton({
  target,
  label,
}: {
  target: ShareTarget;
  label: string;
}) {
  return (
    <ShareMenu
      target={target}
      label={label}
      trigger={
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={label} title={label}>
          <Share2 className="h-4 w-4" />
        </Button>
      }
    />
  );
}

export type { ShareTarget };

/** Builds the share payload for an academy page. */
export function academyShareTarget(
  academy: { name: string; slug: string; area?: string | null; governorate?: string | null },
  program?: { id: string; name: string } | null
): ShareTarget {
  return {
    url: program ? programShareLink(academy.slug, program.id) : academyShareLink(academy.slug),
    title: academy.name,
    text: academyShareText(academy, program),
  };
}

export type AcademyShareButtonProps = {
  academy: { name: string; slug: string; area?: string | null; governorate?: string | null };
  program?: { id: string; name: string } | null;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  align?: "start" | "center" | "end";
};

/** Convenience wrapper: renders the share menu for an academy or a plan. */
export function AcademyShareButton({
  academy,
  program,
  variant,
  size,
  className,
  align,
}: AcademyShareButtonProps) {
  const { t } = useI18n();
  const target = academyShareTarget(academy, program);
  const label = program
    ? t("academy_share_program")
    : t("academy_share_title").replace("{name}", academy.name);
  return (
    <ShareMenu
      target={target}
      label={label}
      variant={variant}
      size={size}
      className={className}
      align={align}
    />
  );
}