"use client";

import type { ReactNode } from "react";
import { formatBytes, formatClock } from "@/lib/format";
import type { RecorderStatus } from "@/lib/useRecorder";
import {
  FilmIcon,
  LightIcon,
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
        "flex h-10 w-10 items-center justify-center rounded-full transition",
        disabled && "cursor-not-allowed opacity-40",
        !disabled && active
          ? "bg-white text-ink-950"
          : !disabled && "bg-ink-850 text-ink-200 hover:bg-ink-700 hover:text-white",
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
  fillLight: number;
  onLightCycle: () => void;
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
  fillLight,
  onLightCycle,
  takesCount,
  activePanel,
  onPanel,
  recordDisabled,
}: Props) {
  const counting = countdownLeft !== null;

  const tabs: { key: PanelKey; label: string; icon: ReactNode; badge?: number }[] =
    [
      { key: "script", label: "Script", icon: <ScriptIcon className="h-4 w-4" /> },
      { key: "setup", label: "Setup", icon: <SlidersIcon className="h-4 w-4" /> },
      {
        key: "takes",
        label: "Takes",
        icon: <FilmIcon className="h-4 w-4" />,
        badge: takesCount,
      },
    ];

  return (
    <div className="relative z-30 shrink-0 border-t border-ink-800 bg-ink-950/90 px-3 pt-2.5 backdrop-blur-md [padding-bottom:max(env(safe-area-inset-bottom),0.65rem)]">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
        <div className="flex flex-1 items-center gap-1.5">
          <IconButton
            label={micEnabled ? "Mute microphone" : "Unmute microphone"}
            onClick={onMicToggle}
            active={!micEnabled}
          >
            <MicIcon className="h-[18px] w-[18px]" muted={!micEnabled} />
          </IconButton>
          {canFlip && (
            <IconButton label="Switch camera" onClick={onFlip}>
              <SwitchCameraIcon className="h-[18px] w-[18px]" />
            </IconButton>
          )}
          <IconButton
            label={fillLight > 0 ? `Fill light ${fillLight}%` : "Turn on fill light"}
            onClick={onLightCycle}
            active={fillLight > 0}
          >
            <LightIcon className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        <div className="flex items-center gap-2.5">
          <IconButton
            label={prompterRunning ? "Pause script" : "Scroll script"}
            onClick={onPrompterToggle}
            disabled={!hasScript}
            active={prompterRunning}
          >
            {prompterRunning ? (
              <PauseIcon className="h-[18px] w-[18px]" />
            ) : (
              <PlayIcon className="h-[18px] w-[18px]" />
            )}
          </IconButton>

          <button
            type="button"
            onClick={onRecordToggle}
            disabled={recordDisabled && !isActive && !counting}
            aria-label={
              counting
                ? "Cancel countdown"
                : isActive
                  ? "Stop recording"
                  : "Start recording"
            }
            className={cx(
              "flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full ring-2 transition",
              recordDisabled && !isActive && !counting
                ? "cursor-not-allowed bg-ink-800 ring-ink-700"
                : "bg-ink-900 ring-white/80 hover:ring-white active:scale-95",
            )}
          >
            {counting ? (
              <span className="text-xl font-bold tabular-nums text-white">
                {countdownLeft}
              </span>
            ) : isActive ? (
              <span className="h-5 w-5 rounded-[4px] bg-accent" />
            ) : (
              <span
                className={cx(
                  "h-[46px] w-[46px] rounded-full",
                  recordDisabled ? "bg-ink-600" : "bg-accent",
                )}
              />
            )}
          </button>

          {isActive ? (
            <IconButton
              label={status === "paused" ? "Resume recording" : "Pause recording"}
              onClick={onPauseToggle}
            >
              {status === "paused" ? (
                <PlayIcon className="h-[18px] w-[18px]" />
              ) : (
                <PauseIcon className="h-[18px] w-[18px]" />
              )}
            </IconButton>
          ) : (
            <IconButton
              label="Rewind script to the top"
              onClick={onPrompterReset}
              disabled={!hasScript}
            >
              <RewindIcon className="h-[18px] w-[18px]" />
            </IconButton>
          )}
        </div>

        <div className="flex flex-1 items-center justify-end">
          {isActive || status === "finishing" ? (
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 text-sm font-semibold tabular-nums text-white">
                {status === "recording" && (
                  <span className="rec-dot h-2 w-2 rounded-full bg-accent" />
                )}
                {formatClock(elapsedMs)}
              </div>
              <div className="text-[10px] tabular-nums text-ink-500">
                {status === "paused"
                  ? "Paused"
                  : status === "finishing"
                    ? "Saving…"
                    : formatBytes(recordedBytes)}
              </div>
            </div>
          ) : (
            <span className="hidden text-[11px] text-ink-600 sm:block">
              {hasScript ? "R record · Space scroll" : "Add a script to begin"}
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto mt-2 flex w-full max-w-3xl gap-1.5 lg:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onPanel(tab.key)}
            aria-pressed={activePanel === tab.key}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition",
              activePanel === tab.key
                ? "bg-white text-ink-950"
                : "bg-ink-850 text-ink-300 hover:bg-ink-800",
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge ? (
              <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
