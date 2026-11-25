import assert from 'node:assert/strict';
import {createSoccerMatch,SOCCER_STEP} from './soccer-adapter.mjs';
const rows=[];
async function run(seed,traits){
 const start=performance.now(),m=await createSoccerMatch(seed,traits,seed%3,75);
 assert.equal(m.actors.length,22);
 assert.equal(m.actors.filter(p=>p.side===0).length,11);assert.equal(m.actors.filter(p=>p.side===1).length,11);
 let steps=0;
 while(!m.finished&&steps<12000){m.step();steps++;if(steps%20===0){assert.ok(m.actors.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));assert.ok(Number.isFinite(m.ball.x)&&Number.isFinite(m.ball.z)&&Number.isFinite(m.ball.y));}}
 assert.ok(m.finished,'Match must reach full time');
 assert.equal(m.score.length,2);assert.ok(m.stats.every(s=>s.completed<=s.passes+5));
 return {seed,traits,steps,wallMs:Math.round(performance.now()-start),score:m.score,stats:m.stats};
}
for(const seed of [1,2,3,4,5,6])rows.push(await run(seed,['touch','overlap']));
const repeated=await run(1,['touch','overlap']),base=await run(1,[]);
assert.deepEqual(repeated.score,rows[0].score);assert.deepEqual(repeated.stats,rows[0].stats);
assert.notDeepEqual(base.stats,rows[0].stats,'Traits must change actual match decisions');
assert.ok(rows.some(m=>m.stats.some(s=>s.shots>0)));
console.log('SOCCER_ADAPTER_BENCHMARK '+JSON.stringify({logicStep:SOCCER_STEP,rows,baseline:base}));
