import { sampleTravel, world, clamp, smooth, foot } from './walking';
import { Simulation, recipes } from './simulation';
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
let sim = new Simulation(), speed = 1;
const $ = (id: string) => document.getElementById(id)!;
$('pause').onclick = () => { sim.paused = !sim.paused; $('pause').textContent = sim.paused ? 'Resume' : 'Pause'; };
$('speed').onclick = () => { speed = speed === 1 ? 3 : 1; $('speed').textContent = `${speed}× speed`; };
$('restart').onclick = () => { sim = new Simulation(); captions.clear(); headings.clear(); $('pause').textContent = 'Pause'; };
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
function sprite(name: keyof typeof sprites, x: number, bottom: number, height: number) {
  if (!atlas.complete || !atlas.naturalWidth) return;
  const [sx, sy, sw, sh] = sprites[name];
  const width = height * sw / sh;
  ctx.drawImage(atlas, sx, sy, sw, sh, x - width / 2, bottom - height, width, height);
}
// Articulated chibi actors: separate limbs, torso and head, not distorted image strips.
// Coordinates are authored in a 128-unit local rig with the floor as its origin.
const cast = {
  courier: { hair: '#6d4535', shirt: '#b97852', pants: '#74685b', skin: '#f5cda5', accent: '#f0d5a3' },
  mapmaker: { hair: '#403d38', shirt: '#819b85', pants: '#596b68', skin: '#f4cca7', accent: '#e9e1bc' },
  potter: { hair: '#805748', shirt: '#c78883', pants: '#77647a', skin: '#e9b68d', accent: '#f7e2cc' },
  chef: { hair: '#47392f', shirt: '#eee2ce', pants: '#655a4d', skin: '#f6d0aa', accent: '#a66f59' },
  server: { hair: '#493c33', shirt: '#547b73', pants: '#514c45', skin: '#f6d0aa', accent: '#f9e9c9' },
} as const;
type Art = keyof typeof cast;
type Pose = ReturnType<typeof sampleTravel>;
type Layer = { y: number; draw: () => void };
type Label = { x: number; y: number; value: string; opacity: number };
const captions = new Map<string, { value: string; since: number }>();
const strides = new WeakMap<object, { edge?: Travel; base: number }>();
const headings = new Map<string, { dx: number; dy: number }>();

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
  ctx.save(); ctx.translate(x, y); ctx.scale(width, width * 0.27);
  const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  shade.addColorStop(0, '#553c3260'); shade.addColorStop(1, '#553c3200');
  ctx.fillStyle = shade; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
}

type Joint = { x: number; y: number };
function bone(a: Joint, b: Joint, width: number, color: string) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = '#594438'; ctx.lineWidth = width + 2; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function drawActor(art: Art, pose: Pose, distance: number, sitting: number,
  action: 'idle' | 'carry' | 'eat' | 'clean' | 'cook' = 'idle', plate?: number) {
  const palette = cast[art], height = adultHeight * depthScale(pose.y);
  const s = height / 128, tick = sim.visualTick;
  const side = pose.dx !== 0, back = !side && pose.dy < 0;
  const dir = pose.dx < 0 ? -1 : 1;
  const walking = pose.moving && sitting < 0.01;
  const step = 18 * s;
  const breath = Math.sin(tick * 0.28 + (art.length * 0.9)) * 0.8;
  const bob = walking ? -2.4 * Math.sin(Math.PI * distance / step) ** 2 : breath;
  const hipY = -38 + sitting * 18 + bob;
  const shoulderY = hipY - 37;
  const headY = shoulderY - 23;
  const activity = Math.sin(tick * 0.8);
  const blink = (tick + art.length * 13) % 49 < 1.5;
  shadow(pose.x, pose.y + 7, height * 0.22);
  ctx.save(); ctx.translate(pose.x, pose.y + 8); ctx.scale(s * dir, s);

  function leg(i: number) {
    const sign = i === 0 ? -1 : 1;
    const stride = walking ? foot(distance, step, i === 1) : { reach: 0, lift: 0 };
    const spread = side ? 5 : 10;
    const hip = { x: sign * spread, y: hipY };
    const ankle = { x: sign * spread + (side ? stride.reach / s + sitting * 16 : 0),
      y: -5 - stride.lift / s + (!side ? pose.dy * stride.reach / s : 0) };
    const knee = { x: (hip.x + ankle.x) / 2 + (side ? 4 + sitting * 9 : sign * 2 * sitting),
      y: (hip.y + ankle.y) / 2 - sitting * 6 };
    bone(hip, knee, 15, palette.pants); bone(knee, ankle, 12, palette.pants);
    ellipse(ankle.x + (side ? 4 : 0), ankle.y + 2, side ? 11 : 8, 5, '#594438');
    ellipse(ankle.x + (side ? 4 : 0), ankle.y, side ? 9 : 7, 4, '#faf0d8');
  }
  function arm(i: number) {
    const sign = i === 0 ? -1 : 1;
    const stride = walking ? foot(distance, step, i !== 1).reach / s : 0;
    const shoulder = { x: sign * (side ? 9 : 20), y: shoulderY + 5 };
    let hand = { x: shoulder.x + (side ? stride * 0.8 : sign * 4), y: shoulder.y + 30 + (!side ? pose.dy * stride * 0.6 : 0) };
    if (action === 'carry') hand = { x: side ? 29 : sign * 15, y: shoulder.y + 16 };
    if (action === 'eat') hand = { x: side ? 17 : sign * 12, y: shoulder.y + 12 - 15 * (0.5 + 0.5 * activity) };
    if (action === 'clean' || action === 'cook') hand = { x: (side ? 24 : sign * 14) + activity * 7, y: shoulder.y + 23 + activity * 3 };
    const elbow = { x: (shoulder.x + hand.x) / 2 + (side ? -5 : sign * 5), y: (shoulder.y + hand.y) / 2 + 3 };
    bone(shoulder, elbow, 13, palette.shirt); bone(elbow, hand, 9, palette.skin);
    ellipse(hand.x, hand.y, 6, 6, palette.skin);
  }
  // Far limbs are occluded by the torso; near limbs overlap it.
  leg(0); leg(1); arm(0);
  round(-20, shoulderY, 40, hipY - shoulderY + 6, 13, palette.shirt, '#594438');
  if (art === 'server' && !back) {
    round(-13, shoulderY + 14, 26, 29, 5, palette.accent);
    bone({ x: -10, y: shoulderY + 1 }, { x: -10, y: shoulderY + 18 }, 4, palette.accent);
    bone({ x: 10, y: shoulderY + 1 }, { x: 10, y: shoulderY + 18 }, 4, palette.accent);
    round(-7, shoulderY + 28, 14, 8, 2, '#e5cda5');
  } else if (!back) {
    bone({ x: -10, y: shoulderY + 2 }, { x: 0, y: shoulderY + 10 }, 3, palette.accent);
    bone({ x: 10, y: shoulderY + 2 }, { x: 0, y: shoulderY + 10 }, 3, palette.accent);
  }
  arm(1);
  // Head has its own pivot and independent expression.
  ctx.save(); ctx.translate(0, headY);
  ctx.rotate(walking ? Math.sin(distance / step * Math.PI) * 0.035 : activity * 0.012);
  ellipse(0, 0, 27, 27, '#594438');
  ellipse(0, -2, 25, 25, palette.hair);
  if (!back) {
    ellipse(side ? 7 : 0, 6, side ? 21 : 23, 20, palette.skin);
    ellipse(side ? -17 : -24, 7, 5, 7, palette.skin);
    if (!side) ellipse(24, 7, 5, 7, palette.skin);
    ellipse(side ? -6 : -8, -14, 17, 11, palette.hair);
    if (art === 'potter') ellipse(-18, -17, 11, 12, palette.hair);
    const eyes = side ? [12] : [-9, 9];
    for (const x of eyes) {
      ellipse(x, 5, 2.7, blink ? 0.7 : 4, '#493c33');
      if (!blink) ellipse(x + 0.7, 4, 0.9, 1, '#fff9eb');
      ellipse(x + (side ? 3 : 0), 13, 4, 2, '#e8a398');
    }
    ctx.beginPath(); ctx.arc(side ? 15 : 0, 14, 3, 0.15, Math.PI - 0.15);
    ctx.strokeStyle = '#945e54'; ctx.lineWidth = 1.5; ctx.stroke();
  } else {
    ellipse(-8, -5, 13, 18, palette.hair);
    ellipse(8, -5, 13, 18, palette.hair);
  }
  if (art === 'server' || art === 'chef') {
    round(-22, -23, 44, 9, 4, '#f9e9c9', '#594438');
    if (art === 'chef') { ellipse(-12, -28, 13, 12, '#fff3d8'); ellipse(9, -29, 15, 13, '#fff3d8'); }
  }
  ctx.restore();
  if (action === 'carry' && plate !== undefined) {
    // Dish shares the hand's rig coordinates instead of floating beside the actor.
    sprite(dishes[plate], side ? 29 : 0, shoulderY + 19, 23);
  }
  if (action === 'cook') {
    round(-18 + activity * 6, shoulderY + 21, 20, 5, 2, '#f4dbc2');
    round(-3 + activity * 7, shoulderY + 12 + activity * 3, 18, 4, 1, '#a8b5b4');
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
  drawActor('chef', { x: 500, y: 267, dx: 0, dy: 1, moving: false, along: 0 }, 0, 0, sim.chef ? 'cook' : 'idle');
  round(205, 265, 590, 55, 17, '#bb815c', '#9c6a4d'); round(192, 250, 616, 34, 16, '#dfb187', '#a87754');
  for (let i = 0; i < 3; i++) sprite(dishes[i], 315 + i * 90, 270, plateHeight * depthScale(260));
  text('PICKUP', 675, 273, 12, '#805744');
  round(422, 595, 156, 44, 12, '#a8b8a0'); text('WELCOME', 500, 623, 16, '#ffffff');
  const layers: Layer[] = [], labels: Label[] = [];
  for (const [index, seat] of sim.seats.entries()) {
    const p = world(seat.position);
    layers.push({ y: p.y + 9, draw: () => sprite('chair', p.x, p.y + 9, 70) });
    layers.push({ y: p.y + 28, draw: () => {
      sprite('table', p.x, p.y + 28, 69);
      const customer = sim.customers.find(c => c.id === seat.owner);
      if (customer?.state === 'eating') sprite(dishes[customer.recipe], p.x - 10, p.y - 12, plateHeight);
      else if (seat.dirty) ellipse(p.x - 10, p.y - 12, 15, 5, '#eee5d7');
      text(seat.dirty ? 'Cleaning soon' : `Table ${index + 1}`, p.x, p.y + 43, 12, '#96795e');
    } });
  }
  const live = new Set<string>();
  function actor(id: string, entity: { position: Point }, art: Art, value: string, sitting = 0, plate?: number, action: 'idle' | 'eat' | 'clean' = 'idle') {
    const edge = sim.travel.get(entity);
    const sample = sampleTravel(entity.position, edge, sim.visualTick);
    if (sample.moving) headings.set(id, { dx: sample.dx, dy: sample.dy });
    const pose = sitting > 0 ? { ...sample, dx: 0, dy: 1 } : { ...sample, ...(!sample.moving ? headings.get(id) : undefined) };
    const distance = strideDistance(entity, edge, pose);
    live.add(id); caption(labels, id, value, pose);
    layers.push({ y: pose.y + 8 + 16 * sitting, draw: () => {
      drawActor(art, pose, distance, sitting, plate !== undefined ? 'carry' : pose.moving && action === 'clean' ? 'idle' : action, plate);
    } });
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
    actor(String(c.id), c, guests[(c.id - 1) % guests.length], status, sitting, undefined, c.state === 'eating' ? 'eat' : 'idle');
  }
  const server = sim.server, task = server.task;
  const plate = task?.kind === 'deliver' && server.phase === 'target'
    ? sim.customers.find(c => c.id === task.target)?.recipe : undefined;
  actor('server', server, 'server', task?.kind === 'clean' ? 'Mochi · tidying' : task ? 'Mochi · serving' : 'Mochi · ready', 0, plate, task?.kind === 'clean' && server.phase === 'target' ? 'clean' : 'idle');
  for (const layer of layers.sort((a, b) => a.y - b.y)) layer.draw();
  drawLabels(labels);
  for (const id of captions.keys()) if (!live.has(id)) { captions.delete(id); headings.delete(id); }
  $('coins').textContent = `${sim.coins} coins`; $('served').textContent = `${sim.served} served`;
  const seconds = Math.floor(sim.ticks / 10); $('clock').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('activity').textContent = sim.paused ? 'Taking a little break' : `${sim.customers.length} inside · ${sim.arrivals.length} in line`;
  const upgrade = $('upgrade') as HTMLButtonElement; upgrade.disabled = sim.upgraded || sim.coins < 75; upgrade.textContent = sim.upgraded ? 'Upgraded · happy chopping!' : 'Upgrade · 75 coins';
  $('events').innerHTML = sim.events.map(event => `<li>${event}</li>`).join('');
}
let previous = performance.now();
function frame(now: number) { sim.advance(Math.min((now - previous) / 1000 * speed, 0.5)); previous = now; render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
