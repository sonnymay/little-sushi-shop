# Little Sushi Shop

A small autonomous sushi restaurant simulation written in TypeScript. Guests reserve seats, order one of three recipes, wait, eat, pay, and leave. Hana prepares sushi; Mochi serves dishes and cleans tables. No staff micromanagement required.

[Play Little Sushi Shop](https://sonnymay-little-sushi-shop.fantastichinny32.chatgpt.site)

Watch Hana at the counter around 3 seconds at 1×. She gathers rice, presses it and presents the current order. Finished plates wait at pickup until Mochi collects them. [Watch the 6-second gameplay clip](docs/hana-prepares.mp4).

Restart at 1× and watch the window table from 00:09. Mochi turns toward the courier and takes 0.8 seconds to set down the salmon nigiri. The courier reaches with chopsticks halfway through, then lifts a bite and smiles. [Watch the handoff](docs/mochi-handoff.mp4). Each guest has their own illustrated sequence for their usual order.

At 1×, watch the window table from 00:18.9 to 00:19.9 on a fresh run. After the courier leaves, Mochi clears the plate, gives the table two quick wipes, and leaves a little glint before the next guest can sit. [Watch Mochi polish the table](docs/mochi-polishes.mp4).

On a fresh run at 1×, watch the middle table at 00:18. After tasting the tuna maki, the foodie calls “Thank you, Hana!” Hana finishes her current order and waves back from the counter around 00:20.4. [Watch their exchange](docs/foodie-thanks.mp4).

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
- Pause, restart and 3× speed controls. The wallet, knife upgrade, and lifetime guest count survive a reload. Restart clears the save.
- Original painted chibi characters, four-direction walking, and three illustrated dining sequences.

This is a functional foundation, **not the finished polished art release**. Personalities currently affect seat preference, recipe choice, eating duration and patience. Layout editing is still future work. NPCs reserve aisle cells and route around furniture. Orders are placed upon seating, without a waiter order-taking visit. Up to three guests wait by the entrance. Clean seats go to the longest-waiting guest. Guests leave after 24 simulated seconds in line or turn away if the line is full.

## Architecture

`src/simulation.ts` owns authoritative state and has no renderer or browser dependencies. Customers have four explicit states; entering and ordering are immediate transitions within walking/seating, and payment is an atomic transition from eating to leaving. Terminal orders are removed to bound memory. A seat stays unavailable until cleanup finishes. FIFO work avoids cleanup starvation. Cancelled customers release pending tasks, chef claims and server claims. Failed delivery routes retry; customer patience eventually cancels the order. An exit timeout prevents permanent stuck guests.

`src/navigation.ts` uses breadth-first search on a tiny uniform-cost grid. It returns shortest routes like A* on this grid, with less machinery. The invisible grid does not dictate the art style.

`src/main.ts` draws original smooth Canvas shapes and interpolates authoritative positions. Canvas 2D is deliberately used instead of Phaser for this first small scene; the independent simulation can be integrated into Phaser later if animation tooling warrants it. No external image assets are required; web fonts have system fallbacks.

`tests/simulation.test.ts` verifies pathfinding, exclusive reservations, exact payments, valid delivery targets, bounded task queues, cancellation, pause and upgrade behavior. A 30,000-tick soak test exercises 50 simulated minutes. `e2e/restaurant.spec.ts` tests the production build in Chromium, including the service loop, controls and mobile overflow. For an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path.

## Deployment

`npm run build` produces a static `dist/` directory. Import the repository into a static host with build command `npm run build` and output directory `dist`. Vite defaults work at the domain root; set Vite's `base` for a subdirectory deployment. The public demo serves the production build.

## Next priorities

1. Fix visual overlap at shared service points.
2. Replace prototype shapes with cohesive original hand-drawn chibi animation.
3. Add richer personalities, then consider layout upgrades.

See [progress](docs/progress.md) for verified delivery status. Run tests and build before each focused change; never represent placeholders as finished art.
