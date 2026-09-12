"use client";

import { useMemo, useState } from "react";
import { estimateSeconds, tokenize } from "@/lib/script";
import { formatDuration } from "@/lib/format";
import type { PrompterSettings } from "@/lib/types";
import { Button, Note, PanelHeader, Pill, SliderRow } from "@/components/ui";

const SAMPLE = `Hey — quick one.

I got tired of teleprompter apps that promise "free" and then stamp a watermark across your face, so I built my own.

Paste a script here. Hit record. It scrolls at your pace, right under the lens, so you're looking straight down the barrel the whole time.

No account. No trial. No watermark. The file lands in your downloads folder and that's the end of it.`;

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
        <div className="flex flex-wrap items-center gap-2">
          <Pill>{wordCount} words</Pill>
          <Pill>≈ {formatDuration(seconds * 1000)}</Pill>
          {voiceListening && <Pill tone="accent">Listening</Pill>}
        </div>

        <textarea
          value={prompter.script}
          onChange={(event) => onPatch({ script: event.target.value })}
          placeholder="Paste or type your script here. Blank lines become breathing room while it scrolls."
          spellCheck
          className="min-h-[180px] flex-1 resize-none rounded-xl border border-ink-700 bg-ink-900 p-3 leading-relaxed text-ink-100 outline-none placeholder:text-ink-500 focus:border-ink-500"
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

        <div className="space-y-2 rounded-xl border border-ink-800 bg-ink-900/60 p-3">
          <SliderRow
            label="Scroll speed"
            value={prompter.wpm}
            min={70}
            max={260}
            onChange={(wpm) => onPatch({ wpm })}
            suffix=" wpm"
            hint="Conversational delivery is around 140–160 wpm."
          />
          {heardWpm !== null && (
            <button
              type="button"
              onClick={() => onPatch({ wpm: heardWpm })}
              className="w-full rounded-lg bg-accent/15 px-3 py-1.5 text-left text-[11px] font-medium text-accent-soft ring-1 ring-accent/30 transition hover:bg-accent/25"
            >
              You&apos;re speaking at ~{heardWpm} wpm — tap to match the scroll
              to it.
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
