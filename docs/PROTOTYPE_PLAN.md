# SUNDAY: first playable

## The idea

Be the number nine in an English pub team. The fun comes from constructing an improbable chance with the hand you have, and deciding whether to push it further before the defence crowds you out. The setting should supply the choices, jokes and character; it should not depend on being a good arcade football simulation.

Saltmere is fictional. The Anchor & Crown, its opponents and all the artwork are invented. The visual target is the clarity and small-scale charm of Sensible Soccer on the Amiga, rendered with Three.js and original pixel assets.

## Core loop

| Stage | What you do | What changes |
| --- | --- | --- |
| Match briefing | Read the comeback target and pitch pressure rule | Your risk budget for the next match |
| Attack | Spend legs on a five-card hand | Chance, pressure, remaining hand and draw pile |
| Finish | Pick a shot or recycle the chance | A probability roll determines the goal; an attack is spent |
| Win | Draft one of three rare cards | The deck grows for this run |
| Between Sundays | Make one of two life choices | A lasting deck change or a one-match bonus |
| End of run | Bank earned money and visit the shed | Small upgrades survive; the deck resets |

## The decisions worth testing

**Spend or shoot.** Movement creates better chances but costs legs and pressure. A 0-cost Toe punt has lower accuracy; a Side-foot it needs a reserved leg. The fallback shot prevents an unlucky hand from becoming a dead end.

**Flair or safety.** Through his legs gives a large chance gain at a high pressure cost. Drop a shoulder improves your chance while relieving pressure. Exact shot probabilities and tackle warnings make failure attributable to a visible risk.

**Build around a reward.** On the volley pays off immediately after a Link-up card. Cheeky little dink rewards keeping pressure below 40. Second wind permits a longer sequence. These are the beginnings of distinct decks, rather than a large catalogue of equivalent numeric upgrades.

**Take care of yourself or collect another card.** An early night gives extra legs for one match. Staying out adds a powerful persistent Link-up card and next-match pressure. Training can remove the starting Dodgy knee. Permanent upgrades are modest, with low level caps, so repeated runs should not replace tactical decisions.

## What the prototype deliberately simplifies

Matches are comeback challenges with fixed opposing scores. There is no tackling input, player steering, transfer market, management screen, team formation editor, simulated league table or real player data. The match clock is an abstract attack counter. A draw ends the run; penalty shoot-outs are not implemented.

Three.js visualises the state and short ball movements. It does not independently decide whether a shot scores. There is no hidden accuracy penalty based on render timing, and animations can be skipped quickly with reduced-motion preferences.

The first draft allows runs to be completed in roughly 10–15 minutes, depending on how long decisions take. That estimate needs human playtesting.

## Art direction

- Overhead orthographic pitch; strong alternating green stripes and clear cream lines.
- Tiny, original 16×16 footballer sprites with red home shirts, white shorts and blue opposition shirts.
- Pixel-sharp low-resolution rendering, limited colour, basic goal frames and a sparse touchline crowd.
- Navy panels, yellow selection, cyan secondary information, square borders and restrained bevels.
- Pixel display typography with readable text for rules. A complete desktop game screen without page scrolling; horizontally swipeable hands on mobile.
- No copied Sensible Soccer assets. No expensive visual feature that obscures the next decision.

## First playtest

Ask players to complete one attack without explanation, then one run. Observe:

1. Do they understand that cards cost legs, and reserve enough to shoot?
2. Can they explain why pressure matters and when a shot is likely to score?
3. Is a miss at a good probability frustrating in an interesting way, or merely arbitrary?
4. Does a reward change how they play the next match?
5. Do they prefer the deck-building, the life choices, or the football presentation?
6. Do they immediately want another run after losing?

The balance script is a reproducible starting point. Its 24.5% cup rate is for a simple policy across seeds 1–1500, with no permanent upgrades. It does not measure human enjoyment or fairness. The semi-final is intentionally a relative breather after the quarter-final because an equipment bonus and an extra attack can help; the final tightens the target.

## Sensible next slice

Choose the next system after observing a few runs. The most promising expansion is a compact route between matches: a training session, pub visit, physio or boot-sale stop. Each stop should force a deck or condition trade-off. Add a second starting build only when the first has decisions people enjoy.

Later possibilities: explicit injury and morale systems, opponent behaviours that counter different decks, alternative striker styles, small equipment relics, run saves and shareable seeds. These are future work, not features claimed by this prototype.
