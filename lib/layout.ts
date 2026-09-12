import type { AspectKey, QualityKey } from "@/lib/types";
import { aspectRatioOf } from "@/lib/types";

export type Rect = { x: number; y: number; w: number; h: number };

/** Output pixel size. `quality` is the short edge, the way "1080p" is normally meant. */
export function outputSize(
  aspect: AspectKey,
  quality: QualityKey,
): { width: number; height: number } {
  const ratio = aspectRatioOf(aspect);
  const shortEdge = quality === "1080" ? 1080 : 720;
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  if (ratio <= 1) {
    return { width: even(shortEdge), height: even(shortEdge / ratio) };
  }
  return { width: even(shortEdge * ratio), height: even(shortEdge) };
}

/**
 * Picture-in-picture camera box for screen-share layouts. Shared by the canvas
 * compositor and the on-screen preview so the preview is honestly WYSIWYG.
 */
export function pipRect(frameW: number, frameH: number): Rect {
  const portrait = frameH >= frameW;
  const margin = Math.round(Math.min(frameW, frameH) * 0.035);
  const w = Math.round(frameW * (portrait ? 0.34 : 0.26));
  const h = Math.round(w * (portrait ? 4 / 3 : 3 / 4));
  return { x: frameW - w - margin, y: frameH - h - margin, w, h };
}

/** Crop-to-fill: the frame is always covered, edges are trimmed. */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  source: HTMLVideoElement,
  dest: Rect,
  mirror: boolean,
): void {
  const vw = source.videoWidth;
  const vh = source.videoHeight;
  if (!vw || !vh || dest.w <= 0 || dest.h <= 0) return;

  const scale = Math.max(dest.w / vw, dest.h / vh);
  const sw = dest.w / scale;
  const sh = dest.h / scale;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;

  ctx.save();
  if (mirror) {
    ctx.translate(dest.x + dest.w, dest.y);
    ctx.scale(-1, 1);
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, dest.w, dest.h);
  } else {
    ctx.drawImage(source, sx, sy, sw, sh, dest.x, dest.y, dest.w, dest.h);
  }
  ctx.restore();
}

/** Fit-inside: nothing is cropped, so shared screens stay fully readable. */
export function drawContain(
  ctx: CanvasRenderingContext2D,
  source: HTMLVideoElement,
  dest: Rect,
): void {
  const vw = source.videoWidth;
  const vh = source.videoHeight;
  if (!vw || !vh || dest.w <= 0 || dest.h <= 0) return;

  const scale = Math.min(dest.w / vw, dest.h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = dest.x + (dest.w - dw) / 2;
  const dy = dest.y + (dest.h - dh) / 2;
  ctx.drawImage(source, 0, 0, vw, vh, dx, dy, dw, dh);
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  radius: number,
): void {
  const r = Math.min(radius, rect.w / 2, rect.h / 2);
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(rect.x + r, rect.y);
  ctx.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, r);
  ctx.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, r);
  ctx.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, r);
  ctx.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, r);
  ctx.closePath();
}
