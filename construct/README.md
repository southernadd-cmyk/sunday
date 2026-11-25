# SUNDAY — native Construct 3 project

[Play the native Construct version](https://southernadd-cmyk.github.io/sunday/construct/) · [Download the web export](https://southernadd-cmyk.github.io/sunday/downloads/SUNDAY-Construct3-Web.zip)

[Download the single-file project](https://southernadd-cmyk.github.io/sunday/downloads/SUNDAY-Construct3.c3p)

Open [Construct 3](https://editor.construct.net/), then drag `SUNDAY-Construct3.c3p` into the editor. You can also use **Open → File**. Press **F5** to preview. No extra addons or npm installation are needed to open the project.

This is a native Construct project, with Sprite, Drawing Canvas and Text objects. The pitch, footballers, ball, ring, ghost and pickups are Construct assets. There is no iframe, Three.js scene or embedded copy of the earlier web application. Two layers keep the project within the Free Edition's layer allowance. Match outcomes use the same tested JavaScript rules as the browser prototype.

## Play

All seven home outfield players and the goalkeeper are selectable. Time waits while you plan.

- Tap a red shirt to select him, then tap grass or drag a run.
- Select another player to retain the first run and plan a second. All queued runs happen together.
- With the ball carrier selected, choose PASS or 1–2 and tap a teammate. Control follows possession after an ordinary pass.
- With an off-ball player selected, CALL requests a pass into his planned run.
- SHOOT selects the ball carrier; choose a corner. Orange lines show the opposition's intentions, cyan marks show support routes and pass targets.
- Press PLAY 2s. Everyone moves together, then the pitch freezes again.
- Tab cycles players; P pass/call, O one-two, Space play, B sprint, R rewind, arrows/WASD run, 1/2 shoot, C learned dink, Escape clears the plan.

The full pitch is visible, horizontal on desktop and vertical on narrow screens, with a fixed compact command deck rather than floating action buttons. The build repaints the recreation ground and footballer sprites with original pixel art, preserving the native atlas frame geometry. Run `python3 scripts/refine-construct-art.py` to refresh the editable source art before opening the folder project; the published `.c3p` is packed after this step. The native game now plays scored two-way mini-matches. Losing possession opens a defensive phase; tackle or intercept to regain it at the same location. Opposition movement, pass and shot intentions are visible. PRESS, COVER and HOLD give quick defensive plans (P/O/H keys). A goal restarts play rather than ending the fixture. Win at full time to earn kit and progress; a defeat or draw after extra time costs one replay. The original browser route retains the older attack-only mode.

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

## Timed passes and challenges

Plan the receiver's run, select the ball carrier, choose PASS and select the runner. AUTO leads the runner at ordinary pass pace; 0.5s, 1.0s, 1.5s and 2.0s choose exact reception times. Tap the cyan markers along the run or use the command buttons. The preview rejects unreachable passes and shows the actual trajectory. Without possession, PRESS approaches but does not tackle. STAND (T) is short reach; SLIDE (F) is longer reach but risks a foul from behind. Choose the challenge time and adjust the approach route. A miss or slide leaves the defender recovering next turn; a foul gives the opponent a free kick. Interceptions and keeper saves remain positional.

## Training ground

The title screen offers PLAY TUTORIAL or direct entry. Five interactive drills teach movement, timed passing into space, finishing, standing tackles and sliding tackles. Each checks the actual outcome, permits retry or repeat and preserves the cup and club profile. Reopen training from the help menu at any point between turns. Enter starts training, and advances/retries a completed drill. The challenge preview measures the defender-to-ball distance at the chosen time and marks reach on the pitch. Cyan timing indicators mean a predicted regain, orange a miss, red a foul. STAND/SLIDE initially selects the earliest viable timing if one exists; user-drawn routes and manual timing choices remain supported. Training uses deterministic fixed scenarios, not a separate physics system.

## Main menu

SUNDAY opens on a dedicated title screen: NEW CAREER starts a fresh cup run, TUTORIALS opens the training ground (full sequence or individual drills). MENU during play allows resuming the current in-session career; starting another requires confirmation. Training preserves the active career and its planned orders, and returns to the tutorial selection or the live career depending on entry point. Existing banked club upgrades are retained. Resume is session-only; this change does not add saved career persistence across reloads.

## Aiming shots

SHOOT now highlights the full goal mouth. Tap anywhere on the goal line to aim, or use NEAR, CENTRE and FAR in the command panel. Near and far refer to the post relative to the ball carrier, not screen orientation; the selected target has a crosshair and the path previews interceptions/saves. Tap a different point to adjust the shot before PLAY 2s. Keyboard 1/2/3 select near/far/centre. There is no independent shot-height control; the learned DINK remains a separate chip option.
