# Construct 3 assessment · 25 November 2026

Construct 3 is a viable direction for an editable 2D version of SUNDAY. Its visual layout, sprite and animation tools suit the full-screen pixel pitch. The live game currently remains Three.js; no native Construct project has been created or validated.

The game rules are plain JavaScript in `src/engine.js`, separate from rendering and browser input. A port can reuse those rules, the fixed-step playback data and the behavioural tests. The work is a new Construct display/input adapter, rather than importing the whole Three.js application.

## Smallest useful port

1. Create one pitch layout with nearest-neighbour sprites, a fixed logical resolution and compact edge controls. Reuse original project art.
2. Load the engine as a script module. Map twenty sprite instances to actor IDs and a ball instance to the recorded ball coordinates. Keep the striker's yellow ring even when a teammate has possession.
3. Map pitch taps to world coordinates, and expose separate normal pass, one-two and call actions. Draw route/defender previews in the same coordinate system.
4. Let the engine resolve the order once. Animate its recorded frames; do not use Construct collision behaviours to make a second decision about the outcome.
5. Bring across the four fixtures, pickups, rewind and existing profile migration. Check parity against the JavaScript tests.
6. Export an HTML5 build, test the exported game under `/sunday/`, then replace the Pages deployment once input, appearance and saves are verified.

## Edition and workflow

The current official comparison lists HTML5 export and unlimited JavaScript code, snippets and script files in the Free Edition. It also limits that edition to two layers and 50 events when signed in with a verified email (25 as a guest). Paid editions remove those event/layer limits. A script-driven slice can therefore start without buying a licence; a large visual event-sheet version is likely to need a paid edition.

Construct supports JavaScript/TypeScript script files and folder projects with external editors. Keep the project in Git for reviewable source history; deploy its exported web output separately.

Official references:

- [Edition comparison](https://www.construct.net/en/make-games/buy-construct)
- [Using an external editor](https://www.construct.net/en/make-games/manuals/construct-3/scripting/guides/using-external-editor)
- [Publishing projects](https://www.construct.net/en/make-games/manuals/construct-3/overview/publishing-projects)
