export type EmoteKind = '🎵' | '❤️' | '✨' | '🍣' | '😓';

export type EmoteEvent =
  | 'seated'
  | 'served'
  | 'first-bite'
  | 'waiting-long'
  | 'leaving-happy'
  | 'turned-away';

export interface ActiveEmote {
  actorId: number;
  kind: EmoteKind;
  startedTick: number;
  durationTicks: number;
}

export const DEFAULT_EMOTE_DURATION_TICKS = 20;

export function emoteForEvent(event: string): EmoteKind | null {
  switch (event) {
    case 'seated':
      return '🎵';
    case 'served':
      return '❤️';
    case 'first-bite':
      return '✨';
    case 'waiting-long':
      return '🍣';
    case 'leaving-happy':
      return '❤️';
    case 'turned-away':
      return '😓';
    default:
      return null;
  }
}

export class EmoteTracker {
  private readonly defaultDurationTicks: number;
  private readonly activeByActor = new Map<number, ActiveEmote>();

  constructor(defaultDurationTicks: number = DEFAULT_EMOTE_DURATION_TICKS) {
    this.defaultDurationTicks = defaultDurationTicks;
  }

  get size(): number {
    return this.activeByActor.size;
  }

  spawn(
    actorId: number,
    kind: EmoteKind,
    tick: number,
    durationTicks: number = this.defaultDurationTicks,
  ): ActiveEmote {
    const emote: ActiveEmote = {
      actorId,
      kind,
      startedTick: tick,
      durationTicks,
    };
    this.activeByActor.set(actorId, emote);
    return { ...emote };
  }

  activeAt(tick: number): ActiveEmote[] {
    const result: ActiveEmote[] = [];
    for (const emote of this.activeByActor.values()) {
      if (tick >= emote.startedTick && tick < emote.startedTick + emote.durationTicks) {
        result.push({ ...emote });
      }
    }
    return result;
  }

  prune(tick: number): void {
    for (const [actorId, emote] of this.activeByActor.entries()) {
      if (tick >= emote.startedTick + emote.durationTicks) {
        this.activeByActor.delete(actorId);
      }
    }
  }
}