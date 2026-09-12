"use client";

import { useMemo, useState } from "react";
import { estimateSeconds, tokenize } from "@/lib/script";
import { formatDuration } from "@/lib/format";
import type { PrompterSettings } from "@/lib/types";
import { SparkIcon } from "@/components/icons";
import {
  Button,
  Note,
  PanelHeader,
  SectionTitle,
  SliderRow,
  cx,
} from "@/components/ui";

const SAMPLE = `Hey — quick one.

I got tired of teleprompter apps that promise "free" and then stamp a watermark across your face, so I built my own.

Paste a script here. Hit record. It scrolls at your pace, right under the lens, so you're looking straight down the barrel the whole time.

No account. No trial. No watermark. The file lands in your downloads folder and that's the end of it.`;

const PRESETS = [
  { label: "Measured", wpm: 120 },
  { label: "Natural", wpm: 145 },
  { label: "Brisk", wpm: 175 },
];

type Props = {
  prompter: PrompterSettings;
  onPatch: (patch: Partial<PrompterSettings>) => void;
  onClose: () => void;
  heardWpm: number | null;
  voiceListening: boolean;
  embedded?: boolean;
};

export default function ScriptPanel({
  prompter,
  onPatch,
  onClose,
  heardWpm,
  voiceListening,
  embedded = false,
}: Props) {
  const [pasteError, setPasteError] = useState<string | null>(null);

  const wordCount = useMemo(
    () => tokenize(prompter.script).length,
    [prompter.script],
  );
  const seconds = estimateSeconds(wordCount, prompter.wpm);

  const pasteFromClipboard = async () => {
    setPasteError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setPasteError("Clipboard is empty.");
        return;
      }
      onPatch({ script: text });
    } catch {
      setPasteError("Your browser blocked clipboard access — paste with ⌘V.");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!embedded && <PanelHeader title="Script" onClose={onClose} />}

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        {/* Read-time summary: the two numbers that actually matter when you're
            deciding whether a script fits the video you're making. */}
        <div className="flex items-stretch gap-2">
          <div className="flex-1 rounded-xl bg-ink-900 px-3 py-2 ring-1 ring-inset ring-ink-850">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-600">
              Words
            </div>
            <div
              data-word-count
              className="mt-0.5 text-lg font-semibold tabular-nums leading-none text-white"
            >
              {wordCount}
            </div>
          </div>
          <div className="flex-1 rounded-xl bg-ink-900 px-3 py-2 ring-1 ring-inset ring-ink-850">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-600">
              Runs about
            </div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums leading-none text-white">
              {wordCount === 0 ? "—" : formatDuration(seconds * 1000)}
            </div>
          </div>
        </div>

        <textarea
          value={prompter.script}
          onChange={(event) => onPatch({ script: event.target.value })}
          placeholder="Paste or type your script here.&#10;&#10;Blank lines become breathing room while it scrolls."
          spellCheck
          className="min-h-[160px] flex-1 resize-none rounded-xl bg-ink-900 p-3.5 text-[13.5px] leading-[1.65] text-ink-100 ring-1 ring-inset ring-ink-850 outline-none transition placeholder:text-ink-600 hover:ring-ink-800 focus:ring-ink-600"
        />

        <div className="flex flex-wrap gap-1.5">
          <Button onClick={pasteFromClipboard}>Paste from clipboard</Button>
          <Button onClick={() => onPatch({ script: SAMPLE })}>
            Load sample
          </Button>
          <Button
            onClick={() => onPatch({ script: "" })}
            disabled={prompter.script.length === 0}
          >
            Clear
          </Button>
        </div>

        {pasteError && <Note tone="warn">{pasteError}</Note>}

        <div className="space-y-3 rounded-xl bg-ink-900 p-3 ring-1 ring-inset ring-ink-850">
          <SectionTitle
            aside={
              voiceListening ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-accent-soft">
                  <SparkIcon className="h-3 w-3" />
                  Listening
                </span>
              ) : undefined
            }
          >
            Pace
          </SectionTitle>

          <SliderRow
            label="Scroll speed"
            value={prompter.wpm}
            min={70}
            max={260}
            display={`${prompter.wpm} wpm`}
            onChange={(wpm) => onPatch({ wpm })}
          />

          <div className="flex gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onPatch({ wpm: preset.wpm })}
                className={cx(
                  "flex-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
                  prompter.wpm === preset.wpm
                    ? "bg-ink-700 text-white ring-1 ring-inset ring-ink-600"
                    : "bg-ink-850 text-ink-400 hover:text-ink-200",
                )}
              >
                {preset.label}
                <span className="ml-1 tabular-nums text-ink-500">
                  {preset.wpm}
                </span>
              </button>
            ))}
          </div>

          {heardWpm !== null && heardWpm !== prompter.wpm && (
            <button
              type="button"
              onClick={() => onPatch({ wpm: heardWpm })}
              className="flex w-full items-center gap-2 rounded-lg bg-accent/10 px-2.5 py-2 text-left text-[11px] font-medium text-accent-soft ring-1 ring-inset ring-accent/25 transition hover:bg-accent/18"
            >
              <SparkIcon className="h-3.5 w-3.5 shrink-0" />
              <span>
                You&apos;re speaking at about {heardWpm} wpm — tap to match the
                scroll to it.
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
