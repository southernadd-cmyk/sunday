// A small search policy for smoke-testing spatial layouts. It cannot alter a
// shot outcome: the plan is played through the ordinary deterministic rules.
import { Run, GOAL, distance } from '../src/engine.js';
const fork=r=>Object.assign(Object.create(Run.prototype),r,{before:null,lastResult:null});
export function candidates(r){
 const p=r.state.actors[0],actions=[-5.8,5.8].map(x=>({kind:'shot',target:{x,z:GOAL.z}}));
 if(r.buffs.chip)actions.push(...[-5.8,5.8].map(x=>({kind:'shot',target:{x,z:GOAL.z},chip:true})));
 const kinds=[{kind:'run',burst:false}];
 if(r.state.bursts)kinds.push({kind:'run',burst:true});
 if(r.state.passes)for(const ally of [1,2,3])if(distance(p,r.state.actors[ally])<=29)kinds.push({kind:'one-two',ally,burst:false});
 for(const mode of kinds){
  const range=r.runRange+(mode.burst?7:0)+(mode.kind==='one-two'?2:0);
  for(let a=0;a<8;a++){const angle=a/8*Math.PI*2;actions.push({...mode,path:[{x:p.x+Math.sin(angle)*range,z:p.z+Math.cos(angle)*range}]});}
 }
 return actions;
}
export function solveAttack(r,beam=12){
 let nodes=[{r:fork(r),path:[]}];
 for(let depth=0;depth<r.state.beats;depth++){
  const next=[];
  for(const node of nodes)for(const action of candidates(node.r)){
   const clean=node.r.normalise(action);if(clean.error)continue;
   const result=node.r.simulate(clean,false),path=[...node.path,action];
   if(result.type==='goal')return path;
   if(result.type!=='move')continue;
   const child=fork(node.r);child.state=result.end;child.intents=child.makeIntents();
   const p=child.state.actors[0];
   const room=Math.min(...child.state.actors.filter(a=>a.active).map(a=>distance(p,a)));
   next.push({r:child,path,score:distance(p,{x:0,z:GOAL.z})+Math.max(0,6-room)*2-child.state.passes*.6-child.state.bursts*.5});
  }
  const seen=new Set();nodes=next.sort((a,b)=>a.score-b.score).filter(n=>{const p=n.r.state.actors[0],key=[Math.round(p.x),Math.round(p.z),n.r.state.passes,n.r.state.bursts].join(',');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,beam);
  if(!nodes.length)break;
 }
 return null;
}
export function simulate(count=12){
 let wins=0;const lengths=[];
 for(let seed=1;seed<=count;seed++){
  const r=new Run(seed);r.start();let guard=0;
  while(!['champion','over'].includes(r.phase)&&guard++<30){
   if(r.phase==='planning'){
    const plan=solveAttack(r);if(!plan)break;
    lengths.push(plan.length);for(const action of plan)r.commit(action);
   }else if(['goal','setback'].includes(r.phase))r.continue();
   else if(r.phase==='pickup')r.collect(r.offers.find(id=>['boots','touch','wind','range'].includes(id))||r.offers[0]);
  }
  if(r.phase==='champion')wins++;
 }
 return {runs:count,completed:wins,shortestAttack:Math.min(...lengths),longestAttack:Math.max(...lengths),averageTurns:+(lengths.reduce((a,b)=>a+b,0)/lengths.length).toFixed(2)};
}
if(process.argv[1]?.endsWith('balance.mjs'))console.log(JSON.stringify(simulate(Number(process.argv[2])||12),null,2));
