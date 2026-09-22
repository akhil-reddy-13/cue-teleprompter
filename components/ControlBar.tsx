"use client";

import type { ReactNode } from "react";
import { formatBytes, formatClock } from "@/lib/format";
import type { RecorderStatus } from "@/lib/useRecorder";
import {
  FilmIcon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  RewindIcon,
  ScriptIcon,
  SlidersIcon,
  SwitchCameraIcon,
} from "@/components/icons";
import { cx } from "@/components/ui";

export type PanelKey = "script" | "setup" | "takes";

function IconButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cx(
        "relative flex h-11 w-11 items-center justify-center rounded-full transition duration-150",
        disabled
          ? "cursor-not-allowed text-ink-600"
          : active
            ? "bg-ink-100 text-ink-950 shadow-lift"
            : "bg-ink-850/90 text-ink-300 ring-1 ring-inset ring-ink-800 hover:bg-ink-800 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

type Props = {
  status: RecorderStatus;
  isActive: boolean;
  elapsedMs: number;
  recordedBytes: number;
  countdownLeft: number | null;
  countdownTotal: number;
  onRecordToggle: () => void;
  onPauseToggle: () => void;
  prompterRunning: boolean;
  hasScript: boolean;
  onPrompterToggle: () => void;
  onPrompterReset: () => void;
  micEnabled: boolean;
  onMicToggle: () => void;
  canFlip: boolean;
  onFlip: () => void;
  takesCount: number;
  activePanel: PanelKey | null;
  onPanel: (panel: PanelKey) => void;
  recordDisabled: boolean;
};

export default function ControlBar({
  status,
  isActive,
  elapsedMs,
  recordedBytes,
  countdownLeft,
  countdownTotal,
  onRecordToggle,
  onPauseToggle,
  prompterRunning,
  hasScript,
  onPrompterToggle,
  onPrompterReset,
  micEnabled,
  onMicToggle,
  canFlip,
  onFlip,
  takesCount,
  activePanel,
  onPanel,
  recordDisabled,
}: Props) {
  const counting = countdownLeft !== null;
  const blocked = recordDisabled && !isActive && !counting;

  const tabs: {
    key: PanelKey;
    label: string;
    icon: ReactNode;
    badge?: number;
  }[] = [
    { key: "script", label: "Script", icon: <ScriptIcon className="h-4 w-4" /> },
    { key: "setup", label: "Setup", icon: <SlidersIcon className="h-4 w-4" /> },
    {
      key: "takes",
      label: "Takes",
      icon: <FilmIcon className="h-4 w-4" />,
      badge: takesCount,
    },
  ];

  // Reserved-height status line: the timer replacing a hint must not shift the
  // button row underneath it.
  const statusLine = counting ? (
    <span className="text-ink-400">Starting in {countdownLeft}…</span>
  ) : isActive || status === "finishing" ? (
    <span className="inline-flex items-center gap-2">
      {status === "recording" && (
        <span className="rec-dot h-1.5 w-1.5 rounded-full bg-accent" />
      )}
      <span className="font-semibold tabular-nums text-white">
        {formatClock(elapsedMs)}
      </span>
      <span className="text-ink-600">·</span>
      <span className="tabular-nums text-ink-500">
        {status === "paused"
          ? "Paused"
          : status === "finishing"
            ? "Saving…"
            : formatBytes(recordedBytes)}
      </span>
    </span>
  ) : hasScript ? null : (
    <span className="text-ink-600">Add a script to start the prompter</span>
  );

  return (
    <div className="relative z-30 shrink-0 border-t border-ink-850 bg-ink-950/85 px-3 pt-1.5 backdrop-blur-xl [padding-bottom:max(env(safe-area-inset-bottom),0.4rem)] sm:pt-2">
      {statusLine && (
        <div className="mx-auto flex h-4 w-full max-w-3xl items-center justify-center text-[11px] leading-none">
          {statusLine}
        </div>
      )}

      <div
        className={cx(
          "mx-auto flex w-full max-w-3xl items-center gap-2",
          statusLine && "mt-1.5",
        )}
      >
        <div className="flex flex-1 items-center gap-1.5">
          <IconButton
            label={micEnabled ? "Mute microphone" : "Unmute microphone"}
            onClick={onMicToggle}
            active={!micEnabled}
          >
            <MicIcon className="h-[19px] w-[19px]" muted={!micEnabled} />
          </IconButton>
          {canFlip && (
            <IconButton label="Switch camera" onClick={onFlip}>
              <SwitchCameraIcon className="h-[19px] w-[19px]" />
            </IconButton>
          )}
        </div>

        <div className="flex items-center gap-3">
          <IconButton
            label={prompterRunning ? "Pause script" : "Scroll script"}
            onClick={onPrompterToggle}
            disabled={!hasScript}
            active={prompterRunning}
          >
            {prompterRunning ? (
              <PauseIcon className="h-[19px] w-[19px]" />
            ) : (
              <PlayIcon className="h-[19px] w-[19px]" />
            )}
          </IconButton>

          <button
            type="button"
            onClick={onRecordToggle}
            disabled={blocked}
            aria-label={
              counting
                ? "Cancel countdown"
                : isActive
                  ? "Stop recording"
                  : "Start recording"
            }
            className={cx(
              "group relative flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full transition-transform duration-150 sm:h-[68px] sm:w-[68px]",
              blocked ? "cursor-not-allowed" : "active:scale-[0.94]",
            )}
          >
            {/* Outer ring */}
            <span
              className={cx(
                "absolute inset-0 rounded-full ring-[2.5px] transition",
                blocked
                  ? "ring-ink-700"
                  : "ring-white/85 group-hover:ring-white",
              )}
            />
            {/* Countdown sweep */}
            {counting && countdownTotal > 0 && (
              <span
                aria-hidden
                className="absolute inset-[3px] rounded-full"
                style={{
                  background: `conic-gradient(var(--color-accent) ${
                    ((countdownTotal - (countdownLeft ?? 0)) / countdownTotal) *
                    360
                  }deg, transparent 0deg)`,
                  opacity: 0.35,
                }}
              />
            )}
            {counting ? (
              <span className="text-2xl font-semibold tabular-nums text-white">
                {countdownLeft}
              </span>
            ) : isActive ? (
              <span
                className={cx(
                  "h-[22px] w-[22px] rounded-[5px] bg-accent",
                  status === "recording" && "rec-halo",
                )}
              />
            ) : (
              <span
                className={cx(
                  "h-[44px] w-[44px] rounded-full transition-colors sm:h-[52px] sm:w-[52px]",
                  blocked ? "bg-ink-700" : "bg-accent group-hover:brightness-110",
                )}
              />
            )}
          </button>

          {isActive ? (
            <IconButton
              label={
                status === "paused" ? "Resume recording" : "Pause recording"
              }
              onClick={onPauseToggle}
            >
              {status === "paused" ? (
                <PlayIcon className="h-[19px] w-[19px]" />
              ) : (
                <PauseIcon className="h-[19px] w-[19px]" />
              )}
            </IconButton>
          ) : (
            <IconButton
              label="Rewind script to the top"
              onClick={onPrompterReset}
              disabled={!hasScript}
            >
              <RewindIcon className="h-[19px] w-[19px]" />
            </IconButton>
          )}
        </div>

        <div aria-hidden className="flex-1" />
      </div>

      <div className="mx-auto mt-1.5 flex w-full max-w-3xl gap-1.5 lg:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onPanel(tab.key)}
            aria-pressed={activePanel === tab.key}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition duration-150",
              activePanel === tab.key
                ? "bg-ink-100 text-ink-950"
                : "bg-ink-900/80 text-ink-400 ring-1 ring-inset ring-ink-850 hover:text-ink-200",
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge ? (
              <span
                className={cx(
                  "rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                  activePanel === tab.key
                    ? "bg-ink-950 text-ink-100"
                    : "bg-ink-700 text-ink-200",
                )}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
