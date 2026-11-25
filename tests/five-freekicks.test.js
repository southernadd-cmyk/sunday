import test from 'node:test';
import assert from 'node:assert/strict';
import {freeKickLayout} from '../scripts/engine-evaluation/five-tactics.js';
import {createSoccerMatch} from '../construct/scripts/engine.js';
test('compact restart positions, outlets, clearance and wall limits across pitch',()=>{
 for(const depth of [.02,.12,.3,.45,.65,.75,.85,.95,.98])for(const lateral of [.02,.12,.3,.5,.7,.88,.98])for(const indirect of [false,true]){
  const x=60*depth,y=40*lateral,p=freeKickLayout({width:60,height:40,x,y,attackers:[0,1,2],defenders:[3,4,5,6],indirect});
  assert.equal(p.attack.length,3);assert.equal(p.wall.length+p.defend.length,4);
  assert.ok(p.wall.length<=2);assert.ok(p.defend.length>=2);
  if(indirect||depth<.65)assert.equal(p.direct,false);
  for(const q of [...p.attack,...p.wall,...p.defend])assert.ok(q.x>=0&&q.x<=60&&q.y>=0&&q.y<=40);
  for(const q of [...p.wall,...p.defend])assert.ok(Math.hypot(q.x-x,q.y-y)>=4.98);
 }
});
test('actual free-kick FSM restarts for both teams and halves, deep and attacking',async()=>{
 for(const team of ['A','B'])for(const half of [1,2])for(const c of [{depth:.23,lateral:.10},{depth:.84,lateral:.50},{depth:.84,lateral:.50,indirect:true}]){
  const m=await createSoccerMatch(1117,[],0,90,5,'intent',['diamond','diamond'],{testHooks:true});
  const p=m.forceFreeKick({team,half,...c});
  assert.equal(p.attack,3);assert.ok(p.wall<=2);
  for(let i=0;i<300&&!m.lastFreeKick;i++)m.step();
  assert.ok(m.lastFreeKick,'restart decision '+JSON.stringify({team,half,c}));
  assert.equal(m.lastFreeKick.team,team);assert.equal(m.lastFreeKick.half,half);
  if(c.indirect||c.depth<.65)assert.equal(m.lastFreeKick.action,'pass');
  if(m.lastFreeKick.action==='shoot')assert.ok(Math.abs(m.lastFreeKick.aim.x-p.goalX)<.01,'shot at correct goal');
  assert.equal(m.flow.freeKicks.clearanceViolations,0);
 }
});
