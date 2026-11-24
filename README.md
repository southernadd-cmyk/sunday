# SUNDAY

**You've got work in the morning.**

A turn-based Sunday league deckbuilding roguelite set in fictional Saltmere, on the English coast. You play the striker for The Anchor & Crown. The pitch takes its visual cues from Amiga-era Sensible Soccer: overhead striped grass, tiny original pixel footballers, chunky score panels and a limited palette.

Three.js stages your decisions. Cards, rather than real-time movement, decide what happens.

## Play

Public hosting is configured for [SUNDAY on GitHub Pages](https://southernadd-cmyk.github.io/sunday/). The separate [ChatGPT preview](https://sunday-saltmere.adamclement00.chatgpt.site) is private to its owner.

1. Start a cup run. Read the match's comeback target and kick off.
2. Play cards to raise your scoring chance. The number at the top right costs **legs**.
3. Watch **pressure**. Build-up brings defenders closer; at 100 you are crowded out and lose the attack. Head up reduces pressure and draws a card.
4. Play a **Shot** card. Its footer gives your exact chance of scoring, including card bonuses. Keep a leg for a shot unless you have the free Toe punt.
5. Each attack starts a new hand with fresh legs. Six attacks in early matches, seven later. Finish ahead to progress; a draw knocks you out.
6. After a win, draft a card and make a choice between Sundays. Win four matches to lift the cup.

No Shot card? **Scramble a shot** is always available for one leg, with a 14-point chance penalty. No usable legs? **Let this chance go** moves on without trapping the game.

Every goal adds £5, every win £15. At the end of a run, the kitty is banked even if you lose. The Club Shed sells small permanent upgrades; your deck resets on the next run. The starter deck includes one Dodgy knee, which you can remove through a training event.

**Controls:** click or tap cards; 1–8 plays the corresponding card; S scrambles a shot; Enter continues; Esc closes a dialog. On small screens, swipe the hand to see further cards. Sound is optional and starts muted.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

The production output is `dist/`, with relative asset paths for static hosting. No CDN, backend, account, paid asset, external font request or API key is required. Serve the directory over HTTP; ES modules do not support opening `index.html` directly with `file://`.

## GitHub Pages

The single **Check and publish SUNDAY** workflow tests and builds each code push once, then publishes that exact `dist/` artifact from `main`. Pull requests run the checks without deployment. Markdown-only changes skip the workflow. It can also be run manually from Actions.

GitHub requires one-time activation under **Settings → Pages → Build and deployment → Source → GitHub Actions**. After activation, rerun the failed deployment job or run the workflow manually. No custom domain or repository secrets are needed.

## Prototype scope

- Four comeback fixtures, rather than a simulation of all 22 players and 90 minutes.
- A 12-card starter deck, 8 reward cards, 3 events with 2 choices each, and 2 permanent upgrades.
- Seeded rules and shuffle; displayed probabilities are the probabilities used to roll shots.
- The opponent's goals are a fixed scenario target. Opponents do not score extra goals during an attack.
- Weather affects the match through its visible pressure rule. It does not run a hidden ball-physics modifier.
- Local storage saves the club profile only. An in-progress run does not survive refreshing or closing the page.

The [prototype plan](docs/PROTOTYPE_PLAN.md) records the design, intentional limits and next playtest questions.

## Rendering and performance

- Three.js orthographic scene, an original canvas-drawn sprite atlas and nearest-neighbour filtering.
- Instanced players, spectators, goal frames and touchline details. Shared geometry and materials.
- Unlit materials: no real-time lighting, dynamic shadows, physics engine or post-processing.
- A framebuffer capped at 640 pixels wide, independent of device pixel ratio. LO-FI reduces it to 384 pixels and caps animation at 20 fps instead of 30.
- Animation stops while the document is hidden. The scene and atlas are reused across matches.
- If WebGL2 is unavailable, a small compatibility renderer projects the same Three.js scene and caches static scenery. Card play remains available.
- Self-hosted Latin font subsets; Three.js is built into a separate cacheable chunk.

`window.sundayPerformance()` returns read-only renderer diagnostics. The pure rules in `src/engine.js` do not depend on WebGL, animation timing or frame rate.

## Checks

`npm test` exercises 23 behavioural checks, including full-run transitions, deck conservation, exact shot bonuses, tackle thresholds, rewards, banking and denied storage.

`node scripts/balance.mjs` plays 1,500 seeded runs with a simple policy that cannot see future draws or shot rolls. Current unupgraded cup completion: **24.5%**. This checks that the run can be completed and terminates; it is not a prediction of human difficulty.

For manual responsive checks, open `/tests/viewport.html` on the dev server. This fixture is not included in the production build.

Original art and game code are in this repository. Sensible Soccer is a visual reference; no original sprites, sounds, logo or game data are included. Bundled libraries and fonts retain their respective upstream licences.
