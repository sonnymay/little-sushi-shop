import type { Point } from './navigation';
import type { Travel } from './simulation';

export const world = (p: Point): Point => ({
  x: 115 + p.x * 55,
  y: 190 + p.y * 40 + 40 * Math.sin(Math.PI * Math.min(p.y, 10) / 10),
});
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

export function sampleTravel(position: Point, travel: Travel | undefined, tick: number) {
  if (!travel) return { ...world(position), dx: 0, dy: 1, moving: false, along: 0 };
  const a = world(travel.from), b = world(travel.to);
  const t = clamp((tick - travel.tick) / 3);
  // Cubic Hermite with zero incoming velocity on launch and zero outgoing velocity at a goal.
  const fraction = smooth(t) + (travel.continued ? t * (1 - t) ** 2 : 0) -
    (travel.final ? 0 : t * t * (1 - t));
  const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
  return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction,
    dx, dy, moving: t < 1, along: Math.hypot(b.x - a.x, b.y - a.y) * fraction };
}

// One foot stays on the floor for half a stride. During stance its local offset
// decreases by exactly the distance the body advances. The other foot swings through.
export function foot(distance: number, step: number, opposite: boolean) {
  const phase = ((distance / step + (opposite ? 1 : 0)) % 2 + 2) % 2;
  if (phase < 1) return { reach: step * (0.5 - phase), lift: 0 };
  const t = phase - 1;
  return { reach: step * (smooth(t) - 0.5), lift: Math.sin(Math.PI * t) * step * 0.22 };
}
