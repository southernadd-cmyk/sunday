import test from 'node:test';
import assert from 'node:assert/strict';
import {ENVIRONMENT,ENVIRONMENT_GRAPH,validLoadout,createEnvironment} from '../scripts/engine-evaluation/mutations.js';
import {createSoccerMatch} from '../construct/scripts/engine.js';
const field={width:63.6,height:40.8,centerX:31.8,centerY:20.4},dt=.05;
function mock(loadout){
 const players=[{team:'A',role:'CF',x:20,y:20,update(){this.x+=1;}},{team:'B',role:'CF',x:30,y:20,update(){this.x+=1;}},{team:'B',role:'GK',x:2,y:20,update(){this.x+=1;}}];
 const ball={x:30,y:20,z:0,vx:0,vy:0,vz:0,owner:null};
 const sim={players,ball,matchState:'play',setPieceType:'',isSecondHalf:()=>false};
 const c=createEnvironment({sim,field,dt,event:()=>{},resetPlayer:()=>{},loadout});
 return {c,sim,players,ball};
}
const pos={x:30,y:20};
test('eight connected effects, 21 unique edges and 56 possible three-effect hands',()=>{
 const ids=Object.keys(ENVIRONMENT),keys=new Set();
 assert.equal(ids.length,8);assert.equal(ENVIRONMENT_GRAPH.length,21);
 for(const e of ENVIRONMENT_GRAPH){assert.ok(ids.includes(e.a)&&ids.includes(e.b)&&e.a!==e.b);const k=[e.a,e.b].sort().join('+');assert.ok(!keys.has(k));keys.add(k);}
 assert.ok(ids.every(id=>ENVIRONMENT_GRAPH.some(e=>e.a===id||e.b===id)));
 let count=0;for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)for(let k=j+1;k<8;k++){assert.ok(validLoadout([ids[i],ids[j],ids[k]]));count++;}
 assert.equal(count,56);assert.ok(!validLoadout(['giant','snow','wall']));assert.ok(!validLoadout(['snow','snow','wall']));
});
test('storm affects opponents only, skips native update, ice amplifies its strike radius',()=>{
 const {c,players,ball}=mock(['lightning','snow','mud']);
 players[0].x=30;players[1].x=35.8;players[2].x=30;ball.owner=players[1];
 assert.ok(c.activate('lightning',pos));assert.ok(c.activate('snow',pos));
 for(let i=0;i<9;i++){c.before();c.after({x:ball.x,y:ball.y});}
 assert.equal(players[0].sundayStunned,undefined);assert.equal(players[2].sundayStunned,undefined);assert.equal(players[1].sundayStunned,true);assert.equal(ball.owner,null);
 assert.ok(c.metrics.synergies['lightning+snow']>0);const x=players[1].x;players[1].update();assert.equal(players[1].x,x);
 for(let i=0;i<37;i++)c.before();assert.equal(players[1].sundayStunned,false);players[1].update();assert.equal(players[1].x,x+1);
});
test('only equipped effects are allowed, cooldowns are finite and permit repeated uses',()=>{
 const {c}=mock(['lightning','snow','sinkhole']);
 assert.ok(!c.activate('wall',pos));assert.ok(!c.activate('giant',0));
 assert.ok(c.activate('snow',pos));assert.ok(!c.activate('snow',pos));
 for(let i=0;i<200;i++)c.before();assert.ok(!c.activate('snow',pos));
 for(let i=0;i<80;i++)c.before();assert.ok(c.activate('snow',pos));assert.equal(c.metrics.reuses,1);
});
test('snow carries momentum; hill and wind combine; mud cancels ice',()=>{
 const {c,players,ball}=mock(['snow','hill','wind']);
 assert.ok(c.activate('snow',pos));assert.ok(c.activate('hill',pos));assert.ok(c.activate('wind',pos));
 players[0].x=29;players[0].y=20;c.before();players[0].x=30;c.after({x:30,y:20});
 c.before();players[0].y+=1;ball.x=32;ball.vx=0;c.after({x:32,y:20});
 assert.ok(players[0].x>30);assert.ok(ball.vx>0);assert.ok(c.metrics.synergies['hill+snow']>0);assert.ok(c.metrics.synergies['hill+wind']>0);
 const m=mock(['snow','mud','wall']);m.players[0].x=30;m.players[0].y=20;m.c.activate('snow',pos);m.c.activate('mud',pos);m.c.before();m.players[0].x++;m.c.after({x:30,y:20});
 assert.ok(m.players[0].x<31);assert.ok(m.c.metrics.synergies['mud+snow']>0);
});
test('walls rebound a fast low ball and block crossing players',()=>{
 const {c,players,ball}=mock(['wall','snow','sinkhole']);assert.ok(c.activate('wall',pos));assert.ok(c.activate('snow',pos));
 players[0].x=28;c.before();players[0].x=32;
 Object.assign(ball,{x:33,y:20,z:0,vx:25,vy:0});c.after({x:27,y:20});
 assert.ok(ball.vx<0);assert.ok(ball.x<30);assert.ok(players[0].x<30);assert.equal(c.metrics.wallHits,1);assert.ok(c.metrics.synergies['snow+wall']>0);
});
test('eight native environment loadouts complete matches with repeated overlapping effects',async()=>{
 const ids=Object.keys(ENVIRONMENT),reports=[];
 for(let i=0;i<ids.length;i++){
  const loadout=[ids[i],ids[(i+1)%8],ids[(i+3)%8]];
  const m=await createSoccerMatch(12345+i,[],0,90,5,'intent',['diamond','diamond'],{environment:loadout,testHooks:true,adaptiveOpponent:true});
  let max=0;for(let n=0;n<20000&&!m.finished;n++){
   if(m.mutations.canActivate)for(const id of loadout)if(m.mutations.cooldowns[id]===0){
    const opponent=m.actors.find(a=>a.side===1&&a.role==='CF'&&a.visible),p=opponent||m.ball;
    m.activateMutation(id,{x:p.x,z:p.z});
   }
   m.step();max=Math.max(max,m.mutations.active.length);
   assert.ok(Number.isFinite(m.ball.x)&&Number.isFinite(m.ball.z));assert.ok(m.actors.every(a=>Number.isFinite(a.x)&&Number.isFinite(a.z)&&a.size===1));
  }
  assert.ok(m.finished,loadout.join(','));assert.ok(max>=2);assert.ok(m.mutations.metrics.reuses>0);reports.push({loadout,score:m.score,metrics:m.mutations.metrics});
 }
 console.log('ENVIRONMENT_MATCHES '+JSON.stringify(reports));
});
