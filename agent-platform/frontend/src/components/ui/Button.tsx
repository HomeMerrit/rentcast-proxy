"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-iris-500 text-white hover:bg-iris-600 hover:-translate-y-0.5 hover:shadow-offset active:translate-y-0 active:shadow-none",
  secondary:
    "bg-surface text-content border border-line-strong hover:-translate-y-0.5 hover:shadow-offset-iris active:translate-y-0 active:shadow-none",
  outline:
    "bg-transparent text-content border border-line-strong hover:bg-surface hover:-translate-y-0.5 hover:shadow-offset-iris active:translate-y-0 active:shadow-none",
  ghost: "bg-transparent text-content-muted hover:bg-content/5 hover:text-content",
  danger:
    "bg-danger text-white hover:-translate-y-0.5 hover:shadow-offset active:translate-y-0 active:shadow-none",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs gap-1.5 rounded-full",
  md: "h-10 px-5 text-sm gap-2 rounded-full",
  lg: "h-12 px-7 text-[0.95rem] gap-2.5 rounded-full",
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
