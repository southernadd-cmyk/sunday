# SUNDAY — Anything goes.

Five-a-side football in a fictional British leisure centre. The football is automatic; you change the players and the pitch.

[Play SUNDAY](https://southernadd-cmyk.github.io/sunday/) · [Native Construct game](https://southernadd-cmyk.github.io/sunday/construct/) · [Match Lab](https://southernadd-cmyk.github.io/sunday/pitchlab.html) · [Construct 3 project](https://southernadd-cmyk.github.io/sunday/downloads/SUNDAY-Construct3.c3p)

## How to play

Start Game launches a five-a-side match in Construct. Drag one of the six mutation tokens directly onto a red player or the pitch. Play freezes during the drag and resumes on release. Invalid drops cancel without spending the token; Squeeze is also deployed by dragging onto the pitch. Each power can be used once per match and lasts ten simulation seconds at normal speed. Effects overlap. Tap the clock or press Space to pause; hold the clock or press Escape to return to the title. Tap anywhere to start, resume at half-time, or play again after full-time.

This is a playable mutation prototype; drafting and long-term run progression are not yet implemented. The Match Lab preserves fixed and adaptive football evaluation controls.

## Development

`npm ci`, `npm test`, `npm run build`. The root opens the native Construct export. The pinned MIT-licensed [Soccer-JS engine](https://github.com/haeretici/soccer-js) is bundled at build time. The game's sprites, pitch, HUD and pointer controls are native Construct objects; the simulation remains in JavaScript. The owned project scripts are synchronized to the existing genuine web export. See [Construct instructions](construct/README.md).
