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

  // Scale type with the panel so the same setting reads sensibly on a phone
  // and on a wide desktop frame.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      const width = viewport.clientWidth;
      if (width > 0) setFontScale(clamp(width / 520, 0.6, 1.3));
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

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex flex-col"
      style={{ height: `${settings.heightPct}%` }}
    >
      <div
        className="relative flex-1 overflow-hidden"
        style={{
          background: `rgba(6, 7, 10, ${settings.opacity / 100})`,
          backdropFilter: settings.opacity > 12 ? "blur(3px)" : undefined,
          WebkitBackdropFilter:
            settings.opacity > 12 ? "blur(3px)" : undefined,
        }}
      >
        {/* Reading line */}
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
          style={{ top: `${FOCUS_RATIO * 100}%` }}
          aria-hidden
        >
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
        </div>
        <div
          className="pointer-events-none absolute z-10 -translate-y-1/2"
          style={{ top: `${FOCUS_RATIO * 100}%`, left: 0 }}
          aria-hidden
        >
          <div className="h-0 w-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-accent" />
        </div>

        <div
          ref={viewportRef}
          className="prompter-fade h-full cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
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
            className="px-[5%] will-change-transform"
            style={{
              paddingTop: `${FOCUS_RATIO * 100}%`,
              paddingBottom: `${(1 - FOCUS_RATIO) * 100}%`,
              fontSize: `${fontPx}px`,
              lineHeight: settings.lineHeight,
              fontWeight: settings.bold ? 650 : 450,
              letterSpacing: "-0.01em",
              transform: "translate3d(0, 0, 0)",
              ...(settings.mirrorText ? { scale: "-1 1" } : {}),
            }}
          >
            {totalWords === 0 ? (
              <p className="text-ink-400">
                Paste your script in the Script panel and it will scroll here
                while you record.
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
                    className="text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.85)]"
                  >
                    {block.text}
                  </p>
                ),
              )
            )}
          </div>
        </div>
      </div>

      {/* Progress + remaining time */}
      <div className="relative h-[3px] w-full bg-black/50">
        <div
          className="h-full bg-accent transition-[width] duration-200 ease-linear"
          style={{ width: `${clamp(progress * 100, 0, 100)}%` }}
        />
        {totalWords > 0 && (
          <span className="absolute right-1.5 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-ink-300">
            {formatClock(secondsLeft * 1000)} left
          </span>
        )}
      </div>
    </div>
  );
}
