# SUNDAY — native Construct 3

[Play](https://southernadd-cmyk.github.io/sunday/construct/) · [Project](https://southernadd-cmyk.github.io/sunday/downloads/SUNDAY-Construct3.c3p) · [Web export](https://southernadd-cmyk.github.io/sunday/downloads/SUNDAY-Construct3-Web.zip)

Open the single-file project in Construct 3 and preview with F5. The native Sprite, Drawing Canvas and Text objects render a five-a-side match with a vertically scrolling pitch and an integrated mutation hand. The game uses the pinned Soccer-JS simulation and the six tested mutations, with adaptive opposition enabled. Select a power, then target a player or pitch location; Squeeze is immediate. Ten simulation seconds per power; one use per match. Controls: 1–6 select powers, Space pauses, Escape cancels targeting or returns to menu.

The owned scripts synchronize to the existing native web export at build time. No Construct runtime files are edited. To open the source directory, run `npm ci` and `npm run prebuild` first. Native GPU rendering still requires a manual browser/editor playtest. This version is a single-match prototype; roguelite run progression will follow playtesting.
