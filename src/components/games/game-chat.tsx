"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, MessageCircle, Pin, PinOff, Send } from "lucide-react";
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
  const [limit, setLimit] = useState(100);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const attempt = useRef<{ body: string; image: string | null; id: string } | null>(null);
  const busy = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const messages = useQuery({
    queryKey: ["game-chat", gameId, memberId, limit],
    queryFn: async () => {
      const { data, error } = await createClient().from("friendly_game_messages")
        .select("id,sender_id,sender_name,sender_username,body,image_url,is_pinned,created_at").eq("game_id", gameId)
        .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data as Message[]).reverse();
    },
    refetchInterval: 15000,
    gcTime: 0,
  });
  useEffect(() => {
    const client = createClient();
    const channel = client.channel(`game-chat-${gameId}-${memberId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "friendly_game_messages", filter: `game_id=eq.${gameId}` }, () => {
        void qc.invalidateQueries({ queryKey: ["game-chat", gameId, memberId] });
      }).subscribe(status => {
        if (status === "SUBSCRIBED") void qc.invalidateQueries({ queryKey: ["game-chat", gameId, memberId] });
      });
    return () => { void client.removeChannel(channel); };
  }, [gameId, memberId, qc]);
  const all = messages.data ?? [];
  const pinned = all.filter((m) => m.is_pinned).at(-1);
  const lastId = all.at(-1)?.id;
  useEffect(() => {
    if (nearBottom.current) bottom.current?.scrollIntoView({ block: "end" });
  }, [lastId]);
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
        nearBottom.current = true;
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
      nearBottom.current = true;
      await qc.invalidateQueries({ queryKey: ["game-chat", gameId, memberId] });
    } catch (error) {
      setSendError(errorMessage(error, ar ? "الرسالة متبعتتش. حاول تاني." : "Message not sent. Try again."));
    } finally { busy.current = false; }
  };
  const renderMessage = (message: Message) => (
    <div key={message.id} className={`max-w-[90%] rounded-lg p-3 ${message.sender_id === memberId ? "ms-auto bg-info/10" : "me-auto bg-muted"}`}>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1 font-semibold text-foreground">
          {message.is_pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
          {message.sender_id === memberId ? (ar ? "أنت" : "You") : message.sender_name}
          {message.sender_id !== memberId && message.sender_username && <span className="ms-1 font-normal text-muted-foreground">@{message.sender_username}</span>}
        </span>
        <span className="flex items-center gap-2">
          {isOrganizer && message.sender_id === memberId && (
            <button
              type="button"
              aria-label={message.is_pinned ? (ar ? "إلغاء التثبيت" : "Unpin") : (ar ? "تثبيت" : "Pin")}
              className={message.is_pinned ? "text-primary" : "text-muted-foreground hover:text-primary"}
              onClick={() => pin.mutate({ id: message.id, pinned: !message.is_pinned })}
            >
              {message.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            </button>
          )}
          <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(ar ? "ar-EG" : "en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
        </span>
      </div>
      {message.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={message.image_url} alt={message.body ?? ""} className="mt-2 max-h-64 w-full rounded-lg object-cover" />
      )}
      {message.body && <p dir="auto" className="mt-1 whitespace-pre-wrap break-words text-sm">{message.body}</p>}
    </div>
  );
  return <>
    <div className="h-[45vh] min-h-48 overflow-y-auto rounded-lg border p-3 space-y-3" role="log" aria-label={ar ? "رسائل الجيم" : "Game messages"}
      onScroll={e => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      {messages.isPending && <p className="text-sm text-muted-foreground">{ar ? "جاري تحميل الرسائل…" : "Loading messages…"}</p>}
      {messages.isError && <div role="alert" className="text-sm text-error-ink">{ar ? "مش قادرين نحمل الشات." : "Could not load chat."}<Button variant="link" onClick={() => void messages.refetch()}>{ar ? "حاول تاني" : "Retry"}</Button></div>}
      {messages.data?.length === limit && <Button variant="ghost" size="sm" onClick={() => { nearBottom.current = false; setLimit(n => n + 100); }}>{ar ? "رسائل أقدم" : "Older messages"}</Button>}
      {messages.data?.length === 0 && <p className="text-sm text-muted-foreground">{ar ? "لسه مفيش رسائل. ابدأ الكلام مع الفريق!" : "No messages yet. Start the conversation!"}</p>}
      {pinned && (
        <div className="rounded-lg border border-attention-300/60 bg-attention-50 p-3 dark:bg-attention-500/10">
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-warning-ink dark:text-attention-300">
            <Pin className="h-3 w-3" />
            {ar ? "مثبّت" : "Pinned"}
          </p>
          {pinned.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pinned.image_url} alt={pinned.body ?? ""} className="max-h-40 w-full rounded-lg object-cover" />
          )}
          {pinned.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{pinned.body}</p>}
        </div>
      )}
      {all.map(renderMessage)}
      <div ref={bottom} />
    </div>
    <form className="space-y-2" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <Textarea dir="auto" aria-label={ar ? "رسالتك" : "Your message"} placeholder={ar ? "اكتب رسالة للمشاركين…" : "Write to the participants…"}
        maxLength={2000} value={draft} onChange={e => setDraft(e.target.value)} disabled={send.isPending} />
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadThenSend(f); }}
          />
          <Button type="button" variant="ghost" size="sm" aria-label={ar ? "أرفق صورة" : "Attach a photo"} disabled={uploading || send.isPending} onClick={() => fileInput.current?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </Button>
          {draft.length}/2000
        </span>
        <Button type="submit" disabled={(!draft.trim() && !uploading) || send.isPending}><Send className="h-4 w-4" />{send.isPending ? (ar ? "جاري الإرسال…" : "Sending…") : (ar ? "إرسال" : "Send")}</Button>
      </div>
      {sendError && <p role="alert" className="text-sm text-error-ink">{sendError}</p>}
    </form>
  </>;
}

export function GameChat({ gameId, gameTitle, memberId, isOrganizer = false }: { gameId: string; gameTitle: string; memberId: string; isOrganizer?: boolean }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const ar = lang === "ar";
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}><MessageCircle className="h-4 w-4" />{ar ? "شات الجيم" : "Game chat"}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-xl max-h-[95dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{gameTitle}</DialogTitle><DialogDescription>{ar ? "الشات للمشاركين في الجيم بس." : "Only current game participants can access this chat."}</DialogDescription></DialogHeader>
      {open && <ChatContent gameId={gameId} memberId={memberId} isOrganizer={isOrganizer} />}
    </DialogContent></Dialog>
  </>;
}