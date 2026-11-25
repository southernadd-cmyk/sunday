# The Next Two Seconds

## A different centre of gravity

The first prototype put the decisions in a hand of cards and used football as a display. This version makes the Sensible Soccer-style screen the interface. Read positions, choose a route on the grass, then watch the consequences there.

The match waits for the player. Nobody needs arcade reflexes or a football physics simulator to enjoy the decisions. The player controls one striker; this is not a team-management screen.

## One turn

While the match is frozen, defenders have already committed their next two-second movements. Orange paths show their routes and destinations. The player can then:

- Run with the ball, including a drawn bend around a defender.
- Spend a limited sprint to cover more ground.
- Give a teammate the ball and run onto the return pass.
- Aim a ground shot or, with the appropriate upgrade, a dink.

Pressing Play moves all those bodies and the ball together. Time then stops again. Collisions are tested at the same time samples that produce the animation, and previews run that same calculation. There is no hidden probability roll after selecting a good spatial plan.

A safe endpoint is not enough: a route can be tackled on the way. A passing lane can cross a defender's movement. A goalkeeper can be drawn towards one post before the striker takes the other corner. These should be readable football problems.

## The run

Four Sunday opponents build from a loose back line to a crowded defence. Each encounter is a next-goal-wins attacking situation, rather than a full simulation of ninety minutes. Three legs are shared across the run. A wasted, tackled or saved attack costs a leg. A fresh attack resets the limited turn, sprint and one-two budgets.

One rewind gives the player a second thought. It restores the actual pre-turn positions and resources and consumes the rewind permanently. It cannot undo a goal or duplicate earnings.

After a goal, the player chooses a piece of kit located on the pitch. Each changes spatial play: longer routes, another sprint, an extra one-two, tighter control, shooting range or ball height. Recovery and extra rewinds are also possible. Rewards have no card hand, deck or draw pile.

The small Club Shed remains as persistent progression, and preserves money earned in the earlier prototype. The active run itself is intentionally not saved yet.

## Screen

The pitch fills the viewport, with a camera close enough to read the players. Score and fixture information sit in a small corner panel. Resources and the current plan occupy short overlays near the edges. Help, the shed and end-of-attack messages appear only when needed.

The route, passing line, keeper movement and ghost destination are all anchored to the grass through the Three.js camera. Mouse, keyboard and touch describe the same plan; none controls the striker in real time.

Original nearest-neighbour pixel sprites, strong grass stripes, clean pitch lines and the navy/yellow palette carry the Amiga reference. Rendering is capped and sleeps while the match is frozen.

## What to learn from this playable

1. Does the first movement feel obvious without a separate explanation?
2. Can a player predict a tackle from the orange route and red collision marker?
3. Is planning a one-two clearer and more satisfying than simply running around everyone?
4. Does a kit pickup change the next plan?
5. Does one rewind encourage learning without removing the tension?
6. Is the pitch itself enjoyable enough to make another run appealing?

The included search policy checks that seed layouts have routes to goal. It is not a human-difficulty estimate, and the opponent AI remains deliberately readable. A later slice could add attacking deliveries, defender styles, moving off-ball starts and different starting strikers. Those should follow playtesting rather than add screens around the pitch.
