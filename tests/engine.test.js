import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Run,ACTORS,STRIDE,GOAL,route,routeLength,along,distance,clone,defaultProfile,readProfile,saveProfile,purchase} from '../src/engine.js';
import {solveAttack} from '../scripts/balance.mjs';
const start=(seed=1)=>{const r=new Run(seed);r.start();return r;};
function openPitch(r,player={x:0,z:-28}){
 Object.assign(r.state.actors[0],player);r.state.ball={x:player.x+.5,z:player.z-1,y:.6};
 for(const a of r.state.actors)if(a.active)a.active=false;
 Object.assign(r.state.actors[14],{x:24,z:-45});
 r.intents=r.state.actors.map(a=>({x:a.x,z:a.z,id:a.id}));
}
function obstacle(r,index,p){Object.assign(r.state.actors[index],{...p,active:true});r.intents[index]={...p,id:index};}

test('a match starts frozen with twenty actors and finite resources',()=>{
 const r=start();assert.equal(r.phase,'planning');assert.equal(r.state.actors.length,ACTORS);assert.equal(r.state.beats,6);assert.equal(r.state.bursts,1);assert.equal(r.state.passes,1);assert.equal(r.lives,3);
});
test('routes stay on the pitch and cannot exceed the travel budget',()=>{
 const p=route({x:0,z:0},[{x:5,z:0},{x:5,z:-100},{x:100,z:0}],11);
 assert.ok(Math.abs(routeLength(p)-11)<1e-8);assert.deepEqual(along(p,100),p.at(-1));assert.deepEqual(p[1],{x:5,z:0});
 assert.deepEqual(route({x:0,z:0},[{x:NaN,z:2},{x:0,z:0}],11),[{x:0,z:0}]);
});
test('previewing plans never advances the clock, actors, resources or random seed',()=>{
 const r=start(),before=JSON.stringify(r);
 for(let i=0;i<10;i++)r.preview({kind:'run',path:[{x:-20+i,z:-12}]});
 assert.equal(JSON.stringify(r),before);
});
test('defender intentions are locked before an order is chosen',()=>{
 const r=start(),intents=clone(r.intents);
 r.preview({kind:'run',path:[{x:-25,z:-5}]});r.preview({kind:'run',path:[{x:25,z:-5}]});assert.deepEqual(r.intents,intents);
});
test('invalid orders cannot spend a turn or consume a sprint',()=>{
 const r=start(),before=JSON.stringify(r);
 assert.equal(r.commit({kind:'teleport'}).type,'invalid');assert.equal(r.commit({kind:'run',path:[]}).type,'invalid');
 assert.equal(r.commit({kind:'shot',target:{x:NaN}}).type,'invalid');assert.equal(r.commit({kind:'one-two',ally:14,path:[{x:0,z:-5}]}).type,'invalid');
 assert.equal(JSON.stringify(r),before);
});
test('a normal move advances all players together and spends exactly one turn',()=>{
 const r=start();openPitch(r,{x:0,z:0});r.intents[1]={x:-20,z:-25,id:1};
 const result=r.commit({kind:'run',path:[{x:0,z:-11}]});
 assert.equal(result.type,'move');assert.equal(r.state.actors[0].z,-11);assert.equal(r.state.actors[1].z,-25);assert.equal(r.state.beats,5);assert.equal(r.state.bursts,1);
 assert.equal(result.frames.length,61*STRIDE);assert.equal(result.count,61);
 assert.ok(Math.abs(result.frames[(result.count-1)*STRIDE+1]-r.state.actors[0].z)<1e-5);
});
test('a sprint has a longer route and is exhausted after one use',()=>{
 const r=start();openPitch(r,{x:0,z:0});const action={kind:'run',burst:true,path:[{x:30,z:0}]};
 assert.equal(r.preview(action).order.path.at(-1).x,18);r.commit(action);assert.equal(r.state.bursts,0);
 assert.equal(r.preview(action).valid,false);assert.equal(r.state.beats,5);
});
test('spatial contact causes a tackle even if the destination is otherwise clear',()=>{
 const r=start();openPitch(r,{x:0,z:0});obstacle(r,7,{x:0,z:-5});
 const action={kind:'run',path:[{x:0,z:-11}]},p=r.preview(action),result=r.commit(action);
 assert.equal(p.type,'tackle');assert.equal(result.type,p.type);assert.equal(result.hit,7);assert.equal(r.lives,2);assert.equal(r.phase,'setback');assert.ok(result.count<61);
});
test('a bent route can go around a defender instead of passing through him',()=>{
 const r=start();openPitch(r,{x:0,z:0});obstacle(r,7,{x:0,z:-5});
 const result=r.commit({kind:'run',path:[{x:-4,z:-2},{x:-4,z:-7},{x:0,z:-9}]});
 assert.equal(result.type,'move');assert.ok(r.state.actors[0].x<0);
});
test('a one-two lets the player pass a defender while the ball is away',()=>{
 const r=start();openPitch(r,{x:0,z:0});Object.assign(r.state.actors[1],{x:-10,z:-6});r.intents[1]={x:-10,z:-6,id:1};obstacle(r,7,{x:0,z:-5});
 const result=r.commit({kind:'one-two',ally:1,path:[{x:0,z:-10}]});
 assert.equal(result.type,'move');assert.equal(r.state.passes,0);assert.equal(r.state.actors[0].z,-10);
});
test('a defender in the outward passing lane intercepts a one-two',()=>{
 const r=start();openPitch(r,{x:0,z:0});Object.assign(r.state.actors[1],{x:-10,z:-6});r.intents[1]={x:-10,z:-6,id:1};obstacle(r,7,{x:-5,z:-3.5});
 assert.equal(r.commit({kind:'one-two',ally:1,path:[{x:0,z:-10}]}).type,'intercept');assert.equal(r.lives,2);
});
test('a clear shot scores from geometry with no random roll',()=>{
 const r=start();openPitch(r);const rng=r.rng,p=r.preview({kind:'shot',target:{x:5.8}}),result=r.commit({kind:'shot',target:{x:5.8}});
 assert.equal(p.type,'goal');assert.equal(result.type,'goal');assert.equal(r.rng,rng);assert.equal(r.phase,'goal');assert.equal(r.bank,20);assert.equal(r.goals,1);
 assert.equal(r.commit({kind:'shot',target:{x:5.8}}).type,'invalid');assert.equal(r.goals,1);
});
test('the keeper saves a centre shot when his actual position intersects it',()=>{
 const r=start();openPitch(r);Object.assign(r.state.actors[14],{x:0,z:-45});r.intents[14]={x:0,z:-45,id:14};
 assert.equal(r.preview({kind:'shot',target:{x:0}}).type,'save');assert.equal(r.preview({kind:'shot',target:{x:5.8}}).type,'goal');
});
test('a chip skips a midfield tackle but has to be learned first',()=>{
 const r=start();openPitch(r,{x:0,z:-15});r.buffs.shotRange=20;obstacle(r,7,{x:0,z:-30});
 assert.equal(r.preview({kind:'shot',target:{x:0},chip:true}).valid,false);
 assert.equal(r.preview({kind:'shot',target:{x:0}}).type,'tackle');r.buffs.chip=1;
 assert.equal(r.preview({kind:'shot',target:{x:0},chip:true}).type,'goal');
});
test('the last non-scoring turn exhausts the chance without trapping the game',()=>{
 const r=start();openPitch(r,{x:0,z:0});r.state.beats=1;
 assert.equal(r.commit({kind:'run',path:[{x:2,z:0}]}).type,'whistle');assert.equal(r.phase,'setback');assert.equal(r.lives,2);
 assert.equal(r.continue(),true);assert.equal(r.phase,'planning');assert.equal(r.state.beats,6);
});
test('rewind restores actual actors, legs, turn and consumables only once',()=>{
 const r=start();openPitch(r,{x:0,z:0});obstacle(r,7,{x:0,z:-5});const state=clone(r.state),intent=clone(r.intents);
 r.commit({kind:'run',burst:true,path:[{x:0,z:-18}]});assert.equal(r.lives,2);assert.equal(r.rewind(),true);
 assert.deepEqual(r.state,state);assert.deepEqual(r.intents,intent);assert.equal(r.lives,3);assert.equal(r.rewinds,0);assert.equal(r.rewind(),false);
});
test('rewards are unique, alter on-pitch rules and cannot be collected twice',()=>{
 const r=start();openPitch(r);r.commit({kind:'shot',target:{x:5.8}});assert.equal(r.rewind(),false);r.continue();
 assert.equal(r.phase,'pickup');assert.equal(new Set(r.offers).size,3);assert.equal(r.collect('unknown'),false);
 r.offers=['boots','wind','kev'];assert.equal(r.collect('boots'),true);assert.equal(r.runRange,14);assert.equal(r.fixtureIndex,1);assert.equal(r.collect('boots'),false);
});
test('four fixtures can be completed through the normal physics and reward flow',()=>{
 const r=start(3),p=defaultProfile();
 for(let fixture=0;fixture<4;fixture++){
  const plan=solveAttack(r);assert.ok(plan,`No route for fixture ${fixture}`);
  for(const action of plan)r.commit(action);assert.equal(r.phase,'goal');r.continue();
  if(fixture<3)r.collect(r.offers[0]);
 }
 assert.equal(r.phase,'champion');assert.equal(r.history.length,4);assert.equal(r.goals,4);assert.equal(r.bank,80);
 assert.equal(r.claim(p),true);assert.equal(r.claim(p),false);assert.equal(p.kitty,80);assert.equal(p.cups,1);
});
test('three lost chances end the run and still bank earlier goals once',()=>{
 const r=start(),p=defaultProfile();r.bank=20;
 for(let i=0;i<3;i++){openPitch(r,{x:0,z:0});obstacle(r,7,{x:0,z:-5});r.commit({kind:'run',path:[{x:0,z:-11}]});r.continue();}
 assert.equal(r.phase,'over');assert.equal(r.lives,0);assert.equal(r.claim(p),true);assert.equal(p.kitty,20);assert.equal(r.rewind(),false);
});
test('profile migration preserves earned kitty and caps old upgrades safely',()=>{
 const storage={getItem:key=>key==='sunday-profile'?'{"version":1,"kitty":145,"training":2,"warmup":1,"cups":1}':null};
 const p=readProfile(storage);assert.equal(p.version,2);assert.equal(p.kitty,145);assert.equal(p.training,2);assert.equal(p.cups,1);
 const r=new Run(1,p);r.start();assert.equal(r.runRange,12);assert.equal(r.state.bursts,2);
});
test('corrupt or denied storage recovers and purchases respect limits',()=>{
 assert.deepEqual(readProfile(null),defaultProfile());assert.deepEqual(readProfile({getItem:()=>'{broken'}),defaultProfile());assert.equal(saveProfile(null,defaultProfile()),false);
 const p={...defaultProfile(),kitty:100};assert.equal(purchase(p,'training'),true);assert.equal(p.kitty,65);assert.equal(purchase(p,'warmup'),true);assert.equal(purchase(p,'warmup'),false);assert.equal(purchase(p,'training'),false);
});
test('repeated previews and playback agree across a sweep of spatial plans',()=>{
 const base=start(8);
 for(let i=0;i<18;i++){
  const r=Object.assign(Object.create(Run.prototype),clone(base)),a=i*Math.PI/9;
  const order={kind:'run',burst:i%2===0,path:[{x:r.state.actors[0].x+Math.sin(a)*18,z:r.state.actors[0].z+Math.cos(a)*18}]};
  const p=r.preview(order),result=r.commit(order);assert.equal(p.type,result.type);assert.ok(distance(p.end,result.end.actors[0])<1e-7);
 }
});
