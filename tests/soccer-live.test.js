import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSoccerMatch,SOCCER_STEP,AUTO_TRAITS} from '../construct/scripts/engine.js';
async function run(seed,traits,round=0){
 const m=await createSoccerMatch(seed,traits,round,300);
 assert.equal(m.upstream,'soccer-js');assert.equal(m.actors.length,22);
 let n=0;while(!m.finished&&n<16000){m.step();n++;if(n%100===0){assert.ok(m.actors.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));assert.ok(Number.isFinite(m.ball.x)&&Number.isFinite(m.ball.z)&&Number.isFinite(m.ball.y));}}
 assert.ok(m.finished,'Soccer-JS must reach fulltime');
 assert.ok(m.stats.every(s=>s.completed<=s.passes));return {score:m.score,stats:m.stats,steps:n};
}
test('real bundled Soccer-JS matches finish, produce varied play, and respect behaviour builds',async()=>{
 const rows=[];for(let i=1;i<=6;i++)rows.push(await run(i,['touch','overlap'],i%3));
 const again=await run(1,['touch','overlap'],1),base=await run(1,[],1);
 assert.deepEqual(again,rows[0]);assert.notDeepEqual(base.stats,again.stats);
 assert.ok(rows.some(r=>r.score[0]+r.score[1]>0),'Longer simulated match needs goals');
 assert.ok(rows.some(r=>r.stats[0].shots>0));assert.ok(rows.some(r=>r.stats[1].shots>0));
 assert.ok(rows.every(r=>r.stats.reduce((n,s)=>n+s.completed,0)>0));
 console.log('SOCCER_LIVE_BENCHMARK '+JSON.stringify(rows));
});
test('all six traits can initialise genuine upstream matches',async()=>{
 for(const trait of Object.keys(AUTO_TRAITS)){const m=await createSoccerMatch(12,[trait],0,300);for(let i=0;i<100;i++)m.step();assert.equal(m.actors.length,22);assert.equal(m.stepSeconds,SOCCER_STEP);}
});

test('half-time plans influence second-half play, not scores directly',async()=>{
 async function half(plan){
  const m=await createSoccerMatch(9,['touch'],0,300);
  for(let i=0;i<10000&&m.phase!=='halftime';i++)m.step();
  assert.equal(m.phase,'halftime');const first={score:[...m.score],stats:JSON.parse(JSON.stringify(m.stats))};
  assert.ok(m.chooseHalfPlan(plan));assert.deepEqual(m.score,first.score);assert.equal(m.callsLeft,2);
  for(let i=0;i<10000&&!m.finished;i++)m.step();
  assert.ok(m.finished);return {first,score:m.score,stats:m.stats};
 }
 const attack=await half('attack'),protect=await half('protect');assert.deepEqual(attack.first,protect.first);assert.notDeepEqual(attack.stats,protect.stats);
});
test('touchline call expires on the match clock and cannot be stacked',async()=>{
 const m=await createSoccerMatch(3,[],0,300);
 assert.equal(m.callTouchline('press'),false);
 for(let i=0;i<500&&m.phase!=='play';i++)m.step();
 assert.equal(m.phase,'play');const before=m.tacticalSettings();assert.equal(m.callTouchline('press'),true);assert.equal(m.callsLeft,1);assert.equal(m.callTouchline('push'),false);assert.ok(m.tacticalSettings().DEFENSIVE_PRESS_INTENSITY>before.DEFENSIVE_PRESS_INTENSITY);
 for(let i=0;i<5000&&m.call;i++)m.step();
 assert.equal(m.call,null);assert.deepEqual(m.tacticalSettings(),before);
});
