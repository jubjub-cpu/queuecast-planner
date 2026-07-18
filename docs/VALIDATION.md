# Validation Evidence

## Local release candidate

Validated on July 17, 2026 before v1.0.0 publication.

- Repository validator: passed. Checked required files, three synthetic queues, human-decision boundaries, privacy patterns, accessibility hooks, and forecasting logic.
- Logic suite: passed. Covered least-squares trend, residual uncertainty, eight-week forecast, five-assumption capacity simulation, risk, required agents, staffing brief, scoring, invalid inputs, and export boundaries.
- Desktop browser: passed at 1440 x 1000. Produced a stress scenario, verified nonblank Canvas pixels, eight weekly rows, high-risk labels, staffing action, human adoption, and local JSON download.
- Mobile browser: passed at 390 x 844 with no document overflow; the weekly table remains horizontally scrollable within its own region.
- Keyboard path: passed. The skip link receives focus first and moves focus to the planning workspace.
- Loading failure: passed. A failed queue-manifest request produces a visible recovery state and Retry control.
- Browser health: zero console errors and zero failed normal requests.
- Privacy scan: passed. No personal email address, API key, GitHub token, private key, employee identity, worker schedule, or real operations data is present.

## Visual evidence

- `docs/screenshots/queuecast-scenario-desktop.png`: 1440 x 2002 full-workflow desktop capture.
- `docs/screenshots/queuecast-scenario-mobile.png`: 390 x 3670 full-workflow mobile capture.

## Deployment verification

Verified on July 17, 2026 at `https://jubjub-cpu.github.io/queuecast-planner/`.

- GitHub Pages build: passed.
- Deployed browser suite: passed with the same forecast Canvas, uncertainty, five-control scenario, weekly risk, human decision, export, keyboard, and recovery checks as local.
- Deployed browser health: zero console errors and zero failed normal requests.
- Public page and synthetic queue fixture: HTTP 200.
- Published page title: `QueueCast Planner | Capacity Scenarios`.
- Published commit identity: author and committer use the GitHub no-reply address.

## v1.0.1 hardening

Validated locally on July 18, 2026.

- Increased muted-text contrast and added keyboard focus plus an accessible label to the weekly coverage table.
- Repository validator, forecast tests, and local browser workflow passed.
- Local and deployed axe-core audits passed at desktop and mobile viewports with zero violations.
- The deployed browser workflow passed with zero console errors, failed requests, or desktop/mobile overflow.
