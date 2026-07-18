"use client";
import { useRef, useState } from "react";
import { Upload, Shuffle, User, X } from "lucide-react";
import { avatarUrl } from "@/lib/utils";
import { downscaleImage } from "@/lib/image";
import { cn } from "@/lib/utils";

export interface AvatarValue {
  avatar_seed: string;
  avatar_url: string | null;
}

const STYLES = ["personas", "bottts-neutral", "notionists", "shapes", "glass"];

export function AvatarPicker({
  value,
  onChange,
  status = "idle",
}: {
  value: AvatarValue;
  onChange: (v: AvatarValue) => void;
  status?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [styleIdx, setStyleIdx] = useState(0);

  const preview =
    value.avatar_url ||
    `https://api.dicebear.com/9.x/${STYLES[styleIdx]}/svg?seed=${encodeURIComponent(
      value.avatar_seed
    )}&backgroundColor=5A97D6,4FB0AA,E6AE3C,E08A5B,E06A9A,ED7150`;

  const shuffle = () => {
    const seed = Math.random().toString(36).slice(2, 10);
    setStyleIdx((i) => (i + 1) % STYLES.length);
    onChange({ avatar_seed: seed, avatar_url: null });
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await downscaleImage(file);
      onChange({ ...value, avatar_url: url });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div
          className={cn(
            "relative h-28 w-28 overflow-hidden rounded-3xl border border-line-strong bg-surface-inset",
            "shadow-[0_0_0_4px_rgba(237,113,80,0.10),0_18px_40px_-18px_rgba(237,113,80,0.6)]"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Agent avatar" className="h-full w-full object-cover" />
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-canvas/60 backdrop-blur-sm">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-content/15 border-t-iris-400" />
            </div>
          )}
        </div>
        {/* status ring */}
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-canvas bg-surface-overlay">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              status === "active"
                ? "bg-positive"
                : status === "thinking"
                ? "bg-warning"
                : status === "error"
                ? "bg-danger"
                : "bg-content-subtle"
            )}
          />
        </span>
        {value.avatar_url && (
          <button
            type="button"
            onClick={() => onChange({ ...value, avatar_url: null })}
            className="absolute -left-1 -top-1 grid h-6 w-6 place-items-center rounded-full border border-line bg-surface-overlay text-content-muted hover:text-content"
            title="Remove photo"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-overlay px-3 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-raised"
        >
          <Upload className="h-3.5 w-3.5" /> Upload photo
        </button>
        <button
          type="button"
          onClick={shuffle}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-content/[0.04] px-3 py-1.5 text-xs font-medium text-content-muted transition-colors hover:text-content"
        >
          <Shuffle className="h-3.5 w-3.5" /> Generate
        </button>
      </div>
      <p className="flex items-center gap-1 text-2xs text-content-subtle">
        <User className="h-3 w-3" /> Upload a headshot or generate a unique avatar
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />
    </div>
  );
}

export { avatarUrl };
