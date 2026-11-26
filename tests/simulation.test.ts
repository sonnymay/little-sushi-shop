import { describe, expect, it } from 'vitest';
import { Simulation, recipes } from '../src/simulation';
import { pathfind, obstacles, same } from '../src/navigation';

describe('navigation', () => {
  it('finds a shortest route around an obstacle, never crossing it', () => {
    const blocked = new Set(['1,0']);
    const path = pathfind({ x: 0, y: 0 }, { x: 2, y: 0 }, blocked)!;
    expect(path).toHaveLength(4);
    expect(path.some(p => blocked.has(`${p.x},${p.y}`))).toBe(false);
    expect(same(path.at(-1)!, { x: 2, y: 0 })).toBe(true);
  });
  it('returns null for unreachable and invalid destinations', () => {
    expect(pathfind({ x: 0, y: 0 }, { x: 2, y: 2 }, new Set(['1,0', '0,1']))).toBeNull();
    expect(pathfind({ x: 0, y: 0 }, { x: 15, y: 0 })).toBeNull();
    expect(pathfind({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([]);
  });
});
describe('autonomous service', () => {
  it('admits the longest-waiting guest when a clean seat opens', () => {
    const sim = new Simulation();
    for (const seat of sim.seats) seat.dirty = true;
    for (let i = 0; i < 121; i++) sim.tick();
    expect(sim.arrivals.map(guest => guest.id)).toEqual([1, 2, 3]);
    sim.seats[0].dirty = false;
    sim.tick();
    expect(sim.seats[0].owner).toBe(1);
    expect(sim.arrivals.map(guest => guest.id)).toEqual([2, 3]);
  });
  it('caps the line and removes expired guests before seating them', () => {
    const sim = new Simulation();
    for (const seat of sim.seats) seat.dirty = true;
    for (let i = 0; i < 240; i++) sim.tick();
    expect(sim.arrivals.map(guest => guest.id)).toEqual([1, 2, 3]);
    expect(sim.turnedAway).toBe(1);
    sim.seats[0].dirty = false;
    sim.tick();
    expect(sim.seats[0].owner).toBe(2);
    expect(sim.turnedAway).toBe(2);
  });
  it('completes repeated cycles with exclusive seats, valid orders and exact payments', () => {
    const sim = new Simulation(); let expectedEarned = 0; const paid = new Set<number>();
    for (let i = 0; i < 30000; i++) {
      const eating = sim.customers.filter(c => c.state === 'eating').map(c => ({ id: c.id, recipe: c.recipe }));
      sim.tick();
      for (const c of eating) if (sim.customers.find(x => x.id === c.id)?.state === 'leaving') {
        expect(paid.has(c.id)).toBe(false); paid.add(c.id); expectedEarned += recipes[c.recipe].price;
      }
      const owners = sim.seats.flatMap(s => s.owner === null ? [] : [s.owner]);
      expect(new Set(owners).size).toBe(owners.length);
      expect(sim.customers.length).toBeLessThanOrEqual(3);
      for (const order of sim.orders) {
        const guest = sim.customers.find(c => c.id === order.customer)!;
        expect(guest).toBeDefined(); expect(guest.recipe).toBe(order.recipe);
        if (order.status === 'served') expect(guest.state).toBe('eating');
      }
      expect(sim.coins).toBe(100 + expectedEarned);
      expect(sim.tasks.length).toBeLessThanOrEqual(6);
    }
    expect(sim.served).toBeGreaterThan(200); expect(sim.lost).toBe(0);
    expect(sim.orders.length).toBeLessThanOrEqual(3);
  });
  it('freezes while paused and resumes with fixed-step timing', () => {
    const sim = new Simulation(); sim.advance(0.25); expect(sim.ticks).toBe(2);
    sim.paused = true; const before = JSON.stringify(sim); sim.advance(0.5); sim.tick();
    expect(JSON.stringify(sim)).toBe(before);
    sim.paused = false; sim.advance(0.05); expect(sim.ticks).toBe(3);
  });
  it('keeps an active prep sequence on its original clock after a knife upgrade', () => {
    const sim = new Simulation();
    while (!sim.chef) sim.tick();
    const job = sim.chef;
    expect(job.duration).toBe(recipes[job.recipe].ticks);
    const remaining = job.remaining;
    sim.buyUpgrade();
    sim.paused = true;
    sim.tick();
    expect(job.remaining).toBe(remaining);
    sim.paused = false;
    for (let i = 0; i < remaining; i++) sim.tick();
    expect(job.remaining).toBe(0);
    expect(sim.orders.find(order => order.customer === job.customer)?.status).toBe('ready');
  });
  it('charges for the upgrade once and reduces new preparation duration', () => {
    const a = new Simulation(), b = new Simulation(); expect(b.buyUpgrade()).toBe(true);
    expect(b.coins).toBe(25); expect(b.buyUpgrade()).toBe(false); expect(b.coins).toBe(25);
    while (!a.chef) { a.tick(); b.tick(); }
    expect(b.chef!.remaining).toBeLessThan(a.chef!.remaining);
    const poor = new Simulation(); poor.coins = 74; expect(poor.buyUpgrade()).toBe(false);
  });
  it('cancels outstanding work when a customer loses patience', () => {
    const sim = new Simulation(); while (!sim.chef) sim.tick();
    const c = sim.customers.find(c => c.id === sim.chef!.customer)!;
    c.patience = 0; sim.tick();
    expect(c.state).toBe('leaving'); expect(sim.lost).toBe(1);
    expect(sim.orders.some(o => o.customer === c.id)).toBe(false);
    expect(sim.chef?.customer).not.toBe(c.id);
    expect(sim.coins).toBe(100);
    for (let i = 0; i < 1000; i++) sim.tick();
    expect(sim.served).toBeGreaterThan(0);
  });
  it('rejects unreachable seats without reserving them', () => {
    const sim = new Simulation(); const before = new Set(obstacles);
    try {
      for (const seat of sim.seats) obstacles.add(`${seat.position.x},${seat.position.y}`);
      for (let i = 0; i < 500; i++) sim.tick();
      expect(sim.customers).toHaveLength(0); expect(sim.seats.every(s => s.owner === null)).toBe(true);
    } finally { obstacles.clear(); for (const cell of before) obstacles.add(cell); }
  });
});
