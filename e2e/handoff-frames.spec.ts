import { expect, test, type Page } from '@playwright/test';

async function firstHandoff(page: Page, missingRelease = false) {
  // Stand-ins let this test exercise the renderer before the art PR lands.
  const fixture = '<svg xmlns="http://www.w3.org/2000/svg" width="153" height="252"/>';
  await page.route('**/art/mochi-handoff-*.webp', route =>
    missingRelease && route.request().url().endsWith('release.webp')
      ? route.fulfill({ status: 404, body: '' })
      : route.fulfill({ contentType: 'image/svg+xml', body: fixture }));
  await page.addInitScript(() => {
    // Drive real game frames at exact simulated times, independent of refresh rate.
    performance.now = () => 0;
    window.requestAnimationFrame = callback => {
      window.addEventListener('test-game-frame', event => callback((event as CustomEvent<number>).detail), { once: true });
      return 1;
    };
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  return page.evaluate(() => {
    const ctx = document.querySelector('canvas')!.getContext('2d')!;
    const draw = ctx.drawImage.bind(ctx);
    type Draw = { name: string; x: number; y: number; w: number; h: number };
    let poses: Draw[] = [], plates: Draw[] = [];
    ctx.drawImage = (image: CanvasImageSource, ...args: number[]) => {
      const name = image instanceof HTMLImageElement ? image.src.split('/').pop()! : '';
      const [x, y, w, h] = args.slice(-4);
      if (name.startsWith('mochi-handoff-')) poses.push({ name, x, y, w, h });
      // Only the first guest's salmon plate, below the kitchen counter.
      if (name === 'shop-cast.webp' && args[0] === 2 && args[1] === 554 && y > 300) {
        plates.push({ name, x, y, w, h });
      }
      Reflect.apply(draw, ctx, [image, ...args]);
    };
    const frames = [];
    for (let ms = 0; ms <= 9800; ms += 50) {
      poses = []; plates = [];
      window.dispatchEvent(new CustomEvent('test-game-frame', { detail: ms }));
      if (ms >= 8900) frames.push({ ms, poses, plates });
    }
    return frames;
  });
}

test('Mochi plants both feet, changes poses on ticks 2 and 5, and releases one dish on tick 4', async ({ page }) => {
  const frames = await firstHandoff(page);
  for (const { ms, poses, plates } of frames) {
    expect(plates, String(ms)).toHaveLength(1);
    if (ms < 9000 || ms === 9800) {
      expect(poses).toHaveLength(0);
      continue;
    }
    const tick = Math.floor((ms - 9000) / 100);
    const name = tick < 2 ? 'lean' : tick < 5 ? 'extend' : 'release';
    expect(poses.map(p => p.name)).toEqual([`mochi-handoff-${name}.webp`]);
    const pose = poses[0], plate = plates[0], scale = 128 / 252;
    expect(pose.w).toBeCloseTo(153 * scale);
    expect(pose.h).toBeCloseTo(128);
    expect(pose.x + 92 * scale).toBeCloseTo(335);
    expect(pose.y + 244 * scale).toBeCloseTo(438);
    const trayX = pose.x + (tick < 2 ? 52 : 46) * scale;
    const trayY = pose.y + (tick < 2 ? 128 : 141) * scale;
    const progress = (ms - 9000) / 800;
    const eased = tick < 4 ? 0 : progress ** 2 * (3 - 2 * progress);
    expect(plate.x + plate.w / 2).toBeCloseTo(trayX + (270 - trayX) * eased);
    const bottom = trayY + plate.h / 2;
    expect(plate.y + plate.h).toBeCloseTo(bottom + (418 - bottom) * eased);
  }
  const landed = frames.at(-1)!.plates[0];
  expect(landed.x + landed.w / 2).toBeCloseTo(270);
  expect(landed.y + landed.h).toBeCloseTo(418);
});

test('a missing pose preserves the original hand-to-table path for the whole handoff', async ({ page }) => {
  const frames = await firstHandoff(page, true);
  for (const { ms, poses, plates } of frames.filter(frame => frame.ms >= 9000)) {
    expect(poses).toHaveLength(0);
    expect(plates).toHaveLength(1);
    const progress = (ms - 9000) / 800, t = progress ** 2 * (3 - 2 * progress);
    const handX = 335 - 27, handY = 438 - 128 * 0.52;
    expect(plates[0].x + plates[0].w / 2).toBeCloseTo(handX + (270 - handX) * t);
    expect(plates[0].y + plates[0].h).toBeCloseTo(handY + (418 - handY) * t);
  }
});
