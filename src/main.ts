import { Simulation, recipes } from './simulation';
import type { Point } from './navigation';
import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main><header><div><p class="eyebrow">A LITTLE PLACE TO SLOW DOWN</p><h1>Little Sushi Shop <span>寿司</span></h1><p>Warm rice. Happy guests. A shop with a life of its own.</p></div><div class="badge">AUTONOMOUS PROTOTYPE · 0.1</div></header>
<section class="dashboard" aria-label="Restaurant controls"><div><small>SHOP WALLET</small><strong id="coins">100 coins</strong></div><div><small>HAPPY GUESTS</small><strong id="served">0 served</strong></div><div><small>SHOP CLOCK</small><strong id="clock">00:00</strong></div><div class="controls"><button id="pause">Pause</button><button id="speed" aria-label="Change simulation speed">1× speed</button><button id="restart">Restart</button></div></section>
<div class="layout"><section class="scene"><div class="scene-title"><span>☀ A quiet afternoon</span><span id="activity">The doors are open</span></div><canvas width="1000" height="720" aria-label="Animated sushi restaurant with autonomous guests, a chef, and a server"></canvas><p class="caption">Guests find a seat. Our team takes care of the rest.</p></section><aside><section class="card"><p class="eyebrow">MAKE ROOM FOR JOY</p><h2>A sharper knife</h2><p>A little upgrade for chef Hana. New orders prepare 35% faster.</p><button id="upgrade">Upgrade · 75 coins</button><small>One permanent upgrade per session.</small></section><section class="card"><h2>On the menu</h2>${recipes.map(r=>`<div class="menu"><i style="background:${r.color}"></i><span>${r.name}</span><b>${r.price}</b></div>`).join('')}</section><section class="card"><h2>Little moments</h2><ol id="events"></ol></section></aside></div>
<footer>Watch the flow, improve the shop. <span>Prototype artwork · Progress resets on reload</span></footer></main>`;
const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;
let sim = new Simulation(), speed = 1;
const $ = (id: string) => document.getElementById(id)!;
$('pause').onclick = () => { sim.paused = !sim.paused; $('pause').textContent = sim.paused ? 'Resume' : 'Pause'; };
$('speed').onclick = () => { speed = speed === 1 ? 3 : 1; $('speed').textContent = `${speed}× speed`; };
$('restart').onclick = () => { sim = new Simulation(); drawn.clear(); $('pause').textContent = 'Pause'; };
$('upgrade').onclick = () => sim.buyUpgrade();
const world = (p: Point) => ({ x: 115 + p.x * 55, y: 190 + p.y * 40 });
function round(x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
}
function ellipse(x: number, y: number, rx: number, ry: number, color: string) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
function text(value: string, x: number, y: number, size = 16, color = '#695044') { ctx.font = `600 ${size}px system-ui`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(value, x, y); }
const drawn = new Map<string, Point>();
function character(id: string, position: Point, color: string, label: string, chef = false, carrying = false) {
  const target = world(position), old = drawn.get(id) ?? target;
  const p = { x: old.x + (target.x - old.x) * 0.18, y: old.y + (target.y - old.y) * 0.18 };
  drawn.set(id, p);
  const bob = sim.paused ? 0 : Math.sin(sim.ticks * 0.22 + p.x) * 1.4;
  const x = p.x, y = p.y + bob;
  ellipse(x, y + 8, 22, 7, '#614a3a22');
  round(x - 15, y - 24, 30, 32, 13, color, '#74554c');
  ellipse(x - 8, y + 7, 7, 4, '#654d43'); ellipse(x + 8, y + 7, 7, 4, '#654d43');
  ellipse(x, y - 42, 23, 23, '#69473f'); ellipse(x, y - 38, 22, 20, '#ffdfbc');
  ellipse(x - 8, y - 39, 2.3, 3, '#493b36'); ellipse(x + 8, y - 39, 2.3, 3, '#493b36');
  ellipse(x - 15, y - 32, 5, 2.5, '#efa49b'); ellipse(x + 15, y - 32, 5, 2.5, '#efa49b');
  ctx.beginPath(); ctx.arc(x, y - 34, 5, 0.2, Math.PI - 0.2); ctx.strokeStyle = '#93685d'; ctx.lineWidth = 1.5; ctx.stroke();
  if (chef) { round(x - 22, y - 68, 44, 18, 8, '#fff9ed', '#c6b8a4'); ellipse(x - 12, y - 68, 11, 10, '#fff9ed'); ellipse(x + 2, y - 72, 12, 12, '#fff9ed'); ellipse(x + 15, y - 68, 10, 10, '#fff9ed'); }
  else { ctx.beginPath(); ctx.arc(x, y - 44, 23, Math.PI, 2 * Math.PI); ctx.fillStyle = '#69473f'; ctx.fill(); }
  if (carrying) sushi(x + 22, y - 18, '#ef947f');
  round(x - 53, y - 103, 106, 24, 12, '#fffdf4ed'); text(label, x, y - 86, 11);
}
function sushi(x: number, y: number, color: string) { ellipse(x, y + 4, 20, 7, '#fbfaf0'); round(x - 13, y - 6, 26, 11, 5, '#fffdf8'); round(x - 15, y - 10, 30, 8, 5, color); }
function render() {
  ctx.clearRect(0, 0, 1000, 720);
  round(35, 25, 930, 645, 50, '#efe0c6');
  round(50, 38, 900, 225, 34, '#f9eed8');
  for (let y = 300; y < 660; y += 48) { ctx.beginPath(); ctx.moveTo(52, y); ctx.lineTo(948, y); ctx.strokeStyle = '#d8bd962f'; ctx.lineWidth = 3; ctx.stroke(); }
  // Paper windows, wooden trim, and softly glowing lanterns.
  for (const x of [95, 745]) { round(x, 70, 155, 135, 10, '#cda47f'); round(x + 9, 79, 137, 117, 5, '#f6f0d6'); for (let i = 1; i < 4; i++) round(x + 9 + i * 32, 79, 4, 117, 1, '#d4b48d'); round(x + 9, 135, 137, 4, 1, '#d4b48d'); }
  round(340, 58, 320, 78, 14, '#46645c'); text('Little Sushi Shop', 500, 106, 28, '#fff3d8');
  for (const x of [290, 710]) { round(x - 1, 38, 2, 88, 1, '#ae8d66'); ellipse(x, 146, 24, 32, '#f1bd81'); text('寿', x, 153, 22, '#945e44'); }
  character('chef', { x: 7, y: 1 }, '#f6f4e9', sim.chef ? 'Hana · preparing' : 'Hana · ready', true);
  round(205, 265, 590, 55, 17, '#bb815c', '#9c6a4d'); round(192, 250, 616, 34, 16, '#dfb187', '#a87754');
  for (let i = 0; i < 3; i++) sushi(315 + i * 90, 260, recipes[i].color);
  text('PICKUP', 675, 273, 12, '#805744');
  for (const [index, seat] of sim.seats.entries()) {
    const p = world(seat.position);
    round(p.x - 21, p.y - 8, 42, 28, 12, '#b68b64');
    round(p.x - 55, p.y - 49, 110, 36, 18, '#d7ab80', '#af8059');
    ellipse(p.x + 31, p.y - 32, 9, 5, '#a9b795');
    const c = sim.customers.find(c => c.id === seat.owner);
    if (c?.state === 'eating') sushi(p.x - 14, p.y - 35, recipes[c.recipe].color);
    else if (seat.dirty) ellipse(p.x - 14, p.y - 32, 18, 6, '#eee5d7');
    text(seat.dirty ? 'Cleaning soon' : `Table ${index + 1}`, p.x, p.y + 43, 12, '#96795e');
  }
  round(422, 595, 156, 44, 12, '#a8b8a0'); text('WELCOME', 500, 623, 16, '#ffffff');
  for (const [index, guest] of sim.arrivals.entries()) {
    character(`line-${guest.id}`, { x: 10.6 + index * 1.55, y: 10.6 }, ['#c89199', '#8baeb0', '#cbb36d'][(guest.id - 1) % 3], `Waiting · ${index + 1}`);
  }
  for (const c of [...sim.customers].sort((a, b) => a.position.y - b.position.y)) character(String(c.id), c.position, ['#c89199', '#8baeb0', '#cbb36d'][c.recipe], c.state === 'waiting' ? recipes[c.recipe].name : c.state === 'eating' ? 'So delicious!' : c.personality);
  character('server', sim.server.position, '#7f9a85', sim.server.task?.kind === 'clean' ? 'Mochi · tidying' : sim.server.task ? 'Mochi · serving' : 'Mochi · ready', false, sim.server.task?.kind === 'deliver' && sim.server.phase === 'target');
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
