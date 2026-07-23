"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/messages";

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function MessengerChat({
  meId,
  partnerId,
  initialMessages,
}: {
  meId: number;
  partnerId: number;
  initialMessages: ChatMessage[];
}) {
  const streamRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages, partnerId]);

  useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight });
  }, [messages]);

  function lastId() {
    return messages.length ? messages[messages.length - 1]!.id : 0;
  }

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(
          `/api/chat?with=${partnerId}&after=${lastId()}`,
        );
        const data = await res.json();
        if (!data.ok || !Array.isArray(data.messages) || !data.messages.length) return;
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const next = [...prev];
          for (const m of data.messages as ChatMessage[]) {
            if (!ids.has(m.id)) next.push(m);
          }
          return next;
        });
      } catch {
        /* ignore */
      }
    }
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId, messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: partnerId, body: text }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.message) {
        setError(data.error || "Could not send message.");
        return;
      }
      setMessages((prev) => [...prev, data.message]);
      setBody("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && (
        <div className="flash flash-error" style={{ margin: "0.75rem 1rem" }}>
          {error}
        </div>
      )}
      <div className="chat-stream" ref={streamRef}>
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={`chat-bubble ${mine ? "mine" : "theirs"}`} data-id={m.id}>
              <div className="chat-text" style={{ whiteSpace: "pre-wrap" }}>
                {m.body}
              </div>
              <div className="chat-time">{formatTime(m.created_at)}</div>
            </div>
          );
        })}
      </div>
      <form className="chat-composer" onSubmit={send}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          maxLength={2000}
          placeholder="Type a message…"
          rows={1}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button className="btn btn-amber" type="submit" disabled={busy}>
          Send
        </button>
      </form>
    </>
  );
}
