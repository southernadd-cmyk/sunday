# SUNDAY — Build the team. Watch the football.

A Sunday league football autobattler in fictional Saltmere. Draft football behaviours, combine them and watch a continuous match on the Amiga-inspired pitch.

[Play SUNDAY](https://southernadd-cmyk.github.io/sunday/) · [Native Construct 3 game](https://southernadd-cmyk.github.io/sunday/construct/) · [Download Construct 3 project](https://southernadd-cmyk.github.io/sunday/downloads/SUNDAY-Construct3.c3p)

## How to play

Select New Career, draft a behaviour, and watch the match. At full time, draft another behaviour for the next fixture. Pause or use 1×, 2× and 4× speed. Both teams play autonomously.

The original drag-to-move game is no longer available through the public interface. Its historical rules remain in the repository for regression coverage while the autoplay engine develops.

## Development

`npm ci`, `npm test`, `npm run build`. The root route forwards to the native Construct export. The match simulation is deterministic and runs independently of rendering. See [Construct instructions](construct/README.md) and [engine evaluation](docs/AUTOPLAY_ENGINE_EVALUATION.md).
