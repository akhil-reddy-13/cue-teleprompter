# Pace

**[paceprompter.vercel.app](https://paceprompter.vercel.app)**

A teleprompter and video recorder that runs entirely in the browser. Paste a
script, pick an aspect ratio, hit record. The script scrolls just under the
lens while you talk, so you look straight down the barrel.

No account, no trial, no watermark, and no upload — there is no backend for
recordings, and the video never leaves the device.

## Privacy

The video, the audio and the script stay in the browser. There is no server to
upload them to and no code path that tries.

The deployed site does load [Vercel Web Analytics](https://vercel.com/docs/analytics),
which counts page views and visitors. It sets no cookies, stores no identifiers,
and never sees the script or the recording. Drop `<Analytics />` from
`app/layout.tsx` to remove it entirely; nothing else depends on it.

"Follow my voice" is the one feature that sends anything else: in Chrome the
Web Speech API streams recognition audio to Google while it is switched on. It
is off by default, and the recording is unaffected either way.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Camera access needs a secure context, so use `localhost` or HTTPS. To try it on
a phone on the same network, put it behind an HTTPS tunnel (`ngrok http 3000`,
`cloudflared tunnel`) — a plain LAN IP over HTTP will not get camera permission.

## Deploy

It is a fully static Next.js app with no server code, env vars or secrets:

```bash
npx vercel
```

## What it does

**Recording** — camera, screen, or screen with a camera picture-in-picture.
Every frame is composited onto a canvas at the exact output size, so the
preview is honestly WYSIWYG: what you see framed is what lands in the file.
Output is MP4 (H.264/AAC) where the browser can mux it, WebM otherwise.

**Aspect ratios** — 9:16, 4:5, 1:1, 4:3, 16:9. Desktop defaults to 16:9 and
phones to 9:16; both are overridable and the choice is remembered. Changing
ratio retunes the live camera track rather than restarting it, so there is no
black flash and no second permission prompt.

**Teleprompter** — the panel sits at the top of the frame, nearest the lens.
Speed is set in words per minute and converted to pixels using the script's own
measured layout, so the same wpm reads the same on a phone and a desktop.
Drag or scroll the panel to scrub, tap it to start and pause.

**Follow my voice (beta)** — listens through the Web Speech API, finds your
place in the script by matching what it heard against a window of upcoming
words, and speeds up or slows down to stay with you. It also reports the wpm
you are actually speaking at, which you can apply to the slider in one tap.
The measured rate is clamped to a band around the slider value, so a
misheard phrase can never run the script away from you. Off by default; in
Chrome, recognition audio goes to Google.

**Fill light** — washes the area around the frame with adjustable brightness
and warmth to light your face. It lives outside the video frame, so it never
appears in the recording.

Also: countdown, mirror preview independently of the recording, mic mute,
camera switching, pause and resume mid-take, a screen wake lock so phones do
not sleep, and per-take download.

## Keyboard

| Key | Action |
| --- | --- |
| `R` | Start / stop recording |
| `Space` | Start / pause the scroll |
| `↑` `↓` | Scroll speed ±5 wpm |
| `Esc` | Close the open panel |

## Tests

The suite drives the real app in real Chrome against a synthetic camera, so the
recording pipeline is exercised end to end rather than mocked. It needs Google
Chrome installed; no browser download.

```bash
npm run dev                  # one shell
npm run test:e2e             # another
npm run test:e2e recording   # or a single suite
npm run typecheck
```

`e2e/recording.mjs` covers camera startup, prompter motion and rate, and that a
take comes out at the dimensions that were framed — the property the whole
canvas compositor exists to guarantee. `e2e/experience.mjs` covers first run,
sheet gestures, orientation, and whether the chrome tells the truth about what
is being recorded.

One wrinkle worth knowing: `--use-fake-ui-for-media-stream` makes Chrome report
camera permission as already *granted*, so the app auto-starts and the camera
gate never appears. Anything testing the gate launches without that flag.

## Notes

Takes are held in memory as blobs and are intentionally not persisted —
download the ones you want before reloading. The page warns before unload
while unsaved takes exist.

Screen capture is unavailable on mobile browsers; the option hides itself.

## Layout

```
app/          route shell, global styles, icon
components/   Studio (orchestrator), Teleprompter, ControlBar, panels, ui primitives
lib/          recorder, media sources, voice sync, canvas layout math, hooks
e2e/          browser suite driven against a synthetic camera
```

`lib/useRecorder.ts` owns the canvas compositor and MediaRecorder.
`components/Teleprompter.tsx` owns the scroll engine and voice correction.
