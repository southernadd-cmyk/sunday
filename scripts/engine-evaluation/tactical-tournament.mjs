import {SYSTEMS} from './five-tactics.js';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const ids=Object.keys(SYSTEMS);
const seeds=[12345,728,9921,1467,2781];
function aggregate(rows){
 const data={fixtures:rows.length,variants:{}};
 for(const variant of ['legacy','compact','previous','direct']){
  const subset=rows.filter(r=>r.variant===variant),teams=Object.fromEntries(ids.map(id=>[id,{games:0,wins:0,draws:0,losses:0,points:0,gf:0,ga:0,shots:0,passes:0,tackles:0,interceptions:0,possession:0,opponents:{}}]));
  const freeKicks={};let goals=0,entries=0,created=0,crowding=0;
  for(const r of subset){
   goals+=r.score[0]+r.score[1];entries+=r.entries;created+=r.created;crowding+=r.crowding;
   for(const [k,v] of Object.entries(r.freeKicks))if(typeof v==='number')freeKicks[k]=(freeKicks[k]||0)+v;
   for(let i=0;i<2;i++){
    const j=1-i,t=teams[r.systems[i]],diff=r.score[i]-r.score[j],points=diff>0?3:diff===0?1:0,opp=r.systems[j];
    t.games++;t.points+=points;t.wins+=+(diff>0);t.draws+=+(diff===0);t.losses+=+(diff<0);t.gf+=r.score[i];t.ga+=r.score[j];
    for(const k of ['shots','passes','tackles','interceptions','possession'])t[k]+=r.stats[i][k];
    const o=t.opponents[opp]??={games:0,points:0,gf:0,ga:0};o.games++;o.points+=points;o.gf+=r.score[i];o.ga+=r.score[j];
   }
  }
  data.variants[variant]={matches:subset.length,goals,entries,created,crowding:subset.length?crowding/subset.length:0,freeKicks,teams};
 }
 return data;
}
if(process.argv[2]==='aggregate'){
 const rows=process.argv.slice(3).flatMap(file=>JSON.parse(readFileSync(file,'utf8')));
 assert.equal(rows.length,720);assert.equal(new Set(rows.map(r=>[r.variant,r.seed,...r.systems].join(':'))).size,720);
 const result=aggregate(rows);
 writeFileSync('tactical-tournament-summary.json',JSON.stringify(result,null,2));
 console.log('TOURNAMENT_SUMMARY '+JSON.stringify(result));
 for(const [variant,v] of Object.entries(result.variants)){
  console.log(variant+': '+v.matches+' matches, '+v.goals+' goals, '+v.entries+' final-third entries, '+v.created+' pass-created shots');
  console.log('Free kicks: '+JSON.stringify(v.freeKicks));
  console.log('System | PPG | W-D-L | GF-GA | shots | passes | tackles | interceptions');
  for(const [id,t] of Object.entries(v.teams).sort((a,b)=>b[1].points/b[1].games-a[1].points/a[1].games)){
   console.log([id,(t.points/t.games).toFixed(3),[t.wins,t.draws,t.losses].join('-'),t.gf+'-'+t.ga,t.shots,t.passes,t.tackles,t.interceptions].join(' | '));
  }
 }
 const legacy=result.variants.legacy.freeKicks,compact=result.variants.compact.freeKicks;
 assert.ok(legacy.releasedPasses>0&&compact.releasedPasses>0,'Both variants need real free-kick passes');
 const oldRate=legacy.completedPasses/legacy.releasedPasses,newRate=compact.completedPasses/compact.releasedPasses;
 console.log('FREE_KICK_COMPLETION '+JSON.stringify({legacy:oldRate,compact:newRate}));
 assert.ok(newRate>=oldRate,'Revised free kicks must at least match legacy completion rate');
 const direct=result.variants.direct.freeKicks;
 const directRate=direct.completedPasses/direct.releasedPasses;
 console.log('DIRECT_FREE_KICK_COMPLETION '+JSON.stringify({baseline:newRate,direct:directRate,shots:direct.releasedShots,goals:direct.shotGoals,saves:direct.shotSaves,wallBlocks:direct.shotWallBlocks}));
 assert.ok(directRate>=oldRate&&directRate>=newRate-.05,'Direct routines must preserve short-restart reliability');
 assert.ok(direct.releasedShots>0,'Direct free-kick shots must actually happen');
 const previous=result.variants.previous.freeKicks;
 const styles=['driven','curled','dipped'];
 const chosen=styles.reduce((n,k)=>n+direct[k],0);
 const maxShare=Math.max(...styles.map(k=>direct[k]))/Math.max(1,chosen);
 console.log('SHOT_BALANCE '+JSON.stringify({previous:Object.fromEntries(styles.map(k=>[k,previous[k]])),revised:Object.fromEntries(styles.map(k=>[k,direct[k]])),maxShare,previousShots:previous.releasedShots,revisedShots:direct.releasedShots,previousGoals:previous.shotGoals,revisedGoals:direct.shotGoals}));
 assert.ok(direct.releasedShots>=Math.max(12,previous.releasedShots*.50),'Keep meaningful direct-shot frequency');
 assert.ok(direct.curled>0&&direct.dipped>0,'Both curved and dipped shots must occur naturally');
 assert.ok(maxShare<=.85,'No single delivery may dominate more than 85% of natural direct choices');
 assert.ok(direct.shotGoals+direct.shotSaves>=direct.releasedShots*.40,'A substantial share of direct shots should reach goal or goalkeeper');
}else{
 const {createSoccerMatch}=await import('../../construct/scripts/engine.js');
 const seed=Number(process.argv[2]);assert.ok(seeds.includes(seed));
 const rows=[];
 for(const home of ids)for(const away of ids)for(const variant of ['legacy','compact','previous','direct']){
  const m=await createSoccerMatch(seed,[],0,90,5,'intent',[home,away],{freeKicks:variant!=='legacy',directFreeKicks:variant==='direct'||variant==='previous',balancedSelection:variant!=='previous'});
  for(let i=0;i<20000&&!m.finished;i++){m.step();assert.ok(Number.isFinite(m.ball.x)&&Number.isFinite(m.ball.z));}
  assert.ok(m.finished,JSON.stringify({seed,home,away,variant}));
  assert.ok(m.flow.intentDecisions>0);
  const f=m.flow;
  if(variant!=='legacy')assert.equal(f.freeKicks.clearanceViolations,0);
  rows.push({seed,variant,systems:[home,away],score:m.score,stats:m.stats.map(t=>({shots:t.shots,passes:t.completed,tackles:t.tackles,interceptions:t.interceptions,possession:t.possession})),freeKicks:f.freeKicks,entries:f.finalThirdEntries,created:f.createdShots,crowding:f.crowdedTicks/Math.max(1,f.shapeTicks)});
 }
 assert.equal(rows.length,144);writeFileSync('tournament-'+seed+'.json',JSON.stringify(rows));
 console.log('SHARD_COMPLETE '+seed+' '+rows.length);
 console.log('SHARD_SUMMARY '+JSON.stringify(aggregate(rows)));
}
