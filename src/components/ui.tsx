import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export function Card({
  children,
  className,
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <div className={cn("glass rounded-[1.25rem]", pad && "p-5", className)}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wide text-faint">
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {accent && (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: accent }}
          />
        )}
        <SectionLabel>{label}</SectionLabel>
      </div>
      <div className="text-2xl font-semibold tabular-nums text-text">{value}</div>
      {sub && <div className="text-sm text-muted">{sub}</div>}
    </Card>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            value === o.value
              ? "bg-surface text-text shadow-sm"
              : "text-muted hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-border",
        disabled && "opacity-40",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "accent";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-2 text-muted",
    good: "bg-[color-mix(in_srgb,var(--c-good)_15%,transparent)] text-[var(--c-good)]",
    warn: "bg-[color-mix(in_srgb,var(--c-warn)_15%,transparent)] text-[var(--c-warn)]",
    accent: "bg-accent-soft text-accent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent",
        className,
      )}
    />
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon && <div className="text-faint">{icon}</div>}
      <div className="font-medium text-text">{title}</div>
      {hint && <div className="max-w-xs text-sm text-muted">{hint}</div>}
    </div>
  );
}
