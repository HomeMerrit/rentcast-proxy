"use client";
import { useState, useEffect, useCallback } from "react";
import { Bell, X, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import type { AgentComm } from "@/types/agent";
import { AgentAvatar } from "./AgentAvatar";

export default function HumanInbox() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AgentComm[]>([]);
  const [unread, setUnread] = useState(0);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});

  const fetchInbox = useCallback(async () => {
    const [msgs, count] = await Promise.all([
      api.comms.humanInbox().catch(() => [] as AgentComm[]),
      api.comms.unreadCount().catch(() => ({ unread: 0 })),
    ]);
    setMessages(msgs);
    setUnread(count.unread);
  }, []);

  // Poll every 30 seconds
  useEffect(() => {
    fetchInbox();
    const interval = setInterval(fetchInbox, 30_000);
    return () => clearInterval(interval);
  }, [fetchInbox]);

  const handleReply = async (comm: AgentComm) => {
    const message = replies[comm.id]?.trim();
    if (!message) return;
    setSending((s) => ({ ...s, [comm.id]: true }));
    await api.comms.reply(comm.id, message).catch(() => null);
    setReplies((r) => ({ ...r, [comm.id]: "" }));
    setSending((s) => ({ ...s, [comm.id]: false }));
    await fetchInbox();
  };

  const handleMarkRead = async (commId: string) => {
    await api.comms.markRead(commId).catch(() => null);
    setMessages((prev) =>
      prev.map((m) => (m.id === commId ? { ...m, read: true } : m))
    );
    setUnread((n) => Math.max(0, n - 1));
  };

  return (
    <>
      {/* Bell button */}
      <button
        onClick={() => setOpen(true)}
        className="relative rounded-full p-2 transition-colors hover:bg-content/5"
        title="Agent messages"
      >
        <Bell className="h-5 w-5 text-content-subtle" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-iris-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-content/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform border-l border-line bg-surface shadow-raised transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-content">
              Agent messages
              {unread > 0 && (
                <span className="rounded-full bg-iris-soft px-2 py-0.5 text-xs font-medium text-iris-600">
                  {unread} unread
                </span>
              )}
            </h2>
            <button
              onClick={() => setOpen(false)}
              className="text-content-subtle transition-colors hover:text-content"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-content-muted">
                <MessageSquare className="mb-2 h-10 w-10 opacity-30" />
                <p className="text-sm">No messages from agents</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    msg.read
                      ? "border-line bg-surface-inset/50"
                      : "border-iris-200 bg-iris-50"
                  }`}
                >
                  {/* Sender */}
                  <div className="mb-2 flex items-center gap-2">
                    {msg.from_agent_name ? (
                      <>
                        <AgentAvatar
                          seed={msg.from_agent_name}
                          name={msg.from_agent_name}
                          status="idle"
                          size={32}
                        />
                        <span className="text-sm font-medium text-content">
                          {msg.from_agent_name}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-medium text-content-subtle">Human reply</span>
                    )}
                    <span className="ml-auto text-xs text-content-muted">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {!msg.read && msg.message_type === "human_message" && (
                      <button
                        onClick={() => handleMarkRead(msg.id)}
                        className="text-xs text-iris-500 hover:text-iris-600"
                      >
                        Mark read
                      </button>
                    )}
                  </div>

                  {/* Message */}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-content">
                    {msg.message}
                  </p>

                  {/* Reply form (only for human_message type) */}
                  {msg.message_type === "human_message" && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        rows={2}
                        placeholder="Reply to this agent…"
                        className="w-full resize-none rounded-lg border border-line bg-surface-inset px-3 py-2 text-sm text-content placeholder:text-content-subtle outline-none focus:border-iris-400/60"
                        value={replies[msg.id] ?? ""}
                        onChange={(e) =>
                          setReplies((r) => ({ ...r, [msg.id]: e.target.value }))
                        }
                      />
                      <button
                        onClick={() => handleReply(msg)}
                        disabled={!replies[msg.id]?.trim() || sending[msg.id]}
                        className="w-full rounded-lg bg-iris-gradient py-1.5 text-sm font-medium text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sending[msg.id] ? "Sending…" : "Reply"}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
