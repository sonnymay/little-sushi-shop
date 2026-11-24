import { expect, it } from 'vitest';
import { advancePose, walkColumn } from '../src/walking';

it('turns with the path, alternates feet by distance, and freezes on pause', () => {
  let pose = advancePose(undefined, { x: 0, y: 0 }, 0);
  for (const [dx, dy, facing, column] of [
    [42, 0, 'right', 2], [0, -42, 'up', 4], [-42, 0, 'left', 2], [0, 42, 'down', 0],
  ] as const) {
    const target = { x: pose.x + dx, y: pose.y + dy };
    pose = advancePose(pose, target, 21 / 190);
    expect([pose.facing, walkColumn(pose)]).toEqual([facing, column + 1]);
    expect(advancePose(pose, target, 0)).toBe(pose);
    pose = advancePose(pose, target, 1);
    expect(pose).toMatchObject(target);
    expect(walkColumn(pose)).toBe(column);
    expect(advancePose(pose, target, 1)).toMatchObject({ facing, moving: false });
  }
});
