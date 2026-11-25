import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLES,TACTICAL_MAP,tacticalTarget,tacticalAssignment} from '../scripts/engine-evaluation/five-tactics.js';
import {createSoccerMatch} from '../construct/scripts/engine.js';
test('original tactical maps contain 35 valid, spaced formations per phase',()=>{
 for(const mode of ['attack','defend']){
  const map=TACTICAL_MAP[mode];assert.equal(map.length,7);
  for(const row of map){assert.equal(row.length,5);for(const cell of row){
   for(const role of ROLES){assert.equal(cell[role].length,2);assert.ok(cell[role].every(n=>Number.isFinite(n)&&n>=0&&n<=1));}
   assert.ok(cell.CB[0]<cell.CF[0]);assert.ok(cell.LM[1]<.4&&cell.RM[1]>.6);
   for(let i=0;i<ROLES.length;i++)for(let j=i+1;j<ROLES.length;j++){const a=cell[ROLES[i]],b=cell[ROLES[j]];assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])>.12);}
  }}
 }
});
test('interpolation matches authored cell centres and is continuous at boundaries',()=>{
 for(const mode of ['attack','defend'])for(const role of ROLES){
  for(let i=0;i<7;i++)for(let j=0;j<5;j++){const a=tacticalTarget(role,mode,(i+.5)/7,(j+.5)/5);assert.ok(a.every((n,k)=>Math.abs(n-TACTICAL_MAP[mode][i][j][role][k])<1e-9));}
  for(let i=1;i<7;i++){const a=tacticalTarget(role,mode,i/7-.00001,.37),b=tacticalTarget(role,mode,i/7+.00001,.37);assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<.001);}
 }
});
test('possession assigns the ball-side wing to support and opposite wing to run',()=>{
 assert.equal(tacticalAssignment('LM','attack',.5,.2).action,'support');
 assert.equal(tacticalAssignment('RM','attack',.5,.2).action,'run');
 assert.equal(tacticalAssignment('LM','attack',.5,.8).action,'run');
 assert.equal(tacticalAssignment('CB','defend',.5,.5).action,'cover');
});
test('new profile runs a full match with coordinated role assignments and intact clock',async()=>{
 const m=await createSoccerMatch(12345,[],0,90,5,'zones');assert.equal(m.profile,'zones');let prev=0;
 for(let i=0;i<20000&&!m.finished;i++){m.step();assert.ok(m.matchSeconds+1e-6>=prev);prev=m.matchSeconds;assert.equal(m.actors.length,10);assert.ok(m.actors.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));}
 assert.ok(m.finished);assert.equal(m.matchSeconds,5400);assert.equal(m.flow.kickoffCrowdedTicks,0);
 for(const action of ['cover','recycle','support','run','threaten','track','screen'])assert.ok(m.flow.assignmentCounts[action]>0,'observed '+action);
});
