# Progress — November 23, 2026

Implemented the first runnable TypeScript browser prototype, simulation separated from rendering. Core loop includes seating, orders, preparation, delivery, eating, payment, exit and cleaning; three recipes; basic personalities; money and chef upgrade; pause/restart/speed controls.

Validation: seven Vitest tests pass, including a 30,000-tick (50 simulated minutes) soak test. TypeScript checking and Vite production build pass. Two Playwright browser tests were added for the service loop/controls and mobile overflow, but execution was blocked before test assertions: the browser download returned HTTP 403, and installed Chromium could not launch because socket creation is disallowed in this runtime. Browser behavior and visual quality remain unverified. CI includes these tests for an environment that supports Chromium.

Publication is pending: no existing sushi repository was found in sonnymay, the available GitHub connector cannot create repositories, and the browser is not signed in. No GitHub commit or public demo is claimed. The source package includes a lockfile, production assets, CI, and setup documentation.

Scope decisions: Canvas 2D for an asset-free smooth prototype; BFS for a small uniform-cost navigation grid. Both can evolve independently of the simulation. Final hand-drawn character artwork is not complete.
