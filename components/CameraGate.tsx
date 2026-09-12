"use client";

import type { ReactNode } from "react";
import { CameraIcon, LightIcon, ScreenIcon, ScriptIcon } from "@/components/icons";
import { Button } from "@/components/ui";

const PITCH: { icon: ReactNode; text: string }[] = [
  {
    icon: <ScriptIcon className="h-3.5 w-3.5" />,
    text: "Your script scrolls right under the lens, at your pace.",
  },
  {
    icon: <CameraIcon className="h-3.5 w-3.5" />,
    text: "Vertical, square or wide — the file comes out exactly as framed.",
  },
  {
    icon: <LightIcon className="h-3.5 w-3.5" />,
    text: "No account, no trial, and never a watermark.",
  },
];

type Props = {
  /** Show the fuller pitch; returning visitors just get the button. */
  firstRun: boolean;
  errored: boolean;
  message: string | null;
  onEnable: () => void;
  screenSupported: boolean;
  onScreenInstead: () => void;
};

export default function CameraGate({
  firstRun,
  errored,
  message,
  onEnable,
  screenSupported,
  onScreenInstead,
}: Props) {
  return (
    <div className="fade-in absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-ink-950/95 p-6 text-center">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink-900 ring-1 ring-inset ring-ink-800">
        {errored ? (
          <CameraIcon className="h-6 w-6 text-accent-soft" />
        ) : (
          <CameraIcon className="h-6 w-6 text-ink-400" />
        )}
      </span>

      <div className="max-w-[19rem] space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-white">
          {errored
            ? "Camera unavailable"
            : firstRun
              ? "A teleprompter that isn't trying to sell you anything"
              : "Turn on your camera"}
        </h2>
        <p className="text-xs leading-relaxed text-ink-400">
          {message ??
            "Your video never leaves this device — there's no server for it to go to."}
        </p>
      </div>

      {firstRun && !errored && (
        <ul className="max-w-[19rem] space-y-2 text-left">
          {PITCH.map((item, index) => (
            <li key={index} className="flex items-start gap-2.5">
              <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-ink-400 ring-1 ring-inset ring-ink-850">
                {item.icon}
              </span>
              <span className="text-[11.5px] leading-relaxed text-ink-400">
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col items-center gap-2.5">
        <Button size="md" variant="primary" onClick={onEnable}>
          {errored ? "Try again" : "Enable camera"}
        </Button>
        {screenSupported && (
          <Button variant="quiet" onClick={onScreenInstead}>
            <ScreenIcon className="h-3.5 w-3.5" />
            Record my screen instead
          </Button>
        )}
      </div>
    </div>
  );
}
