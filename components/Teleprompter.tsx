"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent, RefObject, WheelEvent as ReactWheelEvent } from "react";
import { clamp, formatClock } from "@/lib/format";
import { parseScript } from "@/lib/script";
import type { VoiceMatch } from "@/lib/useVoiceSync";
import type { PrompterSettings } from "@/lib/types";

/** Where on the panel the reading line sits, top-anchored so eyes stay near the lens. */
const FOCUS_RATIO = 0.32;
/** Stay a few words ahead of what was just heard, the way a human reads. */
const VOICE_LEAD_WORDS = 3;
/** Ignore voice matches older than this; silence shouldn't steer the scroll. */
const VOICE_STALE_MS = 3500;

type BlockMetric = {
  wordStart: number;
  wordCount: number;
  top: number;
  height: number;
};

type Props = {
  settings: PrompterSettings;
  running: boolean;
  /** Effective words-per-minute, already blended with any measured rate. */
  effectiveWpm: number;
  voiceMatchRef: RefObject<VoiceMatch | null>;
  /** Written every frame so voice matching knows where the reader is. */
  currentWordRef: RefObject<number>;
  resetToken: number;
  onToggleRunning: () => void;
  onFinished: () => void;
};

export default function Teleprompter({
  settings,
  running,
  effectiveWpm,
  voiceMatchRef,
  currentWordRef,
  resetToken,
  onToggleRunning,
  onFinished,
}: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const blockRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const offsetRef = useRef(0);
  const metricsRef = useRef<BlockMetric[]>([]);
  const textHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const lastManualAtRef = useRef(0);
  const finishedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  const [fontScale, setFontScale] = useState(1);
  const [progress, setProgress] = useState(0);
  const [wordsLeft, setWordsLeft] = useState(0);

  const parsed = useMemo(() => parseScript(settings.script), [settings.script]);
  const { blocks, totalWords } = parsed;

  const fontPx = Math.round(settings.fontSize * fontScale);

  /** Re-measure paragraph geometry; everything downstream keys off this. */
  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const viewportHeight = viewport.clientHeight;
    viewportHeightRef.current = viewportHeight;
    const padTop = viewportHeight * FOCUS_RATIO;

    const metrics: BlockMetric[] = [];
    blocks.forEach((block, index) => {
      if (block.wordCount === 0) return;
      const el = blockRefs.current[index];
      if (!el) return;
      metrics.push({
        wordStart: block.wordStart,
        wordCount: block.wordCount,
        top: el.offsetTop - padTop,
        height: el.offsetHeight,
      });
    });
    metricsRef.current = metrics;
    textHeightRef.current = Math.max(
      0,
      content.scrollHeight - viewportHeight,
    );
  }, [blocks]);

  /**
   * Scale type off the panel's *height*, not its width. Height is what decides
   * how many lines are visible at once, so this keeps a 16:9 desktop frame and
   * a 9:16 phone frame showing roughly the same amount of script — scaling by
   * width instead made wide frames show barely two lines.
   */
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      const height = viewport.clientHeight;
      if (height > 0) setFontScale(clamp(height / 300, 0.55, 1.6));
      measure();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [measure]);

  useLayoutEffect(() => {
    measure();
  }, [measure, fontPx, settings.lineHeight, settings.bold, settings.heightPct]);

  const applyOffset = useCallback((next: number) => {
    const max = textHeightRef.current;
    const clamped = clamp(next, 0, Math.max(0, max));
    offsetRef.current = clamped;
    const content = contentRef.current;
    if (content) {
      content.style.transform = `translate3d(0, ${-clamped}px, 0)`;
    }
    return clamped;
  }, []);

  const offsetForWord = useCallback((wordIndex: number) => {
    const metrics = metricsRef.current;
    if (metrics.length === 0) return 0;
    if (wordIndex <= 0) return 0;

    for (const metric of metrics) {
      const end = metric.wordStart + metric.wordCount;
      if (wordIndex < end) {
        const fraction =
          (wordIndex - metric.wordStart) / Math.max(1, metric.wordCount);
        return metric.top + fraction * metric.height;
      }
    }
    return textHeightRef.current;
  }, []);

  const wordAtOffset = useCallback((offset: number) => {
    const metrics = metricsRef.current;
    if (metrics.length === 0) return 0;
    for (const metric of metrics) {
      if (offset < metric.top + metric.height) {
        const fraction =
          (offset - metric.top) / Math.max(1, metric.height);
        return (
          metric.wordStart + clamp(fraction, 0, 1) * metric.wordCount
        );
      }
    }
    return totalWords;
  }, [totalWords]);

  const reset = useCallback(() => {
    finishedRef.current = false;
    lastManualAtRef.current = 0;
    currentWordRef.current = 0;
    applyOffset(0);
    setProgress(0);
    setWordsLeft(totalWords);
  }, [applyOffset, currentWordRef, totalWords]);

  useEffect(() => {
    reset();
  }, [reset, resetToken]);

  // Keep the readout truthful when the script is edited while parked.
  useEffect(() => {
    if (!running) {
      setWordsLeft(Math.max(0, totalWords - wordAtOffset(offsetRef.current)));
    }
  }, [running, totalWords, wordAtOffset]);

  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    if (!running) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    lastFrameRef.current = performance.now();
    let progressAccumulator = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.25, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;

      const textHeight = textHeightRef.current;
      const viewportHeight = viewportHeightRef.current;

      if (textHeight <= 0 || totalWords === 0) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      // Words-per-minute is the honest unit; convert to pixels using the
      // script's own average density.
      const basePxPerSec =
        (effectiveWpm / 60) * (textHeight / Math.max(1, totalWords));

      let velocity = basePxPerSec;
      const match = voiceMatchRef.current;
      if (
        settings.voiceSync &&
        match &&
        Date.now() - match.at < VOICE_STALE_MS &&
        match.at > lastManualAtRef.current
      ) {
        const target = offsetForWord(match.wordIndex + VOICE_LEAD_WORDS);
        const error = target - offsetRef.current;
        if (Math.abs(error) > viewportHeight * 0.55) {
          // A big gap means the speaker jumped; catch up at once rather than
          // racing through lines they already said.
          applyOffset(target);
        } else {
          velocity = clamp(
            basePxPerSec + error * 1.6,
            -basePxPerSec * 1.2,
            basePxPerSec * 2.6,
          );
        }
      }

      const next = applyOffset(offsetRef.current + velocity * dt);

      progressAccumulator += dt;
      if (progressAccumulator > 0.2) {
        progressAccumulator = 0;
        const word = wordAtOffset(next);
        currentWordRef.current = word;
        setProgress(textHeight > 0 ? next / textHeight : 0);
        setWordsLeft(Math.max(0, Math.round(totalWords - word)));
      }

      if (next >= textHeight - 0.5 && !finishedRef.current) {
        finishedRef.current = true;
        setProgress(1);
        setWordsLeft(0);
        onFinishedRef.current();
        return;
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    applyOffset,
    currentWordRef,
    effectiveWpm,
    offsetForWord,
    running,
    settings.voiceSync,
    totalWords,
    voiceMatchRef,
    wordAtOffset,
  ]);

  const nudge = useCallback(
    (delta: number) => {
      lastManualAtRef.current = Date.now();
      finishedRef.current = false;
      const next = applyOffset(offsetRef.current + delta);
      const textHeight = textHeightRef.current;
      const word = wordAtOffset(next);
      currentWordRef.current = word;
      setProgress(textHeight > 0 ? next / textHeight : 0);
      setWordsLeft(Math.max(0, Math.round(totalWords - word)));
    },
    [applyOffset, currentWordRef, totalWords, wordAtOffset],
  );

  const onWheel = useCallback(
    (event: ReactWheelEvent) => {
      event.preventDefault();
      nudge(event.deltaY);
    },
    [nudge],
  );

  const dragRef = useRef<{ y: number; moved: number } | null>(null);

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragRef.current = { y: event.clientY, moved: 0 };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dy = event.clientY - drag.y;
      drag.y = event.clientY;
      drag.moved += Math.abs(dy);
      nudge(-dy);
    },
    [nudge],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      (event.currentTarget as HTMLElement).releasePointerCapture?.(
        event.pointerId,
      );
      // A tap (not a drag) is the fastest way to start or hold the scroll.
      if (drag && drag.moved < 6 && totalWords > 0) onToggleRunning();
    },
    [onToggleRunning, totalWords],
  );

  const secondsLeft = (wordsLeft / Math.max(1, effectiveWpm)) * 60;

  if (!settings.visible) return null;

  const backdrop = settings.opacity / 100;
  // The blurred layer is masked separately from the colour wash: without it the
  // blur keeps a hard rectangular edge even as the tint fades out, which cuts a
  // visible seam across the middle of the shot.
  const softEdge = "linear-gradient(to bottom, #000 0%, #000 84%, transparent 100%)";

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 top-0 z-20"
      style={{ height: `${settings.heightPct}%` }}
    >
      <div className="relative h-full overflow-hidden">
        {backdrop > 0.12 && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              maskImage: softEdge,
              WebkitMaskImage: softEdge,
            }}
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, rgba(5,6,9,${backdrop}) 0%, rgba(5,6,9,${backdrop}) 78%, rgba(5,6,9,0) 100%)`,
          }}
        />

        {/* Progress hairline, read like a scrubber along the top of the frame */}
        <div className="absolute inset-x-0 top-0 z-20 h-[2px] bg-white/10">
          <div
            className="h-full bg-accent transition-[width] duration-200 ease-linear"
            style={{ width: `${clamp(progress * 100, 0, 100)}%` }}
          />
        </div>

        {/* Lines above the reading line have already been said, so let them
            recede. It makes the next line the brightest thing on screen. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[15]"
          style={{
            // Stops short of the reading line so the line you're actually on
            // stays at full brightness instead of straddling the veil's edge.
            height: `${FOCUS_RATIO * 100 - 7}%`,
            background:
              "linear-gradient(to bottom, rgba(5,6,9,0.58) 0%, rgba(5,6,9,0.3) 60%, rgba(5,6,9,0) 100%)",
          }}
        />

        {/* Reading line */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-[15] h-20 -translate-y-1/2"
          style={{
            top: `${FOCUS_RATIO * 100}%`,
            background:
              "radial-gradient(58% 100% at 24% 50%, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 100%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
          style={{ top: `${FOCUS_RATIO * 100}%` }}
        >
          <span className="h-px w-2.5 bg-accent" />
          <span className="h-px flex-1 bg-gradient-to-r from-accent/55 via-accent/18 to-transparent" />
        </div>

        {totalWords > 0 && (
          <span className="pointer-events-none absolute right-2 top-3 z-20 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white/70 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
            {formatClock(secondsLeft * 1000)} left
          </span>
        )}

        <div
          ref={viewportRef}
          className="prompter-fade relative h-full cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="button"
          tabIndex={-1}
          aria-label="Teleprompter script. Tap to start or pause, drag to scrub."
        >
          <div
            ref={contentRef}
            className="px-[5.5%] will-change-transform"
            style={{
              // ~44 characters per line. Long lines mean long eye travel away
              // from the lens, which defeats the point of a prompter.
              maxWidth: "22em",
              paddingTop: `${FOCUS_RATIO * 100}%`,
              paddingBottom: `${(1 - FOCUS_RATIO) * 100}%`,
              fontSize: `${fontPx}px`,
              lineHeight: settings.lineHeight,
              fontWeight: settings.bold ? 650 : 450,
              letterSpacing: "-0.018em",
              textWrap: "pretty",
              transform: "translate3d(0, 0, 0)",
              ...(settings.mirrorText ? { scale: "-1 1" } : {}),
            }}
          >
            {totalWords === 0 ? (
              <p className="text-[0.42em] font-medium leading-relaxed text-ink-400">
                Your script scrolls here while you record. Open the Script
                panel to paste it in.
              </p>
            ) : (
              blocks.map((block, index) =>
                block.wordCount === 0 ? (
                  <div
                    key={index}
                    style={{ height: "0.7em" }}
                    aria-hidden
                    ref={(el) => {
                      blockRefs.current[index] =
                        el as unknown as HTMLParagraphElement | null;
                    }}
                  />
                ) : (
                  <p
                    key={index}
                    ref={(el) => {
                      blockRefs.current[index] = el;
                    }}
                    className="text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.9)]"
                  >
                    {block.text}
                  </p>
                ),
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
