"use client";

import { Modal } from "@/components/ui";

const SITE = "https://akhil-reddy-13.github.io/";
const REPO = "https://github.com/akhil-reddy-13/cue-teleprompter";

function H({ children }: { children: string }) {
  return (
    <h3 className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-600">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-[13px] leading-relaxed text-ink-300">{children}</p>
  );
}

/** A labelled build decision. The label is the choice, the body is the why. */
function Choice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="mt-2.5">
      <span className="text-[13px] font-medium text-ink-100">{title}</span>
      <span className="text-[13px] leading-relaxed text-ink-400"> — {children}</span>
    </li>
  );
}

export default function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About" onClose={onClose}>
      <P>
        Hi! I&apos;m Akhil — CS + Math at Stanford. More of my work is at{" "}
        <a
          href={SITE}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-accent-soft underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
        >
          akhil-reddy-13.github.io
        </a>
        .
      </P>

      <H>Why this exists</H>
      <P>
        I kept having to record marketing videos for a club, reading off a
        script. Doing it meant juggling two screens — notes on one, camera on
        the other — so my eyes were always off the lens. Every teleprompter app
        I tried put the useful half behind a paywall or stamped a watermark
        across my face. So I built the thing I actually wanted.
      </P>

      <H>How it&apos;s built</H>
      <P>
        Next.js and React, TypeScript, Tailwind. It is a fully static site:
        there is no backend, no database, no accounts, and no API keys. Your
        video is never uploaded, because there is nowhere to upload it to.
      </P>
      <ul className="mt-3 list-none">
        <Choice title="Canvas compositor">
          every frame is drawn to an offscreen canvas at the exact output size,
          then <code className="text-ink-300">captureStream(30)</code> feeds
          that canvas into <code className="text-ink-300">MediaRecorder</code>.
          Framing is honestly WYSIWYG — the preview is the same pipeline the
          file comes out of, not an approximation of it.
        </Choice>
        <Choice title="MP4 first, WebM fallback">
          the recorder probes codec support and prefers H.264/AAC, so takes
          drop straight into Photos, Premiere, or the TikTok uploader with no
          conversion step. Firefox can&apos;t mux that, so it gets WebM.
        </Choice>
        <Choice title="Aspect changes retune the live track">
          switching 16:9 to 9:16 calls{" "}
          <code className="text-ink-300">applyConstraints</code> on the
          existing camera track instead of tearing the stream down — no black
          flash and no second permission prompt.
        </Choice>
        <Choice title="Scrolling in words per minute">
          wpm is the unit a person can reason about, so the prompter converts
          it to pixels using the script&apos;s own measured layout. The same
          setting reads the same on a phone and a laptop. The lead-in and
          run-out are sized from the panel height, which is what makes the last
          line land exactly on the reading line.
        </Choice>
        <Choice title="Follow my voice">
          the Web Speech API transcribes as you talk; the last nine words are
          fuzzy-matched against a window of the script around your current
          position, scoring exact hits and shared word stems. A confidence
          floor means a mis-hearing is discarded rather than obeyed, and the
          correction is velocity-clamped so it can never run away from you.
        </Choice>
        <Choice title="One audio track, built only when needed">
          mic and shared system audio get summed through a WebAudio graph, but
          only when there are genuinely two sources. A lone mic track is passed
          through untouched rather than resampled for no reason.
        </Choice>
      </ul>

      <H>Source</H>
      <P>
        The code is on{" "}
        <a
          href={REPO}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-accent-soft underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
        >
          GitHub
        </a>
        , including the browser test suite that drives real recordings and
        checks the bytes that come out.
      </P>
    </Modal>
  );
}
