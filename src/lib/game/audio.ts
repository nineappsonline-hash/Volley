import type { GameEvent, HitKind } from "./types";

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * Tiny synthesized sound engine — no audio assets to download. The context is
 * created lazily on the first user gesture (browsers block autoplay) and the
 * game stays silent by default until the visitor turns sound on.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = true;

  constructor(muted = true) {
    this.muted = muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.35, this.ctx.currentTime, 0.01);
    }
  }

  private ensure(): boolean {
    if (typeof window === "undefined") return false;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return true;
  }

  unlock(): void {
    this.ensure();
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
  ): void {
    if (this.muted || !this.ensure() || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + duration);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private hitTone(kind: HitKind): void {
    switch (kind) {
      case "spike":
        this.tone(220, 0.12, "square", 0.5, 90);
        break;
      case "tip":
        this.tone(480, 0.08, "triangle", 0.35, 320);
        break;
      case "serve":
        this.tone(300, 0.1, "sawtooth", 0.35, 180);
        break;
      case "block":
        this.tone(160, 0.09, "square", 0.35);
        break;
      default:
        this.tone(360, 0.09, "triangle", 0.4, 240);
    }
  }

  handle(events: GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "serve":
          this.hitTone("serve");
          break;
        case "hit":
          this.hitTone(event.kind ?? "set");
          break;
        case "perfect":
          this.tone(880, 0.09, "sine", 0.4);
          this.tone(1320, 0.14, "sine", 0.3);
          break;
        case "bounce":
          this.tone(120, 0.12, "sine", 0.35, 80);
          break;
        case "point":
          this.tone(523, 0.12, "triangle", 0.4);
          this.tone(784, 0.18, "triangle", 0.35);
          break;
        case "whistle":
          this.tone(1200, 0.2, "sine", 0.3, 1600);
          break;
        case "celebrate":
          this.tone(659, 0.12, "sine", 0.35);
          this.tone(880, 0.12, "sine", 0.35);
          this.tone(1046, 0.2, "sine", 0.35);
          break;
        default:
          break;
      }
    }
  }

  dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
    }
  }
}
