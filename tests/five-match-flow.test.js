import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoccerMatch,SOCCER_STEP} from '../construct/scripts/engine.js';
async function run(seed,profile){
 const m=await createSoccerMatch(seed,[],0,90,5,profile);
 for(let i=0;i<20000&&!m.finished;i++){m.step();assert.ok(Number.isFinite(m.ball.x)&&Number.isFinite(m.ball.z));}
 assert.ok(m.finished,'match must finish');
 const f=m.flow;
 return {seed,profile,score:m.score.join('-'),shots:f.shots,passes:m.stats.reduce((n,t)=>n+t.completed,0),boards:f.boardBounces,live:f.playTicks/(f.playTicks+f.deadTicks),longestQuiet:f.longestQuiet,offside:f.phases.offside||0,deadSeconds:f.deadTicks*SOCCER_STEP};
}
test('five-a-side match flow comparison across independent seeds',async()=>{
 let rows=[];for(const seed of [12345,728,9921,1467,2781,511])for(const profile of ['original','arcade'])rows.push(await run(seed,profile));
 console.log('MATCH_FLOW_COMPARISON '+JSON.stringify(rows));
 const tuned=rows.filter(r=>r.profile==='arcade'),base=rows.filter(r=>r.profile==='original');
 const sum=(rs,k)=>rs.reduce((n,r)=>n+r[k],0);
 assert.ok(tuned.every(r=>r.offside===0),'no offside in arcade');
 assert.ok(sum(tuned,'boards')>0,'actual board rebounds observed');
 assert.ok(tuned.every(r=>r.passes>0),'each fixture has completed passes');
 assert.ok(sum(tuned,'shots')>0,'actual shots observed');
 assert.ok(sum(tuned,'live')>sum(base,'live'),'arcade profile must increase live-play share across fixtures');
});
