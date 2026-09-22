"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import CameraGate from "@/components/CameraGate";
import AboutDialog from "@/components/AboutDialog";
import ControlBar, { type PanelKey } from "@/components/ControlBar";
import FillLight from "@/components/FillLight";
import ScriptPanel from "@/components/ScriptPanel";
import SettingsPanel from "@/components/SettingsPanel";
import TakesPanel from "@/components/TakesPanel";
import Teleprompter from "@/components/Teleprompter";
import { clamp, formatClock } from "@/lib/format";
import { pipRect } from "@/lib/layout";
import { parseScript } from "@/lib/script";
import {
  DEFAULT_PROMPTER,
  DEFAULT_STUDIO,
  aspectRatioOf,
  type PrompterSettings,
  type StudioSettings,
  type Take,
} from "@/lib/types";
import {
  useIsTouchPortraitDevice,
  useMediaQuery,
  usePersistentState,
  useWakeLock,
} from "@/lib/hooks";
import { useCamera, useScreenShare } from "@/lib/useMediaSources";
import { useRecorder, type CompositeConfig } from "@/lib/useRecorder";
import { useVoiceSync } from "@/lib/useVoiceSync";
import {
  CloseIcon,
  FilmIcon,
  QuestionIcon,
  ScriptIcon,
  SlidersIcon,
  SparkIcon,
} from "@/components/icons";
import { Note, Pill, Sheet, cx } from "@/components/ui";

const STUDIO_KEY = "cue.studio.v2";
const PROMPTER_KEY = "cue.prompter.v2";

function attachStream(
  el: HTMLVideoElement | null,
  stream: MediaStream | null,
): void {
  if (!el) return;
  if (el.srcObject !== stream) el.srcObject = stream;
  if (stream) void el.play().catch(() => {});
}

/** Resolve once the element has a frame we can composite, or give up quietly. */
function waitForFrame(el: HTMLVideoElement | null): Promise<void> {
  if (!el || el.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener("loadeddata", done);
      resolve();
    };
    el.addEventListener("loadeddata", done);
    window.setTimeout(done, 2000);
  });
}

export default function Studio() {
  const [studio, patchStudio, studioStatus] =
    usePersistentState<StudioSettings>(STUDIO_KEY, DEFAULT_STUDIO);
  const [prompter, patchPrompter] = usePersistentState<PrompterSettings>(
    PROMPTER_KEY,
    DEFAULT_PROMPTER,
  );

  const [takes, setTakes] = useState<Take[]>([]);
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [prompterRunning, setPrompterRunning] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [secureContext, setSecureContext] = useState(true);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const currentWordRef = useRef(0);
  const wordsRef = useRef<string[]>([]);

  const camera = useCamera();
  const screen = useScreenShare();
  const isTouchPortrait = useIsTouchPortraitDevice();
  // Only one of the sidebar / bottom sheet is mounted. CSS-only hiding would
  // keep both trees alive, duplicating the script box and every take's <video>.
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isLandscape = useMediaQuery("(orientation: landscape)");

  const ratio = aspectRatioOf(studio.aspect);
  const parsed = useMemo(() => parseScript(prompter.script), [prompter.script]);
  wordsRef.current = parsed.words;
  const hasScript = parsed.totalWords > 0;

  // ---------------------------------------------------------------- voice sync

  const handleVoiceUnavailable = useCallback(
    (message: string) => {
      setToast(message);
      patchPrompter({ voiceSync: false });
    },
    [patchPrompter],
  );

  const voice = useVoiceSync({
    enabled: prompter.voiceSync && prompterRunning,
    getWords: useCallback(() => wordsRef.current, []),
    getCurrentWord: useCallback(() => currentWordRef.current, []),
    onUnavailable: handleVoiceUnavailable,
  });

  // The slider stays the anchor; a measured rate can only pull it so far, so a
  // bad recognition result can never run the script away from the speaker.
  const effectiveWpm = useMemo(() => {
    if (prompter.voiceSync && voice.heardWpm) {
      return Math.round(
        clamp(voice.heardWpm, prompter.wpm * 0.6, prompter.wpm * 1.7),
      );
    }
    return prompter.wpm;
  }, [prompter.voiceSync, prompter.wpm, voice.heardWpm]);

  // ----------------------------------------------------------------- recording

  const configRef = useRef<CompositeConfig>({
    aspect: studio.aspect,
    quality: studio.quality,
    sourceMode: studio.sourceMode,
    mirror: studio.mirrorRecording,
    cameraEl: null,
    screenEl: null,
    cameraStream: null,
    screenStream: null,
  });

  configRef.current = {
    aspect: studio.aspect,
    quality: studio.quality,
    sourceMode: studio.sourceMode,
    mirror: studio.mirrorRecording,
    cameraEl: cameraVideoRef.current,
    screenEl: screenVideoRef.current,
    cameraStream: camera.stream,
    screenStream: screen.stream,
  };

  const handleTake = useCallback((take: Take) => {
    setTakes((prev) => [take, ...prev]);
    setActivePanel("takes");
  }, []);

  const recorder = useRecorder({
    configRef,
    onTake: handleTake,
    onError: setToast,
  });

  useWakeLock(recorder.isActive || prompterRunning);

  // -------------------------------------------------------------- media wiring

  const startCamera = useCallback(async () => {
    const stream = await camera.start({
      videoDeviceId: studio.videoDeviceId,
      audioDeviceId: studio.audioDeviceId,
      facing: studio.facing,
      // Audio is always captured and muted via the track, so the mic toggle is
      // instant instead of re-prompting for permission.
      micEnabled: true,
      aspect: studio.aspect,
    });
    if (stream) {
      configRef.current.cameraStream = stream;
      attachStream(cameraVideoRef.current, stream);
      stream
        .getAudioTracks()
        .forEach((track) => (track.enabled = studio.micEnabled));
    }
    return stream;
  }, [
    camera,
    studio.aspect,
    studio.audioDeviceId,
    studio.facing,
    studio.micEnabled,
    studio.videoDeviceId,
  ]);

  useEffect(() => {
    setSecureContext(window.isSecureContext !== false);
  }, []);

  // Phones should land on a vertical frame, but never override a saved choice.
  const aspectSeededRef = useRef(false);
  useEffect(() => {
    if (
      !studioStatus.hydrated ||
      isTouchPortrait === null ||
      aspectSeededRef.current
    ) {
      return;
    }
    aspectSeededRef.current = true;
    if (!studioStatus.hadStored && isTouchPortrait) {
      patchStudio({ aspect: "9:16" });
    }
  }, [isTouchPortrait, patchStudio, studioStatus]);

  // Auto-start only when permission was already granted, so a first-time
  // visitor isn't hit with a permission prompt before they've seen the app.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!studioStatus.hydrated || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void (async () => {
      try {
        const permissions = (
          navigator as unknown as {
            permissions?: {
              query: (d: { name: string }) => Promise<{ state: string }>;
            };
          }
        ).permissions;
        const status = await permissions?.query({ name: "camera" });
        if (status?.state === "granted") await startCamera();
      } catch {
        // Safari has no camera permission query; the user taps to start.
      }
    })();
  }, [startCamera, studioStatus.hydrated]);

  // Re-acquire when the chosen device changes.
  const sourceKey = `${studio.videoDeviceId ?? ""}|${studio.audioDeviceId ?? ""}|${studio.facing}`;
  const lastSourceKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastSourceKeyRef.current === null) {
      lastSourceKeyRef.current = sourceKey;
      return;
    }
    if (lastSourceKeyRef.current === sourceKey) return;
    lastSourceKeyRef.current = sourceKey;
    if (camera.status === "live") void startCamera();
  }, [camera.status, sourceKey, startCamera]);

  // Aspect changes retune the live track rather than restarting it.
  useEffect(() => {
    if (camera.status === "live") void camera.retuneAspect(studio.aspect);
  }, [camera, studio.aspect]);

  useEffect(() => {
    camera.setMicEnabled(studio.micEnabled);
  }, [camera, camera.stream, studio.micEnabled]);

  useEffect(() => {
    attachStream(cameraVideoRef.current, camera.stream);
  }, [camera.stream]);

  useEffect(() => {
    attachStream(screenVideoRef.current, screen.stream);
  }, [screen.stream]);

  useEffect(() => {
    screen.onEnded(() => {
      patchStudio({ sourceMode: "camera" });
      setToast("Screen sharing ended — back to camera only.");
    });
    return () => screen.onEnded(null);
  }, [patchStudio, screen]);

  // Measure the stage so the frame is exactly the chosen aspect ratio.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // Must be the *content* box: the stage carries padding, and sizing the
    // frame off the border box makes it too wide, at which point flex-shrink
    // squashes it and the preview stops matching the recorded aspect ratio.
    const fit = (availableW: number, availableH: number) => {
      const w = Math.min(
        Math.max(0, availableW),
        Math.max(0, availableH) * ratio,
      );
      setFrame({ w: Math.floor(w), h: Math.floor(w / ratio) });
    };
    const measureFromStyle = () => {
      const style = getComputedStyle(stage);
      const padX =
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY =
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      fit(stage.clientWidth - padX, stage.clientHeight - padY);
    };
    measureFromStyle();
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) fit(box.width, box.height);
      else measureFromStyle();
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [ratio]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Warn before losing takes that only exist in this tab.
  useEffect(() => {
    if (takes.length === 0 && !recorder.isActive) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [recorder.isActive, takes.length]);

  // ------------------------------------------------------------------- actions

  const toggleScreenShare = useCallback(async () => {
    const result = await screen.start();
    if (!result.ok) {
      if (result.error) setToast(result.error);
      if (!screen.stream) patchStudio({ sourceMode: "camera" });
      return;
    }
    configRef.current.screenStream = result.stream;
    attachStream(screenVideoRef.current, result.stream);
  }, [patchStudio, screen]);

  const beginRecording = useCallback(async () => {
    const needsCamera = studio.sourceMode !== "screen";
    const needsScreen = studio.sourceMode !== "camera";
    await Promise.all([
      needsCamera ? waitForFrame(cameraVideoRef.current) : Promise.resolve(),
      needsScreen ? waitForFrame(screenVideoRef.current) : Promise.resolve(),
    ]);

    const started = await recorder.start();
    if (!started) return;

    voice.reset();
    currentWordRef.current = 0;
    setResetToken((token) => token + 1);
    setPrompterRunning(hasScript);
  }, [hasScript, recorder, studio.sourceMode, voice]);

  const handleRecordToggle = useCallback(async () => {
    if (countdownLeft !== null) {
      setCountdownLeft(null);
      return;
    }
    if (recorder.isActive) {
      recorder.stop();
      setPrompterRunning(false);
      return;
    }
    if (recorder.status === "finishing") return;

    if (studio.sourceMode !== "screen" && camera.status !== "live") {
      const stream = await startCamera();
      if (!stream) return;
    }
    if (studio.sourceMode !== "camera" && !screen.stream) {
      const result = await screen.start();
      if (!result.ok) {
        if (result.error) setToast(result.error);
        return;
      }
      configRef.current.screenStream = result.stream;
      attachStream(screenVideoRef.current, result.stream);
    }

    if (studio.countdown > 0) {
      setCountdownLeft(studio.countdown);
      return;
    }
    await beginRecording();
  }, [
    beginRecording,
    camera.status,
    countdownLeft,
    recorder,
    screen,
    startCamera,
    studio.countdown,
    studio.sourceMode,
  ]);

  const countdownFiredRef = useRef(false);
  useEffect(() => {
    if (countdownLeft === null) {
      countdownFiredRef.current = false;
      return;
    }
    if (countdownLeft <= 0) {
      if (countdownFiredRef.current) return;
      countdownFiredRef.current = true;
      setCountdownLeft(null);
      void beginRecording();
      return;
    }
    const id = window.setTimeout(
      () => setCountdownLeft((n) => (n === null ? null : n - 1)),
      1000,
    );
    return () => window.clearTimeout(id);
  }, [beginRecording, countdownLeft]);

  const handlePauseToggle = useCallback(() => {
    if (recorder.status === "paused") {
      recorder.resume();
      if (hasScript) setPrompterRunning(true);
    } else {
      recorder.pause();
      setPrompterRunning(false);
    }
  }, [hasScript, recorder]);

  const togglePrompter = useCallback(() => {
    if (!hasScript) {
      setActivePanel("script");
      return;
    }
    setPrompterRunning((running) => !running);
  }, [hasScript]);

  const resetPrompter = useCallback(() => {
    setPrompterRunning(false);
    currentWordRef.current = 0;
    voice.reset();
    setResetToken((token) => token + 1);
  }, [voice]);

  const handleFlip = useCallback(() => {
    if (isTouchPortrait || camera.cameras.length < 2) {
      patchStudio((prev) => ({
        facing: prev.facing === "user" ? "environment" : "user",
        videoDeviceId: null,
      }));
      return;
    }
    const list = camera.cameras;
    const index = list.findIndex((d) => d.deviceId === studio.videoDeviceId);
    const next = list[(index + 1) % list.length];
    patchStudio({ videoDeviceId: next.deviceId });
  }, [camera.cameras, isTouchPortrait, patchStudio, studio.videoDeviceId]);

  const deleteTake = useCallback((id: string) => {
    setTakes((prev) => {
      const target = prev.find((take) => take.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((take) => take.id !== id);
    });
  }, []);

  const handlePrompterFinished = useCallback(() => {
    setPrompterRunning(false);
    setToast(
      recorder.isActive
        ? "End of script — still recording. Stop when you're ready."
        : "End of script.",
    );
  }, [recorder.isActive]);

  // ----------------------------------------------------------------- shortcuts

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case "r":
        case "R":
          event.preventDefault();
          void handleRecordToggle();
          break;
        case " ":
          event.preventDefault();
          togglePrompter();
          break;
        case "Escape":
          // Topmost surface first: the About dialog sits above the panels.
          if (aboutOpen) {
            setAboutOpen(false);
            break;
          }
          setActivePanel(null);
          if (countdownLeft !== null) setCountdownLeft(null);
          break;
        case "ArrowUp":
          event.preventDefault();
          patchPrompter((prev) => ({ wpm: clamp(prev.wpm + 5, 70, 260) }));
          break;
        case "ArrowDown":
          event.preventDefault();
          patchPrompter((prev) => ({ wpm: clamp(prev.wpm - 5, 70, 260) }));
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    aboutOpen,
    countdownLeft,
    handleRecordToggle,
    patchPrompter,
    togglePrompter,
  ]);

  // -------------------------------------------------------------------- render

  const showScreen = studio.sourceMode !== "camera";

  /**
   * Mirroring the preview is a comfort feature — it makes the picture behave
   * like a mirror when you're looking at yourself. On a rear camera you're
   * looking at the world, so flipping it just reverses any text in the shot.
   * The recording toggle is a deliberate creative choice and stays honoured.
   */
  const usingRearCamera =
    studio.videoDeviceId === null && studio.facing === "environment";
  const previewMirrored = studio.mirrorPreview && !usingRearCamera;
  const cameraIsPip = studio.sourceMode === "screen+camera";
  const pip = cameraIsPip ? pipRect(frame.w, frame.h) : null;

  const cameraStyle: CSSProperties = pip
    ? {
        left: pip.x,
        top: pip.y,
        width: pip.w,
        height: pip.h,
        borderRadius: Math.round(Math.min(pip.w, pip.h) * 0.08),
        boxShadow: "0 0 0 1.5px rgba(255,255,255,0.35)",
        opacity: 1,
        transform: previewMirrored ? "scaleX(-1)" : undefined,
      }
    : {
        left: 0,
        top: 0,
        width: frame.w || "100%",
        height: frame.h || "100%",
        opacity: studio.sourceMode === "screen" ? 0 : 1,
        transform: previewMirrored ? "scaleX(-1)" : undefined,
      };

  const formatLabel = recorder.format
    ? recorder.format.ext === "mp4"
      ? "MP4 (H.264)"
      : "WebM (VP8/VP9)"
    : "unsupported";

  const cameraNeeded = studio.sourceMode !== "screen";
  const showSplash =
    cameraNeeded && camera.status !== "live" && camera.status !== "starting";
  const recordDisabled =
    !recorder.supported ||
    (cameraNeeded && camera.status === "starting") ||
    (studio.sourceMode === "screen" && !screen.stream);

  const panelKey: PanelKey = activePanel ?? "script";

  // A vertical frame inside a landscape phone viewport leaves a sliver of
  // preview; say so rather than letting it look broken.
  const showRotateHint =
    isTouchPortrait === true &&
    isLandscape === true &&
    ratio <= 1 &&
    camera.status === "live" &&
    !recorder.isActive;

  const panelContent = (embedded: boolean) => {
    if (panelKey === "script") {
      return (
        <ScriptPanel
          embedded={embedded}
          prompter={prompter}
          onPatch={patchPrompter}
          onClose={() => setActivePanel(null)}
          heardWpm={voice.heardWpm}
          voiceListening={voice.listening}
          lastHeard={voice.lastHeard}
          voiceSupported={voice.supported}
        />
      );
    }
    if (panelKey === "setup") {
      return (
        <SettingsPanel
          embedded={embedded}
          studio={studio}
          prompter={prompter}
          onStudioPatch={patchStudio}
          onPromptPatch={patchPrompter}
          onClose={() => setActivePanel(null)}
          cameras={camera.cameras}
          microphones={camera.microphones}
          screenSupported={screen.supported}
          screenActive={!!screen.stream}
          onToggleScreen={() => void toggleScreenShare()}
          recordingActive={recorder.isActive}
          formatLabel={formatLabel}
          rearCameraActive={usingRearCamera}
        />
      );
    }
    return (
      <TakesPanel
        embedded={embedded}
        takes={takes}
        onDelete={deleteTake}
        onClose={() => setActivePanel(null)}
      />
    );
  };

  const tabs: { key: PanelKey; label: string; icon: ReactNode }[] = [
    {
      key: "script",
      label: "Script",
      icon: <ScriptIcon className="h-4 w-4" />,
    },
    { key: "setup", label: "Setup", icon: <SlidersIcon className="h-4 w-4" /> },
    { key: "takes", label: "Takes", icon: <FilmIcon className="h-4 w-4" /> },
  ];

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-ink-950">
      <FillLight brightness={studio.fillLight} warmth={studio.fillWarmth} />

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex shrink-0 items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),0.65rem)] pb-2.5 [@media(max-height:560px)]:pb-1.5 [@media(max-height:560px)]:pt-[max(env(safe-area-inset-top),0.35rem)]">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-ink-100"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            <h1 className="text-[15px] font-semibold tracking-tight text-white">
              Cue
            </h1>
            <p className="hidden truncate text-[11px] text-ink-500 md:block">
              Teleprompter + recorder. No watermark, no trial, no upload.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              aria-label="About Cue"
              title="About Cue"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-850 hover:text-ink-200"
            >
              <QuestionIcon className="h-[17px] w-[17px]" />
            </button>
            {prompter.voiceSync && (
              <Pill tone={voice.listening ? "accent" : "neutral"}>
                <SparkIcon className="h-3 w-3" />
                {voice.listening ? "Following" : "Voice sync"}
              </Pill>
            )}
          </div>
        </header>

        {!secureContext && (
          <div className="relative z-20 mx-4 mb-2">
            <Note tone="warn">
              Cameras need a secure connection. Open this over HTTPS or on
              localhost.
            </Note>
          </div>
        )}

        <div
          ref={stageRef}
          className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-2 pb-1.5 sm:px-5"
        >
          {/* Ambient wash so the space around a letterboxed frame reads as
              deliberate rather than empty. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-70"
            style={{
              background:
                "radial-gradient(65% 55% at 50% 42%, rgba(60,68,88,0.22) 0%, rgba(0,0,0,0) 72%)",
            }}
          />
          {showRotateHint && (
            <div className="pointer-events-none absolute inset-x-0 bottom-1 z-30 flex justify-center px-3">
              <span className="whitespace-nowrap rounded-full bg-ink-800/90 px-2.5 py-1 text-[10.5px] font-medium text-ink-200 ring-1 ring-inset ring-ink-700 backdrop-blur-md">
                Hold your phone upright for a bigger preview
              </span>
            </div>
          )}
          <div
            data-stage-frame
            className="relative shrink-0 overflow-hidden rounded-[20px] bg-black shadow-stage ring-1 ring-white/[0.09]"
            style={{
              width: frame.w || undefined,
              height: frame.h || undefined,
            }}
          >
            <video
              ref={screenVideoRef}
              muted
              playsInline
              autoPlay
              className="absolute inset-0 z-0 h-full w-full object-contain"
              style={{ opacity: showScreen ? 1 : 0 }}
            />
            <video
              ref={cameraVideoRef}
              muted
              playsInline
              autoPlay
              className="absolute z-10 overflow-hidden object-cover"
              style={cameraStyle}
            />

            {frame.h > 0 && !showSplash && (
              <Teleprompter
                settings={prompter}
                running={prompterRunning}
                effectiveWpm={effectiveWpm}
                voiceMatchRef={voice.matchRef}
                currentWordRef={currentWordRef}
                resetToken={resetToken}
                onToggleRunning={togglePrompter}
                onFinished={handlePrompterFinished}
              />
            )}

            {recorder.isActive && (
              <div
                data-rec-badge
                className="fade-in absolute bottom-3 left-3 z-30 flex items-center gap-2 rounded-full bg-black/60 py-1 pl-2 pr-2.5 text-[11px] font-semibold tabular-nums text-white ring-1 ring-inset ring-white/10 backdrop-blur-md"
              >
                <span
                  className={cx(
                    "h-2 w-2 rounded-full",
                    recorder.status === "paused"
                      ? "bg-ink-400"
                      : "rec-dot bg-accent",
                  )}
                />
                {recorder.status === "paused"
                  ? "Paused"
                  : formatClock(recorder.elapsedMs)}
              </div>
            )}

            {countdownLeft !== null && countdownLeft > 0 && (
              <div
                className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3"
                style={{
                  background:
                    "radial-gradient(60% 50% at 50% 50%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.3) 100%)",
                }}
              >
                <span
                  key={countdownLeft}
                  className="countdown-num text-[24vmin] font-semibold leading-none tracking-tight text-white [text-shadow:0_8px_48px_rgba(0,0,0,0.7)]"
                >
                  {countdownLeft}
                </span>
                <span className="text-xs font-medium text-white/70">
                  Look at the lens
                </span>
              </div>
            )}

            {showSplash && (
              <CameraGate
                firstRun={!studioStatus.hadStored}
                errored={camera.status === "error"}
                message={camera.error}
                onEnable={() => void startCamera()}
                screenSupported={screen.supported}
                onScreenInstead={() => {
                  patchStudio({ sourceMode: "screen" });
                  void toggleScreenShare();
                }}
              />
            )}

            {camera.status === "starting" && (
              <div className="fade-in absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-ink-950/70">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-700 border-t-ink-200" />
                <span className="text-xs font-medium text-ink-400">
                  Starting camera…
                </span>
              </div>
            )}
          </div>
        </div>

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="toast-in relative z-30 mx-auto mb-1.5 w-full max-w-md px-4"
          >
            <div className="flex items-start gap-2.5 rounded-xl bg-ink-800/95 py-2.5 pl-3 pr-2 text-[11.5px] leading-relaxed text-ink-200 shadow-lift ring-1 ring-inset ring-ink-700 backdrop-blur-md">
              <span className="flex-1">{toast}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="-mt-0.5 shrink-0 rounded-md p-1 text-ink-500 transition hover:bg-ink-700 hover:text-white"
                aria-label="Dismiss message"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <ControlBar
          status={recorder.status}
          isActive={recorder.isActive}
          elapsedMs={recorder.elapsedMs}
          recordedBytes={recorder.recordedBytes}
          countdownLeft={countdownLeft}
          countdownTotal={studio.countdown}
          onRecordToggle={() => void handleRecordToggle()}
          onPauseToggle={handlePauseToggle}
          prompterRunning={prompterRunning}
          hasScript={hasScript}
          onPrompterToggle={togglePrompter}
          onPrompterReset={resetPrompter}
          micEnabled={studio.micEnabled}
          onMicToggle={() =>
            patchStudio((prev) => ({ micEnabled: !prev.micEnabled }))
          }
          canFlip={isTouchPortrait === true || camera.cameras.length > 1}
          onFlip={handleFlip}
          takesCount={takes.length}
          activePanel={activePanel}
          onPanel={(panel) =>
            setActivePanel((current) => (current === panel ? null : panel))
          }
          recordDisabled={recordDisabled}
        />
      </main>

      {/* Desktop sidebar */}
      {isDesktop !== false && (
        <aside className="relative z-20 hidden w-[380px] shrink-0 flex-col border-l border-ink-800 bg-ink-950 lg:flex">
          <div className="flex shrink-0 gap-1 border-b border-ink-800 p-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActivePanel(tab.key)}
                aria-pressed={panelKey === tab.key}
                className={cx(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition",
                  panelKey === tab.key
                    ? "bg-ink-800 text-white"
                    : "text-ink-400 hover:bg-ink-850 hover:text-white",
                )}
              >
                {tab.icon}
                {tab.label}
                {tab.key === "takes" && takes.length > 0 && (
                  <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                    {takes.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          {panelContent(true)}
        </aside>
      )}

      {/* Mobile sheet */}
      {isDesktop === false && activePanel && (
        <Sheet
          title={
            activePanel === "script"
              ? "Script"
              : activePanel === "setup"
                ? "Setup"
                : "Takes"
          }
          onClose={() => setActivePanel(null)}
        >
          {panelContent(true)}
        </Sheet>
      )}

      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
    </div>
  );
}
