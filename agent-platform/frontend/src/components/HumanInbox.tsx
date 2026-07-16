"use client";
import { useState, useEffect, useCallback } from "react";
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
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Agent messages"
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform bg-white dark:bg-gray-900 shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Agent Messages
              {unread > 0 && (
                <span className="ml-2 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                  {unread} unread
                </span>
              )}
            </h2>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <svg className="w-10 h-10 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm">No messages from agents</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    msg.read
                      ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50"
                      : "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30"
                  }`}
                >
                  {/* Sender */}
                  <div className="flex items-center gap-2 mb-2">
                    {msg.from_agent_name ? (
                      <>
                        <AgentAvatar
                          seed={msg.from_agent_name}
                          name={msg.from_agent_name}
                          status="idle"
                          size={32}
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {msg.from_agent_name}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-medium text-gray-500">Human Reply</span>
                    )}
                    <span className="ml-auto text-xs text-gray-400">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {!msg.read && msg.message_type === "human_message" && (
                      <button
                        onClick={() => handleMarkRead(msg.id)}
                        className="text-xs text-indigo-500 hover:text-indigo-700"
                      >
                        Mark read
                      </button>
                    )}
                  </div>

                  {/* Message */}
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {msg.message}
                  </p>

                  {/* Reply form (only for human_message type) */}
                  {msg.message_type === "human_message" && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        rows={2}
                        placeholder="Reply to this agent..."
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={replies[msg.id] ?? ""}
                        onChange={(e) =>
                          setReplies((r) => ({ ...r, [msg.id]: e.target.value }))
                        }
                      />
                      <button
                        onClick={() => handleReply(msg)}
                        disabled={!replies[msg.id]?.trim() || sending[msg.id]}
                        className="w-full rounded-lg bg-indigo-600 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {sending[msg.id] ? "Sending..." : "Reply"}
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
