"use client";

import { useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { CloseIcon } from "@/components/icons";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------- button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet";
type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-ink-100 text-ink-950 hover:bg-white active:bg-ink-200 shadow-lift",
  secondary:
    "bg-ink-800 text-ink-200 ring-1 ring-ink-700 hover:bg-ink-700 hover:text-white",
  ghost: "text-ink-400 hover:bg-ink-800 hover:text-white",
  quiet: "text-ink-400 hover:text-ink-200 underline decoration-ink-600 decoration-1 underline-offset-4",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
};

export function Button({
  children,
  onClick,
  variant = "secondary",
  size = "sm",
  disabled,
  full,
  title,
  ariaLabel,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  full?: boolean;
  title?: string;
  ariaLabel?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={cx(
        "inline-flex shrink-0 items-center justify-center font-medium transition-colors duration-150",
        SIZES[size],
        disabled
          ? "cursor-not-allowed bg-ink-850 text-ink-600 ring-1 ring-ink-800"
          : VARIANTS[variant],
        full && "w-full",
      )}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- segmented */

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
      className="flex gap-0.5 rounded-xl bg-ink-900 p-1 ring-1 ring-inset ring-ink-800"
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cx(
              "flex-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
              active
                ? "bg-ink-700 text-white shadow-lift ring-1 ring-ink-600"
                : "text-ink-400 hover:text-ink-200",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ slider */

export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
  hint,
  display,
  progress,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  hint?: ReactNode;
  /** Overrides the printed value, for units that aren't the raw number. */
  display?: string;
  /** Colour of the filled portion; defaults to neutral. */
  progress?: string;
}) {
  const fill = ((value - min) / Math.max(1, max - min)) * 100;
  const style = {
    "--range-fill": `${Math.min(100, Math.max(0, fill))}%`,
    ...(progress ? { "--range-progress": progress } : {}),
  } as CSSProperties;

  return (
    <div>
      <label className="block">
        <span className="mb-1 flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-medium text-ink-300">{label}</span>
          <span className="text-xs font-medium tabular-nums text-ink-400">
            {display ?? `${value}${suffix}`}
          </span>
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          style={style}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
        />
      </label>
      {hint ? (
        <p className="mt-0.5 text-[11px] leading-snug text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ toggle */

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
    <div
      className={cx(
        "flex items-start justify-between gap-3",
        disabled && "opacity-45",
      )}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink-200">{label}</div>
        {hint ? (
          <div className="mt-0.5 text-[11px] leading-snug text-ink-500">
            {hint}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full p-[3px] transition-colors duration-200",
          checked ? "bg-ink-100" : "bg-ink-700",
          !disabled && "hover:brightness-110",
        )}
      >
        <span
          className={cx(
            "block h-4 w-4 rounded-full shadow-sm transition-transform duration-200",
            checked
              ? "translate-x-4 bg-ink-950"
              : "translate-x-0 bg-ink-400",
          )}
        />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------- field, select */

/**
 * Deliberately not a <label>: these wrap button groups, and a <label> around a
 * labelable element steals its accessible name (the first option ends up
 * called "Countdown" instead of "Off"). The controls inside carry their own
 * aria-label.
 */
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-300">
        {label}
      </span>
      {children}
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-ink-500">{hint}</p>
      ) : null}
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
    <div className="relative">
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none rounded-xl bg-ink-900 py-2.5 pl-3 pr-9 text-xs text-ink-200 ring-1 ring-inset ring-ink-800 transition hover:ring-ink-700 focus:ring-ink-600"
      >
        {children}
      </select>
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500"
      >
        <path
          d="M7 10l5 5 5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ chrome */

export function SectionTitle({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
        {children}
      </h3>
      {aside}
    </div>
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
    <div className="flex shrink-0 items-center justify-between border-b border-ink-850 px-4 py-3">
      <h2 className="text-sm font-semibold tracking-tight text-white">
        {title}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={`Close ${title}`}
        className="-mr-1.5 rounded-lg p-1.5 text-ink-500 transition hover:bg-ink-800 hover:text-white"
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
    neutral: "bg-ink-850 text-ink-400 ring-ink-800",
    accent: "bg-accent/12 text-accent-soft ring-accent/25",
    warn: "bg-amber-400/12 text-amber-200/90 ring-amber-400/25",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-ink-700 bg-ink-850 px-1 font-sans text-[10px] font-medium text-ink-400">
      {children}
    </kbd>
  );
}

export function Note({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warn";
}) {
  return (
    <p
      className={cx(
        "rounded-lg px-2.5 py-2 text-[11px] leading-relaxed ring-1 ring-inset",
        tone === "warn"
          ? "bg-amber-400/8 text-amber-200/85 ring-amber-400/20"
          : "bg-ink-900 text-ink-500 ring-ink-850",
      )}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------- sheet */

/**
 * Mobile bottom sheet with a grab handle and swipe-to-dismiss.
 *
 * The drag listeners live on the handle and header only. Putting them on the
 * whole sheet would fight the scroll gesture inside the script editor, which
 * is the one thing people do most in here.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const dragRef = useRef<{
    startY: number;
    pointerId: number;
    captured: boolean;
  } | null>(null);

  const onPointerDown = (event: ReactPointerEvent) => {
    dragRef.current = {
      startY: event.clientY,
      pointerId: event.pointerId,
      captured: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = event.clientY - drag.startY;

    /**
     * Capture lazily, only once this is clearly a drag.
     *
     * Capturing on pointerdown makes Chrome dispatch the following `click` to
     * the capturing element rather than whatever is under the pointer, which
     * silently killed the close button living inside this same wrapper.
     */
    if (!drag.captured && Math.abs(delta) > 4) {
      (event.currentTarget as HTMLElement).setPointerCapture?.(
        event.pointerId,
      );
      drag.captured = true;
    }
    // Downward only: dragging up shouldn't detach the sheet from the edge.
    if (drag.captured) setDragY(Math.max(0, delta));
  };

  const endDrag = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.captured) {
      (event.currentTarget as HTMLElement).releasePointerCapture?.(
        drag.pointerId,
      );
      if (dragY > 96) onClose();
    }
    setDragY(0);
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="fade-in absolute inset-0 bg-black/65 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "absolute inset-x-0 bottom-0 flex max-h-[86dvh] flex-col rounded-t-[20px] bg-ink-950 shadow-stage ring-1 ring-inset ring-ink-800 [padding-bottom:env(safe-area-inset-bottom)]",
          dragY === 0 && "sheet-in",
        )}
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragRef.current ? "none" : "transform 220ms cubic-bezier(0.2,0.9,0.25,1)",
        }}
      >
        <div
          className="shrink-0 cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="flex justify-center pt-2.5 pb-1">
            <span aria-hidden className="h-1 w-9 rounded-full bg-ink-700" />
          </div>
          <PanelHeader title={title} onClose={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
