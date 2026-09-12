"use client";

const COOL: [number, number, number] = [232, 243, 255];
const WARM: [number, number, number] = [255, 214, 162];

function blend(warmth: number): string {
  const t = Math.min(1, Math.max(0, warmth / 100));
  const channels = COOL.map((cool, i) => Math.round(cool + (WARM[i] - cool) * t));
  return `rgb(${channels.join(",")})`;
}

/**
 * A soft wash of light behind the stage. It lives outside the video frame, so
 * it brightens the speaker's face without ever entering the recording.
 */
export default function FillLight({
  brightness,
  warmth,
}: {
  brightness: number;
  warmth: number;
}) {
  if (brightness <= 0) return null;
  const color = blend(warmth);
  const strength = brightness / 100;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
      style={{
        background: `radial-gradient(120% 85% at 50% 38%, ${color} 0%, ${color} 46%, rgba(0,0,0,0) 100%)`,
        opacity: 0.18 + strength * 0.82,
      }}
    />
  );
}
