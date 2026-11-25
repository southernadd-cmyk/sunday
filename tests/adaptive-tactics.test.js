import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptiveTactic,ADAPTIVE_DWELL_SECONDS} from '../scripts/engine-evaluation/five-tactics.js';
import {createSoccerMatch} from '../construct/scripts/engine.js';
const window={controlSeconds:3,possessionShare:.5,shots:1,opponentShots:1,opponentEntries:1,opponentWideShare:.2,interceptions:0,opponentPasses:2};
const context={current:'diamond',base:'diamond',second:4200,goalDifference:0,stamina:.85,window};
test('late score and fatigue drive sensible changes; no blind switching',()=>{
 assert.equal(adaptiveTactic({...context,goalDifference:-1}).system,'press');
 assert.equal(adaptiveTactic({...context,goalDifference:-1,stamina:.4}).system,'direct');
 assert.equal(adaptiveTactic({...context,goalDifference:1}).system,'counter');
 assert.equal(adaptiveTactic({...context,second:1800,current:'press',stamina:.4}).system,'diamond');
 assert.equal(adaptiveTactic(context).system,'diamond');
 assert.equal(adaptiveTactic({...context,goalDifference:-1,lastChange:4000}).system,'diamond');
 assert.equal(adaptiveTactic({...context,goalDifference:-1,second:5300}).system,'diamond');
});
test('manager responds to observed pressure, width, stale attacks and turnovers',()=>{
 const c={...context,second:1800};
 assert.equal(adaptiveTactic({...c,window:{...window,opponentShots:3}}).system,'counter');
 assert.equal(adaptiveTactic({...c,window:{...window,opponentWideShare:.7,opponentEntries:3}}).system,'wide');
 assert.equal(adaptiveTactic({...c,window:{...window,shots:0}}).system,'rotation');
 assert.equal(adaptiveTactic({...c,window:{...window,interceptions:4,opponentPasses:5}}).system,'press');
 assert.equal(adaptiveTactic({...c,window:{...window,controlSeconds:0,opponentShots:4}}).system,'diamond');
});
test('real fixtures preserve home system and obey review cadence; fixed mode stays fixed',async()=>{
 for(const adaptiveOpponent of [false,true]){
  const m=await createSoccerMatch(12345,[],0,90,5,'intent',['wide','diamond'],{adaptiveOpponent});
  for(let i=0;i<20000&&!m.finished;i++){m.step();assert.equal(m.systems[0],'wide');}
  assert.ok(m.finished);assert.deepEqual(m.startingSystems,['wide','diamond']);
  if(!adaptiveOpponent){assert.equal(m.systems[1],'diamond');assert.equal(m.flow.tacticalReviews,0);assert.equal(m.flow.tacticalChanges.length,0);}
  else{
   assert.ok(m.flow.tacticalReviews>=6);
   let last=-Infinity,prior='diamond';
   for(const change of m.flow.tacticalChanges){assert.ok(change.second-last>=ADAPTIVE_DWELL_SECONDS);assert.equal(change.from,prior);assert.notEqual(change.to,prior);assert.ok(change.reason);last=change.second;prior=change.to;}
   assert.equal(m.systems[1],prior);
  }
 }
});
