import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {Sunday,heading,advanceStride,interpolatePose,ARCADE_RATE,playerSpriteSize,cameraGoal} from '../construct/scripts/controller.js';

const json=p=>JSON.parse(readFileSync(new URL('../construct/'+p,import.meta.url)));

// A narrow contract double for documented Construct APIs. This verifies the
// adapter's inputs/state/coordinates, not GPU rendering or the editor loader.
function runtime({width=960,height=640,left=0,top=0,cssScale=1}={}){
 const layout=json('layouts/Saltmere.json'),handlers=new Map(),draws=[],types={};
 const viewport={left,top,right:left+width,bottom:top+height,width,height};
 const layer={getViewport:()=>viewport,layerToCssPx:(x,y)=>[(x-left)*cssScale,(y-top)*cssScale],cssPxToLayer:(x,y)=>[x/cssScale+left,y/cssScale+top]};
 for(const name of json('project.c3proj').objectTypes.items){
  const type=json('objectTypes/'+name+'.json'),instances=[];
  function create(data={}){
   const events=new Map(),i={...data.world,isVisible:true,opacity:1,text:data.properties?.text||'',fontColor:[1,1,1],sizePt:12,
    animationName:data.properties?.['initial-animation']||'Default',animationFrame:0,
    addEventListener:(name,fn)=>events.set(name,fn),moveToTop(){},
    setAnimation(name){assert.ok(type.animations.items.find(a=>a.name===name));this.animationName=name;},
    clearCanvas(color){assert.ok(color.length===4);},fillRect(...args){draws.push({kind:'fill',args});},outlineRect(...args){draws.push({kind:'outline',args});},
    line(...args){draws.push({kind:'line',args});},lineDashed(...args){draws.push({kind:'dash',args});},outlineEllipse(...args){draws.push({kind:'ellipse',args});}
   };
   instances.push(i);return i;
  }
  for(const l of layout.layers)for(const i of l.instances)if(i.type===name)create(i);
  types[name]={getFirstInstance:()=>instances[0],instances:()=>instances.values(),createInstance:(layer,x,y)=>create({world:{x,y}})};
 }
 return {objects:types,layout:{getLayer:()=>layer},addEventListener:(name,fn)=>handlers.set(name,fn),handlers,draws,layer,viewport};
}
test('native Construct package references existing types, scripts, layouts and original frames',()=>{
 const project=json('project.c3proj'),layout=json('layouts/Saltmere.json'),uids=new Set(),sids=new Set();
 assert.equal(project.runtime,'c3');assert.equal(layout.layers.length,2);
 assert.equal(layout.layers.flatMap(l=>l.instances).filter(i=>i.type==='Footballer').length,20);
 for(const name of project.objectTypes.items){
  const type=json('objectTypes/'+name+'.json');assert.equal(type.name,name);assert.ok(!sids.has(type.sid));sids.add(type.sid);
  for(const animation of type.animations?.items||[])for(const [i,frame] of animation.frames.entries()){
   const path=`images/${name.toLowerCase()}-${animation.name.toLowerCase()}-${String(i).padStart(3,'0')}.png`;
   const image=readFileSync(new URL('../construct/'+path,import.meta.url));assert.equal(image.readUInt32BE(16),frame.width);assert.equal(image.readUInt32BE(20),frame.height);
  }
 }
 for(const l of layout.layers)for(const i of l.instances){assert.ok(project.objectTypes.items.includes(i.type));assert.ok(!uids.has(i.uid));uids.add(i.uid);}
 for(const script of project.rootFileFolders.script.items)assert.ok(existsSync(new URL('../construct/scripts/'+script.name,import.meta.url)));
 assert.match(readFileSync(new URL('../construct/scripts/engine.js',import.meta.url),'utf8'),/38970e0dade0865078c9e84bc1ecfd72aaa02fde/);
 for(const name of ['main.js','controller.js','engine.js'])assert.equal(readFileSync(new URL('../construct/scripts/'+name,import.meta.url),'utf8'),readFileSync(new URL('../public/construct/scripts/project/'+name,import.meta.url),'utf8'));
 assert.match(readFileSync(new URL('../public/construct/index.html',import.meta.url),'utf8'),/Scirra Construct/);
});

async function start(g){await g.startAuto(12345);assert.equal(g.auto.phase,'match');assert.equal(g.auto.match.actors.length,10);assert.equal(g.actors.filter(a=>a.isVisible).length,10);assert.ok(g.auto.match.adaptiveOpponent);assert.ok(g.auto.match.mutations);}
function openPlay(g){for(let i=0;i<800&&!g.auto.match.mutations.canActivate;i++)g.advanceAuto(.05);assert.ok(g.auto.match.mutations.canActivate);}
function event(g,x,y,pointerId=1){const [clientX,clientY]=g.field.layerToCssPx(x,y);return {pointerId,button:0,clientX,clientY};}
function tap(g,x,y){const e=event(g,x,y);g.pointerDown(e);g.pointerUp(e);}
function grab(g,id){const t=g.tokens.find(t=>t.id===id);assert.ok(t?.enabled,id+' must be ready');const e=event(g,t.x+t.w/2,t.y+t.h/2);g.pointerDown(e);assert.equal(g.auto.armed,id);return e;}
function release(g,x,y){const e=event(g,x,y);g.pointerMove(e);g.pointerUp(e);}
function inBounds(g){assert.equal(g.buttons,undefined);for(const t of g.tokens){assert.ok(t.x>=g.v.left-1e-6&&t.x+t.w<=g.v.right+1e-6,t.id+' horizontal');assert.ok(t.y>=g.v.top-1e-6&&t.y+t.h<=g.v.bottom+1e-6,t.id+' vertical');}}
test('native title drafts exactly three environmental tokens before kickoff',async()=>{
 const g=new Sunday(runtime());assert.equal(g.tokens.length,0);assert.equal(g.buttons,undefined);
 tap(g,480,320);assert.equal(g.auto.phase,'draft');assert.equal(g.tokens.length,8);
 for(const id of ['lightning','snow','sinkhole']){const t=g.tokens.find(t=>t.id===id);tap(g,t.x+t.w/2,t.y+t.h/2);}
 assert.equal(g.auto.phase,'loading');for(let i=0;i<100&&g.auto.phase==='loading';i++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(g.auto.phase,'match');
 assert.equal(g.auto.match.actors.length,10);assert.equal(g.tokens.length,3);assert.deepEqual(g.auto.match.mutations.loadout,['lightning','snow','sinkhole']);
 tap(g,480,12);const time=g.auto.match.time;g.advanceAuto(2);assert.equal(g.auto.match.time,time);assert.equal(g.auto.paused,true);tap(g,480,12);assert.equal(g.auto.paused,false);
});
test('native pitch stays vertical, scrolls, and inverse coordinates round trip',async()=>{
 for(const opts of [{},{width:960,height:2000,left:130,top:-600,cssScale:.375},{width:960,height:540,cssScale:.65}]){
  const g=new Sunday(runtime(opts));await start(g);inBounds(g);assert.equal(g.pitch.angle,0);
  const p=g.point({x:10,z:12}),back=g.ground(p.x,p.y);assert.ok(Math.abs(back.x-10)<1e-6&&Math.abs(back.z-12)<1e-6);
  const old=g.camera;g.auto.match.ball.z=40;g.captureMotion(true);g.drawAuto(1);assert.ok(g.camera>=old);assert.equal(g.actors.filter(a=>a.isVisible).length,10);
 }
});
test('drag environmental tokens directly onto pitch, and invalid drops cost nothing',async()=>{
 for(const opts of [{},{width:960,height:2000,left:130,top:-600,cssScale:.375}]){
  const g=new Sunday(runtime(opts));await start(g);openPlay(g);const m=g.auto.match;
  const e=grab(g,'lightning'),t=m.time;g.advanceAuto(1);assert.equal(m.time,t);g.pointerUp(e);assert.equal(g.auto.armed,null);assert.equal(m.mutations.used.length,0);
  grab(g,'lightning');release(g,g.cx,g.layout.play.y+g.layout.play.h/2);assert.equal(g.auto.armed,null);assert.ok(m.mutations.used.includes('lightning'));
  grab(g,'snow');release(g,g.cx,g.layout.play.y+g.layout.play.h/2);assert.ok(m.mutations.active.length===2);
  grab(g,'sinkhole');release(g,g.cx,g.v.top);assert.ok(!m.mutations.used.includes('sinkhole'));assert.equal(g.auto.armed,null);
  grab(g,'sinkhole');g.runtime.handlers.get('pointercancel')({pointerId:1});assert.equal(g.auto.armed,null);assert.equal(g.drag,null);
  grab(g,'sinkhole');g.pointerUp(event(g,g.cx,g.v.top,2));assert.equal(g.auto.armed,'sinkhole');g.key({key:'Escape'});assert.equal(g.auto.armed,null);
  grab(g,'sinkhole');const point=g.point({x:0,z:Math.max(-30,Math.min(30,g.camera))});release(g,point.x,point.y);assert.ok(m.mutations.used.includes('sinkhole'));
  assert.ok(g.tokens.every(t=>!t.enabled));assert.ok(m.actors.every(a=>a.size===1));
 }
});
test('half-time and full-time use screen taps, not menu buttons',async()=>{
 const g=new Sunday(runtime({width:960,height:540,cssScale:.65}));await start(g);
 g.auto.speed=4;
 for(let i=0;i<200&&g.auto.phase==='match';i++)g.advanceAuto(1);
 assert.equal(g.auto.phase,'halftime');const t=g.auto.match.time;g.advanceAuto(100);assert.equal(g.auto.match.time,t);assert.equal(g.tokens.length,0);tap(g,480,270);
 for(let i=0;i<200&&g.auto.phase==='match';i++)g.advanceAuto(1);
 assert.equal(g.auto.phase,'result');assert.ok(g.auto.match.finished);assert.equal(g.tokens.length,0);g.key({key:'Escape'});assert.equal(g.auto,null);
});
test('cancelled asynchronous native match cannot overwrite a newer match',async()=>{
 const g=new Sunday(runtime());const first=g.startAuto(12345),old=g.auto;g.exitAuto();const second=g.startAuto(728),current=g.auto;await first;await second;
 assert.notEqual(old,current);assert.equal(g.auto,current);assert.equal(g.auto.seed,728);assert.equal(g.auto.phase,'match');
});

test('eight headings, stationary pose, distance-driven stride and slide frame',()=>{
 const vectors=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
 for(let i=0;i<8;i++){
  const [dx,dz]=vectors[i];assert.equal(heading(dx,dz),i);
  const old={x:0,z:0,side:0},moving={...old,x:dx,z:dz};
  const p=advanceStride(null,moving,old);assert.equal(p.dir,i);assert.ok(p.frame>=i*6+1&&p.frame<=i*6+4);
  assert.equal(advanceStride(p,moving,moving).frame,i*6);
  assert.equal(advanceStride(p,{...moving,sliding:true},moving).frame,i*6+5);
 }
});
test('render interpolation is continuous, clamps extrapolation and snaps teleports and hidden actors',()=>{
 const a={x:0,z:0,y:0,visible:true},b={x:3,z:6,y:2,visible:true};
 assert.deepEqual(interpolatePose(a,b,.5),{x:1.5,z:3,y:1,visible:true});
 assert.deepEqual(interpolatePose(a,b,2),b);assert.deepEqual(interpolatePose(a,b,-1),a);
 assert.deepEqual(interpolatePose(a,{...b,z:50},.5),{...b,z:50});
 assert.deepEqual(interpolatePose(a,{...b,visible:false},.5),{...b,visible:false});
});
test('native directional atlas contains all 192 distinct frame records with valid bounds',()=>{
 const project=json('objectTypes/Footballer.json'),data=JSON.parse(readFileSync(new URL('../public/construct/data.json',import.meta.url)));
 const native=data.project[3].find(o=>o[0]==='Footballer'),atlas=readFileSync(new URL('../public/construct/images/sunday-directional.png',import.meta.url)),width=atlas.readUInt32BE(16),height=atlas.readUInt32BE(20),slots=new Set(),ids=new Set();
 assert.equal(project.animations.items.length,4);
 for(const a of project.animations.items){
  assert.equal(a.frames.length,48);const frames=native[7].find(n=>n[0]===a.name)[7];assert.equal(frames.length,48);
  for(let i=0;i<48;i++){const f=frames[i],p=a.frames[i];assert.equal(f[0],'images/sunday-directional.png');assert.equal(f[1],atlas.length);assert.ok(f[2]>=0&&f[3]>=0&&f[2]+16<=width&&f[3]+16<=height);const key=f[2]+':'+f[3];assert.ok(!slots.has(key));slots.add(key);assert.ok(!ids.has(p.imageSpriteId));ids.add(p.imageSpriteId);}
 }
 assert.equal(slots.size,192);
});
test('fractional visual movement leaves the authoritative simulation untouched',async()=>{
 const g=new Sunday(runtime());await start(g);openPlay(g);
 const s=g.auto,m=s.match,initial=m.time;
 s.speed=1;s.acc=0;g.advanceAuto(.05);const authoritative=m.actors.map(a=>({...a}));const prev=g.visualActors.map(a=>({...a}));
 g.advanceAuto(.025);assert.ok(Math.abs(m.time-initial-.05)<1e-6);assert.deepEqual(m.actors,authoritative);
 const next=g.visualActors;for(let i=0;i<next.length;i++){assert.ok(Math.abs(next[i].x-(prev[i].x+authoritative[i].x)/2)<1e-6);assert.ok(Math.abs(next[i].z-(prev[i].z+authoritative[i].z)/2)<1e-6);}
});

test('arcade playback advances 50 percent more fixed steps without changing physics step size',async()=>{
 const g=new Sunday(runtime());await start(g);openPlay(g);const s=g.auto,m=s.match;
 assert.equal(s.speed,ARCADE_RATE);assert.equal(ARCADE_RATE,1.5);assert.equal(m.stepSeconds,.05);
 const original=m.step;let ticks=0;m.step=()=>{ticks++;original();};
 s.acc=0;for(let i=0;i<60;i++)g.advanceAuto(1/60);
 assert.ok(ticks===30||ticks===29,'expected approximately 30 fixed steps, got '+ticks);
 const before=ticks;g.auto.paused=true;g.advanceAuto(.5);assert.equal(ticks,before);g.auto.paused=false;
});
test('compact sprite sizing preserves giant multiplier and mobile minimum',()=>{
 for(const [scale,u] of [[10,1],[4,1],[960/88,1/.375],[8,1/.65]]){
  const size=playerSpriteSize(scale,u);assert.ok(size>=8.5*u);
  assert.ok(size<=Math.max(2.9*scale,10*u)*.86);
  assert.equal(playerSpriteSize(scale,u,3),size*3);
 }
});
test('camera predicts moving ball without overshooting pitch limits',()=>{
 const scale=8,h=320;
 assert.equal(cameraGoal({z:0},{z:0},scale,h),0);
 assert.ok(cameraGoal({z:6},{z:5},scale,h)>6);
 assert.ok(cameraGoal({z:-6},{z:-5},scale,h)<-6);
 assert.equal(cameraGoal({z:47},{z:40},scale,h),35);
 assert.equal(cameraGoal({z:-47},{z:-40},scale,h),-35);
 assert.equal(cameraGoal({z:40},{z:39},scale,1000),0);
});
