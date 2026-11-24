export interface Point { x: number; y: number }
export const key = (p: Point) => `${p.x},${p.y}`;
export const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const WIDTH = 15, HEIGHT = 11;
export const entrance = { x: 7, y: 10 };
export const pickup = { x: 7, y: 3 };
export const seatPositions = [{ x: 3, y: 5 }, { x: 7, y: 5 }, { x: 11, y: 5 }];
export const obstacles = new Set<string>();
for (let x = 2; x <= 12; x++) obstacles.add(`${x},2`);
for (const seat of seatPositions) obstacles.add(`${seat.x},${seat.y - 1}`);
// Uniform-cost four-neighbour BFS: shortest paths on this tiny unweighted grid.
// Rendering is continuous and never displays the navigation grid.
export function pathfind(start: Point, goal: Point, blocked = obstacles): Point[] | null {
  const valid = (p: Point) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < WIDTH && p.y >= 0 && p.y < HEIGHT && !blocked.has(key(p));
  if (!valid(start) || !valid(goal)) return null;
  const queue = [start], previous = new Map<string, Point | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (same(p, goal)) {
      const path: Point[] = [];
      let cursor = p;
      while (!same(cursor, start)) { path.unshift(cursor); cursor = previous.get(key(cursor))!; }
      return path;
    }
    for (const next of [{ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 }]) {
      if (valid(next) && !previous.has(key(next))) { previous.set(key(next), p); queue.push(next); }
    }
  }
  return null;
}
