"use client";

import type { ReactNode } from "react";
import { CloseIcon } from "@/components/icons";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-xl bg-ink-850 p-1 ring-1 ring-ink-700/70"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cx(
            "flex-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
            value === option.value
              ? "bg-white text-ink-950 shadow-sm"
              : "text-ink-300 hover:bg-ink-800 hover:text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  hint?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-ink-300">{label}</span>
        <span className="text-xs tabular-nums text-ink-400">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
      {hint ? <span className="block text-[11px] text-ink-500">{hint}</span> : null}
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className={cx("flex items-start gap-3", disabled && "opacity-50")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "mt-0.5 h-5 w-9 shrink-0 rounded-full p-0.5 transition",
          checked ? "bg-accent" : "bg-ink-700",
          !disabled && "hover:brightness-110",
        )}
      >
        <span
          className={cx(
            "block h-4 w-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
      <div className="min-w-0">
        <div className="text-xs font-medium text-ink-200">{label}</div>
        {hint ? (
          <div className="text-[11px] leading-snug text-ink-500">{hint}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Deliberately not a <label>: these wrap button groups and selects, and a
 * <label> around a labelable element steals its accessible name (the first
 * option ends up called "Countdown" instead of "Off"). The controls inside
 * carry their own aria-label.
 */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1 block text-xs font-medium text-ink-300">
        {label}
      </span>
      {children}
    </div>
  );
}

export function Select({
  value,
  onChange,
  children,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  ariaLabel: string;
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2 text-xs text-ink-100 outline-none focus:border-ink-500"
    >
      {children}
    </select>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
      {children}
    </h3>
  );
}

export function PanelHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={`Close ${title}`}
        className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-white"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warn";
}) {
  const tones = {
    neutral: "bg-ink-800 text-ink-300 ring-ink-700",
    accent: "bg-accent/15 text-accent-soft ring-accent/30",
    warn: "bg-amber-400/15 text-amber-200 ring-amber-400/30",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
