"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-iris-gradient bg-[length:180%_180%] text-white shadow-[0_8px_24px_-10px_rgba(114,87,255,0.8)] hover:bg-[position:100%_50%] hover:shadow-[0_10px_30px_-8px_rgba(114,87,255,0.9)] active:scale-[0.985]",
  secondary:
    "bg-surface-overlay text-content border border-line-strong hover:bg-surface-raised hover:border-line-strong active:scale-[0.985]",
  outline:
    "bg-transparent text-content border border-line-strong hover:bg-white/5 active:scale-[0.985]",
  ghost: "bg-transparent text-content-muted hover:bg-white/5 hover:text-content",
  danger:
    "bg-danger/90 text-white hover:bg-danger active:scale-[0.985] shadow-[0_8px_24px_-12px_rgba(251,113,133,0.8)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[0.95rem] gap-2.5 rounded-xl",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading, icon, iconRight, children, disabled, ...props },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-all duration-200 outline-none",
        "focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
);
Button.displayName = "Button";
