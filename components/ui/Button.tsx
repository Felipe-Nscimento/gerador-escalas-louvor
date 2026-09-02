import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none",
          variant === "primary" &&
            "bg-[hsl(var(--primary))] text-white hover:opacity-90 shadow-sm",
          variant === "secondary" &&
            "bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--border))]/40",
          variant === "ghost" && "hover:bg-[hsl(var(--border))]/40",
          variant === "danger" && "bg-red-500 text-white hover:bg-red-600",
          size === "sm" && "px-3 py-1.5 text-sm",
          size === "md" && "px-4 py-2.5 text-sm",
          size === "lg" && "px-6 py-3.5 text-base",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
