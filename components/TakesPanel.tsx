"use client";

import { useState } from "react";
import { formatBytes, formatClock, timestampSlug } from "@/lib/format";
import type { Take } from "@/lib/types";
import { DownloadIcon, FilmIcon, PlayIcon, TrashIcon } from "@/components/icons";
import { Button, Note, PanelHeader, cx } from "@/components/ui";

type Props = {
  takes: Take[];
  onDelete: (id: string) => void;
  onClose: () => void;
  embedded?: boolean;
};

function filenameFor(take: Take): string {
  return `take-${timestampSlug(new Date(take.createdAt))}.${take.ext}`;
}

function download(take: Take) {
  const anchor = document.createElement("a");
  anchor.href = take.url;
  anchor.download = filenameFor(take);
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
  // Players mount only once asked for: a list of autoloading <video> elements
  // holds a decoder open for every take at once.
  const [playing, setPlaying] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const saveAll = async () => {
    for (const take of takes) {
      download(take);
      // Browsers throttle or silently drop rapid successive downloads.
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!embedded && <PanelHeader title="Takes" onClose={onClose} />}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {takes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink-900 ring-1 ring-inset ring-ink-800">
              <FilmIcon className="h-5 w-5 text-ink-600" />
            </span>
            <p className="max-w-[15rem] text-xs leading-relaxed text-ink-500">
              Nothing recorded yet. Your takes land here the moment you stop,
              ready to download.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-ink-500">
                {takes.length} {takes.length === 1 ? "take" : "takes"}
              </span>
              {takes.length > 1 && (
                <Button onClick={() => void saveAll()}>
                  <DownloadIcon className="h-3.5 w-3.5" />
                  Save all
                </Button>
              )}
            </div>

            <Note tone="warn">
              Takes live in this tab only — download the ones you want before
              you close or reload the page.
            </Note>

            {takes.map((take, index) => {
              const number = takes.length - index;
              const isPlaying = playing === take.id;
              const confirming = confirmingDelete === take.id;

              return (
                <div
                  key={take.id}
                  className="overflow-hidden rounded-xl bg-ink-900 ring-1 ring-inset ring-ink-850"
                >
                  <div className="relative bg-black">
                    {isPlaying ? (
                      <video
                        src={take.url}
                        controls
                        autoPlay
                        playsInline
                        poster={take.poster ?? undefined}
                        className="max-h-[40vh] w-full bg-black"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPlaying(take.id)}
                        aria-label={`Play take ${number}`}
                        className="group relative block w-full"
                      >
                        {take.poster ? (
                          <img
                            src={take.poster}
                            alt=""
                            className="max-h-[40vh] w-full object-contain"
                          />
                        ) : (
                          <div className="flex aspect-video w-full items-center justify-center">
                            <FilmIcon className="h-6 w-6 text-ink-700" />
                          </div>
                        )}
                        <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/40">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink-950 shadow-lift transition group-hover:scale-105">
                            <PlayIcon className="ml-0.5 h-5 w-5" />
                          </span>
                        </span>
                        <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white ring-1 ring-inset ring-white/10">
                          {formatClock(take.durationMs)}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 p-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-ink-200">
                        Take {number}
                      </div>
                      <div className="mt-0.5 truncate text-[10.5px] tabular-nums text-ink-500">
                        <span data-take-dims>
                          {take.width}×{take.height}
                        </span>{" "}
                        · {formatBytes(take.blob.size)} ·{" "}
                        {take.ext.toUpperCase()}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {confirming ? (
                        <>
                          <Button
                            onClick={() => {
                              onDelete(take.id);
                              setConfirmingDelete(null);
                            }}
                            ariaLabel={`Confirm deleting take ${number}`}
                          >
                            Delete
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setConfirmingDelete(null)}
                          >
                            Keep
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="primary"
                            onClick={() => download(take)}
                            ariaLabel={`Download take ${number}`}
                          >
                            <DownloadIcon className="h-3.5 w-3.5" />
                            Save
                          </Button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDelete(take.id)}
                            aria-label={`Delete take ${number}`}
                            className={cx(
                              "rounded-lg p-2 text-ink-500 transition",
                              "hover:bg-ink-800 hover:text-white",
                            )}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
