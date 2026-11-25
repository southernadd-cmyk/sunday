# SUNDAY — The Next Two Seconds

**The pitch is the game.**

A Sunday league roguelite set in fictional Saltmere. You are the striker for The Anchor & Crown. The full-screen, Amiga-inspired Three.js pitch freezes while you think. Plot your run directly on the grass, read the defence's intentions, then let everybody move together for two seconds.

[**Play SUNDAY on GitHub Pages**](https://southernadd-cmyk.github.io/sunday/)

## How to play

1. **Read the pitch.** The yellow ring is you. Orange paths show each defender's already-committed next movement; circles mark their destinations.
2. **Plan your run.** Click the grass for a straight run, or drag a route beginning near your yellow ring. Your ghost shows its endpoint. Distance is limited, so a far-away click is shortened to your travel budget.
3. **Pass and move.** Tap a red shirt or his name for an ordinary pass. He keeps possession; you still control the striker. Tap grass before playing to pass and move, or run off the ball on the next turn. Tap the carrier's **BALL** label or your own **CALL** label to get it back; add a route to receive into space. You can also pass between teammates. Ordinary passes have a 32m range and do not consume one-twos.
4. **Make a one-two.** Tap the separate **1–2** beside a teammate. A return run is suggested immediately. Press Space to play, or tap grass to change the route. The preview warns about interceptions; a suggested route cannot guarantee safety if every lane is blocked. Tap a selected pass or 1–2 again to cancel.
5. **Find a finish.** Get the ball back at your feet, reach shooting range, read the keeper's movement and click a corner target or a point inside the goalmouth. A learned dink can go over low tackles.
6. **Play two seconds.** Press Space or the yellow button. The route, ball and defenders move together, then freeze again. There is no real-time input during playback.

Goals, saves and tackles come from the actual time-sampled positions and ball height. **There is no shot-percentage dice roll.** The planning preview and playback use the same simulation.

Score to reach the next Sunday. There are four opponents, increasing defensive pressure, and three legs for the run. A lost attack costs one leg. Each attack gives six or seven turns to score. One rewind lets you change your last decision, including recovering a leg lost in that turn.

After each goal, collect one of three pieces of kit lying on the pitch. Boots, second winds, close control, extra one-twos, longer shots and dinks change what you can do spatially for the rest of the run. Four goals win the cup. A run earns £20 per goal, banked when it ends.

## Controls

| Input | Action |
| --- | --- |
| Click or tap grass | Plan a run |
| Drag from your yellow ring | Draw a curved route |
| Tap a red shirt or his name | Pass; teammate keeps possession |
| Tap 1–2 beside a teammate | Suggest a one-two and return run |
| Tap BALL / CALL | Call for a return pass |
| Click the goal or LEFT / RIGHT target | Aim a shot |
| Space | Play the planned two seconds |
| Arrows / WASD | Plan a run in that direction |
| Q / E | Plan a diagonal forward run |
| P | Pass to Kev, or call back when off the ball |
| O | Suggest a one-two with Kev |
| 1 / 2 | Aim at the left / right corner |
| B | Toggle a sprint |
| C | Toggle a dink, after learning it |
| R | Rewind the last turn |
| Enter | Start or continue |
| Escape | Clear the plan or close help |

Sound starts muted. LO-FI uses a smaller framebuffer. Fullscreen is optional; the app already fills the browser viewport.

## Progress

The Club Shed keeps small permanent preparations between runs. Existing kitty and upgrades from the first card prototype are migrated when the new profile is first saved. Training adds 0.5m per level to each run; a warm-up adds a sprint per attack.

Only the club profile is saved. Refreshing or closing a tab ends the in-progress run. The old card prototype remains in Git history; the public game now uses the pitch-based rules.

## Develop

Node.js 20.19+ or 22.12+:

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

Static output is `dist/` with relative asset paths, including under `/sunday/`. There are no CDN assets, API keys, backend services or external font requests. Serve over HTTP rather than opening ES modules with `file://`.

The single **Check and publish SUNDAY** workflow tests and builds code changes once and publishes that checked artifact from `main`. Pull requests run checks without deployment. Markdown-only changes skip it. GitHub Pages uses **Settings → Pages → Source → GitHub Actions**.

## Implementation

- A pure deterministic engine in `src/engine.js`, independent of DOM, rendering, clocks and animation rate.
- The same fixed-step simulation predicts collisions and records playback frames.
- Committed defender intentions cannot retarget after you choose an order.
- An original pixel atlas, instanced footballers and shared unlit geometry in Three.js.
- The pitch covers the viewport; SVG routes and DOM controls are projected through the same orthographic camera.
- A framebuffer capped at 640 pixels wide, or 384 in LO-FI. No device-pixel-ratio scaling, physics library, dynamic lighting, shadows or post-processing.
- While planning, the renderer sleeps until something changes. Animation also stops when the tab is hidden.
- A cached canvas compatibility renderer projects the same Three.js scene when WebGL2 is unavailable.

`window.sundayPerformance()` reports renderer diagnostics. `/tests/viewport.html` provides mobile layout fixtures on the development server and is excluded from the production build.

The [prototype plan](docs/PROTOTYPE_PLAN.md) describes the new direction. [Validation notes](docs/VALIDATION.md) record the checks and their limits. `node scripts/balance.mjs 12` searches twelve seeded runs to smoke-test solvability, rather than estimate human win rates.

The [Construct 3 assessment](docs/CONSTRUCT3.md) describes a possible visual-editor port. This published version uses Three.js.

All sprites, pitch art and code are original to this project. Sensible Soccer is a visual reference; no original game sprites, sounds or data are included. Third-party library and font licences are bundled under `public/licenses/`.
