"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";

type Message = { id: string; sender_id: string; sender_name: string; body: string; created_at: string };

function ChatContent({ gameId, memberId }: { gameId: string; memberId: string }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const [limit, setLimit] = useState(100);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const attempt = useRef<{ body: string; id: string } | null>(null);
  const busy = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const messages = useQuery({
    queryKey: ["game-chat", gameId, memberId, limit],
    queryFn: async () => {
      const { data, error } = await createClient().from("friendly_game_messages")
        .select("id,sender_id,sender_name,body,created_at").eq("game_id", gameId)
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
  const lastId = messages.data?.at(-1)?.id;
  useEffect(() => {
    if (nearBottom.current) bottom.current?.scrollIntoView({ block: "end" });
  }, [lastId]);
  const send = useMutation({
    mutationFn: async ({ body, id }: { body: string; id: string }) => {
      const { error } = await createClient().rpc("send_game_message", { p_game_id: gameId, p_body: body, p_message_id: id });
      if (error) throw error;
    },
  });
  const submit = async () => {
    const body = draft.trim();
    if (!body || busy.current) return;
    busy.current = true;
    setSendError("");
    if (attempt.current?.body !== body) attempt.current = { body, id: crypto.randomUUID() };
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
  return <>
    <div className="h-[45vh] min-h-48 overflow-y-auto rounded-lg border p-3 space-y-3" role="log" aria-label={ar ? "رسائل الجيم" : "Game messages"}
      onScroll={e => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      {messages.isPending && <p className="text-sm text-muted-foreground">{ar ? "جاري تحميل الرسائل…" : "Loading messages…"}</p>}
      {messages.isError && <div role="alert" className="text-sm text-error-ink">{ar ? "مش قادرين نحمل الشات." : "Could not load chat."}<Button variant="link" onClick={() => void messages.refetch()}>{ar ? "حاول تاني" : "Retry"}</Button></div>}
      {messages.data?.length === limit && <Button variant="ghost" size="sm" onClick={() => { nearBottom.current = false; setLimit(n => n + 100); }}>{ar ? "رسائل أقدم" : "Older messages"}</Button>}
      {messages.data?.length === 0 && <p className="text-sm text-muted-foreground">{ar ? "لسه مفيش رسائل. ابدأ الكلام مع الفريق!" : "No messages yet. Start the conversation!"}</p>}
      {messages.data?.map(message => <div key={message.id} className={`max-w-[90%] rounded-lg p-3 ${message.sender_id === memberId ? "ms-auto bg-info/10" : "me-auto bg-muted"}`}>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{message.sender_id === memberId ? (ar ? "أنت" : "You") : message.sender_name}</span>
          <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(ar ? "ar-EG" : "en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
        </div>
        <p dir="auto" className="mt-1 whitespace-pre-wrap break-words text-sm">{message.body}</p>
      </div>)}
      <div ref={bottom} />
    </div>
    <form className="space-y-2" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <Textarea dir="auto" aria-label={ar ? "رسالتك" : "Your message"} placeholder={ar ? "اكتب رسالة للمشاركين…" : "Write to the participants…"}
        maxLength={2000} value={draft} onChange={e => setDraft(e.target.value)} disabled={send.isPending} />
      <div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{draft.length}/2000</span>
        <Button type="submit" disabled={!draft.trim() || send.isPending}><Send className="h-4 w-4" />{send.isPending ? (ar ? "جاري الإرسال…" : "Sending…") : (ar ? "إرسال" : "Send")}</Button>
      </div>
      {sendError && <p role="alert" className="text-sm text-error-ink">{sendError}</p>}
    </form>
  </>;
}

export function GameChat({ gameId, gameTitle, memberId }: { gameId: string; gameTitle: string; memberId: string }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const ar = lang === "ar";
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}><MessageCircle className="h-4 w-4" />{ar ? "شات الجيم" : "Game chat"}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-xl max-h-[95dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{gameTitle}</DialogTitle><DialogDescription>{ar ? "الشات للمشاركين في الجيم بس." : "Only current game participants can access this chat."}</DialogDescription></DialogHeader>
      {open && <ChatContent gameId={gameId} memberId={memberId} />}
    </DialogContent></Dialog>
  </>;
}
