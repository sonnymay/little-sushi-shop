import { expect, test } from '@playwright/test';

test('Mochi polishes only at the dirty table, pauses mid-stroke, then clears it', async ({ page }) => {
  await page.addInitScript(() => {
    performance.now = () => 0;
    window.requestAnimationFrame = callback => {
      window.addEventListener('shop-frame', e => callback((e as CustomEvent<number>).detail), { once: true });
      return 1;
    };
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  const samples = await page.evaluate(() => {
    const ctx = document.querySelector('canvas')!.getContext('2d')!;
    const draw = ctx.drawImage.bind(ctx);
    let cloth: number[] = [];
    ctx.drawImage = (image: CanvasImageSource, ...args: number[]) => {
      if (image instanceof HTMLImageElement && image.src.endsWith('/mochi-cleaning.webp')) {
        cloth.push(ctx.getTransform().b);
      }
      Reflect.apply(draw, ctx, [image, ...args]);
    };
    function frame(ms: number) {
      cloth = [];
      window.dispatchEvent(new CustomEvent('shop-frame', { detail: ms }));
      return cloth;
    }
    for (let ms = 0; ms < 18800; ms += 100) frame(ms);
    const arriving = frame(18800), start = frame(18900), mid = frame(19100);
    document.getElementById('pause')!.click();
    const paused = frame(19600);
    document.getElementById('pause')!.click();
    frame(20000);
    const finish = frame(20400);
    return { arriving, start, mid, paused, finish };
  });
  expect(samples.arriving).toEqual([]);
  expect(samples.start).toHaveLength(1);
  expect(samples.mid).toHaveLength(1);
  expect(samples.mid).not.toEqual(samples.start);
  expect(samples.paused).toEqual(samples.mid);
  expect(samples.finish).toEqual([]);
});
