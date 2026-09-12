"use client";

import { ASPECTS, type AspectKey, type PrompterSettings, type QualityKey, type SourceMode, type StudioSettings } from "@/lib/types";
import type { DeviceInfo } from "@/lib/useMediaSources";
import {
  Button,
  Field,
  Note,
  PanelHeader,
  Pill,
  SectionTitle,
  Segmented,
  Select,
  SliderRow,
  Toggle,
  cx,
} from "@/components/ui";

type Props = {
  studio: StudioSettings;
  prompter: PrompterSettings;
  onStudioPatch: (patch: Partial<StudioSettings>) => void;
  onPromptPatch: (patch: Partial<PrompterSettings>) => void;
  onClose: () => void;
  cameras: DeviceInfo[];
  microphones: DeviceInfo[];
  screenSupported: boolean;
  screenActive: boolean;
  onToggleScreen: () => void;
  voiceSupported: boolean;
  recordingActive: boolean;
  formatLabel: string;
  embedded?: boolean;
};

export default function SettingsPanel({
  studio,
  prompter,
  onStudioPatch,
  onPromptPatch,
  onClose,
  cameras,
  microphones,
  screenSupported,
  screenActive,
  onToggleScreen,
  voiceSupported,
  recordingActive,
  formatLabel,
  embedded = false,
}: Props) {
  const sourceOptions: { value: SourceMode; label: string }[] = [
    { value: "camera", label: "Camera" },
    { value: "screen", label: "Screen" },
    { value: "screen+camera", label: "Both" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!embedded && <PanelHeader title="Setup" onClose={onClose} />}

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 pb-8">
        <section className="space-y-3">
          <SectionTitle>Frame</SectionTitle>
          <div className="grid grid-cols-5 gap-1.5">
            {ASPECTS.map((aspect) => (
              <button
                key={aspect.key}
                type="button"
                title={aspect.hint}
                aria-pressed={studio.aspect === aspect.key}
                onClick={() => onStudioPatch({ aspect: aspect.key })}
                className={cx(
                  "flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-[10px] font-semibold transition",
                  studio.aspect === aspect.key
                    ? "bg-white text-ink-950"
                    : "bg-ink-850 text-ink-300 ring-1 ring-ink-700/70 hover:bg-ink-800 hover:text-white",
                )}
              >
                <span
                  className={cx(
                    "block rounded-[3px] border-[1.5px]",
                    studio.aspect === aspect.key
                      ? "border-ink-950"
                      : "border-ink-400",
                  )}
                  style={{
                    width: aspect.ratio >= 1 ? 22 : 22 * aspect.ratio,
                    height: aspect.ratio >= 1 ? 22 / aspect.ratio : 22,
                  }}
                />
                {aspect.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-ink-500">
            {ASPECTS.find((a) => a.key === studio.aspect)?.hint}
          </p>

          <Field label="Resolution">
            <Segmented<QualityKey>
              ariaLabel="Resolution"
              value={studio.quality}
              onChange={(quality) => onStudioPatch({ quality })}
              options={[
                { value: "1080", label: "1080p" },
                { value: "720", label: "720p — smaller file" },
              ]}
            />
          </Field>
          <p className="text-[11px] text-ink-500">
            Recording as {formatLabel}. No watermark, ever.
          </p>
        </section>

        <section className="space-y-3">
          <SectionTitle>Capture</SectionTitle>
          <Segmented<SourceMode>
            ariaLabel="What to capture"
            value={studio.sourceMode}
            onChange={(sourceMode) => {
              onStudioPatch({ sourceMode });
              if (sourceMode !== "camera" && !screenActive) onToggleScreen();
            }}
            options={sourceOptions}
          />
          {!screenSupported && (
            <Note tone="warn">
              Screen recording isn&apos;t supported on this device — phones
              don&apos;t expose it to the browser.
            </Note>
          )}
          {screenSupported && studio.sourceMode !== "camera" && (
            <Button full onClick={onToggleScreen}>
              {screenActive ? "Pick a different screen" : "Choose what to share"}
            </Button>
          )}

          {cameras.length > 1 && (
            <Field label="Camera">
              <Select
                ariaLabel="Camera"
                value={studio.videoDeviceId ?? "default"}
                onChange={(value) =>
                  onStudioPatch({
                    videoDeviceId: value === "default" ? null : value,
                  })
                }
              >
                <option value="default">Automatic</option>
                {cameras.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {microphones.length > 1 && (
            <Field label="Microphone">
              <Select
                ariaLabel="Microphone"
                value={studio.audioDeviceId ?? "default"}
                onChange={(value) =>
                  onStudioPatch({
                    audioDeviceId: value === "default" ? null : value,
                  })
                }
              >
                <option value="default">Automatic</option>
                {microphones.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Toggle
            label="Mirror my preview"
            checked={studio.mirrorPreview}
            onChange={(mirrorPreview) => onStudioPatch({ mirrorPreview })}
            hint="Looks like a mirror to you. Doesn't affect the file."
          />
          <Toggle
            label="Mirror the recording too"
            checked={studio.mirrorRecording}
            onChange={(mirrorRecording) => onStudioPatch({ mirrorRecording })}
            hint="Leave off unless you want the flipped look — on-screen text reads backwards when it's on."
          />

          <Field label="Countdown">
            <Segmented<string>
              ariaLabel="Countdown"
              value={String(studio.countdown)}
              onChange={(value) =>
                onStudioPatch({ countdown: Number(value) })
              }
              options={[
                { value: "0", label: "Off" },
                { value: "3", label: "3s" },
                { value: "5", label: "5s" },
                { value: "10", label: "10s" },
              ]}
            />
          </Field>
        </section>

        <section className="space-y-3">
          <SectionTitle>Prompter</SectionTitle>
          <Toggle
            label="Show the script over the video"
            checked={prompter.visible}
            onChange={(visible) => onPromptPatch({ visible })}
          />
          <SliderRow
            label="Text size"
            value={prompter.fontSize}
            min={22}
            max={96}
            onChange={(fontSize) => onPromptPatch({ fontSize })}
          />
          <SliderRow
            label="Panel height"
            value={prompter.heightPct}
            min={18}
            max={85}
            suffix="%"
            onChange={(heightPct) => onPromptPatch({ heightPct })}
            hint="Shorter keeps your eyes closer to the lens."
          />
          <SliderRow
            label="Line spacing"
            value={Math.round(prompter.lineHeight * 100)}
            min={110}
            max={210}
            step={5}
            suffix="%"
            onChange={(value) => onPromptPatch({ lineHeight: value / 100 })}
          />
          <SliderRow
            label="Backdrop"
            value={prompter.opacity}
            min={0}
            max={92}
            suffix="%"
            onChange={(opacity) => onPromptPatch({ opacity })}
          />
          <Toggle
            label="Heavier text"
            checked={prompter.bold}
            onChange={(bold) => onPromptPatch({ bold })}
          />
          <Toggle
            label="Mirror the text"
            checked={prompter.mirrorText}
            onChange={(mirrorText) => onPromptPatch({ mirrorText })}
            hint="For beam-splitter teleprompter rigs."
          />
          <div className="space-y-2 rounded-xl border border-ink-800 bg-ink-900/60 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-200">
                Follow my voice
              </span>
              <Pill tone="accent">Beta</Pill>
            </div>
            <Toggle
              label="Match the scroll to my speaking pace"
              checked={prompter.voiceSync}
              disabled={!voiceSupported}
              onChange={(voiceSync) => onPromptPatch({ voiceSync })}
              hint={
                voiceSupported
                  ? "Listens, finds your place in the script, and speeds up or slows down to stay with you. Chrome sends audio to Google for recognition."
                  : "Needs a browser with speech recognition — Chrome, Edge or Safari."
              }
            />
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>Fill light</SectionTitle>
          <SliderRow
            label="Brightness"
            value={studio.fillLight}
            min={0}
            max={100}
            suffix="%"
            onChange={(fillLight) => onStudioPatch({ fillLight })}
            hint="Glows the area around the frame to light your face. Never appears in the recording."
          />
          <SliderRow
            label="Warmth"
            value={studio.fillWarmth}
            min={0}
            max={100}
            suffix="%"
            onChange={(fillWarmth) => onStudioPatch({ fillWarmth })}
          />
        </section>

        {recordingActive && (
          <Note tone="warn">
            Changing the frame mid-take can shift what gets recorded. Safer to
            stop first.
          </Note>
        )}
      </div>
    </div>
  );
}
