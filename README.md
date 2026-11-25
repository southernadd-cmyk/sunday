# SUNDAY — Anything goes.

Five-a-side football in a fictional British leisure centre. The football is automatic; you change the players and the pitch.

[Play SUNDAY](https://southernadd-cmyk.github.io/sunday/) · [Native Construct game](https://southernadd-cmyk.github.io/sunday/construct/) · [Match Lab](https://southernadd-cmyk.github.io/sunday/pitchlab.html) · [Construct 3 project](https://southernadd-cmyk.github.io/sunday/downloads/SUNDAY-Construct3.c3p)

## How to play

Tap the title, choose three of eight environmental powers, then drag their tokens onto the pitch. Football freezes while dragging and resumes when released. Powers recharge after their effect ends; no finite charges. Storm, snow, hole, hill, wall, wind, mud and bumper interact through the physical pitch. Tap the clock or press Space to pause; hold the clock or press Escape to return to the title. Tap anywhere at half-time or full-time to continue. See [the environmental synergy graph](docs/ENVIRONMENT_DESIGN.md).

## Development

`npm ci`, `npm test`, `npm run build`. The root opens the native Construct export. The pinned MIT-licensed [Soccer-JS engine](https://github.com/haeretici/soccer-js) is bundled at build time. The game's sprites, pitch, HUD and pointer controls are native Construct objects; the simulation remains in JavaScript. The owned project scripts are synchronized to the existing genuine web export. See [Construct instructions](construct/README.md).
