# Autoplay engine evaluation

Pinned candidates (MIT):
- [Soccer-JS](https://github.com/haeretici/soccer-js/tree/38970e0dade0865078c9e84bc1ecfd72aaa02fde): JavaScript, 22-player simulator, headless runner, extensive rule and AI suites. CommonJS simulator depends on settings, presets, entities and browser mocks; integrating it into Construct requires an adapter, bundling and a player-count decision.
- [EvoFootball Arena](https://github.com/Quarkgluonmixture/evofootball-arena/tree/1e28434fd2cab86560321c315763bc720dfaee4b): TypeScript, small-sided simulation, pure sim-side Match/League plus separate renderers. Richer behaviour model but a large dependency graph.
- [Football Simulator](https://github.com/tbleckert/football-simulator/tree/9d79a29ac711e5287e8058afe46d6befd790c21b): MIT, alternative reference.

No third-party code or assets have been incorporated. This revision independently implements time-to-intercept pass scoring, predicted moving receivers, role-based formation, hysteresis for press assignments, acceleration, separation and lofted keeper distribution. External candidate benchmarks are a separate evaluation step. The candidates use different pitch dimensions, team sizes and match lengths; raw score counts are not directly comparable without normalization. Do not select an engine merely by its headless throughput.

## SUNDAY comparison

Twelve fixed seeds, 75-second matches, Overlap + One-touch, alternating three opponents. Old engine averaged 2.58 goals, 15.50 completed passes and 7.42 shots (both teams combined). New result: 1.17 goals, 26.25 completed passes, 4.00 shots, 1.25 saves. 1 matches had zero shots. These are development measurements on a small tuning set, not independent validation or proof of fun. Human playtesting and additional hold-out seeds are necessary.

The old manual controller and public root game are retired. Historical engine rules remain for regression coverage.

### Hold-out check (seeds 101–112)

Old: 2.75 goals, 11.92 completed passes, 5.92 shots, 0/12 shotless matches. New: 2.08 goals, 27.08 completed passes, 5.17 shots, 1/12 shotless matches. More completed passes do not guarantee more entertaining football; goals and shot volume are still development priorities.

## Reproducible upstream benchmark

The separate External football engine evaluation workflow checks out the two exact candidate commits with read-only access, and runs six headless seeded matches each. The resulting JSON is printed as ENGINE_BENCHMARK in the job logs. This is intentionally outside the ordinary deployment gate. Candidate outcomes are pending until that workflow completes; no external engine is bundled into the game.

## Selected direction: Soccer-JS

The user prefers Soccer-JS. The next integration gate is a browser-targeted ESM adapter which runs the actual upstream simulator with bundled JSON presets, maps all 22 players and the independent ball into SUNDAY pitch coordinates, and applies the six existing behaviour cards through upstream AI knobs. The verification script checks full-time completion, stable finite snapshots, repeatable results and actual changes caused by trait choices. The MIT notice is included beside the experimental bundle. This is an integration proof only: the playable controller still uses the in-house engine until the adapter passes and the sprite pool is expanded for 11-a-side.

First upstream Soccer-JS baseline at 75 seconds: six of six finished 0–0 (three without a shot). This confirms the native clock needs longer football time for entertaining compressed playback. Adapter build succeeded, but initial pass accounting mixed FSM transitions with actual deliveries. Revised accounting measures physical pass launches and their receptions on the same basis. The switch remains gated on adapter verification.
