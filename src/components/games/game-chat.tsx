"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ImagePlus, Loader2, MessageCircle, Pin, PinOff, Send, Smile, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";

type Message = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_username: string | null;
  body: string | null;
  image_url: string | null;
  is_pinned: boolean;
  created_at: string;
};

/* ── Emoji picker ─────────────────────────────────────────────────────────── */

const EMOJI_TABS: { icon: string; items: string[] }[] = [
  {
    icon: "😀",
    items: [
      "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥳","🤩","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😴","🤤","😪","😮","💨","😵","🤠","🥸","😷","🤒","🤕","🤢","🤮","🤧","😇","🥹","🤗"
    ],
  },
  {
    icon: "👍",
    items: [
      "👍","👎","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤝","👊","✊","🤛","🤜","💪","🦵","🦶","👂","👃","🧠","🦷","🦴","👀","👁️","👅","👄"
    ],
  },
  {
    icon: "❤️",
    items: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️","💯","💢","💥"
    ],
  },
  {
    icon: "⚽",
    items: [
      "⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥅","🏒","🏑","🥍","⛳","🏹","🎣","🥊","🥋","🎽","⛸️","🥌","🛹","🎿","⛷️","🏂","🏄","🏊","🚴","🚵","🤸","🤼","🤽","🤾","🤺","🏇","🧗","🏋️","🎖️","🏅","🥇","🥈","🥉","🏆","🏟️"
    ],
  },
  {
    icon: "🍔",
    items: [
      "🍔","🍕","🌭","🍟","🥪","🌮","🌯","🥗","🍿","🍩","🍪","🎂","🍰","🧁","🍫","🍬","🍭","🍦","🥤","☕","🍺","🍻","🥂","🍷","🍎","🍌","🍉","🍇","🥥","🍄"
    ],
  },
  {
    icon: "🎉",
    items: [
      "🎉","🎊","🎈","🎁","🎀","🎃","🪅","🎭","🎨","🎧","🎵","🎶","🎹","🎸","🥁","🎤","🎮","🕹️","🎲","♟️","🎯","🎳","🎰","🧩","🎠","🎢","⛱️","🌍"
    ],
  },
  {
    icon: "✨",
    items: [
      "✨","⭐","🌟","💫","⚡","🔥","💥","🌈","☀️","🌙","☁️","🌧️","⛈️","❄️","⛄","🌊","🍀","🌸","🌹","🌻","☘️","🪴","🌴","🌵","🦁","🐺","🦅","🦆","🐢","🦈","🐬"
    ],
  },
  {
    icon: "🏠",
    items: [
      "🏠","🏟️","🏫","🏥","🏪","🏢","️","🌆","🌃","🚗","🏎️","🚕","🚌","🚲","🏍️","🛵","✈️","🚀","🛸","⏰","📅","📌","📍","💰","💵","💳","📱","💻","📷","🔑","🧭","🗺️"
    ],
  },
];

function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [tab, setTab] = useState(0);
  const current = EMOJI_TABS[tab];
  return (
    <div className="border-t bg-muted/40 p-2" role="dialog" aria-label="Emoji">
      <div className="mb-2 flex gap-1 overflow-x-auto">
        {EMOJI_TABS.map((t, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            aria-label={t.icon}
            onClick={() => setTab(i)}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-lg transition ${
              i === tab ? "bg-accent" : "hover:bg-accent/60"
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>
      <div className="grid max-h-44 grid-cols-8 gap-0.5 overflow-y-auto">
        {current.items.map((e) => (
          <button
            key={e}
            type="button"
            tabIndex={-1}
            onClick={() => onPick(e)}
            className="grid aspect-square place-items-center rounded-md text-xl hover:bg-accent"
            dir="ltr"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Chat body ────────────────────────────────────────────────────────────── */

function ChatContent({
  gameId,
  memberId,
  isOrganizer,
}: {
  gameId: string;
  memberId: string;
  isOrganizer: boolean;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const [limit, setLimit] = useState(120);

  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sendError, setSendError] = useState("");
  const [uploading, setUploading] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const attempt = useRef<{ body: string; image: string | null; id: string } | null>(null);
  const busy = useRef(false);
  const nearBottom = useRef(true);
  const unread = useRef(0);

  const messages = useQuery({
    queryKey: ["game-chat", gameId, memberId, limit],
    queryFn: async () => {
      const { data, error } = await createClient().from("friendly_game_messages")
        .select("id,sender_id,sender_name,sender_username,body,image_url,is_pinned,created_at").eq("game_id", gameId)
        .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data as Message[]).reverse();
    },
    refetchInterval: 60000,
    gcTime: 0,
  });

  useEffect(() => {
    const client = createClient();
    const channel = client.channel(`game-chat-${gameId}-${memberId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "friendly_game_messages",
        filter: `game_id=eq.${gameId}`,
      }, () => {
        if (nearBottom.current) {
          void qc.invalidateQueries({ queryKey: ["game-chat", gameId, memberId] });
        } else {
          unread.current += 1;
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void qc.invalidateQueries({ queryKey: ["game-chat", gameId, memberId] });
        }
      });
    return () => { void client.removeChannel(channel); };
  }, [gameId, memberId, qc]);

  const all = messages.data ?? [];
  const pinned = all.find((m) => m.is_pinned);
  const lastId = all.at(-1)?.id;

  const scrollToBottom = (smooth = true) => {
    nearBottom.current = true;
    unread.current = 0;
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom || nearBottom.current) scrollToBottom(false);
  }, [lastId]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  const insertEmoji = (e: string) => {
    const el = taRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + e + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const pos = start + e.length;
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const send = useMutation({
    mutationFn: async ({ body, image, id }: { body: string; image: string | null; id: string }) => {
      const { error } = await createClient().rpc("send_game_message", {
        p_game_id: gameId,
        p_body: body,
        p_message_id: id,
        p_image_url: image,
      });
      if (error) throw error;
    },
  });

  const pin = useMutation({
    mutationFn: async ({ id, pinned: next }: { id: string; pinned: boolean }) => {
      const { error } = await createClient().rpc("pin_game_message", {
        p_message_id: id,
        p_pinned: next,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["game-chat", gameId, memberId] });
    },
  });

  const uploadThenSend = async (file: File) => {
    setUploading(true);
    setSendError("");
    try {
      const { data: { user } } = await createClient().auth.getUser();
      if (!user) throw new Error("not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `chat/${gameId}/${Date.now()}.${ext}`;
      const { error: upErr } = await createClient().storage
        .from("session-photos")
        .upload(path, file, { cacheControl: "3600", contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = createClient().storage.from("session-photos").getPublicUrl(path);
      const image = pub.publicUrl;
      const body = draft.trim();
      if (attempt.current?.id && attempt.current.body === body && attempt.current.image === image) {
        // fall through: retry the same payload
      } else {
        attempt.current = { body, image, id: crypto.randomUUID() };
      }
      busy.current = true;
      try {
        await send.mutateAsync(attempt.current!);
        setDraft("");
        attempt.current = null;
        scrollToBottom();
        await qc.invalidateQueries({ queryKey: ["game-chat", gameId, memberId] });
      } catch (error) {
        setSendError(errorMessage(error, ar ? "الصورة متبعتتش. حاول تاني." : "Photo not sent. Try again."));
      } finally {
        busy.current = false;
      }
    } catch {
      setSendError(ar ? "مفيش صورة حيتحمّل خالص. جرب تاني." : "The photo couldn't be uploaded. Try again.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = async () => {
    const body = draft.trim();
    if ((!body || busy.current) && !uploading) return;
    busy.current = true;
    setSendError("");
    if (attempt.current?.body !== body || attempt.current?.image !== null) {
      attempt.current = { body, image: null, id: crypto.randomUUID() };
    }
    try {
      await send.mutateAsync(attempt.current!);
      setDraft("");
      attempt.current = null;
      scrollToBottom();
      await qc.invalidateQueries({ queryKey: ["game-chat", gameId, memberId] });
    } catch (error) {
      setSendError(errorMessage(error, ar ? "الرسالة متبعتتش. حاول تاني." : "Message not sent. Try again."));
    } finally {
      busy.current = false;
    }
  };

  const day = useMemo(() => new Date(), []);
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const startOfDay = (dt: Date) => {
      const x = new Date(dt);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    if (d >= startOfDay(day)) return ar ? "اليوم" : "Today";
    const yesterday = new Date(startOfDay(day));
    yesterday.setDate(yesterday.getDate() - 1);
    if (d >= yesterday) return ar ? "إمبارح" : "Yesterday";
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
    if (d.getFullYear() !== day.getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString(ar ? "ar-EG" : "en-GB", opts);
  };
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(ar ? "ar-EG" : "en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  const avatarColor = (id: string) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return `hsl(${h} 55% 45%)`;
  };

  const renderList = () => {
    const items: React.ReactNode[] = [];
    let prevSender: string | null = null;
    let prevTime = 0;
    all.forEach((m, i) => {
      const time = new Date(m.created_at).getTime();
      const newDay = i === 0 || !sameDay(prevTime ? all[i - 1].created_at : null, m.created_at);
      const grouped =
        !newDay &&
        prevSender === m.sender_id &&
        time - prevTime < 6 * 60 * 1000;
      if (newDay) {
        items.push(
          <div key={`d-${m.id}`} className="flex justify-center py-2">
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {fmtDate(m.created_at)}
            </span>
          </div>,
        );
      }
      items.push(
        <MessageRow
          key={m.id}
          m={m}
          mine={m.sender_id === memberId}
          grouped={grouped}
          avatarColor={avatarColor(m.sender_id)}
          time={fmtTime(m.created_at)}
          ar={ar}
          onUnpin={isOrganizer && m.sender_id === memberId ? () => pin.mutate({ id: m.id, pinned: false }) : undefined}
        />,
      );
      prevSender = m.sender_id;
      prevTime = time;
    });
    return items;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Messages area */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          role="log"
          aria-label={ar ? "رسائل الجيم" : "Game messages"}
          className="absolute inset-0 space-y-0.5 overflow-y-auto px-3 py-3"
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (atBottom) {
              nearBottom.current = true;
              unread.current = 0;
            } else {
              nearBottom.current = false;
            }
          }}
        >
          {messages.isPending && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {ar ? "جاري تحميل الرسائل…" : "Loading messages…"}
            </p>
          )}
          {messages.isError && (
            <div role="alert" className="py-6 text-center text-sm text-error-ink">
              {ar ? "مش قادرين نحمل الشات." : "Could not load chat."}
              <Button variant="link" onClick={() => void messages.refetch()}>
                {ar ? "حاول تاني" : "Retry"}
              </Button>
            </div>
          )}
          {messages.data?.length === limit && (
            <div className="flex justify-center py-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  nearBottom.current = false;
                  setLimit((n) => n + 120);
                }}
              >
                {ar ? "رسائل أقدم" : "Older messages"}
              </Button>
            </div>
          )}
          {messages.data?.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {ar ? "لسه مفيش رسائل. ابدأ الكلام مع الفريق!" : "No messages yet. Start the conversation!"}
            </p>
          )}

          {pinned && (
            <div className="mb-2 rounded-lg border border-attention-300/60 bg-attention-50 p-2.5 dark:bg-attention-500/10">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1 text-[11px] font-semibold text-warning-ink dark:text-attention-300">
                  <Pin className="h-3 w-3" />
                  {ar ? "مثبّت" : "Pinned"}
                </p>
                {pinned.sender_id === memberId && (
                  <button
                    type="button"
                    aria-label={ar ? "إلغاء التثبيت" : "Unpin"}
                    className="text-muted-foreground hover:text-primary"
                    onClick={() => pin.mutate({ id: pinned.id, pinned: false })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {pinned.image_url && (
                <a href={pinned.image_url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pinned.image_url} alt={pinned.body ?? ""} className="max-h-40 w-full rounded-lg object-cover" />
                </a>
              )}
              {pinned.body && <p dir="auto" className="whitespace-pre-wrap break-words text-sm">{pinned.body}</p>}
            </div>
          )}

          {renderList()}
        </div>

        {!nearBottom.current && (
          <button
            type="button"
            aria-label={ar ? "الانتقال لأحدث الرسائل" : "Jump to latest"}
            onClick={() => scrollToBottom()}
            className="absolute bottom-3 end-3 z-10 grid h-10 w-10 place-items-center rounded-full border bg-background shadow-lg transition hover:bg-accent"
          >
            <ChevronDown className="h-5 w-5" />
            {unread.current > 0 && (
              <span className="absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unread.current}
              </span>
            )}
          </button>
        )}
      </div>

      {emojiOpen && <EmojiPicker onPick={insertEmoji} />}

      <form
        className="space-y-2 border-t bg-background p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Textarea
          ref={taRef}
          dir="auto"
          rows={1}
          aria-label={ar ? "رسالتك" : "Your message"}
          placeholder={ar ? "اكتب رسالة للمشاركين…" : "Write to the participants…"}
          maxLength={2000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !send.isPending) {
              e.preventDefault();
              void submit();
            }
          }}
          className="max-h-32 min-h-0 resize-none"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label={ar ? "إيموجي" : "Emoji"}
              onClick={() => setEmojiOpen((v) => !v)}
            >
              <Smile className="h-5 w-5" />
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadThenSend(f);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label={ar ? "أرفق صورة" : "Attach a photo"}
              disabled={uploading || send.isPending}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            </Button>
            <span className="ms-1 text-xs text-muted-foreground">{draft.length}/2000</span>
          </div>
          <Button type="submit" disabled={(!draft.trim() && !uploading) || send.isPending}>
            <Send className="h-4 w-4" />
            {send.isPending ? (ar ? "جاري الإرسال…" : "Sending…") : (ar ? "إرسال" : "Send")}
            <span className="sr-only">{ar ? "إرسال" : "Send"}</span>
          </Button>
        </div>
        {sendError && <p role="alert" className="text-sm text-error-ink">{sendError}</p>}
      </form>
    </div>
  );
}

function sameDay(a: string | null, b: string) {
  if (!a) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function MessageRow({
  m,
  mine,
  grouped,
  avatarColor,
  time,
  ar,
  onUnpin,
}: {
  m: Message;
  mine: boolean;
  grouped: boolean;
  avatarColor: string;
  time: string;
  ar: boolean;
  onUnpin?: () => void;
}) {
  const initials = (m.sender_name || "?").trim().slice(0, 2);
  return (
    <div className={`flex w-full gap-2 ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-1.5"}`}>
      {!mine && (
        <div
          className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: avatarColor }}
          aria-hidden="true"
          dir="ltr"
        >
          {initials}
        </div>
      )}
      <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {!grouped && !mine && (
          <p className="mb-0.5 ps-1 text-xs font-semibold text-foreground">
            {m.sender_name}
            {m.sender_username && (
              <span className="ms-1 font-normal text-muted-foreground">@{m.sender_username}</span>
            )}
          </p>
        )}
        {!grouped && mine && (
          <p className="mb-0.5 pe-1 text-[11px] text-muted-foreground">{ar ? "أنت" : "You"}</p>
        )}
        <button
          type="button"
          onClick={() => {
            if (m.image_url) window.open(m.image_url, "_blank", "noopener,noreferrer");
          }}
          className={`max-w-full rounded-2xl px-3 py-2 text-start text-sm shadow-sm ${
            mine
              ? "bg-[hsl(var(--accent))] text-emerald-950 dark:bg-[hsl(var(--playza-navy))] dark:text-white"
              : "border bg-card text-card-foreground"
          }`}
        >
          {m.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.image_url}
              alt={m.body ?? ""}
              className="mb-1 max-h-56 w-full min-w-40 rounded-lg object-cover"
            />
          )}
          {m.body && <p dir="auto" className="whitespace-pre-wrap break-words">{m.body}</p>}
          <span
            className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${
              mine ? "text-emerald-800/70 dark:text-white/60" : "text-muted-foreground"
            }`}
            dir="ltr"
          >
            {time}
          </span>
        </button>
        {onUnpin && (
          <button
            type="button"
            aria-label={ar ? "إلغاء التثبيت" : "Unpin"}
            className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
            onClick={onUnpin}
          >
            <PinOff className="h-3 w-3" />
            {ar ? "مثبّت — إلغاء" : "Pinned — unpin"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Wrapper ──────────────────────────────────────────────────────────────── */

export function GameChat({ gameId, gameTitle, memberId, isOrganizer = false }: { gameId: string; gameTitle: string; memberId: string; isOrganizer?: boolean }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const ar = lang === "ar";
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <MessageCircle className="h-4 w-4" />
        {ar ? "شات الجيم" : "Game chat"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[88dvh] max-h-[88dvh] flex-col overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="flex items-center gap-2 truncate">
              <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{gameTitle}</span>
            </DialogTitle>
            <DialogDescription>
              {ar ? "الشات للمشاركين في الجيم بس." : "Only current game participants can access this chat."}
            </DialogDescription>
          </DialogHeader>
          {open && <ChatContent gameId={gameId} memberId={memberId} isOrganizer={isOrganizer} />}
        </DialogContent>
      </Dialog>
    </>
  );
}