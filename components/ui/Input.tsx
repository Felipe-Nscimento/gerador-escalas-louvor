import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40",
        className
      )}
      {...props}
    />
  );
}
