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


test('chips modify actual player attributes, stack, expire, and preserve opposition stats',async()=>{
 const m=await createSoccerMatch(9,[],0,300);
 for(const id of ['nitro','magnet','double'])assert.ok(m.grantChip(id));
 assert.equal(m.grantChip('nitro'),false);assert.equal(m.useChip('nitro'),false);
 for(let i=0;i<500&&m.phase!=='play';i++)m.step();
 assert.equal(m.phase,'play');const before=m.playerAttributes();
 assert.ok(m.useChip('double'));assert.ok(m.useChip('nitro'));assert.ok(m.useChip('magnet'));
 assert.equal(m.chips.find(c=>c.id==='double').status,'spent');
 assert.equal(m.chipStats.combos,1);
 const n=m.chips.find(c=>c.id==='nitro');assert.ok(Math.abs(n.until-m.time-300*24/90)<.01);
 const now=m.playerAttributes();assert.ok(now.some((p,i)=>p.team==='A'&&p.role!=='GK'&&p.speed>before[i].speed&&p.passing>before[i].passing));
 assert.ok(now.every((p,i)=>p.team==='A'||p.speed===before[i].speed));assert.equal(m.useChip('nitro'),false);
 for(let i=0;i<10000&&n.status==='active';i++)m.step();
 assert.equal(n.status,'spent');assert.ok(m.playerAttributes().every((p,i)=>p.speed===before[i].speed));
 assert.ok(m.charge>=0&&m.charge<=8);
});
test('real match events earn charge and fund a reload, which cannot repeat indefinitely',async()=>{
 const m=await createSoccerMatch(1,[],0,300);assert.ok(m.grantChip('nitro'));
 for(let i=0;i<500&&m.phase!=='play';i++)m.step();assert.ok(m.useChip('nitro'));
 for(let i=0;i<10000&&!(m.phase==='play'&&m.chips[0].status==='spent'&&m.charge>=4);i++)m.step();
 assert.ok(m.charge>=4);const charge=m.charge;assert.ok(m.useChip('nitro'));assert.equal(m.charge,charge-4);assert.equal(m.chips[0].reloaded,true);
 for(let i=0;i<10000&&m.chips[0].status==='active';i++)m.step();assert.equal(m.useChip('nitro'),false);
});
test('power-ups alter the actual simulation rather than only a display number',async()=>{
 async function play(power){
  const m=await createSoccerMatch(1,[],0,300);m.grantChip('nitro');
  for(let i=0;i<500&&m.phase!=='play';i++)m.step();if(power)assert.ok(m.useChip('nitro'));
  for(let i=0;i<600;i++)m.step();return m.actors.map(p=>[p.x,p.z]);
 }
 assert.notDeepEqual(await play(true),await play(false));
});
