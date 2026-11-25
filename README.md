# SUNDAY — Build the team. Watch the football.

A Sunday league football autobattler in fictional Saltmere. Draft football behaviours, combine them and watch a continuous match on the Amiga-inspired pitch.

[Play SUNDAY](https://southernadd-cmyk.github.io/sunday/) · [Native Construct 3 game](https://southernadd-cmyk.github.io/sunday/construct/) · [Download Construct 3 project](https://southernadd-cmyk.github.io/sunday/downloads/SUNDAY-Construct3.c3p)

## How to play

Select Start Game and pick a chip from three offers. Both teams play autonomously. Activate chips from the live match HUD; different chips can overlap. Passes, ball wins and saves earn charge; spend four to reload a spent chip once per fixture. At half-time choose another chip. Your collection carries into the next fixture and starts ready again. Pause or use 1×, 2× and 4× viewing speed.

The original drag-to-move game is no longer available through the public interface. Its historical rules remain in the repository for regression coverage while the autoplay engine develops.

## Development

`npm ci`, `npm test`, `npm run build`. The root route forwards to the native Construct export. The match simulation uses the pinned MIT-licensed [Soccer-JS engine](https://github.com/haeretici/soccer-js), bundled at build time. Each match simulates 300 seconds of football at a default 4× simulation rate (plus stoppages), with full 11-a-side teams. The playback controls are relative to that base rate. `npm ci` followed by `npm test` or `npm run build` fetches the pinned upstream and generates the local bundle; no external service is required during gameplay. See [Construct instructions](construct/README.md) and [engine evaluation](docs/AUTOPLAY_ENGINE_EVALUATION.md).
