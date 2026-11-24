# Little Sushi Shop

A small autonomous sushi restaurant simulation written in TypeScript. Guests reserve seats, order one of three recipes, wait, eat, pay, and leave. Hana prepares sushi; Mochi serves dishes and cleans tables. No staff micromanagement required.

## Run

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Current prototype

- Three seats and at most three concurrent guests, with exclusive reservations.
- Three sushi recipes, FIFO staff task queue, patience and cancellation cleanup.
- A deterministic 10 Hz simulation, shortest-path grid navigation, smooth Canvas rendering.
- Exact-once settlement, 100 starting coins, 75-coin one-time chef upgrade.
- Pause, restart and 3× speed controls. Reloading resets progress.
- Original rounded vector-style placeholder characters and warm Japanese shop setting; no pixel art.

This is a functional foundation, **not the finished polished art release**. Personalities currently affect recipe choice, eating duration and patience only. There is no layout editor, save system, sound or collision avoidance between characters. NPCs can pass each other; navigation avoids furniture. Orders are placed upon seating, without a waiter order-taking visit. Up to three guests wait by the entrance. Clean seats go to the longest-waiting guest. Guests leave after 24 simulated seconds in line or turn away if the line is full.

## Architecture

`src/simulation.ts` owns authoritative state and has no renderer or browser dependencies. Customers have four explicit states; entering and ordering are immediate transitions within walking/seating, and payment is an atomic transition from eating to leaving. Terminal orders are removed to bound memory. A seat stays unavailable until cleanup finishes. FIFO work avoids cleanup starvation. Cancelled customers release pending tasks, chef claims and server claims. Failed delivery routes retry; customer patience eventually cancels the order. An exit timeout prevents permanent stuck guests.

`src/navigation.ts` uses breadth-first search on a tiny uniform-cost grid. It returns shortest routes like A* on this grid, with less machinery. The invisible grid does not dictate the art style.

`src/main.ts` draws original smooth Canvas shapes and interpolates authoritative positions. Canvas 2D is deliberately used instead of Phaser for this first small scene; the independent simulation can be integrated into Phaser later if animation tooling warrants it. No external image assets are required; web fonts have system fallbacks.

`tests/simulation.test.ts` verifies pathfinding, exclusive reservations, exact payments, valid delivery targets, bounded task queues, cancellation, pause and upgrade behavior. A 30,000-tick soak test exercises 50 simulated minutes. `e2e/restaurant.spec.ts` tests the production build in Chromium, including the service loop, controls and mobile overflow. These browser tests have not yet run successfully in the authoring environment (Chromium launch restriction). For an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path.

## Deployment

`npm run build` produces a static `dist/` directory. Import the repository into a static host with build command `npm run build` and output directory `dist`. Vite defaults work at the domain root; set Vite's `base` for a subdirectory deployment. No public demo has been deployed yet.

## Next priorities

1. Publish the repository and demo.
2. Fix visual overlap at shared service points.
3. Replace prototype shapes with cohesive original hand-drawn chibi animation.
4. Add richer personalities, then consider layout upgrades.

See [progress](docs/progress.md) for verified delivery status. Run tests and build before each focused change; never represent placeholders as finished art.
