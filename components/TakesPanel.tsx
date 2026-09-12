"use client";

import { formatBytes, formatClock, timestampSlug } from "@/lib/format";
import type { Take } from "@/lib/types";
import { DownloadIcon, TrashIcon } from "@/components/icons";
import { PanelHeader, Pill } from "@/components/ui";

type Props = {
  takes: Take[];
  onDelete: (id: string) => void;
  onClose: () => void;
  embedded?: boolean;
};

function download(take: Take) {
  const anchor = document.createElement("a");
  anchor.href = take.url;
  anchor.download = `take-${timestampSlug(new Date(take.createdAt))}.${take.ext}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function TakesPanel({
  takes,
  onDelete,
  onClose,
  embedded = false,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!embedded && <PanelHeader title="Takes" onClose={onClose} />}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {takes.length === 0 ? (
          <p className="text-xs leading-relaxed text-ink-500">
            Nothing recorded yet. Your takes show up here the moment you stop,
            ready to download.
          </p>
        ) : (
          <>
            <p className="text-[11px] leading-relaxed text-amber-300/90">
              Takes live in this tab only — download the ones you want before
              you close or reload the page.
            </p>
            {takes.map((take, index) => (
              <div
                key={take.id}
                className="overflow-hidden rounded-xl border border-ink-800 bg-ink-900"
              >
                <video
                  src={take.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-[42vh] w-full bg-black"
                />
                <div className="flex items-center justify-between gap-2 p-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-ink-100">
                      Take {takes.length - index}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <Pill>{formatClock(take.durationMs)}</Pill>
                      <Pill>{formatBytes(take.blob.size)}</Pill>
                      <Pill>
                        {take.width}×{take.height}
                      </Pill>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => download(take)}
                      aria-label={`Download take ${takes.length - index}`}
                      className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-ink-950 transition hover:bg-ink-100"
                    >
                      <DownloadIcon className="h-4 w-4" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(take.id)}
                      aria-label={`Delete take ${takes.length - index}`}
                      className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-white"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
