"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const baseField =
  "w-full rounded-xl bg-surface-inset border border-line px-3.5 text-sm text-content placeholder:text-content-subtle " +
  "transition-all duration-200 outline-none focus:border-iris-400/60 focus:shadow-[0_0_0_3px_rgba(114,87,255,0.16)] " +
  "disabled:opacity-50 disabled:pointer-events-none";

export function Label({
  children,
  htmlFor,
  hint,
  required,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 flex items-baseline justify-between", className)}>
      <span className="text-sm font-medium text-content">
        {children}
        {required && <span className="ml-0.5 text-iris-400">*</span>}
      </span>
      {hint && <span className="text-2xs text-content-subtle">{hint}</span>}
    </label>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(baseField, "h-11", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(baseField, "py-2.5 min-h-[96px] resize-y leading-relaxed", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(baseField, "h-11 appearance-none pr-9 cursor-pointer", className)}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
  </div>
));
Select.displayName = "Select";

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <Label htmlFor={htmlFor} hint={hint} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error && <p className="mt-1.5 text-2xs text-danger">{error}</p>}
    </div>
  );
}
