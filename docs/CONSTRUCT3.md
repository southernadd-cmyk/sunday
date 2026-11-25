# Construct 3 version · 25 November 2026

[Play the native HTML5 version](https://southernadd-cmyk.github.io/sunday/construct/). A native Construct project is now available in [`construct/`](../construct/README.md), with a ready-to-open [SUNDAY-Construct3.c3p](../public/downloads/SUNDAY-Construct3.c3p).

It uses nine native object types on two layers: Pitch, Footballer, Ball, StrikerRing, Ghost, Pickup, Plans, HudCanvas and Label. Construct renders its own Sprites, Drawing Canvas overlays and Text objects. It does not embed the Three.js game.

The port includes the four-fixture run, persistent teammate possession, pass-and-move, calls into space, automatically suggested one-twos, shooting/dinks, interceptions, rewind, pickups, club upgrades and saved-profile migration. Input and presentation are in `construct/scripts/controller.js`; match outcomes use a copied, byte-identical `src/engine.js`. Initial positions and original pixel assets are editable through Construct's layout/animation editors. The rule system remains JavaScript.

The presentation caps active playback at 30 ticks per second, reuses native instances and Text objects, redraws planning overlays when decisions change, uses nearest-neighbour sprites and low-resolution fullscreen rendering, and performs no match simulation during animation. A frozen match does no per-tick adapter work.

## Verification

The package opened in Construct r506.4 and passed its script-validation phase. All object types, layers, scripts and original PNG frames resolved. The automated suite now has 37 passing checks. Native-adapter tests exercise ordinary possession, returned passes into space, immediately playable one-two suggestions, rewind, pointer coordinates and shifted portrait viewports through documented Construct API doubles.

The available browser failed to initialize WebGL, preventing a native layout/preview check. A genuine Construct HTML5 export completed with PNG sprite sheets and optional image optimization disabled. It is published at `/sunday/construct/`, alongside the original Three.js route. The owned project modules are synchronized after edits, without modifying the Construct engine. Native GPU rendering remains unverified. See the [project instructions and current limits](../construct/README.md).

Export settings and project-module hashes are recorded in [CONSTRUCT3_EXPORT.json](CONSTRUCT3_EXPORT.json).

## Edition

The current official comparison includes HTML5 export and JavaScript files in the Free Edition, with two layers and up to 50 events for a verified account (25 as a guest). This project uses two layers and no event blocks. Construct's export UI confirms that **script minification requires a paid edition**; choose **None** when exporting with the Free Edition. No paid licence is required to open this slice.

References:

- [Edition comparison](https://www.construct.net/en/make-games/buy-construct)
- [Project format](https://www.construct.net/en/tutorials/constructs-project-format-3275)
- [Runtime interface](https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/iruntime)
- [Drawing Canvas interface](https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/plugin-interfaces/drawing-canvas)
- [Sprite interface](https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/plugin-interfaces/sprite)
