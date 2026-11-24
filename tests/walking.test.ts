import { expect, it } from 'vitest';
import { foot, sampleTravel, world } from '../src/walking';
import { Simulation } from '../src/simulation';
import { key, same } from '../src/navigation';

it('eases at both ends and faces the actual interpolated displacement', () => {
  const from = { x: 7, y: 7 };
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const to = { x: from.x + dx, y: from.y + dy };
    const edge = { from, to, tick: 12, continued: false, final: true };
    const at = (t: number) => sampleTravel(to, edge, 12 + t);
    expect(at(0)).toMatchObject({ ...world(from), dx, dy });
    expect(at(3)).toMatchObject({ ...world(to), moving: false });
    expect(at(0.5).along).toBeLessThan(at(1.5).along - at(1).along);
    expect(at(3).along - at(2.5).along).toBeLessThan(at(1.5).along - at(1).along);
  }
});

it('holds the stance foot at one world coordinate as the other foot lifts', () => {
  for (const step of [14, 17, 20]) {
    for (let d = 0; d < step; d += 0.5) {
      expect(d + foot(d, step, false).reach).toBeCloseTo(step / 2);
      expect(foot(d, step, false).lift).toBe(0);
      if (d > 0) expect(foot(d, step, true).lift).toBeGreaterThan(0);
    }
  }
});

it('keeps traffic on exclusive cells and postpones cleanup until the guest clears the chair', () => {
  const sim = new Simulation();
  let departures = 0;
  for (let i = 0; i < 1800; i++) {
    sim.tick();
    const actors = [...sim.customers, sim.server];
    expect(new Set(actors.map(a => key(a.position))).size).toBe(actors.length);
    for (const c of sim.customers.filter(c => c.state === 'leaving')) {
      const seat = sim.seats[c.seat];
      if (c.timer <= 4) {
        expect(same(c.position, seat.position)).toBe(true);
        expect(seat.dirty).toBe(false);
        if (c.timer === 4) departures++;
      }
      if (seat.dirty) expect(same(c.position, seat.position)).toBe(false);
    }
  }
  expect(departures).toBeGreaterThan(5);
});
