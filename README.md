# SUNDAY — Anything goes.

Five-a-side football in a fictional British leisure centre. The football is automatic; you change the players and the pitch.

[Play SUNDAY](https://southernadd-cmyk.github.io/sunday/) · [Native Construct game](https://southernadd-cmyk.github.io/sunday/construct/) · [Match Lab](https://southernadd-cmyk.github.io/sunday/pitchlab.html) · [Construct 3 project](https://southernadd-cmyk.github.io/sunday/downloads/SUNDAY-Construct3.c3p)

## How to play

Start Game launches a five-a-side match in Construct. Select one of six mutations (or press 1–6). Player and pitch targeting freezes play while you select a target; Escape cancels. Squeeze activates immediately. Each power can be used once in a match and lasts ten simulation seconds at 1× speed. Effects can overlap. Space pauses; use the speed control to change playback. Half-time pauses until you choose Second Half.

This is a playable mutation prototype; drafting and long-term run progression are not yet implemented. The Match Lab preserves fixed and adaptive football evaluation controls.

## Development

`npm ci`, `npm test`, `npm run build`. The root opens the native Construct export. The pinned MIT-licensed [Soccer-JS engine](https://github.com/haeretici/soccer-js) is bundled at build time. The game's sprites, pitch, HUD and pointer controls are native Construct objects; the simulation remains in JavaScript. The owned project scripts are synchronized to the existing genuine web export. See [Construct instructions](construct/README.md).
