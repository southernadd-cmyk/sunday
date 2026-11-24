// A repeatable sanity check, not a prediction of human win rates.
// This policy cannot see the next draw or the shot roll.
import { Run, CARDS } from '../src/engine.js';

export function chooseAction(run) {
  const legal = run.hand.filter(e => run.canPlay(e.uid));
  const free = legal.find(e => e.id === 'breathe') || legal.find(e => ['tea','second'].includes(e.id) && run.energy < 6 && !run.preview(e.id).tackle);
  if (free) return { uid: free.uid };
  const shots = legal.filter(e => CARDS[e.id].shot).sort((a,b) => run.shotChance(b.id) - run.shotChance(a.id));
  const shot = shots[0];
  if (shot && run.shotChance(shot.id) >= 85) return { uid: shot.uid };
  const reserve = shot ? CARDS[shot.id].cost : 1;
  const setups = legal.filter(e => !CARDS[e.id].shot && !run.preview(e.id).tackle && run.energy - CARDS[e.id].cost >= reserve)
    .sort((a,b) => ((CARDS[b.id].quality || 0) + (CARDS[b.id].draw || 0) * 8) - ((CARDS[a.id].quality || 0) + (CARDS[a.id].draw || 0) * 8));
  if (setups.length) return { uid: setups[0].uid };
  if (shot) return { uid: shot.uid };
  return { action: run.energy ? 'scramble' : 'abandon' };
}

export function simulate(count = 1500) {
  const reached = [0,0,0,0], wins = [0,0,0,0];
  let goals = 0, chanceSum = 0, shots = 0, seedWithCup;
  for (let seed = 1; seed <= count; seed++) {
    const r = new Run(seed);
    let guard = 0;
    while (!['champion','lost'].includes(r.phase)) {
      if (guard++ > 1500) throw new Error(`Run ${seed} failed to terminate`);
      if (r.phase === 'ready') { reached[r.fixtureIndex]++; r.startMatch(); }
      else if (r.phase === 'reward') {
        wins[r.fixtureIndex]++;
        const pref = ['second','feint','wall','chip','overlap','volley','laces','nutmeg'];
        r.pickReward(pref.find(id => r.offers.includes(id)));
      } else if (r.phase === 'event') r.chooseEvent(0);
      else if (r.phase === 'resolution') r.nextChance();
      else {
        const action = chooseAction(r);
        const result = action.uid ? r.play(action.uid) : r[action.action]();
        if (result.chance) { chanceSum += result.chance; shots++; }
      }
    }
    if (r.phase === 'champion') { wins[3]++; seedWithCup ||= seed; }
    goals += r.totalGoals;
  }
  return { runs: count, reached, wins, fixtureWinRates: wins.map((n,i) => +(n / reached[i] * 100).toFixed(1)), cupRate: +(wins[3] / count * 100).toFixed(1), averageGoals: +(goals / count).toFixed(2), averageShotChance: +(chanceSum / shots).toFixed(1), firstWinningSeed: seedWithCup };
}

if (process.argv[1]?.endsWith('balance.mjs')) console.log(JSON.stringify(simulate(Number(process.argv[2]) || 1500), null, 2));
