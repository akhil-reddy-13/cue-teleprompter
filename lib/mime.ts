type RecordingFormat = { mimeType: string; ext: string };

/**
 * MP4 first: it drops straight into iOS Photos, Premiere, CapCut and the
 * Instagram/TikTok uploaders without a conversion step. WebM is the fallback
 * for browsers whose MediaRecorder can't mux H.264 (mostly Firefox).
 */
const CANDIDATES: RecordingFormat[] = [
  { mimeType: 'video/mp4;codecs="avc1.4d002a,mp4a.40.2"', ext: "mp4" },
  { mimeType: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', ext: "mp4" },
  { mimeType: "video/mp4", ext: "mp4" },
  { mimeType: 'video/webm;codecs="vp9,opus"', ext: "webm" },
  { mimeType: 'video/webm;codecs="vp8,opus"', ext: "webm" },
  { mimeType: "video/webm", ext: "webm" },
];

export function pickRecordingFormat(): RecordingFormat | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const candidate of CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(candidate.mimeType)) return candidate;
    } catch {
      // isTypeSupported throws on some older engines; keep probing.
    }
  }
  // Last resort: let the browser choose its own default container.
  return { mimeType: "", ext: "webm" };
}

export function extensionForMime(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("quicktime")) return "mov";
  return "webm";
}
