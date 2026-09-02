import { InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Checkbox({ label, className, checked, ...props }: CheckboxProps) {
  return (
    <label
      className={cn(
        "flex items-center gap-2.5 cursor-pointer select-none py-1.5",
        className
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          checked
            ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))]"
            : "border-[hsl(var(--border))] bg-transparent"
        )}
      >
        {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
      </span>
      <input type="checkbox" className="hidden" checked={checked} {...props} />
      <span className="text-sm">{label}</span>
    </label>
  );
}
