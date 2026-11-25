import { League } from '../src/sim/League';
const rows=[];
for(const seed of [1,2,3,4,5,6]){
 const start=performance.now();
 const league=new League({seed});
 const fixture=league.nextFixture();
 if(!fixture)throw new Error('No fixture');
 const r=league.createMatch(fixture).runToCompletion();
 rows.push({seed,wallMs:Math.round(performance.now()-start),duration:r.duration,score:r.score,passes:r.stats.map(s=>s.passes),completed:r.stats.map(s=>s.passesCompleted),shots:r.stats.map(s=>s.shots),tackles:r.stats.map(s=>s.tackles),saves:r.stats.map(s=>s.saves),blocks:r.stats.map(s=>s.blocks)});
}
console.log('ENGINE_BENCHMARK '+JSON.stringify({engine:'evofootball',rows}));
