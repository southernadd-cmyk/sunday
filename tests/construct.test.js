import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {Sunday} from '../construct/scripts/controller.js';
import {clone,distance} from '../src/engine.js';
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
function click(g,text){
 const b=[...g.buttons].reverse().find(b=>b.label.text===text);assert.ok(b,'Missing button: '+text);
 const [clientX,clientY]=g.field.layerToCssPx(b.x+b.w/2,b.y+b.h/2),event={pointerId:1,button:0,clientX,clientY};
 g.pointerDown(event);g.pointerUp(event);
}
function finish(g){assert.ok(g.anim);g.anim.elapsed=g.anim.duration;g.tick();assert.equal(g.busy,false);}

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
 assert.equal(readFileSync(new URL('../construct/scripts/engine.js',import.meta.url),'utf8'),readFileSync(new URL('../src/engine.js',import.meta.url),'utf8'));
 for(const name of ['main.js','controller.js','engine.js'])assert.equal(readFileSync(new URL('../construct/scripts/'+name,import.meta.url),'utf8'),readFileSync(new URL('../public/construct/scripts/project/'+name,import.meta.url),'utf8'));
 assert.match(readFileSync(new URL('../public/construct/index.html',import.meta.url),'utf8'),/Scirra Construct/);
});
test('Construct buttons pass possession to Kev, then call a return while running into space',()=>{
 const g=new Sunday(runtime());click(g,'STEP ONTO THE PITCH');click(g,'KEV');
 assert.equal(g.order.kind,'pass');assert.equal(g.preview.type,'move');click(g,'PLAY 2 SECONDS');finish(g);assert.equal(g.run.state.ballOwner,1);
 click(g,'CALL');g.key({key:'q'});assert.equal(g.order.kind,'call');click(g,'PLAY 2 SECONDS');finish(g);
 assert.equal(g.run.state.ballOwner,0);assert.ok(g.run.state.actors[0].z<0);assert.equal(g.run.lives,3);
});
test('one-two has an immediately playable suggested run and rewind restores possession and resources',()=>{
 const g=new Sunday(runtime());click(g,'STEP ONTO THE PITCH');g.key({key:'o'});
 assert.equal(g.order.kind,'one-two');assert.ok(g.order.path.length);assert.equal(g.preview.type,'move');
 const before=clone(g.run.state);click(g,'PLAY 2 SECONDS');finish(g);assert.equal(g.run.state.passes,0);g.key({key:'r'});
 assert.deepEqual(g.run.state,before);assert.equal(g.run.rewinds,0);
});
test('native hit regions and pooled labels stay finite in a portrait viewport with a shifted origin',()=>{
 const r=runtime({width:960,height:2000,left:130,top:-600,cssScale:.375}),g=new Sunday(r);click(g,'STEP ONTO THE PITCH');
 const range=clone(g.run.state);click(g,'KEV');assert.equal(g.order.kind,'pass');
 assert.deepEqual(g.run.state,range);assert.equal(g.narrow,true);
 for(const b of g.buttons){assert.ok([b.x,b.y,b.w,b.h].every(Number.isFinite));assert.ok(b.x>=r.viewport.left&&b.x+b.w<=r.viewport.right+.001);}
 const fill=r.draws.find(d=>d.kind==='fill');assert.ok(Math.abs(fill.args[0]-12*g.u)<1e-8);assert.ok(Math.abs(fill.args[1]-12*g.u)<1e-8);
 const created=g.labels.length;g.refresh();g.refresh();assert.equal(g.labels.length,created);
});
test('native pointer input plots a route and playback reaches the same ghost endpoint',()=>{
 const g=new Sunday(runtime());click(g,'STEP ONTO THE PITCH');const player=g.run.state.actors[0],target={x:player.x-5,z:player.z-8},p=g.point(target);
 const [clientX,clientY]=g.field.layerToCssPx(p.x,p.y),e={pointerId:1,button:0,clientX,clientY};g.pointerDown(e);g.pointerUp(e);
 assert.equal(g.order.kind,'run');const end={...g.preview.end};assert.equal(g.preview.type,'move');g.play();finish(g);assert.ok(distance(g.run.state.actors[0],end)<1e-8);
});
test('a learned dink is available on touch controls and cannot leak into a fresh run',()=>{
 const g=new Sunday(runtime());click(g,'STEP ONTO THE PITCH');g.run.buffs.chip=1;g.refresh();click(g,'DINK');assert.equal(g.chip,true);
 g.newRun();assert.equal(g.run.buffs.chip,0);assert.equal(g.chip,false);assert.ok(!g.buttons.some(b=>b.label.text==='DINK ON'));
});
