# SUNDAY — native Construct 3 project

[Play the native Construct version](https://southernadd-cmyk.github.io/sunday/construct/) · [Download the web export](https://southernadd-cmyk.github.io/sunday/downloads/SUNDAY-Construct3-Web.zip)

[Download the single-file project](https://southernadd-cmyk.github.io/sunday/downloads/SUNDAY-Construct3.c3p)

Open [Construct 3](https://editor.construct.net/), then drag `SUNDAY-Construct3.c3p` into the editor. You can also use **Open → File**. Press **F5** to preview. No extra addons or npm installation are needed to open the project.

This is a native Construct project, with Sprite, Drawing Canvas and Text objects. The pitch, footballers, ball, ring, ghost and pickups are Construct assets. There is no iframe, Three.js scene or embedded copy of the earlier web application. Two layers keep the project within the Free Edition's layer allowance. Match outcomes use the same tested JavaScript rules as the browser prototype.

## Play

You remain the striker with the yellow ring when a teammate has possession. Time waits while you plan.

- Tap grass for a run; drag from your striker to bend the route.
- Tap a teammate's name or sprite for an ordinary pass. He keeps the ball. Add a route before playing to pass and move.
- Tap **BALL** or **CALL** to get a return pass. Add a route to receive into space.
- Tap **1–2** for a suggested give-and-go. Press Play immediately, or tap grass to change the return run.
- Read orange defender intentions and the interception warning. Reach shooting range with the ball, then aim **LEFT** or **RIGHT**.
- Press **PLAY 2 SECONDS**. Everyone moves together, then the pitch freezes again.

| Key | Action |
| --- | --- |
| Space | Play the plan |
| Arrows / WASD | Plan a run |
| Q / E | Diagonal run |
| P | Pass to Kev / call back |
| O | Suggested one-two with Kev |
| 1 / 2 | Aim at goal; choose kit between fixtures |
| 3 | Choose the third kit item |
| B | Sprint |
| C | Toggle a learned dink |
| R | Rewind |
| Enter | Start / continue |
| Escape | Clear the plan / close help |

Four fixtures, three legs, kit pickups, club upgrades and profile migration are included. Only club progress is saved; refreshing ends an active run. Sound is not included in this first Construct port.

## Edit

- **Saltmere** is the single match layout. **Pitch** contains the field and player objects; **HUD** contains the interface.
- Double-click **Footballer** in the Project Bar to edit its Home, Away, Keeper and Official pixel animations. Open **Pitch**, **Pickup**, **Ball** or **StrikerRing** to edit the other original assets.
- `scripts/controller.js` maps native input to plans, places native instances, draws intentions and creates pooled native Text labels. The small `scripts/main.js` starts it.
- `scripts/engine.js` is the shared deterministic engine. In the repository its source is `src/engine.js`; packaging copies it into the Construct project.
- **Match** documents those connections. Rules are JavaScript, rather than a duplicate event-sheet implementation. Visual assets and the initial layout are editable in Construct.

The repository stores the editable folder project as well as the ready-to-open `.c3p`. Normal Construct saving supports either form. `scripts/make-construct.py` regenerates the original foundation and packages it; it requires Python and Pillow. Run it when deliberately regenerating the repository's original assets/layout, not to package a separately edited project.

## Checks and publication

The project was opened in **Construct r506.4**, which recognized all nine native object types, both layers and all three script files. Construct's export process passed script validation. The repository has 37 passing checks, including six native-adapter/package checks; adapter checks use documented API doubles and do not establish GPU rendering.

The available browser reports **Failed to initialise WebGL**, so native layout/preview rendering has not been verified. A genuine Construct HTML5 export is published at `/sunday/construct/`. The existing game at `/sunday/` remains Three.js while native GPU rendering is verified.

The HTML5 export completed with PNG sprite sheets and image optimization off; the optional optimization step stalled in this browser. The three owned project scripts are synchronized into that export after code edits, without modifying the Construct runtime. Art/layout changes require a fresh export from Construct. The downloadable web ZIP contains the same files as the native web route.

For a normal web export, use **Menu → Project → Export → Web (HTML5)**. Free Edition export works with **Minify mode: None**; script minification is a paid feature. Keep runtime outcome logic in the shared engine, and verify both mouse/touch input and rendering before replacing the live game.
