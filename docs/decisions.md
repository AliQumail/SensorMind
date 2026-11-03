# Decisions

Where the spec was ambiguous, or where implementation forced a choice, this file records what was chosen and why. Newest phase at the bottom.

## Phase 1: skeleton

### Backend

| # | Decision | Why |
|---|----------|-----|
| 1 | **Minimal APIs**, organised as endpoint-group extension methods (`MapPlantEndpoints`, `MapSensorEndpoints`). | Less ceremony than controllers for a small surface. Groups keep `Program.cs` readable and give one place per feature. |
| 2 | **Parse and validate in one pass.** The JSON is deserialised into nullable `*Document` classes, then a builder validates and maps them to immutable domain records. | Missing fields become errors with a JSON path (`$.site.floors[0]...`) instead of deserialiser exceptions. All errors are collected at once, so a user fixing a file sees everything that is wrong. |
| 3 | **Unknown properties are errors.** Captured via `[JsonExtensionData]`. | A typo such as `nominalMaxx` would otherwise be silently ignored and the tag would fail validation for the wrong reason, or not at all. |
| 4 | **Ids are lowercase kebab-case** (`p-101.discharge-pressure`) and unique plant-wide for each kind (floor, group, equipment, tag). | Tag ids key the live stream and history API, so they must be globally unique and URL-safe. |
| 5 | **Coordinates:** metres, origin at the floor's corner. `position` is the footprint centre (`x`, `z`) plus an optional base elevation `y`. `rotation` is in degrees around the vertical axis. `shape` is optional and defaults by equipment type. | Easiest to author from a floor plan. The validator checks that the rotated footprint stays inside the floor. |
| 6 | **Thresholds:** a nominal band (`nominalMin`/`nominalMax`) plus optional `alarmLow`/`alarmHigh`. Inside the band is *normal*, outside it is *warning*, at or beyond an alarm limit is *alarm*. | The spec names "nominal min/max, alarm thresholds" only. A separate warning band can be added later without breaking files. |
| 7 | **Import is file-based.** The plant file loads at startup and fails fast, listing every error. `POST /api/plant/validate` checks a candidate file without applying it. There is no runtime replace endpoint. | The demo is public. Letting one anonymous visitor swap the plant for everyone is a bad default. Runtime import can come back behind auth. |
| 8 | **2 s sampling** (spec example: 5 s), 24 h retention, **24 h backfilled at startup**. All configurable under `Simulation:*`. | 5 s feels sluggish in a live UI. 24 h × 2 s × 36 tags ≈ 1.6 M samples ≈ 25 MB, which fits Render's free tier. The backfill (about 0.7 s, done before Kestrel listens) means trend charts and Phase 3 trend questions work immediately. |
| 9 | **Simulator:** an Ornstein–Uhlenbeck (mean-reverting) walk around the band centre, plus Poisson-distributed drifts, single-sample spikes and short alarm excursions. Each tag has its own `Random`, seeded from `seed ^ FNV-1a(tagId)`. | Smooth and realistic, with a bounded variance. Per-tag seeding makes a tag's series independent of which other tags exist. FNV is used because `string.GetHashCode` is randomised per process. Development uses seed 42. Production is random unless `Simulation__Seed` is set. |
| 10 | **SSE rather than WebSockets** for live readings. | Traffic is one-way. `EventSource` reconnects on its own, and SSE passes through proxies and CDNs as plain HTTP. Each subscriber gets a bounded channel that drops the oldest batch, so a slow client can't stall the others. |
| 11 | **Sensor payloads use Unix epoch milliseconds** (`ts`, `t`). | Compact, and native to JS `Date` and chart libraries. The plant model uses ordinary JSON. |
| 12 | **History downsampling** by equal-count bucket averages. | Cheap and stable for sparklines and trend charts. Swap in LTTB if peak preservation matters later. |
| 13 | **`TimeProvider`** is injected for all clocks. | Makes the hosted service and store testable with `FakeTimeProvider`. |

### Frontend

| # | Decision | Why |
|---|----------|-----|
| 14 | **No state-management library.** Live readings live in a small external store read via `useSyncExternalStore`; plant and selection live in a React context. | The state is small. This avoids a dependency, and components re-render only for the tags they read. |
| 15 | **Status is computed server-side per tag.** The UI only rolls statuses up (worst of). | One source of truth for threshold logic. |
| 16 | **3D labels are a projected DOM overlay** (`SceneLabelRegistry`), not drei `<Html>`. | drei `<Html>` creates a React root per label. Under React 19 StrictMode these roots crashed with `removeChild` errors when a floor unmounted. The overlay is ordinary React, positioned with transforms in `useFrame`. |
| 17 | **Selection is shown with accent edges plus a footprint pad**, not drei `<Outlines>`. | Inverted-hull outlines were invisible at plant scale in world units and produced artefacts in screen-space mode. Edges plus a pad read clearly from any angle. Status keeps the emissive tint, as the spec asks. |
| 18 | **Contrast adjustments to the palette** (WCAG AA, measured): `--text-muted` is `#736356` instead of `#7A6A5D` (4.42:1 on `--surface`). Accent-coloured text and primary buttons use `--accent-hover`/`--accent-text`. Status text uses darker `*-text` variants. | The spec colours stay as the tokens for fills, rings, dots and the 3D scene. Only text pairings that failed AA were changed. |
| 19 | **Fonts are self-hosted** via `@fontsource-variable` (Inter, JetBrains Mono). | No third-party font requests, and it works offline and on GitHub Pages. |
| 20 | **Dev uses the Vite proxy** for `/api`. Production uses `VITE_API_BASE_URL`. | The browser sees a single origin locally, so no CORS setup is needed for development. |

### Data

| # | Decision | Why |
|---|----------|-----|
| 21 | Sample motors are **ABB M3BP**, and the process tank is "Generic". | The spec lists Grundfos and Atlas Copco for pumps and compressors but names no motor vendor. Manuals for the RAG phase match the Grundfos (CR, NB, DDA) and Atlas Copco (GA 37 VSD+) models in the sample. |
