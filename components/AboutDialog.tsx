"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/ui";

const SITE = "https://akhil-reddy-13.github.io/";
const REPO = "https://github.com/akhil-reddy-13/cue-teleprompter";

const linkClass =
  "font-medium text-accent-soft underline decoration-accent/40 underline-offset-2 transition hover:decoration-accent";

function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-[13px] leading-relaxed text-ink-300">{children}</p>
  );
}

/** A labelled build decision: the label is the choice, the body is the why. */
function Choice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="mt-3">
      <span className="text-[13px] font-medium text-ink-100">{title}:</span>
      <span className="text-[13px] leading-relaxed text-ink-400">
        {" "}
        {children}
      </span>
    </li>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="text-[12.5px] text-ink-300">{children}</code>;
}

export default function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About Pace" onClose={onClose}>
      <P>
        Most web teleprompters make you pick between a greasy $15/mo
        subscription, a watermark stamped across your forehead, or an app that
        crashes the second you swap tabs.
      </P>
      <P>
        I kept having to record quick promo videos and got sick of juggling
        notes on one screen while looking off-camera on the other. Pace is just
        the clean, free tool that should&apos;ve already existed.
      </P>
      <P>
        No accounts, no paywalls, zero backend. Everything runs locally in your
        browser&mdash;your footage never leaves your machine because
        there&apos;s literally nowhere to send it.
      </P>

      <h3 className="mt-6 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-600">
        How it works under the hood
      </h3>

      <ul className="mt-1 list-none">
        <Choice title="True WYSIWYG recording">
          Frames render directly to an offscreen canvas at the exact export
          dimensions before feeding <Code>MediaRecorder</Code> via{" "}
          <Code>captureStream(30)</Code>. What you preview is bit-for-bit what
          gets written to disk.
        </Choice>
        <Choice title="Smart codec probing">
          Prioritizes native H.264/AAC MP4 so takes drop straight into Premiere,
          Photos, or short-form feeds without transcoding, gracefully falling
          back to WebM where muxing isn&apos;t supported.
        </Choice>
        <Choice title="Seamless aspect swaps">
          Toggling between 16:9 and 9:16 reconfigures constraints directly on
          the active media track instead of tearing the stream down&mdash;no
          black screen flash, no re-prompting for camera permissions.
        </Choice>
        <Choice title="Layout-aware scrolling">
          Speed is calibrated in words per minute rather than arbitrary pixels,
          converting dynamically against your screen&apos;s measured typography
          so cadence stays consistent across devices.
        </Choice>
        <Choice title="Speech tracking">
          Leverages the Web Speech API to fuzzy-match live transcriptions
          against a localized script window. Misheard inputs are rejected via
          confidence thresholds, and correction velocity is clamped to keep the
          scroll from jerking around.
        </Choice>
        <Choice title="Minimal WebAudio graph">
          Mic audio is passed through raw by default; a summing node is only
          spun up if system audio is actively captured alongside it.
        </Choice>
      </ul>

      <P>Built with Next.js, React, TypeScript, and Tailwind.</P>

      <p className="mt-5 border-t border-ink-850 pt-4 text-[13px] text-ink-400">
        &mdash;{" "}
        <a href={SITE} target="_blank" rel="noreferrer noopener" className={linkClass}>
          Akhil
        </a>{" "}
        <span className="text-ink-700">/</span>{" "}
        <a href={REPO} target="_blank" rel="noreferrer noopener" className={linkClass}>
          Source on GitHub
        </a>
      </p>
    </Modal>
  );
}
