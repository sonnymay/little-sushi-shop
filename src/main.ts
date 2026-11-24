import { Simulation, recipes } from './simulation';
import type { Point } from './navigation';
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
let sim = new Simulation(), speed = 1;
const $ = (id: string) => document.getElementById(id)!;
$('pause').onclick = () => { sim.paused = !sim.paused; $('pause').textContent = sim.paused ? 'Resume' : 'Pause'; };
$('speed').onclick = () => { speed = speed === 1 ? 3 : 1; $('speed').textContent = `${speed}× speed`; };
$('restart').onclick = () => { sim = new Simulation(); drawn.clear(); $('pause').textContent = 'Pause'; };
$('upgrade').onclick = () => sim.buyUpgrade();
const world = (p: Point) => ({ x: 115 + p.x * 55, y: 190 + p.y * 40 + 40 * Math.sin(Math.PI * Math.min(p.y, 10) / 10) });
function round(x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
}
function ellipse(x: number, y: number, rx: number, ry: number, color: string) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
function text(value: string, x: number, y: number, size = 16, color = '#695044') { ctx.font = `600 ${size}px system-ui`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(value, x, y); }
const drawn = new Map<string, Point>();
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
function character(id: string, position: Point, art: keyof typeof sprites, label: string, seated = false) {
  const target = world(position), old = drawn.get(id) ?? target;
  const x = old.x + (target.x - old.x) * 0.18, y = old.y + (target.y - old.y) * 0.18;
  drawn.set(id, { x, y });
  const moving = Math.hypot(target.x - x, target.y - y) > 1;
  const bob = Math.sin(sim.ticks * (moving ? 0.7 : 0.18) + target.x) * (moving ? 2.2 : 0.7);
  const height = adultHeight * depthScale(y);
  // Lower the hips onto the cushion while preserving the size of the head.
  const bottom = y + (seated ? 24 : 8);
  if (!seated) ellipse(x, bottom - 1, 22, 6, '#614a3a22');
  ctx.save();
  if (seated) {
    ctx.beginPath();
    ctx.rect(x - height / 2, bottom - height - 4, height, height * 0.72);
    ctx.clip();
  }
  sprite(art, x, bottom + bob, height);
  ctx.restore();
  round(x - 51, bottom - height - 22, 102, 18, 9, '#fffdf4ef');
  text(label, x, bottom - height - 9, 10);
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
  if (hana.complete && hana.naturalWidth) {
    const height = adultHeight * depthScale(260) * 0.58;
    const width = height * hana.naturalWidth / hana.naturalHeight;
    const bob = sim.chef ? Math.sin(sim.ticks * 0.36) * 2 : 0;
    ctx.drawImage(hana, 500 - width / 2, 258 - height + bob, width, height);
  }
  round(205, 265, 590, 55, 17, '#bb815c', '#9c6a4d'); round(192, 250, 616, 34, 16, '#dfb187', '#a87754');
  for (let i = 0; i < 3; i++) sprite(dishes[i], 315 + i * 90, 270, plateHeight * depthScale(260));
  text('PICKUP', 675, 273, 12, '#805744');
  round(422, 595, 156, 44, 12, '#a8b8a0'); text('WELCOME', 500, 623, 16, '#ffffff');
  const layers: { y: number; draw: () => void }[] = [];
  for (const [index, seat] of sim.seats.entries()) {
    const p = world(seat.position);
    layers.push({ y: p.y + 12, draw: () => {
      sprite('chair', p.x, p.y + 9, 70);
      const c = sim.customers.find(c => c.id === seat.owner);
      if (c && (c.state === 'waiting' || c.state === 'eating')) {
        character(String(c.id), c.position, guests[(c.id - 1) % guests.length],
          c.state === 'waiting' ? recipes[c.recipe].name : 'So delicious!', true);
      }
      sprite('table', p.x, p.y + 28, 69);
      if (c?.state === 'eating') sprite(dishes[c.recipe], p.x - 10, p.y - 12, plateHeight);
      else if (seat.dirty) ellipse(p.x - 10, p.y - 12, 15, 5, '#eee5d7');
      text(seat.dirty ? 'Cleaning soon' : `Table ${index + 1}`, p.x, p.y + 43, 12, '#96795e');
    } });
  }
  for (const [index, guest] of sim.arrivals.entries()) {
    layers.push({ y: world({ x: 0, y: 10.6 }).y, draw: () => character(`line-${guest.id}`, { x: 10.6 + index * 1.55, y: 10.6 }, guests[(guest.id - 1) % guests.length], `Waiting · ${index + 1}`) });
  }
  for (const c of sim.customers) {
    if (c.state === 'walking' || c.state === 'leaving')
      layers.push({ y: world(c.position).y, draw: () => character(String(c.id), c.position, guests[(c.id - 1) % guests.length], c.personality) });
  }
  const task = sim.server.task;
  layers.push({ y: world(sim.server.position).y, draw: () => {
    character('server', sim.server.position, 'server', task?.kind === 'clean' ? 'Mochi · tidying' : task ? 'Mochi · serving' : 'Mochi · ready');
    if (task?.kind === 'deliver' && sim.server.phase === 'target') {
      const customer = sim.customers.find(c => c.id === task.target);
      const hand = drawn.get('server')!;
      if (customer) sprite(dishes[customer.recipe], hand.x + 27 * depthScale(hand.y), hand.y + 8 - adultHeight * depthScale(hand.y) * 0.52, plateHeight * depthScale(hand.y));
    }
  } });
  for (const layer of layers.sort((a, b) => a.y - b.y)) layer.draw();
  // Do not retain render positions for departed guests indefinitely.
  const live = new Set(['chef', 'server', ...sim.customers.map(c => String(c.id)), ...sim.arrivals.map(c => `line-${c.id}`)]);
  for (const id of drawn.keys()) if (!live.has(id)) drawn.delete(id);
  $('coins').textContent = `${sim.coins} coins`; $('served').textContent = `${sim.served} served`;
  const seconds = Math.floor(sim.ticks / 10); $('clock').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('activity').textContent = sim.paused ? 'Taking a little break' : `${sim.customers.length} inside · ${sim.arrivals.length} in line`;
  const upgrade = $('upgrade') as HTMLButtonElement; upgrade.disabled = sim.upgraded || sim.coins < 75; upgrade.textContent = sim.upgraded ? 'Upgraded · happy chopping!' : 'Upgrade · 75 coins';
  $('events').innerHTML = sim.events.map(event => `<li>${event}</li>`).join('');
}
let previous = performance.now();
function frame(now: number) { sim.advance(Math.min((now - previous) / 1000, 0.2) * speed); previous = now; render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
