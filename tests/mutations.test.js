import test from 'node:test';
import assert from 'node:assert/strict';
import {MUTATIONS,createMutations} from '../scripts/engine-evaluation/mutations.js';
import {createSoccerMatch} from '../construct/scripts/engine.js';
const field={width:63.6,height:40.8,centerX:31.8,centerY:20.4};
const mock=()=>{
 const players=[{team:'A',role:'CF',x:10,y:10},{team:'B',role:'CB',x:45,y:35},{team:'A',role:'GK',x:2,y:20.4}];
 const ball={x:20,y:20,z:0,vx:0,vy:0,vz:0,owner:null};
 const sim={players,ball,matchState:'play',setPieceType:''};
 const c=createMutations({sim,field,dt:.05,event:()=>{},resetPlayer:()=>{}});
 return {c,sim,players,ball};
};
test('all six definitions, one use per match, legal targeting, overlapping expiry',()=>{
 const {c,players,sim}=mock();assert.equal(Object.keys(MUTATIONS).length,6);
 assert.equal(c.activate('giant',1),false);assert.equal(c.activate('giant',2),false);
 assert.equal(c.activate('giant',0),true);assert.equal(c.activate('giant',0),false);
 assert.equal(c.activate('turbo',0),true);assert.equal(c.activate('cannon',0),true);
 assert.equal(players[0].sundayMutationSize,3);assert.equal(players[0].sundayMutationSpeed,2);assert.equal(players[0].sundayMutationShot,2.2);
 for(let i=0;i<199;i++)c.before();
 assert.equal(c.active.size,3);c.before();assert.equal(c.active.size,0);
 for(const p of players){assert.equal(p.sundayMutationSize,1);assert.equal(p.sundayMutationSpeed,1);assert.equal(p.sundayMutationShot,1);}
 assert.equal(c.activate('turbo',0),false);
 sim.matchState='kickoff';assert.equal(c.activate('squeeze'),false);
});
test('sinkhole removes low ball and carrier then safely restores both',()=>{
 const {c,players,ball}=mock();
 assert.ok(c.activate('sinkhole',{x:30,y:20}));
 Object.assign(players[0],{x:30,y:20});ball.owner=players[0];Object.assign(ball,{x:30,y:20});
 c.after({x:29,y:20});assert.equal(c.metrics.falls,1);assert.equal(c.metrics.ballDrops,1);assert.equal(players[0].isSentOff,true);assert.equal(ball.owner,null);
 assert.equal(c.snapshot(p=>p).ballHidden,true);
 for(let i=0;i<42;i++)c.before();
 assert.equal(c.snapshot(p=>p).ballHidden,false);assert.equal(players[0].isSentOff,false);assert.equal(c.metrics.respawns,1);
 assert.ok(Math.hypot(ball.x-30,ball.y-20)>3.2);assert.ok(Math.hypot(players[0].x-30,players[0].y-20)>3.2);
});
test('high ball clears hole; giant displaces bodies; squeeze physically reflects',()=>{
 const {c,players,ball}=mock();
 assert.ok(c.activate('sinkhole',{x:30,y:20}));
 Object.assign(ball,{x:30,y:20,z:4,vx:12});c.after({x:26,y:20});assert.equal(c.metrics.ballDrops,0);
 assert.ok(c.activate('giant',0));Object.assign(players[0],{x:15,y:20});Object.assign(players[1],{x:15.5,y:20});c.after({x:30,y:20});
 assert.ok(Math.hypot(players[0].x-players[1].x,players[0].y-players[1].y)>=1.69);
 assert.ok(c.activate('squeeze'));Object.assign(ball,{x:10,y:1,z:0,vx:1,vy:-15});c.after({x:10,y:10});
 assert.ok(ball.y>=field.height*.20);assert.ok(ball.vy>0);assert.equal(c.metrics.wallHits,1);
});
test('pinball resolves swept high-speed impacts and clamps energy',()=>{
 const {c,ball}=mock();assert.ok(c.activate('pinball',{x:30,y:20}));
 const h=c.active.get('pinball').points[0];
 Object.assign(ball,{x:h.x+4,y:h.y,z:0,vx:50,vy:0});
 c.after({x:h.x-4,y:h.y});assert.equal(c.metrics.bumperHits,1);assert.ok(ball.vx<0);assert.ok(Math.hypot(ball.vx,ball.vy)<=65);
});
async function live(seed=12345,adaptiveOpponent=false){
 const m=await createSoccerMatch(seed,[],0,90,5,'intent',['diamond','diamond'],{mutations:true,testHooks:true,adaptiveOpponent});
 for(let i=0;i<400&&m.phase!=='play';i++)m.step();
 assert.equal(m.phase,'play');return m;
}
test('native movement and shot speed respond to player powers, then restore',async()=>{
 const m=await live();const {sim,controller,computeShootKick}=m.mutationTest;
 const id=sim.players.findIndex(p=>p.team==='A'&&p.role==='CF'),p=sim.players[id];
 const shot=computeShootKick(p).speed;
 const move=()=>{p.x=20;p.y=20;p._currentSpeed=0;for(let i=0;i<20;i++)p.moveTo({x:55,y:20},1);return p.x-20;};
 const ordinary=move();
 assert.ok(m.activateMutation('turbo',id));assert.ok(m.activateMutation('cannon',id));
 assert.ok(Math.abs(computeShootKick(p).speed/shot-2.2)<.02);
 const accelerated=move();assert.ok(accelerated>ordinary*1.6);
 assert.ok(m.activateMutation('giant',id));assert.equal(p.sundayMutationSize,3);
 for(let i=0;i<200;i++)controller.before();
 assert.equal(p.sundayMutationSize,1);assert.equal(p.sundayMutationSpeed,1);assert.equal(p.sundayMutationShot,1);
 assert.ok(Math.abs(computeShootKick(p).speed/shot-1)<.04);
});
test('seeded complete matches with all six overlapping powers and adaptive opponents',async()=>{
 const report=[];
 for(const seed of [12345,728,9921,1467,2781,88,329,918,47,81,73,29]){
  const m=await live(seed,true);const {sim,controller}=m.mutationTest;
  const id=sim.players.findIndex(p=>p.team==='A'&&p.role==='CF');
  for(const key of ['giant','turbo','cannon'])assert.ok(m.activateMutation(key,id));
  assert.ok(m.activateMutation('squeeze'));assert.ok(m.activateMutation('sinkhole',{x:0,z:0}));assert.ok(m.activateMutation('pinball',{x:10,z:-10}));
  for(let i=0;i<20000&&!m.finished;i++){m.step();assert.ok(Number.isFinite(m.ball.x)&&Number.isFinite(m.ball.z));assert.ok(m.actors.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));}
  assert.ok(m.finished,'match must finish '+seed);assert.equal(controller.active.size,0);assert.equal(controller.fallen.size,0);assert.equal(controller.metrics.activations,6);
  assert.ok(sim.players.every(p=>p.sundayMutationSize===1&&p.sundayMutationSpeed===1&&p.sundayMutationShot===1));
  report.push({seed,score:m.score,metrics:controller.metrics,changes:m.flow.tacticalChanges.length});
 }
 console.log('MUTATION_MATCHES '+JSON.stringify(report));
});
test('mutation-disabled replay preserves the original engine exactly',async()=>{
 async function play(options){const m=await createSoccerMatch(12345,[],0,90,5,'intent',['diamond','diamond'],options);for(let i=0;i<20000&&!m.finished;i++)m.step();assert.ok(m.finished);return {score:m.score,stats:m.stats,flow:m.flow};}
 assert.deepEqual(await play({mutations:false}),await play({}));
});
