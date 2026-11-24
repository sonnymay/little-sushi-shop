import type { Point } from './navigation';

export type Facing = 'down' | 'right' | 'left' | 'up';
export interface WalkPose extends Point { facing: Facing; distance: number; moving: boolean }

export function advancePose(previous: WalkPose | undefined, target: Point, seconds: number): WalkPose {
  if (!previous) return { ...target, facing: 'down', distance: 0, moving: false };
  if (seconds <= 0) return previous;
  const dx = target.x - previous.x, dy = target.y - previous.y;
  const gap = Math.hypot(dx, dy);
  if (gap < 0.01) return { ...previous, ...target, moving: false };
  const facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  const step = Math.min(gap, seconds * 190);
  return { x: previous.x + dx * step / gap, y: previous.y + dy * step / gap,
    facing, distance: previous.distance + step, moving: true };
}

export function walkColumn(pose: WalkPose): number {
  const start = pose.facing === 'up' ? 4 : pose.facing === 'down' ? 0 : 2;
  return start + (pose.moving ? Math.floor(pose.distance / 21) % 2 : 0);
}
