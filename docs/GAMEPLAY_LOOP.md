# SUNDAY: gameplay loop redesign

The pitch stays the main screen; no separate tactical card screen. The first implementation is a short scored match with two-second simultaneous turns. The run is four opponents, three replays, and three reward drafts.

## Benchmark synthesis

- Into the Breach: telegraphed threats and satisfying counters.
- FTL: pause and issue orders, recover from bad situations.
- Slay the Spire: opponent variety and choice of builds.
- Balatro, Binding of Isaac, Risk of Rain 2: synergies and unexpected builds.
- Hades, Dead Cells: fast restarts, responsive actions, characterful encounters.
- Vampire Survivors, Brotato: escalating pressure and clear power gains.
- Spelunky, Noita: consistent rules, emergent situations.

## Implemented in this phase
- Shared clock and score, extra time, opposition AI with visible dribble/pass/shot.
- Same-pitch turnovers, interception/tackles, keeper selection, defensive quick plans.
- Win at full time; clean-sheet and regain bonuses; tactical gear draft.
- Counterpress + counterattack is a real synergy: more regains and faster movement after them.
- Opponents vary in speed, passing and press; legacy mode unchanged.

## Next after actual playtesting
1. Reduce repeated or low-stakes turns; adjust match duration and remove dominant strategies using playtest data.
2. Different starting scenarios (protect a lead, chase a goal, counter from a corner, ten men, bad pitch); opponent identities and visible scouting.
3. Tradeoffs: fatigue, substitutions, one-touch play, risky through balls, set pieces; avoid mandatory passive turns.
4. Distinct builds: counterattack, possession, high press, wing play, set-piece specialists. Draft combinations that change decisions, not just stats.
5. Branching cup route, optional risky friendlies and pub events, meaningful club progression, rematch seeds, match highlights.
6. Native visual and audio polish, keyboard and touch journeys, actual human playtest before declaring fun.

No claim that the new balance has been human-playtested. The aim is recoverable mistakes and new tactical problems, not a full real-time 90-minute simulation.
