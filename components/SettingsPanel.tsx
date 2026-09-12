"use client";

import type { ReactNode } from "react";
import {
  ASPECTS,
  type PrompterSettings,
  type QualityKey,
  type SourceMode,
  type StudioSettings,
} from "@/lib/types";
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

/** A card of hairline-divided rows, so stacked toggles stop reading as a wall. */
function Rows({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-ink-850 overflow-hidden rounded-xl bg-ink-900 ring-1 ring-inset ring-ink-850 [&>*]:px-3 [&>*]:py-2.5">
      {children}
    </div>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5 border-t border-ink-850 pt-5 first:border-0 first:pt-0">
      <SectionTitle aside={aside}>{title}</SectionTitle>
      {children}
    </section>
  );
}

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
  rearCameraActive: boolean;
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
  rearCameraActive,
  embedded = false,
}: Props) {
  const activeAspect = ASPECTS.find((a) => a.key === studio.aspect);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!embedded && <PanelHeader title="Setup" onClose={onClose} />}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 pb-10">
        <Section
          title="Frame"
          aside={
            activeAspect ? (
              <span className="text-[10px] font-medium text-ink-600">
                {activeAspect.hint}
              </span>
            ) : undefined
          }
        >
          <div className="grid grid-cols-5 gap-1.5">
            {ASPECTS.map((aspect) => {
              const active = studio.aspect === aspect.key;
              return (
                <button
                  key={aspect.key}
                  type="button"
                  title={aspect.hint}
                  aria-pressed={active}
                  onClick={() => onStudioPatch({ aspect: aspect.key })}
                  className={cx(
                    "flex flex-col items-center gap-2 rounded-xl px-1 py-2.5 text-[10px] font-semibold transition duration-150",
                    active
                      ? "bg-ink-100 text-ink-950"
                      : "bg-ink-900 text-ink-400 ring-1 ring-inset ring-ink-850 hover:bg-ink-850 hover:text-ink-200",
                  )}
                >
                  <span
                    className={cx(
                      "block rounded-[3px] border-[1.5px]",
                      active ? "border-ink-950" : "border-ink-500",
                    )}
                    style={{
                      width: aspect.ratio >= 1 ? 22 : 22 * aspect.ratio,
                      height: aspect.ratio >= 1 ? 22 / aspect.ratio : 22,
                    }}
                  />
                  {aspect.label}
                </button>
              );
            })}
          </div>

          <Field
            label="Resolution"
            hint={`Recording as ${formatLabel}. No watermark, ever.`}
          >
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

          {recordingActive && (
            <Note tone="warn">
              Changing the frame mid-take shifts what gets recorded. Safer to
              stop first.
            </Note>
          )}
        </Section>

        <Section title="Capture">
          <Segmented<SourceMode>
            ariaLabel="What to capture"
            value={studio.sourceMode}
            onChange={(sourceMode) => {
              onStudioPatch({ sourceMode });
              if (sourceMode !== "camera" && !screenActive) onToggleScreen();
            }}
            options={[
              { value: "camera", label: "Camera" },
              { value: "screen", label: "Screen" },
              { value: "screen+camera", label: "Both" },
            ]}
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

          <Rows>
            <Toggle
              label="Mirror my preview"
              checked={studio.mirrorPreview}
              onChange={(mirrorPreview) => onStudioPatch({ mirrorPreview })}
              hint={
                rearCameraActive
                  ? "Ignored on the rear camera — flipping it would only reverse text in the shot."
                  : "Looks like a mirror to you. Doesn't touch the file."
              }
            />
            <Toggle
              label="Mirror the recording too"
              checked={studio.mirrorRecording}
              onChange={(mirrorRecording) =>
                onStudioPatch({ mirrorRecording })
              }
              hint="Leave off unless you want the flipped look — on-screen text reads backwards with it on."
            />
          </Rows>

          <Field label="Countdown">
            <Segmented<string>
              ariaLabel="Countdown"
              value={String(studio.countdown)}
              onChange={(value) => onStudioPatch({ countdown: Number(value) })}
              options={[
                { value: "0", label: "Off" },
                { value: "3", label: "3s" },
                { value: "5", label: "5s" },
                { value: "10", label: "10s" },
              ]}
            />
          </Field>
        </Section>

        <Section title="Prompter">
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
            hint="How much the panel dims the video behind your words."
          />

          <Rows>
            <Toggle
              label="Show the script over the video"
              checked={prompter.visible}
              onChange={(visible) => onPromptPatch({ visible })}
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
          </Rows>
        </Section>

        <Section
          title="Follow my voice"
          aside={<Pill tone="accent">Beta</Pill>}
        >
          <Rows>
            <Toggle
              label="Match the scroll to my speaking pace"
              checked={prompter.voiceSync}
              disabled={!voiceSupported}
              onChange={(voiceSync) => onPromptPatch({ voiceSync })}
              hint={
                voiceSupported
                  ? "Listens, finds your place in the script, and speeds up or slows down to stay with you."
                  : "Needs a browser with speech recognition — Chrome, Edge or Safari."
              }
            />
          </Rows>
          {voiceSupported && prompter.voiceSync && (
            <Note>
              Chrome sends recognition audio to Google. Your recording still
              never leaves the device.
            </Note>
          )}
        </Section>

        <Section title="Fill light">
          <SliderRow
            label="Brightness"
            value={studio.fillLight}
            min={0}
            max={100}
            suffix="%"
            onChange={(fillLight) => onStudioPatch({ fillLight })}
            progress="#ffe3b0"
            hint="Glows the area around the frame to light your face. Never appears in the recording."
          />
          <SliderRow
            label="Warmth"
            value={studio.fillWarmth}
            min={0}
            max={100}
            suffix="%"
            onChange={(fillWarmth) => onStudioPatch({ fillWarmth })}
            progress="#ffd6a2"
            display={
              studio.fillWarmth < 33
                ? "Daylight"
                : studio.fillWarmth < 67
                  ? "Neutral"
                  : "Warm"
            }
          />
        </Section>
      </div>
    </div>
  );
}
