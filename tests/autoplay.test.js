import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AutoMatch,AUTO_STEP,AUTO_TRAITS} from '../src/engine.js';
const run=(seed,traits=[],opponent=0)=>{const m=new AutoMatch(seed,traits,opponent);while(!m.finished)m.step();return m;};
test('autoplay finishes with deterministic real football events',()=>{
 const a=run(4,['touch','overlap'],1),b=run(4,['touch','overlap'],1);
 assert.deepEqual(a.score,b.score);assert.deepEqual(a.stats,b.stats);assert.deepEqual(a.events,b.events);
 assert.ok(a.finished);assert.ok(a.stats.some(s=>s.shots>0));
 assert.ok(a.stats.every(s=>s.completed>0));
 for(let i=0;i<2;i++){assert.ok(a.score[i]<=a.stats[i].shots);assert.ok(a.stats[i].completed<=a.stats[i].passes);}
});
test('autonomous opponents can score, save, intercept and tackle across multiple seeds',()=>{
 const rows=Array.from({length:12},(_,i)=>run(i+1,['touch','overlap'],(i+1)%3));
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

test('pass corridor checks opponent arrival, and player movement accelerates',()=>{
 const m=new AutoMatch(3),a={x:0,z:0},target={x:0,z:-20},near={x:0,z:-10,pace:6,role:'CM'},far={x:20,z:-10,pace:6,role:'CM'};
 assert.ok(m.passSafety(a,target,[near])<m.passSafety(a,target,[far]));
 const p={x:0,z:0,vx:0,vz:0};m.move(p,target,6);assert.ok(Math.abs(p.vz)<6);assert.ok(p.z<0);
});
test('keeper clearance travels above outfield interception height',()=>{
 const m=new AutoMatch(2);m.owner=15;m.ball=m.foot(15);m.launch('pass',{x:0,z:0},3);
 assert.equal(m.flight.loft,true);
});
test('benchmarked seed set sustains passing and attempts on goal',()=>{
 const rows=Array.from({length:12},(_,i)=>run(i+1,['touch','overlap'],(i+1)%3));
 const total=(k)=>rows.reduce((n,m)=>n+m.stats.reduce((sum,s)=>sum+s[k],0),0);
 assert.ok(total('completed')>=180);assert.ok(total('shots')>=35);
 assert.ok(rows.filter(m=>m.stats.every(s=>s.shots===0)).length<=3);
});
