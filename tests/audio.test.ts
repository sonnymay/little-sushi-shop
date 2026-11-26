import { describe, expect, it } from 'vitest';
import {
  SoundEngine,
  type AudioContextLike,
  type AudioParamLike,
  type GainNodeLike,
  type OscillatorNodeLike,
  type OscillatorWaveform,
} from '../src/audio';

interface ParamCall {
  method:
    | 'setValueAtTime'
    | 'linearRampToValueAtTime'
    | 'exponentialRampToValueAtTime';
  value: number;
  time: number;
}

class FakeAudioParam implements AudioParamLike {
  public readonly calls: ParamCall[] = [];

  public setValueAtTime(value: number, startTime: number): void {
    this.calls.push({ method: 'setValueAtTime', value, time: startTime });
  }

  public linearRampToValueAtTime(value: number, endTime: number): void {
    this.calls.push({ method: 'linearRampToValueAtTime', value, time: endTime });
  }

  public exponentialRampToValueAtTime(value: number, endTime: number): void {
    this.calls.push({
      method: 'exponentialRampToValueAtTime',
      value,
      time: endTime,
    });
  }
}

class FakeGainNode implements GainNodeLike {
  public readonly gain = new FakeAudioParam();
  public readonly connections: unknown[] = [];

  public connect(destination: unknown): void {
    this.connections.push(destination);
  }
}

class FakeOscillatorNode implements OscillatorNodeLike {
  public type: OscillatorWaveform = 'sine';
  public readonly frequency = new FakeAudioParam();
  public readonly connections: unknown[] = [];
  public readonly starts: Array<number | undefined> = [];
  public readonly stops: Array<number | undefined> = [];

  public connect(destination: unknown): void {
    this.connections.push(destination);
  }

  public start(when?: number): void {
    this.starts.push(when);
  }

  public stop(when?: number): void {
    this.stops.push(when);
  }
}

class FakeAudioContext implements AudioContextLike {
  public currentTime = 1.0;
  public state: string;
  public readonly destination = { kind: 'destination' };
  public readonly oscillators: FakeOscillatorNode[] = [];
  public readonly gains: FakeGainNode[] = [];
  public resumeCalls = 0;

  constructor(initialState: 'running' | 'suspended' = 'running') {
    this.state = initialState;
  }

  public createOscillator(): OscillatorNodeLike {
    const osc = new FakeOscillatorNode();
    this.oscillators.push(osc);
    return osc;
  }

  public createGain(): GainNodeLike {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain;
  }

  public resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = 'running';
    return Promise.resolve();
  }
}

describe('SoundEngine', () => {
  it('creates no audio nodes when muted', () => {
    const fakeCtx = new FakeAudioContext('suspended');
    const engine = new SoundEngine(() => fakeCtx, { muted: true });

    engine.resume();
    engine.playCoin();
    engine.playServed();
    engine.playClick();

    expect(fakeCtx.oscillators).toHaveLength(0);
    expect(fakeCtx.gains).toHaveLength(0);
    expect(fakeCtx.resumeCalls).toBe(0);
  });

  it('creates oscillators and gain nodes for unmuted playCoin()', () => {
    const fakeCtx = new FakeAudioContext('running');
    const engine = new SoundEngine(() => fakeCtx);

    engine.playCoin();

    expect(fakeCtx.oscillators).toHaveLength(2);
    expect(fakeCtx.gains).toHaveLength(2);

    for (let i = 0; i < fakeCtx.oscillators.length; i += 1) {
      const osc = fakeCtx.oscillators[i];
      const gain = fakeCtx.gains[i];
      expect(osc).toBeDefined();
      expect(gain).toBeDefined();
      if (!osc || !gain) {
        continue;
      }

      expect(osc.connections).toContain(gain);
      expect(gain.connections).toContain(fakeCtx.destination);
      expect(osc.starts).toHaveLength(1);
      expect(osc.stops).toHaveLength(1);

      const startTime = osc.starts[0];
      const stopTime = osc.stops[0];
      expect(startTime).toBeTypeOf('number');
      expect(stopTime).toBeTypeOf('number');
      if (startTime !== undefined && stopTime !== undefined) {
        expect(stopTime).toBeGreaterThan(startTime);
      }
    }
  });

  it('keeps all gain levels <= 0.15 across all synthesized sounds', () => {
    const fakeCtx = new FakeAudioContext('running');
    const engine = new SoundEngine(() => fakeCtx);

    engine.playCoin();
    engine.playServed();
    engine.playClick();

    expect(fakeCtx.gains.length).toBeGreaterThanOrEqual(6);
    for (const gainNode of fakeCtx.gains) {
      for (const call of gainNode.gain.calls) {
        expect(call.value).toBeLessThanOrEqual(0.15);
        expect(call.value).toBeGreaterThan(0);
      }
    }
  });

  it('does not throw when AudioContext is unavailable or factory throws', () => {
    const missingEngine = new SoundEngine(() => null);
    expect(() => {
      missingEngine.resume();
      missingEngine.playCoin();
      missingEngine.playServed();
      missingEngine.playClick();
      missingEngine.setMuted(true);
      missingEngine.setMuted(false);
    }).not.toThrow();

    const throwingEngine = new SoundEngine(() => {
      throw new Error('AudioContext blocked');
    });
    expect(() => {
      throwingEngine.resume();
      throwingEngine.playCoin();
      throwingEngine.playServed();
      throwingEngine.playClick();
    }).not.toThrow();
  });

  it('toggles mute state via setMuted() and gates node creation', () => {
    const fakeCtx = new FakeAudioContext('running');
    const engine = new SoundEngine(() => fakeCtx);

    expect(engine.isMuted()).toBe(false);

    engine.setMuted(true);
    expect(engine.isMuted()).toBe(true);
    engine.playClick();
    expect(fakeCtx.oscillators).toHaveLength(0);
    expect(fakeCtx.gains).toHaveLength(0);

    engine.setMuted(false);
    expect(engine.isMuted()).toBe(false);
    engine.playClick();
    expect(fakeCtx.oscillators).toHaveLength(1);
    expect(fakeCtx.gains).toHaveLength(1);
  });

  it('resumes a suspended AudioContext once and reuses the created context', () => {
    const fakeCtx = new FakeAudioContext('suspended');
    let factoryCalls = 0;
    const engine = new SoundEngine(() => {
      factoryCalls += 1;
      return fakeCtx;
    });

    engine.resume();
    expect(factoryCalls).toBe(1);
    expect(fakeCtx.resumeCalls).toBe(1);
    expect(fakeCtx.state).toBe('running');

    engine.playServed();
    expect(factoryCalls).toBe(1);
    expect(fakeCtx.resumeCalls).toBe(1);
    expect(fakeCtx.oscillators).toHaveLength(3);
    expect(fakeCtx.gains).toHaveLength(3);
  });
});
