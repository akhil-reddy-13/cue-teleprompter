"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "@/lib/format";
import { matchSpokenPosition, tokenize } from "@/lib/script";

// Minimal shape of the Web Speech API — it isn't in the DOM typings.
type SpeechAlternative = { transcript: string };
type SpeechResult = { 0: SpeechAlternative; isFinal: boolean; length: number };
type SpeechResultList = { length: number; [index: number]: SpeechResult };
type SpeechEvent = { resultIndex: number; results: SpeechResultList };
type SpeechErrorEvent = { error: string };

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceMatch = { wordIndex: number; at: number };

type UseVoiceSyncArgs = {
  enabled: boolean;
  getWords: () => string[];
  getCurrentWord: () => number;
  onUnavailable: (message: string) => void;
};

const TAIL_WORDS = 9;

export function useVoiceSync({
  enabled,
  getWords,
  getCurrentWord,
  onUnavailable,
}: UseVoiceSyncArgs) {
  // Probed after mount, not during render: the server has no `window`, so a
  // render-time probe renders "unsupported" on the server and "supported" on
  // the client, which is a hydration mismatch. Same reason the recorder probes
  // its output format in an effect.
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(getRecognitionCtor() !== null), []);
  const [listening, setListening] = useState(false);
  const [heardWpm, setHeardWpm] = useState<number | null>(null);
  const [lastHeard, setLastHeard] = useState<string>("");

  const matchRef = useRef<VoiceMatch | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const wantRunningRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const samplesRef = useRef<VoiceMatch[]>([]);
  const wpmRef = useRef<number | null>(null);

  const getWordsRef = useRef(getWords);
  const getCurrentWordRef = useRef(getCurrentWord);
  const onUnavailableRef = useRef(onUnavailable);
  getWordsRef.current = getWords;
  getCurrentWordRef.current = getCurrentWord;
  onUnavailableRef.current = onUnavailable;

  const recordSample = useCallback((sample: VoiceMatch) => {
    const samples = samplesRef.current;
    samples.push(sample);
    // Keep a rolling ~12s window of positions to estimate speaking rate.
    const cutoff = sample.at - 12_000;
    while (samples.length > 2 && samples[0].at < cutoff) samples.shift();

    const first = samples[0];
    const spanMs = sample.at - first.at;
    const spanWords = sample.wordIndex - first.wordIndex;
    if (spanMs < 4000 || spanWords < 6) return;

    const instant = clamp((spanWords / (spanMs / 60_000)), 60, 320);
    // Heavy smoothing: the displayed rate should drift, not twitch.
    wpmRef.current =
      wpmRef.current === null
        ? instant
        : wpmRef.current * 0.75 + instant * 0.25;
    setHeardWpm(Math.round(wpmRef.current));
  }, []);

  const handleResult = useCallback(
    (event: SpeechEvent) => {
      const words = getWordsRef.current();
      if (words.length === 0) return;

      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += ` ${event.results[i][0]?.transcript ?? ""}`;
      }
      const spoken = tokenize(transcript);
      if (spoken.length === 0) return;
      setLastHeard(spoken.slice(-6).join(" "));

      const tail = spoken.slice(-TAIL_WORDS);
      const current = getCurrentWordRef.current();
      const matched = matchSpokenPosition(tail, words, current);
      if (matched === null) return;

      const sample = { wordIndex: matched, at: Date.now() };
      matchRef.current = sample;
      recordSample(sample);
    },
    [recordSample],
  );

  const startRecognition = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    if (recognitionRef.current) return;

    let recognition: Recognition;
    try {
      recognition = new Ctor();
    } catch {
      onUnavailableRef.current("Voice sync couldn't start on this browser.");
      return;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang =
      (typeof navigator !== "undefined" && navigator.language) || "en-US";

    recognition.onstart = () => setListening(true);
    recognition.onresult = handleResult;

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        wantRunningRef.current = false;
        setListening(false);
        onUnavailableRef.current(
          "Voice sync needs microphone permission for speech recognition.",
        );
      }
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      // Chrome ends the session after every pause in speech; restart quietly.
      if (wantRunningRef.current) {
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          if (wantRunningRef.current) startRecognition();
        }, 400);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      recognitionRef.current = null;
    }
  }, [handleResult]);

  const stopRecognition = useCallback(() => {
    wantRunningRef.current = false;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      try {
        recognition.abort();
      } catch {
        // Already torn down.
      }
    }
    setListening(false);
  }, []);

  useEffect(() => {
    if (!enabled || !supported) {
      stopRecognition();
      return;
    }
    wantRunningRef.current = true;
    samplesRef.current = [];
    wpmRef.current = null;
    setHeardWpm(null);
    matchRef.current = null;
    startRecognition();
    return stopRecognition;
  }, [enabled, startRecognition, stopRecognition, supported]);

  const reset = useCallback(() => {
    samplesRef.current = [];
    wpmRef.current = null;
    matchRef.current = null;
    setHeardWpm(null);
    setLastHeard("");
  }, []);

  return { supported, listening, heardWpm, lastHeard, matchRef, reset };
}
