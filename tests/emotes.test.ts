import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EMOTE_DURATION_TICKS,
  EmoteTracker,
  emoteForEvent,
} from '../src/emotes';

describe('emoteForEvent', () => {
  it('maps each known game event to its emote icon', () => {
    expect(emoteForEvent('seated')).toBe('🎵');
    expect(emoteForEvent('served')).toBe('❤️');
    expect(emoteForEvent('first-bite')).toBe('✨');
    expect(emoteForEvent('waiting-long')).toBe('🍣');
    expect(emoteForEvent('leaving-happy')).toBe('❤️');
    expect(emoteForEvent('turned-away')).toBe('😓');
  });

  it('returns null for unknown events', () => {
    expect(emoteForEvent('unknown-event')).toBeNull();
    expect(emoteForEvent('')).toBeNull();
    expect(emoteForEvent('toString')).toBeNull();
  });
});

describe('EmoteTracker', () => {
  it('spawns an emote with default 20-tick duration and expires at duration boundary', () => {
    const tracker = new EmoteTracker();
    const spawned = tracker.spawn(1, '🎵', 10);

    expect(spawned).toEqual({
      actorId: 1,
      kind: '🎵',
      startedTick: 10,
      durationTicks: DEFAULT_EMOTE_DURATION_TICKS,
    });

    expect(tracker.activeAt(9)).toEqual([]);
    expect(tracker.activeAt(10)).toEqual([spawned]);
    expect(tracker.activeAt(29)).toEqual([spawned]);
    expect(tracker.activeAt(30)).toEqual([]);
    expect(tracker.activeAt(40)).toEqual([]);
  });

  it('supports custom default and per-spawn durations', () => {
    const tracker = new EmoteTracker(12);
    tracker.spawn(1, '✨', 5);
    tracker.spawn(2, '🍣', 5, 4);

    expect(tracker.activeAt(8).map((e) => e.actorId)).toEqual([1, 2]);
    expect(tracker.activeAt(9).map((e) => e.actorId)).toEqual([1]);
    expect(tracker.activeAt(16).map((e) => e.actorId)).toEqual([1]);
    expect(tracker.activeAt(17)).toEqual([]);
  });

  it('replaces an existing emote for the same actor (max 1 active per actor)', () => {
    const tracker = new EmoteTracker();
    tracker.spawn(7, '🎵', 10);
    tracker.spawn(7, '❤️', 15);

    expect(tracker.size).toBe(1);
    expect(tracker.activeAt(20)).toEqual([
      {
        actorId: 7,
        kind: '❤️',
        startedTick: 15,
        durationTicks: 20,
      },
    ]);
    // Still active at tick 34 (15 + 19), gone at tick 35 (15 + 20)
    expect(tracker.activeAt(34)).toHaveLength(1);
    expect(tracker.activeAt(35)).toEqual([]);
  });

  it('prunes expired emotes while keeping active ones', () => {
    const tracker = new EmoteTracker();
    tracker.spawn(1, '🎵', 0);
    tracker.spawn(2, '✨', 10);

    tracker.prune(19);
    expect(tracker.size).toBe(2);

    tracker.prune(20);
    expect(tracker.size).toBe(1);
    expect(tracker.activeAt(20)).toEqual([
      {
        actorId: 2,
        kind: '✨',
        startedTick: 10,
        durationTicks: 20,
      },
    ]);

    tracker.prune(30);
    expect(tracker.size).toBe(0);
    expect(tracker.activeAt(30)).toEqual([]);
  });

  it('tracks multiple actors independently', () => {
    const tracker = new EmoteTracker();
    tracker.spawn(1, '🎵', 0);
    tracker.spawn(2, '🍣', 5);
    tracker.spawn(3, '😓', 10);

    // Replace actor 2 only
    tracker.spawn(2, '❤️', 12);

    expect(tracker.activeAt(15)).toEqual([
      { actorId: 1, kind: '🎵', startedTick: 0, durationTicks: 20 },
      { actorId: 2, kind: '❤️', startedTick: 12, durationTicks: 20 },
      { actorId: 3, kind: '😓', startedTick: 10, durationTicks: 20 },
    ]);

    // At tick 20, actor 1 expires; actors 2 and 3 remain active
    expect(tracker.activeAt(20).map((e) => [e.actorId, e.kind])).toEqual([
      [2, '❤️'],
      [3, '😓'],
    ]);

    // At tick 30, actor 3 expires; actor 2 remains active until tick 32
    expect(tracker.activeAt(30).map((e) => [e.actorId, e.kind])).toEqual([
      [2, '❤️'],
    ]);
    expect(tracker.activeAt(32)).toEqual([]);
  });
});