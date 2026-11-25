import assert from 'node:assert/strict';
import {SYSTEMS,ADAPTIVE_DWELL_SECONDS} from './five-tactics.js';
import {readFileSync,writeFileSync} from 'node:fs';
const ids=Object.keys(SYSTEMS);
if(process.argv[2]==='aggregate'){
 const rows=process.argv.slice(3).flatMap(p=>JSON.parse(readFileSync(p,'utf8')));
 assert.equal(rows.length,360);
 const pairs=new Map();
 for(const r of rows){const k=[r.seed,...r.start].join(':');const p=pairs.get(k)||{};p[r.adaptive?'adaptive':'fixed']=r;pairs.set(k,p);}
 assert.equal(pairs.size,180);
 const report={pairs:pairs.size,fixed:{wins:0,draws:0,losses:0,points:0,gf:0,ga:0,shots:0},adaptive:{wins:0,draws:0,losses:0,points:0,gf:0,ga:0,shots:0},changes:0,changedMatches:0,reasons:{},transitions:{},improved:0,worsened:0,unchanged:0};
 for(const p of pairs.values()){
  assert.ok(p.fixed&&p.adaptive);
  for(const key of ['fixed','adaptive']){
   const r=p[key],s=report[key],diff=r.score[1]-r.score[0];s[diff>0?'wins':diff<0?'losses':'draws']++;s.points+=diff>0?3:diff===0?1:0;s.gf+=r.score[1];s.ga+=r.score[0];s.shots+=r.shots[1];
  }
  const diff=(p.adaptive.score[1]-p.adaptive.score[0])-(p.fixed.score[1]-p.fixed.score[0]);report[diff>0?'improved':diff<0?'worsened':'unchanged']++;
  report.changedMatches+=+(p.adaptive.changes.length>0);
  for(const c of p.adaptive.changes){report.changes++;report.reasons[c.reason]=(report.reasons[c.reason]||0)+1;const k=c.from+'>'+c.to;report.transitions[k]=(report.transitions[k]||0)+1;}
 }
 console.log('ADAPTIVE_SUMMARY '+JSON.stringify(report));
 writeFileSync('adaptive-summary.json',JSON.stringify(report,null,2));
 assert.ok(report.changedMatches>=30,'Adaptation must operate in a meaningful number of fixtures');
 assert.ok(Object.keys(report.transitions).length>=4,'Multiple system transitions must occur');
 // Report actual effectiveness rather than pretending a manager always wins.
 // A substantial decline is a regression, not evidence of useful adaptation.
 assert.ok(report.adaptive.points>=report.fixed.points*.85,'Adaptive opponent must not suffer a major competitive regression');
}else{
 const {createSoccerMatch}=await import('../../construct/scripts/engine.js');
 const seed=Number(process.argv[2]);assert.ok(Number.isInteger(seed));const rows=[];
 for(const home of ids)for(const away of ids)for(const adaptiveOpponent of [false,true]){
  const m=await createSoccerMatch(seed,[],0,90,5,'intent',[home,away],{adaptiveOpponent});
  for(let i=0;i<20000&&!m.finished;i++){m.step();assert.ok(Number.isFinite(m.ball.x)&&Number.isFinite(m.ball.z));assert.equal(m.systems[0],home);}
  assert.ok(m.finished);assert.equal(m.flow.freeKicks.clearanceViolations,0);
  let last=-Infinity,prior=away;
  for(const c of m.flow.tacticalChanges){assert.ok(c.second-last>=ADAPTIVE_DWELL_SECONDS);assert.equal(c.from,prior);assert.notEqual(c.to,prior);last=c.second;prior=c.to;}
  assert.equal(m.systems[1],prior);if(!adaptiveOpponent)assert.equal(m.flow.tacticalChanges.length,0);
  rows.push({seed,start:[home,away],adaptive:adaptiveOpponent,score:m.score,shots:m.stats.map(t=>t.shots),reviews:m.flow.tacticalReviews,changes:m.flow.tacticalChanges});
 }
 assert.equal(rows.length,72);writeFileSync('adaptive-'+seed+'.json',JSON.stringify(rows));
}
