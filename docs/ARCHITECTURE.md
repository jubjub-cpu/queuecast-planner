# Architecture

QueueCast Planner is a static local-first browser application with no backend, database, analytics, or model endpoint.

## Data Flow

1. `data/queues.json` supplies three fictional 12-week demand histories and default aggregate assumptions.
2. `linearTrend` exposes slope, intercept, and residual deviation.
3. `forecastDemand` projects eight point estimates and expanding low/high bounds.
4. `simulateCapacity` applies five planner assumptions, computes effective capacity and buffered need, and labels weekly risk.
5. `buildPlanningBrief` converts transparent results into a concise decision brief.
6. Canvas renders actual history, forecast, uncertainty, and capacity without an external chart service.
7. Human adoption or rejection is recorded separately from model output.

## Trust Boundary

All inputs are aggregate and synthetic. The application cannot create schedules, contact workers, change staffing systems, or persist a decision. JSON export excludes personal data because none is accepted.

## Failure Model

- Queue fixture failure produces a Retry state.
- Invalid histories and nonpositive capacity assumptions throw explicit calculation errors.
- Export remains disabled until a complete scenario exists.
- Browser tests verify chart pixels, risk rows, human decision, download, mobile layout, and failed fixture loading.

## Deployment

Static files deploy from `main` to GitHub Pages. The same browser suite validates local and public URLs.
