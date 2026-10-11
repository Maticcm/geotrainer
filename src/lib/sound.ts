let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.08) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.02);
}

export type SoundName = "correct" | "wrong" | "finish";

/** Tiny synthesised cues – no audio assets needed. Silent if the browser blocks audio. */
export function playSound(name: SoundName, enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    if (name === "correct") {
      tone(660, 0, 0.12);
      tone(880, 0.09, 0.18);
    } else if (name === "wrong") {
      tone(220, 0, 0.22, "triangle", 0.07);
    } else {
      tone(523, 0, 0.14);
      tone(659, 0.12, 0.14);
      tone(784, 0.24, 0.24);
    }
  } catch {
    /* audio unavailable */
  }
}
