export type OscillatorWaveform =
  | 'sine'
  | 'square'
  | 'sawtooth'
  | 'triangle'
  | 'custom';

export interface AudioParamLike {
  setValueAtTime(value: number, startTime: number): unknown;
  linearRampToValueAtTime(value: number, endTime: number): unknown;
  exponentialRampToValueAtTime(value: number, endTime: number): unknown;
}

export interface GainNodeLike {
  readonly gain: AudioParamLike;
  connect(destination: unknown): unknown;
}

export interface OscillatorNodeLike {
  type: OscillatorWaveform;
  readonly frequency: AudioParamLike;
  connect(destination: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  createOscillator(): OscillatorNodeLike;
  createGain(): GainNodeLike;
  resume(): Promise<void> | void;
}

export type AudioContextFactory = () => AudioContextLike | null | undefined;

export interface SoundEngineOptions {
  muted?: boolean;
}

interface ToneSpec {
  readonly type: Exclude<OscillatorWaveform, 'custom'>;
  readonly startFreq: number;
  readonly endFreq?: number;
  readonly startOffset: number;
  readonly duration: number;
  readonly peakGain: number;
  readonly attack?: number;
}

const MAX_GAIN = 0.15;
const MIN_EXP_GAIN = 0.0001;

type GlobalWithAudioContext = typeof globalThis & {
  AudioContext?: new () => AudioContextLike;
  webkitAudioContext?: new () => AudioContextLike;
};

export function defaultAudioContextFactory(): AudioContextLike | null {
  const scope = globalThis as GlobalWithAudioContext;
  const AudioCtx = scope.AudioContext ?? scope.webkitAudioContext;
  if (typeof AudioCtx !== 'function') {
    return null;
  }
  try {
    return new AudioCtx();
  } catch {
    return null;
  }
}

export class SoundEngine {
  private readonly contextFactory: AudioContextFactory;
  private context: AudioContextLike | null = null;
  private contextUnavailable = false;
  private muted: boolean;

  constructor(
    contextFactory: AudioContextFactory = defaultAudioContextFactory,
    options: SoundEngineOptions = {},
  ) {
    this.contextFactory = contextFactory;
    this.muted = options.muted ?? false;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public resume(): void {
    if (this.muted) {
      return;
    }
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'suspended') {
      return;
    }
    this.safeResume(ctx);
  }

  /** Short bright two-note pop for coins / payment. */
  public playCoin(): void {
    const ctx = this.preparePlayback();
    if (!ctx) {
      return;
    }
    this.scheduleTone(ctx, {
      type: 'sine',
      startFreq: 987.77, // B5
      startOffset: 0,
      duration: 0.08,
      peakGain: 0.1,
      attack: 0.005,
    });
    this.scheduleTone(ctx, {
      type: 'triangle',
      startFreq: 1318.51, // E6
      startOffset: 0.055,
      duration: 0.12,
      peakGain: 0.11,
      attack: 0.005,
    });
  }

  /** Soft warm chime when a sushi dish is served. */
  public playServed(): void {
    const ctx = this.preparePlayback();
    if (!ctx) {
      return;
    }
    this.scheduleTone(ctx, {
      type: 'sine',
      startFreq: 523.25, // C5
      startOffset: 0,
      duration: 0.22,
      peakGain: 0.07,
      attack: 0.01,
    });
    this.scheduleTone(ctx, {
      type: 'sine',
      startFreq: 659.25, // E5
      startOffset: 0.05,
      duration: 0.24,
      peakGain: 0.06,
      attack: 0.01,
    });
    this.scheduleTone(ctx, {
      type: 'sine',
      startFreq: 783.99, // G5
      startOffset: 0.1,
      duration: 0.26,
      peakGain: 0.05,
      attack: 0.01,
    });
  }

  /** Tiny crisp UI tick for buttons and upgrades. */
  public playClick(): void {
    const ctx = this.preparePlayback();
    if (!ctx) {
      return;
    }
    this.scheduleTone(ctx, {
      type: 'triangle',
      startFreq: 680,
      endFreq: 320,
      startOffset: 0,
      duration: 0.035,
      peakGain: 0.08,
      attack: 0.003,
    });
  }

  private preparePlayback(): AudioContextLike | null {
    if (this.muted) {
      return null;
    }
    const ctx = this.getContext();
    if (!ctx) {
      return null;
    }
    if (ctx.state === 'suspended') {
      this.safeResume(ctx);
    }
    return ctx;
  }

  private getContext(): AudioContextLike | null {
    if (this.context) {
      return this.context;
    }
    if (this.contextUnavailable) {
      return null;
    }
    try {
      const created = this.contextFactory();
      if (!created) {
        this.contextUnavailable = true;
        return null;
      }
      this.context = created;
      return created;
    } catch {
      this.contextUnavailable = true;
      return null;
    }
  }

  private safeResume(ctx: AudioContextLike): void {
    try {
      const result = ctx.resume();
      if (result && typeof result.catch === 'function') {
        void result.catch(() => {
          // Ignore autoplay rejection until the next user gesture.
        });
      }
    } catch {
      // Ignore resume errors in restricted environments.
    }
  }

  private scheduleTone(ctx: AudioContextLike, spec: ToneSpec): void {
    const startTime = ctx.currentTime + spec.startOffset;
    const attack = Math.min(spec.attack ?? 0.005, spec.duration * 0.4);
    const endTime = startTime + spec.duration;
    const peakGain = Math.max(MIN_EXP_GAIN, Math.min(spec.peakGain, MAX_GAIN));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.startFreq, startTime);
    if (spec.endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, spec.endFreq),
        endTime,
      );
    }

    gain.gain.setValueAtTime(MIN_EXP_GAIN, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(MIN_EXP_GAIN, endTime);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(endTime + 0.01);
  }
}
