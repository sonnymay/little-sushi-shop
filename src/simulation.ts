import { entrance, pickup, seatPositions, obstacles, key, servicePoint, pathfind, same, type Point } from './navigation';

export const recipes = [
  { name: 'Salmon nigiri', price: 12, ticks: 35, color: '#ef947f' },
  { name: 'Tuna maki', price: 15, ticks: 45, color: '#d96876' },
  { name: 'California roll', price: 18, ticks: 55, color: '#a3b97d' },
];
export const HANDOFF_TICKS = 8;
export type CustomerState = 'walking' | 'waiting' | 'eating' | 'leaving';
export interface Customer { id: number; seat: number; position: Point; state: CustomerState; timer: number; patience: number; recipe: number; personality: string }
export interface Seat { position: Point; owner: number | null; dirty: boolean }
export interface Order { customer: number; recipe: number; status: 'placed' | 'preparing' | 'ready' | 'delivering' | 'served' }
export interface Task { kind: 'deliver' | 'clean'; target: number }
export interface Server { position: Point; task: Task | null; phase: 'pickup' | 'target' | 'handoff'; timer: number; handoff: number }
export interface Travel { from: Point; to: Point; tick: number; continued: boolean; final: boolean }
export class Simulation {
  ticks = 0; coins = 100; earned = 0; served = 0; lost = 0; upgraded = false; paused = false;
  customers: Customer[] = [];
  arrivals: { id: number; joinedAt: number }[] = [];
  turnedAway = 0;
  seats: Seat[] = seatPositions.map(position => ({ position: { ...position }, owner: null, dirty: false }));
  orders: Order[] = [];
  tasks: Task[] = [];
  chef: { customer: number; recipe: number; duration: number; remaining: number } | null = null;
  server: Server = { position: { x: 9, y: 3 }, task: null, phase: 'pickup', timer: 0, handoff: 0 };
  events: string[] = ['Welcome! Your tiny shop runs itself.'];
  readonly travel = new WeakMap<{ position: Point }, Travel>();
  get visualTick() { return this.ticks + this.accumulator * 10; }
  private nextId = 1;
  private accumulator = 0;
  private log(message: string) { this.events.unshift(message); this.events.length = Math.min(5, this.events.length); }
  advance(seconds: number) {
    if (this.paused || !Number.isFinite(seconds) || seconds <= 0) return;
    this.accumulator += Math.min(seconds, 0.5);
    while (this.accumulator >= 0.1 - 1e-9) { this.accumulator -= 0.1; this.tick(); }
  }
  buyUpgrade(): boolean {
    if (this.upgraded || this.coins < 75) return false;
    this.coins -= 75; this.upgraded = true; this.log('A sharper knife! New orders cook 35% faster.'); return true;
  }
  private move(actor: { position: Point }, target: Point): boolean {
    const last = this.travel.get(actor);
    if (last && this.ticks - last.tick < 3) return false;
    if (same(actor.position, target)) return true;
    if (this.ticks % 3 !== 0) return false;

    const blocked = new Set(obstacles);
    for (const seat of this.seats) {
      if (!same(seat.position, target)) blocked.add(key(seat.position));
    }
    for (const other of [...this.customers, this.server]) {
      if (other === actor) continue;
      blocked.add(key(other.position));
      const edge = this.travel.get(other);
      if (edge && this.ticks - edge.tick < 3) blocked.add(key(edge.from));
    }
    blocked.delete(key(actor.position));
    const next = pathfind(actor.position, target, blocked)?.[0];
    if (!next) return false;
    const continued = !!last && this.ticks === last.tick + 3 &&
      next.x - actor.position.x === last.to.x - last.from.x &&
      next.y - actor.position.y === last.to.y - last.from.y;
    this.travel.set(actor, { from: actor.position, to: next, tick: this.ticks, continued, final: same(next, target) });
    actor.position = next;
    return false;
  }
  private enqueue(task: Task) {
    if (!this.tasks.some(t => t.kind === task.kind && t.target === task.target) && !(this.server.task?.kind === task.kind && this.server.task.target === task.target)) this.tasks.push(task);
  }
  private clearDelivery() {
    const s = this.server;
    s.task = null; s.phase = 'pickup'; s.timer = 0; s.handoff = 0;
  }
  private depart(c: Customer) {
    this.orders = this.orders.filter(o => o.customer !== c.id);
    this.tasks = this.tasks.filter(t => t.kind !== 'deliver' || t.target !== c.id);
    if (this.chef?.customer === c.id) this.chef = null;
    if (this.server.task?.kind === 'deliver' && this.server.task.target === c.id) this.clearDelivery();
    c.state = 'leaving'; c.timer = 0;
  }
  tick() {
    if (this.paused) return;
    this.ticks++;
    while (this.arrivals.length && this.ticks - this.arrivals[0].joinedAt >= 240) {
      const guest = this.arrivals.shift()!;
      this.turnedAway++;
      this.log(`Guest #${guest.id} left the line.`);
    }
    if (this.ticks % 60 === 1) {
      const id = this.nextId++;
      if (this.arrivals.length < 3) this.arrivals.push({ id, joinedAt: this.ticks });
      else {
        this.turnedAway++;
        this.log(`Guest #${id} found the line full.`);
      }
    }
    if (this.arrivals.length && this.customers.length < 3 && !this.customers.some(c => same(c.position, entrance))) {
      // Dreamers like the window, foodies watch the chef, and regulars have a usual table.
      const favorites = [0, 1, 2];
      const favorite = favorites[(this.arrivals[0].id - 1) % favorites.length];
      const available = (s: Seat) => s.owner === null && !s.dirty && pathfind(entrance, s.position) !== null;
      const index = available(this.seats[favorite]) ? favorite : this.seats.findIndex(available);
      if (index >= 0) {
        const { id } = this.arrivals.shift()!;
        const recipe = (id - 1) % recipes.length;
        this.seats[index].owner = id;
        this.customers.push({ id, seat: index, position: { ...entrance }, state: 'walking', timer: 0, patience: 600 + recipe * 100, recipe, personality: ['Dreamer', 'Foodie', 'Regular'][recipe] });
        const moment = index === favorite
          ? ['A window seat. The dreamer watches the afternoon light.', 'Front row! The foodie watches Hana shape the rice.', 'The regular settles into their usual spot.'][recipe]
          : 'A change of scenery today!';
        this.log(`Table ${index + 1}: ${moment}`);
      }
    }
    for (const c of this.customers) {
      c.timer++;
      if (c.state === 'walking' && this.move(c, this.seats[c.seat].position)) {
        c.state = 'waiting'; c.timer = 0;
        this.orders.push({ customer: c.id, recipe: c.recipe, status: 'placed' });
      } else if ((c.state === 'walking' || c.state === 'waiting') && c.timer > c.patience) {
        this.lost++; this.log(`Guest #${c.id} ran out of patience.`); this.depart(c);
      } else if (c.state === 'eating' && c.timer >= 40 + c.recipe * 10) {
        const price = recipes[c.recipe].price;
        this.coins += price; this.earned += price; this.served++;
        this.log(`Guest #${c.id}: delicious! +${price} coins`);
        this.depart(c);
      } else if (c.state === 'leaving') {
        // Timeout is a last-resort escape if a future layout edit blocks the exit.
        const seat = this.seats[c.seat];
        if (c.timer <= 4 && same(c.position, seat.position)) continue;
        const exited = this.move(c, entrance);
        const travel = this.travel.get(c);
        const cleared = !same(c.position, seat.position) &&
          !(travel && same(travel.from, seat.position) && this.ticks < travel.tick + 3);
        if (seat.owner === c.id && (cleared || c.timer > 300)) {
          seat.owner = null; seat.dirty = true;
          this.enqueue({ kind: 'clean', target: c.seat });
        }
        if (exited || c.timer > 300) this.customers = this.customers.filter(other => other !== c);
      }
    }
    if (!this.chef) {
      const order = this.orders.find(o => o.status === 'placed');
      if (order) {
        const duration = Math.ceil(recipes[order.recipe].ticks * (this.upgraded ? 0.65 : 1));
        order.status = 'preparing';
        this.chef = { customer: order.customer, recipe: order.recipe, duration, remaining: duration };
      }
    }
    if (this.chef && --this.chef.remaining <= 0) {
      const order = this.orders.find(o => o.customer === this.chef!.customer);
      if (order) { order.status = 'ready'; this.enqueue({ kind: 'deliver', target: order.customer }); }
      this.chef = null;
    }
    this.workServer();
  }
  private workServer() {
    const s = this.server;
    // FIFO bounds cleanup wait, so ready dishes cannot starve dirty tables forever.
    if (!s.task) { s.task = this.tasks.shift() ?? null; s.phase = 'pickup'; s.timer = 0; }
    const task = s.task;
    if (!task) return;
    s.timer++;
    if (task.kind === 'clean') {
      const seat = this.seats[task.target];
      if (this.move(s, servicePoint(seat.position))) {
        if (s.phase === 'pickup') { s.phase = 'target'; s.timer = 0; }
        else if (s.timer >= 10) { seat.dirty = false; s.task = null; }
      }
      else if (s.timer > 200) { s.task = null; this.enqueue(task); }
      return;
    }
    const order = this.orders.find(o => o.customer === task.target);
    const customer = this.customers.find(c => c.id === task.target && c.state === 'waiting');
    if (!order || !customer) { this.clearDelivery(); return; }
    if (s.phase === 'pickup') {
      if (this.move(s, pickup)) { order.status = 'delivering'; s.phase = 'target'; }
    } else if (s.phase === 'target') {
      if (this.move(s, servicePoint(customer.position))) {
        s.phase = 'handoff'; s.handoff = HANDOFF_TICKS;
      }
    } else if (--s.handoff === 0) {
      order.status = 'served'; customer.state = 'eating'; customer.timer = 0;
      this.clearDelivery();
    }
    if (s.task && s.timer > 200) {
      order.status = 'ready'; this.clearDelivery(); this.enqueue(task);
    }
  }
}
