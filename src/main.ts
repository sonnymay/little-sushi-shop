import { sampleTravel, world, clamp, smooth, foot } from './walking';
import { HANDOFF_TICKS, Simulation, recipes } from './simulation';
import type { Travel } from './simulation';
import { same, type Point } from './navigation';
import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main><header><div><p class="eyebrow">A LITTLE PLACE TO SLOW DOWN</p><h1>Little Sushi Shop <span>寿司</span></h1><p>Warm rice. Happy guests. A shop with a life of its own.</p></div><div class="badge">AUTONOMOUS PROTOTYPE · 0.1</div></header>
<section class="dashboard" aria-label="Restaurant controls"><div><small>SHOP WALLET</small><strong id="coins">100 coins</strong></div><div><small>HAPPY GUESTS</small><strong id="served">0 served</strong></div><div><small>SHOP CLOCK</small><strong id="clock">00:00</strong></div><div class="controls"><button id="pause">Pause</button><button id="speed" aria-label="Change simulation speed">1× speed</button><button id="restart">Restart</button></div></section>
<div class="layout"><section class="scene"><div class="scene-title"><span>☀ A quiet afternoon</span><span id="activity">The doors are open</span></div><canvas width="1000" height="720" aria-label="Animated sushi restaurant with autonomous guests, a chef, and a server"></canvas><p class="caption">Guests find a seat. Our team takes care of the rest.</p></section><aside><section class="card"><img class="hana-portrait" src="./art/hana.webp" alt="Chef Hana holding sushi"><h2>A sharper knife</h2><p>A little upgrade for chef Hana. New orders prepare 35% faster.</p><button id="upgrade">Upgrade · 75 coins</button><small>One permanent upgrade per session.</small></section><section class="card"><h2>On the menu</h2>${recipes.map(r=>`<div class="menu"><i style="background:${r.color}"></i><span>${r.name}</span><b>${r.price}</b></div>`).join('')}</section><section class="card"><h2>Little moments</h2><ol id="events"></ol></section></aside></div>
<footer>Watch the flow, improve the shop. <span>Prototype artwork · Progress resets on reload</span></footer></main>`;
const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;
const hana = new Image();
hana.src = `./art/hana.webp`;
const preparation = new Image();
preparation.src = './art/hana-prepares.webp';
let sim = new Simulation(), speed = 1;
const $ = (id: string) => document.getElementById(id)!;
$('pause').onclick = () => { sim.paused = !sim.paused; $('pause').textContent = sim.paused ? 'Resume' : 'Pause'; };
$('speed').onclick = () => { speed = speed === 1 ? 3 : 1; $('speed').textContent = `${speed}× speed`; };
$('restart').onclick = () => { sim = new Simulation(); captions.clear(); $('pause').textContent = 'Pause'; };
$('upgrade').onclick = () => sim.buyUpgrade();
function round(x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
}
function ellipse(x: number, y: number, rx: number, ry: number, color: string) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
function text(value: string, x: number, y: number, size = 16, color = '#695044') { ctx.font = `600 ${size}px system-ui`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(value, x, y); }

const atlas = new Image();
atlas.src = './art/shop-cast.webp';
// Tight source rectangles in the transparent atlas, in pixels.
const sprites = {
  courier: [33, 2, 173, 252], mapmaker: [270, 2, 180, 252], potter: [537, 2, 126, 252],
  server: [43, 258, 153, 252], table: [242, 317, 236, 133], chair: [493, 258, 213, 252],
  salmon: [2, 554, 236, 172], tuna: [242, 553, 236, 173], california: [482, 556, 236, 168],
} as const;
const guests = ['courier', 'mapmaker', 'potter'] as const;
const dishes = ['salmon', 'tuna', 'california'] as const;
// Canvas units at the dining tables. The chef artwork is a waist-up portrait.
const adultHeight = 128;
const depthScale = (floorY: number) => 1 + (floorY - 430) / 1800;
const plateHeight = 21;
const tablePlateSlot = (table: Point): Point => ({ x: table.x - 10, y: table.y - 12 });
function sprite(name: keyof typeof sprites, x: number, bottom: number, height: number) {
  if (!atlas.complete || !atlas.naturalWidth) return;
  const [sx, sy, sw, sh] = sprites[name];
  const width = height * sw / sh;
  ctx.drawImage(atlas, sx, sy, sw, sh, x - width / 2, bottom - height, width, height);
}
const walking = new Image();
walking.src = './art/walking.webp';
const walkRows = { courier: 0, mapmaker: 1, potter: 2, server: 3 } as const;
type Art = keyof typeof walkRows;
type Pose = ReturnType<typeof sampleTravel>;
type Layer = { y: number; draw: () => void };
type Label = { x: number; y: number; value: string; opacity: number };
const captions = new Map<string, { value: string; since: number }>();
const strides = new WeakMap<object, { edge?: Travel; base: number }>();

function strideDistance(actor: object, edge: Travel | undefined, pose: Pose) {
  const last = strides.get(actor);
  let base = last?.base ?? 0;
  if (last?.edge && last.edge !== edge) {
    const a = world(last.edge.from), b = world(last.edge.to);
    base += Math.hypot(b.x - a.x, b.y - a.y);
  }
  strides.set(actor, { edge, base });
  return base + pose.along;
}

function shadow(x: number, y: number, width: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width, width * 0.27);
  const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  shade.addColorStop(0, '#553c3260'); shade.addColorStop(1, '#553c3200');
  ctx.fillStyle = shade; ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

// Deform the existing artwork from the waist down. All offsets are in canvas
// units so the planted foot counters the body's actual screen displacement.
function gait(art: Art, pose: Pose, distance: number, height: number, bottom: number) {
  const scale = height / 160, step = height * 0.135;
  const motion = pose.moving ? 1 : 0;
  const breath = Math.sin(sim.visualTick * 0.22) * 0.7;
  const bob = motion ? -1.6 * Math.sin(Math.PI * distance / step) ** 2 : breath;
  const column = pose.dy < 0 ? 4 : pose.dx ? 2 : 0;
  const sx = column * 116, sy = walkRows[art] * 160;
  ctx.save();
  ctx.translate(pose.x, bottom);
  if (pose.dx < 0) ctx.scale(-1, 1);
  ctx.scale(scale, scale);
  const torso = bob / scale;
  if (!pose.moving) {
    // Anchor the soles as the chest rises and falls.
    ctx.drawImage(walking, sx, sy, 116, 160, -58, -160 + torso, 116, 160 - torso);
    ctx.restore();
    return;
  }
  ctx.drawImage(walking, sx, sy, 116, 58, -58, -160 + torso, 116, 58);
  for (let side = 0; side < 2; side++) {
    const limb = foot(distance, step, side === 1);
    function offset(row: number) {
      const leg = smooth((row - 101) / 55);
      const arm = Math.sin(Math.PI * clamp((row - 58) / 47));
      const swing = motion * limb.reach / scale;
      return {
        x: Math.abs(pose.dx) * swing * leg - swing * arm * 0.22,
        y: torso * (1 - leg) + motion * (pose.dy * limb.reach - limb.lift) / scale * leg,
      };
    }
    // Each horizontal strip meets its neighbour at the same displaced boundary.
    for (let row = 58; row < 160; row += 3) {
      const end = Math.min(row + 3, 160), a = offset(row), b = offset(end);
      const x = side * 58;
      // Keep the garment joined along the centre seam above the knees.
      const seam = a.x * smooth((row - 120) / 18);
      const left = side === 0 ? a.x : seam;
      const right = side === 0 ? seam : a.x;
      ctx.drawImage(walking, sx + x, sy + row, 58, end - row,
        x - 58 + left, row - 160 + a.y, 58 + right - left, end - row + b.y - a.y + 0.4);
    }
  }
  ctx.restore();
}

const biteArt = new Image();
biteArt.src = './art/bites.webp';

function drawActor(art: Art, pose: Pose, distance: number, sitting: number, mealTick?: number) {
  const height = adultHeight * depthScale(pose.y), bottom = pose.y + 8 + 16 * sitting;
  shadow(pose.x, pose.y + 7, height * 0.22);
  if (mealTick !== undefined && art !== 'server' && biteArt.complete && biteArt.naturalWidth) {
    // Reach, lift, then linger on the happy expression. The simulation clock
    // freezes the gesture on pause and scales it along with service at 3×.
    const phase = mealTick % 20;
    const frame = phase < 6 ? 0 : phase < 12 ? 1 : 2;
    const size = height * 0.56;
    const nod = frame === 2 ? 1.8 * Math.sin((phase - 12) * Math.PI / 4) : 0;
    ctx.drawImage(biteArt, frame * 128, walkRows[art] * 128, 128, 128,
      pose.x - size / 2, bottom - height + nod, size, size);
    return;
  }
  const ready = walking.complete && walking.naturalWidth > 0;
  ctx.save();
  if (sitting > 0) {
    ctx.beginPath();
    ctx.rect(pose.x - height, bottom - height - 3, height * 2, height * (1 - 0.28 * sitting) + 3);
    ctx.clip();
  }
  if (ready && sitting < 1) {
    ctx.globalAlpha = 1 - sitting;
    gait(art, pose, distance, height, bottom);
  }
  if (!ready || sitting > 0) {
    ctx.globalAlpha = ready ? sitting : 1;
    sprite(art, pose.x, bottom, height + 0.7 * Math.sin(sim.visualTick * 0.22));
  }
  ctx.restore();
}

function caption(labels: Label[], id: string, value: string, pose: Pose) {
  let entry = captions.get(id);
  if (!entry || entry.value !== value) {
    entry = { value, since: sim.visualTick }; captions.set(id, entry);
  }
  const opacity = clamp((30 - (sim.visualTick - entry.since)) / 9);
  if (opacity) labels.push({ x: pose.x, y: pose.y - adultHeight * depthScale(pose.y) - 9, value, opacity });
}

function drawLabels(labels: Label[]) {
  const placed: { x: number; y: number; width: number }[] = [];
  for (const label of labels.sort((a, b) => b.y - a.y)) {
    ctx.font = '600 10px system-ui';
    const width = Math.ceil(ctx.measureText(label.value).width) + 14;
    const x = Math.max(width / 2, Math.min(1000 - width / 2, label.x));
    let y = label.y;
    while (placed.some(p => Math.abs(x - p.x) < (width + p.width) / 2 + 3 && Math.abs(y - p.y) < 18)) y -= 18;
    placed.push({ x, y, width });
    ctx.save(); ctx.globalAlpha = label.opacity;
    round(x - width / 2, y - 9, width, 16, 8, '#fffdf4ed');
    text(label.value, x, y + 3, 10); ctx.restore();
  }
}
function render() {
  ctx.clearRect(0, 0, 1000, 720);
  round(35, 25, 930, 645, 50, '#efe0c6');
  round(50, 38, 900, 225, 34, '#f9eed8');
  for (let y = 300; y < 660; y += 48) { ctx.beginPath(); ctx.moveTo(52, y); ctx.lineTo(948, y); ctx.strokeStyle = '#d8bd962f'; ctx.lineWidth = 3; ctx.stroke(); }
  // Paper windows, wooden trim, and softly glowing lanterns.
  for (const x of [95, 745]) { round(x, 70, 155, 135, 10, '#cda47f'); round(x + 9, 79, 137, 117, 5, '#f6f0d6'); for (let i = 1; i < 4; i++) round(x + 9 + i * 32, 79, 4, 117, 1, '#d4b48d'); round(x + 9, 135, 137, 4, 1, '#d4b48d'); }
  round(340, 58, 320, 78, 14, '#46645c'); text('Little Sushi Shop', 500, 106, 28, '#fff3d8');
  for (const x of [290, 710]) { round(x - 1, 38, 2, 88, 1, '#ae8d66'); ellipse(x, 146, 24, 32, '#f1bd81'); text('寿', x, 153, 22, '#945e44'); }
  const chefHeight = adultHeight * depthScale(260) * 0.58;
  const chef = sim.chef;
  shadow(500, 256, 22);
  if (chef && preparation.complete && preparation.naturalWidth) {
    const progress = clamp((chef.duration - chef.remaining - 1 + sim.visualTick - sim.ticks) / chef.duration);
    const stage = progress < 0.32 ? 0 : progress < 0.74 ? 1 : 2;
    const press = stage === 1 ? 1.8 * Math.sin((progress - 0.32) / 0.42 * Math.PI) : 0;
    const width = chefHeight * 192 / 256;
    ctx.drawImage(preparation, stage * 192, 0, 192, 256,
      500 - width / 2, 258 - chefHeight + press, width, chefHeight);
    if (stage === 2) sprite(dishes[chef.recipe], 501, 258 - chefHeight * 0.24, chefHeight * 0.17);
  } else if (hana.complete && hana.naturalWidth) {
    const width = chefHeight * hana.naturalWidth / hana.naturalHeight;
    const breath = Math.sin(sim.visualTick * 0.22) * 0.7;
    ctx.drawImage(hana, 500 - width / 2, 258 - chefHeight + breath, width, chefHeight);
  }
  round(205, 265, 590, 55, 17, '#bb815c', '#9c6a4d'); round(192, 250, 616, 34, 16, '#dfb187', '#a87754');
  const ready = sim.orders.filter(order => order.status === 'ready');
  ready.forEach((order, i) => sprite(dishes[order.recipe], 500 + i * 40, 270, plateHeight * depthScale(260)));
  text('PICKUP', 635, 273, 12, '#805744');
  round(422, 595, 156, 44, 12, '#a8b8a0'); text('WELCOME', 500, 623, 16, '#ffffff');
  const layers: Layer[] = [], labels: Label[] = [];
  const server = sim.server, task = server.task;
  const recipient = task?.kind === 'deliver' && server.phase !== 'pickup'
    ? sim.customers.find(c => c.id === task.target) : undefined;
  const handoffProgress = server.phase === 'handoff'
    ? clamp(1 - (server.handoff - (sim.visualTick - sim.ticks)) / HANDOFF_TICKS) : 0;
  for (const [index, seat] of sim.seats.entries()) {
    const p = world(seat.position);
    layers.push({ y: p.y + 9, draw: () => sprite('chair', p.x, p.y + 9, 70) });
    layers.push({ y: p.y + 28, draw: () => {
      sprite('table', p.x, p.y + 28, 69);
      const customer = sim.customers.find(c => c.id === seat.owner);
      const slot = tablePlateSlot(p);
      if (customer?.state === 'eating') sprite(dishes[customer.recipe], slot.x, slot.y, plateHeight);
      else if (seat.dirty) ellipse(slot.x, slot.y, 15, 5, '#eee5d7');
      text(seat.dirty ? 'Cleaning soon' : `Table ${index + 1}`, p.x, p.y + 43, 12, '#96795e');
    } });
  }
  const live = new Set<string>();
  function actor(id: string, entity: { position: Point }, art: Art, value: string, sitting = 0, mealTick?: number) {
    const edge = sim.travel.get(entity);
    const pose = sampleTravel(entity.position, edge, sim.visualTick);
    if (entity === server && server.phase === 'handoff') {
      // All three service points are one tile east of the seated guest.
      pose.dx = -1; pose.dy = 0;
    }
    const distance = strideDistance(entity, edge, pose);
    live.add(id); caption(labels, id, value, pose);
    layers.push({ y: pose.y + 8 + 16 * sitting, draw: () => drawActor(art, pose, distance, sitting, mealTick) });
    return pose;
  }
  for (const [index, guest] of sim.arrivals.entries()) {
    const position = { x: 10.6 + index * 1.55, y: 10.6 };
    actor(`line-${guest.id}`, { position }, guests[(guest.id - 1) % guests.length], `Waiting · ${index + 1}`);
  }
  for (const c of sim.customers) {
    const elapsed = c.timer + sim.visualTick - sim.ticks;
    const inChair = same(c.position, sim.seats[c.seat].position);
    let sitting = 0;
    if (c.state === 'waiting') sitting = smooth(elapsed / 4);
    if (c.state === 'eating') sitting = 1;
    if (c.state === 'leaving' && inChair) sitting = 1 - smooth(elapsed / 4);
    const status = c.state === 'waiting' ? recipes[c.recipe].name : c.state === 'eating' ? 'So delicious!' : c.personality;
    const reaching = c === recipient && handoffProgress > 0.5;
    const mealTick = reaching ? 0 : c.state === 'eating' ? elapsed : undefined;
    actor(String(c.id), c, guests[(c.id - 1) % guests.length], status, sitting, mealTick);
  }
  const pose = actor('server', server, 'server', task?.kind === 'clean' ? 'Mochi · tidying' : task ? 'Mochi · serving' : 'Mochi · ready');
  if (recipient) {
    const scale = depthScale(pose.y);
    // The front-facing carry uses Mochi's raised right hand (screen left),
    // keeping the dish in place when Mochi turns toward the table.
    const handX = pose.x + (pose.dx > 0 ? 27 : -27) * scale;
    const handY = pose.y + 8 - adultHeight * scale * 0.52;
    const table = world(sim.seats[recipient.seat].position), slot = tablePlateSlot(table);
    const t = smooth(handoffProgress);
    // Draw the carried dish above the tabletop as it lands. On the completion
    // tick the eating guest's table takes over at exactly the same slot and size.
    layers.push({ y: server.phase === 'handoff' ? table.y + 28 : pose.y + 8, draw: () =>
      sprite(dishes[recipient.recipe], handX + (slot.x - handX) * t, handY + (slot.y - handY) * t,
        plateHeight * (scale + (1 - scale) * t)) });
  }
  for (const layer of layers.sort((a, b) => a.y - b.y)) layer.draw();
  drawLabels(labels);
  for (const id of captions.keys()) if (!live.has(id)) captions.delete(id);
  $('coins').textContent = `${sim.coins} coins`; $('served').textContent = `${sim.served} served`;
  const seconds = Math.floor(sim.ticks / 10); $('clock').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('activity').textContent = sim.paused ? 'Taking a little break' : `${sim.customers.length} inside · ${sim.arrivals.length} in line`;
  const upgrade = $('upgrade') as HTMLButtonElement; upgrade.disabled = sim.upgraded || sim.coins < 75; upgrade.textContent = sim.upgraded ? 'Upgraded · happy chopping!' : 'Upgrade · 75 coins';
  $('events').innerHTML = sim.events.map(event => `<li>${event}</li>`).join('');
}
let previous = performance.now();
function frame(now: number) { sim.advance(Math.min((now - previous) / 1000 * speed, 0.5)); previous = now; render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
