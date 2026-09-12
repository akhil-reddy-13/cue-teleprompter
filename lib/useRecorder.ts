"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { extensionForMime, pickRecordingFormat } from "@/lib/mime";
import {
  drawContain,
  drawCover,
  outputSize,
  pipRect,
  roundRectPath,
  type Rect,
} from "@/lib/layout";
import type { AspectKey, QualityKey, SourceMode, Take } from "@/lib/types";

export type RecorderStatus = "idle" | "recording" | "paused" | "finishing";

export type CompositeConfig = {
  aspect: AspectKey;
  quality: QualityKey;
  sourceMode: SourceMode;
  mirror: boolean;
  cameraEl: HTMLVideoElement | null;
  screenEl: HTMLVideoElement | null;
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
};

type UseRecorderArgs = {
  configRef: RefObject<CompositeConfig>;
  onTake: (take: Take) => void;
  onError: (message: string) => void;
};

const FPS = 30;
/** Long edge of the takes-list thumbnail. */
const POSTER_EDGE = 360;

/**
 * Downsample the last composited frame into a small JPEG. The compositor
 * canvas still holds it at this point, so a real thumbnail costs nothing
 * beyond one scaled drawImage.
 */
function capturePoster(canvas: HTMLCanvasElement): string | null {
  try {
    const scale = POSTER_EDGE / Math.max(canvas.width, canvas.height);
    if (!Number.isFinite(scale) || scale <= 0) return null;
    const thumb = document.createElement("canvas");
    thumb.width = Math.max(1, Math.round(canvas.width * scale));
    thumb.height = Math.max(1, Math.round(canvas.height * scale));
    const ctx = thumb.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
    return thumb.toDataURL("image/jpeg", 0.72);
  } catch {
    // Tainted canvas or an out-of-memory device: a missing poster is fine.
    return null;
  }
}

function bitrateFor(quality: QualityKey): number {
  return quality === "1080" ? 8_000_000 : 4_500_000;
}

/**
 * Mic and shared-system audio have to end up on one track, and only a
 * WebAudio graph can do that. When there's a single source we pass its track
 * through untouched so we don't resample good audio for no reason.
 */
function buildAudioTrack(
  cameraStream: MediaStream | null,
  screenStream: MediaStream | null,
): { track: MediaStreamTrack | null; context: AudioContext | null } {
  const micTracks = cameraStream?.getAudioTracks() ?? [];
  const screenTracks = screenStream?.getAudioTracks() ?? [];
  const live = [...micTracks, ...screenTracks].filter(
    (t) => t.readyState === "live",
  );

  if (live.length === 0) return { track: null, context: null };
  if (live.length === 1) return { track: live[0], context: null };

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return { track: live[0], context: null };

  const context = new Ctor();
  const destination = context.createMediaStreamDestination();
  for (const track of live) {
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const gain = context.createGain();
    // Two sources summed at unity clip easily; back each off a little.
    gain.gain.value = 0.85;
    source.connect(gain).connect(destination);
  }
  void context.resume().catch(() => {});
  return { track: destination.stream.getAudioTracks()[0] ?? null, context };
}

export function useRecorder({ configRef, onTake, onError }: UseRecorderArgs) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recordedBytes, setRecordedBytes] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startedAtRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  // Probed after mount for the same SSR-parity reason as screen sharing.
  const [format, setFormat] = useState<ReturnType<
    typeof pickRecordingFormat
  > | null>(null);
  useEffect(() => setFormat(pickRecordingFormat()), []);
  const supported = format !== null;

  const stopDrawLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const teardown = useCallback(() => {
    stopDrawLoop();
    captureStreamRef.current?.getTracks().forEach((t) => t.stop());
    captureStreamRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    recorderRef.current = null;
  }, [stopDrawLoop]);

  useEffect(() => teardown, [teardown]);

  /** One composited frame. Reads live config so settings can change mid-take. */
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const config = configRef.current;
    if (!canvas || !config) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = sizeRef.current;
    const frame: Rect = { x: 0, y: 0, w: width, h: height };

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    const camera = config.cameraEl;
    const screen = config.screenEl;
    const hasCamera = !!camera && camera.readyState >= 2;
    const hasScreen = !!screen && screen.readyState >= 2;

    if (config.sourceMode === "camera") {
      if (hasCamera) drawCover(ctx, camera, frame, config.mirror);
      return;
    }

    if (config.sourceMode === "screen") {
      if (hasScreen) drawContain(ctx, screen, frame);
      return;
    }

    // screen + camera: screen fills the frame, camera rides in the corner.
    if (hasScreen) drawContain(ctx, screen, frame);
    if (hasCamera) {
      const pip = pipRect(width, height);
      const radius = Math.round(Math.min(pip.w, pip.h) * 0.08);
      ctx.save();
      roundRectPath(ctx, pip, radius);
      ctx.clip();
      drawCover(ctx, camera, pip, config.mirror);
      ctx.restore();
      roundRectPath(ctx, pip, radius);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = Math.max(2, Math.round(width * 0.002));
      ctx.stroke();
    }
  }, [configRef]);

  const runDrawLoop = useCallback(() => {
    const tick = () => {
      drawFrame();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [drawFrame]);

  const start = useCallback(async () => {
    const config = configRef.current;
    if (!config) return false;
    if (!format) {
      onError("This browser can't record video. Try Chrome, Safari or Edge.");
      return false;
    }
    if (status === "recording" || status === "paused") return false;

    const needsCamera = config.sourceMode !== "screen";
    const needsScreen = config.sourceMode !== "camera";
    if (needsCamera && !config.cameraStream) {
      onError("Camera isn't ready yet.");
      return false;
    }
    if (needsScreen && !config.screenStream) {
      onError("Share a screen first, or switch back to camera only.");
      return false;
    }

    const { width, height } = outputSize(config.aspect, config.quality);
    sizeRef.current = { width, height };

    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvasRef.current = canvas;

    // Paint one frame before capturing so the first sampled frame isn't blank.
    drawFrame();
    runDrawLoop();

    const captureStream = canvas.captureStream(FPS);
    const { track: audioTrack, context } = buildAudioTrack(
      config.sourceMode === "screen" ? null : config.cameraStream,
      config.screenStream,
    );
    audioContextRef.current = context;
    if (audioTrack) captureStream.addTrack(audioTrack);
    captureStreamRef.current = captureStream;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(captureStream, {
        ...(format.mimeType ? { mimeType: format.mimeType } : {}),
        videoBitsPerSecond: bitrateFor(config.quality),
        audioBitsPerSecond: 128_000,
      });
    } catch {
      try {
        recorder = new MediaRecorder(captureStream);
      } catch {
        teardown();
        onError("Couldn't start the recorder on this device.");
        return false;
      }
    }

    chunksRef.current = [];
    setRecordedBytes(0);
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
        setRecordedBytes((bytes) => bytes + event.data.size);
      }
    };

    recorder.onerror = () => {
      onError("Recording stopped unexpectedly.");
      setStatus("idle");
      teardown();
    };

    recorder.onstop = () => {
      // Grab the poster before teardown clears the draw loop.
      const poster = canvasRef.current ? capturePoster(canvasRef.current) : null;
      const mimeType = recorder.mimeType || format.mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, {
        type: mimeType.split(";")[0] || "video/webm",
      });
      chunksRef.current = [];
      const durationMs =
        Date.now() - startedAtRef.current - pausedTotalRef.current;
      teardown();
      setStatus("idle");

      if (blob.size === 0) {
        onError("That take came out empty — nothing was saved.");
        return;
      }

      onTake({
        id:
          globalThis.crypto?.randomUUID?.() ??
          `take-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        url: URL.createObjectURL(blob),
        blob,
        mimeType,
        ext: extensionForMime(mimeType),
        durationMs: Math.max(0, durationMs),
        createdAt: Date.now(),
        width,
        height,
        poster,
      });
    };

    startedAtRef.current = Date.now();
    pausedTotalRef.current = 0;
    pausedAtRef.current = null;
    setElapsedMs(0);
    // Timeslice keeps chunks flowing so a crashed tab loses seconds, not takes.
    recorder.start(1000);
    setStatus("recording");
    return true;
  }, [
    configRef,
    drawFrame,
    format,
    onError,
    onTake,
    runDrawLoop,
    status,
    teardown,
  ]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    setStatus("finishing");
    if (pausedAtRef.current !== null) {
      pausedTotalRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    try {
      recorder.stop();
    } catch {
      teardown();
      setStatus("idle");
    }
  }, [teardown]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    try {
      recorder.pause();
      pausedAtRef.current = Date.now();
      setStatus("paused");
    } catch {
      onError("This browser can't pause mid-take.");
    }
  }, [onError]);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    try {
      recorder.resume();
      if (pausedAtRef.current !== null) {
        pausedTotalRef.current += Date.now() - pausedAtRef.current;
        pausedAtRef.current = null;
      }
      setStatus("recording");
    } catch {
      onError("Couldn't resume — stop and start a fresh take.");
    }
  }, [onError]);

  // Drive the on-screen timer.
  useEffect(() => {
    if (status !== "recording") return;
    const id = window.setInterval(() => {
      setElapsedMs(
        Date.now() - startedAtRef.current - pausedTotalRef.current,
      );
    }, 200);
    return () => window.clearInterval(id);
  }, [status]);

  const isActive = status === "recording" || status === "paused";

  return {
    status,
    isActive,
    elapsedMs,
    recordedBytes,
    supported,
    format,
    start,
    stop,
    pause,
    resume,
  };
}
