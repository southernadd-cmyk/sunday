import assert from 'node:assert/strict';
import {createSoccerMatch} from '../../construct/scripts/engine.js';
import {writeFileSync} from 'node:fs';
const seed=Number(process.argv[2]);
assert.ok(Number.isInteger(seed));
const cases=[
 {depth:.68,lateral:.50},{depth:.73,lateral:.35},{depth:.73,lateral:.65},
 {depth:.79,lateral:.50},{depth:.84,lateral:.25},{depth:.84,lateral:.75},
 {depth:.88,lateral:.42},{depth:.88,lateral:.58},{depth:.92,lateral:.50},
 {depth:.23,lateral:.15},{depth:.48,lateral:.50},{depth:.84,lateral:.5,indirect:true}
];
const rows=[];
for(const team of ['A','B'])for(const half of [1,2])for(const c of cases){
 const m=await createSoccerMatch(seed,[],0,90,5,'intent',['diamond','diamond'],{testHooks:true});
 const plan=m.forceFreeKick({team,half,...c});
 let choice=null;
 for(let i=0;i<250;i++){
  m.step();
  assert.ok(Number.isFinite(m.ball.x)&&Number.isFinite(m.ball.z));
  if(!choice&&m.lastFreeKick)choice={...m.lastFreeKick};
  if(m.lastFreeKickOutcome||m.lastCombinationOutcome||m.flow.freeKicks.interceptedPasses)break;
  if(m.flow.freeKicks.completedPasses&&(!plan.direct||!m.flow.freeKicks.layoffs))break;
  if(m.flow.freeKicks.awarded>1)break;
 }
 assert.ok(choice,'restart decision');
 assert.equal(choice.team,team);assert.equal(choice.half,half);
 if(c.indirect||c.depth<.65)assert.equal(choice.action,'pass');
 if(choice.action==='shoot'){
  assert.equal(choice.aim.x,plan.goalX);
  assert.ok(m.flow.freeKicks.releasedShots>0,'shot must be released, not just selected');
  assert.ok(['driven','curled','dipped'].includes(choice.routine));
  assert.ok(m.lastFreeKickOutcome,'direct shot must have classified outcome');
 }
 assert.equal(m.flow.freeKicks.clearanceViolations,0);
 rows.push({seed,team,half,...c,eligible:plan.direct,wall:plan.wall,choice,outcome:m.lastFreeKickOutcome||m.lastCombinationOutcome||null,stats:m.flow.freeKicks});
}
assert.equal(rows.length,48);
const sum={};
for(const row of rows)for(const [k,v] of Object.entries(row.stats))if(typeof v==='number')sum[k]=(sum[k]||0)+v;
console.log('DIRECT_TRIALS '+JSON.stringify({seed,count:rows.length,sum}));
assert.ok(sum.releasedShots>=8,'At least eight real shots per 48 restart scenarios');
assert.ok(sum.shotGoals+sum.shotSaves>0,'Shots must sometimes reach goal or keeper');
assert.ok(sum.dipped>0,'At least one dipped direct free kick must be selected');
assert.ok(sum.layoffShots+sum.returnShots>0,'At least one genuine combination shot must be released');
writeFileSync('direct-trials-'+seed+'.json',JSON.stringify(rows,null,2));
