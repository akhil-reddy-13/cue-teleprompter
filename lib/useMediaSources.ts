"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { aspectRatioOf, type AspectKey } from "@/lib/types";

export type CameraStatus = "off" | "starting" | "live" | "error";

export type DeviceInfo = { deviceId: string; label: string };

type CameraRequest = {
  videoDeviceId: string | null;
  audioDeviceId: string | null;
  facing: "user" | "environment";
  micEnabled: boolean;
  aspect: AspectKey;
};

function describeError(error: unknown): string {
  const name = (error as { name?: string })?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera and mic access was blocked. Allow it in your browser's site settings, then try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found. Plug one in or pick a different device.";
    case "NotReadableError":
    case "TrackStartError":
      return "Another app is using the camera. Close it (Zoom, Meet, Photo Booth) and try again.";
    case "AbortError":
      return "The camera stopped responding. Try again.";
    default:
      return "Couldn't start the camera. Try again, or pick a different device.";
  }
}

/**
 * Resolution hints that actually agree with the ratio being asked for.
 *
 * These used to be a hardcoded 1920x1080 / 1080x1920 pair, which contradicts
 * every ratio that isn't 16:9 or 9:16 — asking for 4:3 alongside a 1920x1080
 * size lets the browser satisfy the size and quietly drop the aspect, so a
 * 4:3 frame ends up cropping a 16:9 source.
 */
function idealSizeFor(aspect: AspectKey): MediaTrackConstraints {
  const ratio = aspectRatioOf(aspect);
  const shortEdge = 1080;
  return {
    width: { ideal: ratio >= 1 ? Math.round(shortEdge * ratio) : shortEdge },
    height: { ideal: ratio >= 1 ? shortEdge : Math.round(shortEdge / ratio) },
    aspectRatio: { ideal: ratio },
  };
}

/**
 * Whether a track is at least the right way up for the target frame.
 *
 * The compositor crops to fill, so a portrait track in a landscape frame is
 * not a harmless mismatch: it keeps a thin horizontal band from the middle of
 * the picture and discards the rest, which reads as an extreme zoom.
 */
function orientationMatches(
  track: MediaStreamTrack,
  aspect: AspectKey,
): boolean {
  const { width, height } = track.getSettings();
  if (!width || !height) return true; // Nothing to judge on; leave it be.
  const side = (r: number) => (r > 1.05 ? 1 : r < 0.95 ? -1 : 0);
  return side(aspectRatioOf(aspect)) === side(width / height);
}

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<DeviceInfo[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const generationRef = useRef(0);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const toInfo = (d: MediaDeviceInfo, i: number, kind: string) => ({
        deviceId: d.deviceId,
        label: d.label || `${kind} ${i + 1}`,
      });
      setCameras(
        devices
          .filter((d) => d.kind === "videoinput")
          .map((d, i) => toInfo(d, i, "Camera")),
      );
      setMicrophones(
        devices
          .filter((d) => d.kind === "audioinput")
          .map((d, i) => toInfo(d, i, "Microphone")),
      );
    } catch {
      // Enumeration is a nicety; the app works without a device list.
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const start = useCallback(
    async (request: CameraRequest) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setError(
          "This browser doesn't support camera capture. Try Chrome, Safari or Edge.",
        );
        return null;
      }

      const generation = ++generationRef.current;
      setStatus("starting");
      setError(null);

      const video: MediaTrackConstraints = {
        ...idealSizeFor(request.aspect),
        frameRate: { ideal: 30, max: 60 },
        ...(request.videoDeviceId
          ? { deviceId: { exact: request.videoDeviceId } }
          : { facingMode: { ideal: request.facing } }),
      };
      const audio: MediaTrackConstraints | false = request.micEnabled
        ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...(request.audioDeviceId
              ? { deviceId: { exact: request.audioDeviceId } }
              : {}),
          }
        : false;

      const attempts: MediaStreamConstraints[] = [
        { video, audio },
        // Drop the resolution hints if the device can't satisfy them.
        {
          video: request.videoDeviceId
            ? { deviceId: { exact: request.videoDeviceId } }
            : { facingMode: { ideal: request.facing } },
          audio,
        },
        { video: true, audio },
      ];

      let lastError: unknown = null;
      for (const constraints of attempts) {
        try {
          const next = await navigator.mediaDevices.getUserMedia(constraints);
          if (generation !== generationRef.current) {
            next.getTracks().forEach((t) => t.stop());
            return null;
          }
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = next;
          setStream(next);
          setStatus("live");
          setError(null);
          void refreshDevices();
          return next;
        } catch (err) {
          lastError = err;
          const name = (err as { name?: string })?.name;
          // A hard denial won't be fixed by loosening constraints.
          if (name === "NotAllowedError" || name === "SecurityError") break;
        }
      }

      if (generation !== generationRef.current) return null;
      setStatus("error");
      setError(describeError(lastError));
      return null;
    },
    [refreshDevices],
  );

  const stop = useCallback(() => {
    generationRef.current += 1;
    stopStream();
    setStatus("off");
  }, [stopStream]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;
    const handler = () => void refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", handler);
    return () =>
      navigator.mediaDevices.removeEventListener("devicechange", handler);
  }, [refreshDevices]);

  /**
   * Retune the live track instead of re-acquiring, so switching aspect ratio
   * doesn't flash a black preview or re-trigger a permission prompt.
   */
  const retuneAspect = useCallback(async (aspect: AspectKey) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return true;
    try {
      await track.applyConstraints(idealSizeFor(aspect));
    } catch {
      // Some cameras refuse to retune a live track at all.
    }
    // Retuning is best-effort, so check the result rather than assume it. A
    // camera that won't turn landscape needs its stream rebuilt, which the
    // caller does; permission is already granted, so there is no new prompt.
    return orientationMatches(track, aspect);
  }, []);

  const setMicEnabled = useCallback((enabled: boolean) => {
    streamRef.current
      ?.getAudioTracks()
      .forEach((track) => (track.enabled = enabled));
  }, []);

  return {
    stream,
    status,
    error,
    cameras,
    microphones,
    start,
    stop,
    refreshDevices,
    retuneAspect,
    setMicEnabled,
  };
}

export function useScreenShare() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const endedCallbackRef = useRef<(() => void) | null>(null);

  // Resolved after mount: the server has no `navigator`, and branching on it
  // during render would desync the first client paint from the SSR output.
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(
      typeof navigator.mediaDevices?.getDisplayMedia === "function",
    );
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const start = useCallback(async (): Promise<
    { ok: true; stream: MediaStream } | { ok: false; error: string | null }
  > => {
    if (!supported) {
      return { ok: false, error: "Screen sharing isn't available on this device." };
    }
    try {
      const next = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: true,
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = next;
      setStream(next);
      next.getVideoTracks()[0]?.addEventListener("ended", () => {
        stop();
        endedCallbackRef.current?.();
      });
      return { ok: true, stream: next };
    } catch (err) {
      const name = (err as { name?: string })?.name;
      // The user dismissing the picker isn't an error worth surfacing.
      if (name === "NotAllowedError" || name === "AbortError") {
        return { ok: false, error: null };
      }
      return { ok: false, error: "Couldn't start screen sharing." };
    }
  }, [supported, stop]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const onEnded = useCallback((callback: (() => void) | null) => {
    endedCallbackRef.current = callback;
  }, []);

  return { stream, supported, start, stop, onEnded };
}
