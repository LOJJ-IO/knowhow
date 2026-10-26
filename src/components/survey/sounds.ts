"use client";

import { useSyncExternalStore } from "react";

/** The survey's sounds: the landing's old Get Started click (880→220Hz sine,
 *  80ms; removed from the landing 2026-09-16) plus two softer cousins. Web
 *  Audio, no files. One shared AudioContext: a fresh one per sound leaks, and
 *  browsers cap how many can exist. A suspended context (autoplay policy) has
 *  to `resume()` first or the oscillator runs silently. */

const MUTE_KEY = "knohow_survey_muted";

let audio: AudioContext | null = null;
let muted = false;
let mutedLoaded = false;
const listeners = new Set<() => void>();

function readMuted() {
  if (!mutedLoaded) {
    mutedLoaded = true;
    try {
      muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      // Storage blocked: sound stays on.
    }
  }
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  mutedLoaded = true;
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    // Storage blocked: the choice lasts this visit.
  }
  listeners.forEach((listener) => listener());
}

/** Sound on, for the toggle. Off on the server, so nothing claims to play. */
export function useSoundOn() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => !readMuted(),
    () => false,
  );
}

type Tone = {
  type: OscillatorType;
  from: number;
  to?: number;
  /** s after now. */
  at?: number;
  dur: number;
  gain: number;
};

function play(tones: Tone[]) {
  if (readMuted()) return;
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    const start = () => {
      const now = ctx.currentTime;
      for (const tone of tones) {
        const t = now + (tone.at ?? 0);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = tone.type;
        osc.frequency.setValueAtTime(tone.from, t);
        if (tone.to)
          osc.frequency.exponentialRampToValueAtTime(tone.to, t + tone.dur);
        gain.gain.setValueAtTime(tone.gain, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + tone.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + tone.dur);
      }
    };
    if (ctx.state === "suspended") void ctx.resume().then(start);
    else start();
  } catch {
    // Web Audio unavailable or blocked: sound is a nice-to-have.
  }
}

/** A choice picked, a button pressed: the landing's original click. */
export function playTick() {
  play([{ type: "sine", from: 880, to: 220, dur: 0.08, gain: 0.1 }]);
}

/** Something landing in the tour (a file filed, a person added): a short
 *  rising blip, quieter than the click so a run of them stays soft. */
export function playPop() {
  play([{ type: "sine", from: 520, to: 880, dur: 0.07, gain: 0.05 }]);
}

/** A slider passing a notch: barely there, so dragging reads as detents. */
export function playDetent() {
  play([{ type: "sine", from: 1800, to: 1200, dur: 0.025, gain: 0.03 }]);
}

/** Survey sent: two bell notes, a fifth apart. */
export function playChime() {
  play([
    { type: "triangle", from: 659.25, dur: 0.35, gain: 0.08 },
    { type: "triangle", from: 987.77, at: 0.12, dur: 0.5, gain: 0.07 },
  ]);
}
