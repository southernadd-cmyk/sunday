# Pitch prototype checks · 25 November 2026

The card prototype's old validation is superseded by the spatial rules in version 0.2.

## Automated

31 behavioural checks cover frozen previews, locked defender intentions, route length and boundaries, simultaneous movement, limited sprints, tackles along a route, bending around a defender, off-ball one-twos, passing interceptions, clear goals, keeper saves, chip height, running out of turns, exact rewind restoration, gear collection, four-fixture completion, loss and banking, profile migration, denied storage and preview/playback agreement.

A twelve-seed search-policy smoke test completed all twelve runs. Its shortest attacks used two turns and its longest used three after upgrades. It explores future positions and is intended to catch impossible layouts and rule regressions, not to predict human success or enjoyment.

Nine new passing checks cover a moving receiver retaining possession, pass-and-move, off-ball movement, teammate-to-teammate passes, called returns into space, invalid off-ball shots, normal/return interceptions, automatic one-two suggestions, possession restored by rewind and exact preview/playback agreement.

## Browser checks

The full-screen pitch, click-to-plan route, keyboard planning, simultaneous playback, and a one-two were inspected through the browser. The desktop preview fills the viewport with the field and small edge overlays; the card table and former full-page menus are removed.

A browser sequence completed a one-two, sprint and left-corner goal; chose a boots pickup on the grass; advanced to the second fixture; deliberately played a marked unsafe route; and verified that rewind restored all three legs and the original frozen positions. Mobile fixtures at 390×844 and 360×740 fit the pitch and controls without a card table or page scrolling, and a pointer tap plotted a route in the narrow view. The `/tests/viewport.html` development fixture exposes those narrow-screen versions of the same app.

Version 0.2.1 browser checks played a normal pass to Kev, verified that he kept possession, called a return while running into space, and completed a one-two from its suggested route. The striker remains the controlled player throughout. Both narrow-screen fixtures expose separate pass and 1–2 buttons; selecting 1–2 at 360px immediately enables Play without requiring a drawn route.

Playback now uses elapsed visible time, so throttled rendering does not stretch a recorded two-second turn. Returning from a hidden tab resets the animation timestamp to keep hidden time paused.

## Limits

This is a first playable of a different mechanic. Human difficulty, football feel, physical Android touch input and sustained GPU performance still need playtesting. The browser compatibility renderer is available for environments with WebGL disabled. Source and build verification alone do not establish GPU shader compilation or hardware frame pacing.

Only club progress is saved; an active run is lost on refresh. The opponent AI is intentionally deterministic and readable. It does not simulate a full team or a ninety-minute match.
