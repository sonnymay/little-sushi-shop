import { describe, expect, it } from 'vitest';
import { FIRST_BITE_TICK, Simulation, WAVE_TICKS } from '../src/simulation';

function reachThankYou() {
  const sim = new Simulation();
  for (let i = 0; i < 300; i++) {
    sim.tick();
    const foodie = sim.customers.find(c => c.awaitingWave);
    if (foodie) return { sim, foodie };
  }
  throw new Error('The first foodie never thanked the chef');
}

describe('the foodie and Hana', () => {
  it('thanks once after the first bite and receives a wave when the kitchen is free', () => {
    const { sim, foodie } = reachThankYou();
    expect(foodie).toMatchObject({ personality: 'Foodie', state: 'eating', timer: FIRST_BITE_TICK });
    expect(sim.chef).not.toBeNull();
    while (sim.chef && sim.ticks < 300) {
      expect(sim.waveUntil).toBe(0);
      sim.tick();
    }
    expect(sim.chef).toBeNull();
    expect(sim.waveUntil).toBe(sim.ticks + WAVE_TICKS);
    expect(foodie.awaitingWave).toBe(false);
    expect(sim.events.filter(entry => entry.includes('Thank you, Hana!'))).toHaveLength(1);
    expect(sim.events.filter(entry => entry.includes('waves back'))).toHaveLength(1);
    const time = sim.visualTick;
    sim.paused = true;
    sim.advance(0.5);
    expect(sim.visualTick).toBe(time);
  });

  it('lets a thank-you expire when the diner leaves before the chef is free', () => {
    const { sim, foodie } = reachThankYou();
    sim.chef!.remaining = 100;
    for (let i = 0; i < 115; i++) {
      sim.tick();
      expect(sim.waveUntil).toBe(0);
    }
    expect(sim.customers.some(c => c.id === foodie.id && c.state === 'eating')).toBe(false);
  });
});
