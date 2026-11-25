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
