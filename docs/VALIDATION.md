# Prototype validation · 24 November 2026

## Rules and build

- 23 behavioural tests passed with Node's built-in test runner.
- The production Vite build passed. Application code and Three.js are split into separate cacheable bundles; font requests are limited to self-hosted Latin subsets.
- 1,500 deterministic policy runs completed without a stalled phase. 367 won the cup (24.5%). The policy has no knowledge of future draws or shot rolls.

## Browser playtest

A complete four-fixture run was played through the rendered UI with normal card inputs and probability rolls:

| Fixture | Result |
| --- | --- |
| The Railway Arms | 3–2 |
| AFC Municipal | 4–3 |
| Station Road Social | 4–3 |
| The Dog & Duck | 6–4 |

The run drafted three rewards, took an early night and the boot bonus, removed Dodgy knee, and reached the champion screen. The 17 goals and four wins banked £145. A £35 training upgrade deducted correctly, and reloading preserved the £110 balance and one cup. The rules tests separately cover losing and drawing, single-claim banking, unaffordable actions and an exhausted hand.

Desktop was inspected at 1363×936. The same app was inspected in 390×844 and 360×740 viewport fixtures: score, meters and finishing controls fit; the card hand scrolls horizontally rather than widening the page. Text was enlarged after the first mobile inspection. The final hand was rechecked at both sizes.

## Rendering limit

The remote browser reports WebGL as disabled. The browser playtest therefore exercised the compatibility renderer, which projects the same Three.js scene, camera and original sprite atlas. The WebGL renderer is included in the successful production build, but its shader compilation, actual GPU draw-call count and hardware frame pacing still need checking on a WebGL2-capable device.

The intended WebGL budget is 12 scene draw calls, with a 640-pixel-wide framebuffer at 30 fps (384 pixels and 20 fps in LO-FI), no device-pixel-ratio scaling, lighting, dynamic shadows or post-processing. This budget is based on the scene structure, not a measured GPU result. `window.sundayPerformance()` reports actual metrics in the browser console.

Human difficulty, longer-term variety and physical Android touch input still need playtesting. This is a complete first playable loop rather than a balanced finished game.
