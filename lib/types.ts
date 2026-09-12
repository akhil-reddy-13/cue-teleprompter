export type AspectKey = "9:16" | "4:5" | "1:1" | "4:3" | "16:9";

export type AspectOption = {
  key: AspectKey;
  label: string;
  hint: string;
  ratio: number; // width / height
};

export const ASPECTS: AspectOption[] = [
  { key: "9:16", label: "9:16", hint: "Reels / TikTok / Shorts", ratio: 9 / 16 },
  { key: "4:5", label: "4:5", hint: "Instagram feed", ratio: 4 / 5 },
  { key: "1:1", label: "1:1", hint: "Square", ratio: 1 },
  { key: "4:3", label: "4:3", hint: "Classic", ratio: 4 / 3 },
  { key: "16:9", label: "16:9", hint: "YouTube / landscape", ratio: 16 / 9 },
];

export function aspectRatioOf(key: AspectKey): number {
  return ASPECTS.find((a) => a.key === key)?.ratio ?? 9 / 16;
}

/** What gets composited into the recording. */
export type SourceMode = "camera" | "screen" | "screen+camera";

export type QualityKey = "720" | "1080";

export type Take = {
  id: string;
  url: string;
  blob: Blob;
  mimeType: string;
  ext: string;
  durationMs: number;
  createdAt: number;
  width: number;
  height: number;
  /** Small JPEG data URL of the final frame, used as the takes-list poster. */
  poster: string | null;
};

export type PrompterSettings = {
  script: string;
  wpm: number;
  fontSize: number; // px at a 1080-tall reference frame
  lineHeight: number;
  heightPct: number; // share of the frame the prompter covers
  opacity: number; // backdrop opacity
  mirrorText: boolean;
  bold: boolean;
  visible: boolean;
  voiceSync: boolean;
};

export type StudioSettings = {
  aspect: AspectKey;
  sourceMode: SourceMode;
  quality: QualityKey;
  mirrorPreview: boolean;
  mirrorRecording: boolean;
  countdown: number;
  micEnabled: boolean;
  fillLight: number; // 0-100
  fillWarmth: number; // 0-100 (0 = daylight, 100 = warm)
  videoDeviceId: string | null;
  audioDeviceId: string | null;
  facing: "user" | "environment";
};

export const DEFAULT_PROMPTER: PrompterSettings = {
  script: "",
  wpm: 145,
  fontSize: 44,
  lineHeight: 1.45,
  heightPct: 42,
  opacity: 55,
  mirrorText: false,
  bold: true,
  visible: true,
  voiceSync: false,
};

export const DEFAULT_STUDIO: StudioSettings = {
  aspect: "16:9",
  sourceMode: "camera",
  quality: "1080",
  mirrorPreview: true,
  mirrorRecording: false,
  countdown: 3,
  micEnabled: true,
  fillLight: 0,
  fillWarmth: 25,
  videoDeviceId: null,
  audioDeviceId: null,
  facing: "user",
};
