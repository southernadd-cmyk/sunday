import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AutoMatch,AUTO_STEP,AUTO_TRAITS} from '../src/engine.js';
const run=(seed,traits=[],opponent=0)=>{const m=new AutoMatch(seed,traits,opponent);while(!m.finished)m.step();return m;};
test('autoplay finishes with deterministic real football events',()=>{
 const a=run(4,['touch','overlap'],1),b=run(4,['touch','overlap'],1);
 assert.deepEqual(a.score,b.score);assert.deepEqual(a.stats,b.stats);assert.deepEqual(a.events,b.events);
 assert.ok(a.finished);assert.ok(a.score[0]+a.score[1]>0);
 assert.ok(a.stats.every(s=>s.shots>0&&s.completed>0));
 for(let i=0;i<2;i++){assert.ok(a.score[i]<=a.stats[i].shots);assert.ok(a.stats[i].completed<=a.stats[i].passes);}
});
test('autonomous opponents can score, save, intercept and tackle across multiple seeds',()=>{
 const rows=Array.from({length:8},(_,i)=>run(i+1,['touch','overlap'],(i+1)%3));
 assert.ok(rows.some(m=>m.score[0]>0));assert.ok(rows.some(m=>m.score[1]>0));assert.ok(rows.some(m=>m.stats[0].saves>0));assert.ok(rows.some(m=>m.stats[1].saves>0));
 for(let i=0;i<2;i++)assert.ok(rows.some(m=>m.stats[i].interceptions>0&&m.stats[i].tackles>0));
 assert.ok(new Set(rows.map(m=>m.score.join('-'))).size>=3);
});
test('behaviour choices affect actual simulation rather than just changing a label',()=>{
 const a=run(4,[],1),b=run(4,['touch','overlap'],1);
 assert.notDeepEqual(a.stats,b.stats);assert.ok(Object.keys(AUTO_TRAITS).length>=6);
});
test('continuous ball and actor state remains finite through a match',()=>{
 const m=new AutoMatch(11,['hunt','rifle'],2);while(!m.finished){m.step();assert.ok(Number.isFinite(m.ball.x)&&Number.isFinite(m.ball.z));for(const a of m.actors)assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.z));}
 assert.ok(Math.abs(m.time-m.duration)<AUTO_STEP);
 const stats=JSON.stringify(m.stats);m.step();assert.equal(JSON.stringify(m.stats),stats);
});
