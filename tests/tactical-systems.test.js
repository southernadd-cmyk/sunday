import test from 'node:test';
import assert from 'node:assert/strict';
import {SYSTEMS,ROLES,systemAssignment,tacticalAssignment,systemCanPress} from '../scripts/engine-evaluation/five-tactics.js';
import {possessionAction} from '../scripts/engine-evaluation/possession-intent.js';
import {createSoccerMatch} from '../construct/scripts/engine.js';
const ids=Object.keys(SYSTEMS);
test('six valid and distinct systems, exact original diamond',()=>{
 assert.equal(ids.length,6);
 const signatures=new Set();
 for(const id of ids){
  const points=[];
  for(const role of ROLES)for(const mode of ['attack','defend'])for(let i=0;i<7;i++)for(let j=0;j<5;j++){
   const args=[role,mode,(i+.5)/7,(j+.5)/5],p=systemAssignment(id,...args);
   assert.ok(Number.isFinite(p.x)&&p.x>=0&&p.x<=1&&Number.isFinite(p.y)&&p.y>=0&&p.y<=1);
   if(id==='diamond')assert.deepEqual(p,tacticalAssignment(...args));
   points.push([p.x,p.y]);
  }
  signatures.add(JSON.stringify(points));
 }
 assert.equal(signatures.size,6);
});
test('high press engages earlier than counter while both contest loose balls',()=>{
 const ctx={hasOpponentOwner:true,distance:.4,depth:.65};
 assert.equal(systemCanPress('press',ctx),true);assert.equal(systemCanPress('counter',ctx),false);
 assert.equal(systemCanPress('counter',{...ctx,hasOpponentOwner:false}),true);
});
test('tactical action preferences still require a genuine available option',()=>{
 const ctx={depth:.55,clearShot:false,forwardPass:true,backwardPass:false,pressure:false,breaksLine:false};
 assert.equal(possessionAction('progress',ctx,'diamond'),'carry');
 assert.equal(possessionAction('progress',ctx,'press'),'pass');
 for(const id of ids)assert.equal(possessionAction('progress',{...ctx,forwardPass:false},id),'carry');
 assert.equal(possessionAction('progress',{...ctx,depth:.73,clearShot:true},'direct'),'shoot');
});
test('all 36 ordered tactical matchups produce valid complete fixtures',async()=>{
 const rows=[];
 for(const home of ids)for(const away of ids){
  const m=await createSoccerMatch(12345,[],0,60,5,'intent',[home,away]);
  assert.deepEqual(m.systems,[home,away]);
  for(let i=0;i<20000&&!m.finished;i++){m.step();assert.ok(Number.isFinite(m.ball.x)&&Number.isFinite(m.ball.z));}
  assert.ok(m.finished,home+' vs '+away);
  assert.equal(m.actors.length,10);
  assert.ok(m.flow.intentDecisions>0);
  assert.ok(m.flow.teamAssignments.every(a=>Object.keys(a).length>0));
  rows.push({home,away,score:m.score,shots:m.stats.map(t=>t.shots),passes:m.stats.map(t=>t.completed),tackles:m.stats.map(t=>t.tackles),interceptions:m.stats.map(t=>t.interceptions),possession:m.stats.map(t=>t.possession),actions:m.flow.teamIntentActions,assignments:m.flow.teamAssignments,entries:m.flow.finalThirdEntries,crowding:m.flow.crowdedTicks/Math.max(1,m.flow.shapeTicks)});
 }
 console.log('TACTICAL_MATCHUP_MATRIX '+JSON.stringify(rows));
 assert.equal(rows.length,36);
});
