import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {Sunday} from '../construct/scripts/controller.js';

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

test('title offers exactly Start Game and Instructions, with no legacy movement controls',async()=>{
 const g=new Sunday(runtime());assert.deepEqual(g.buttons.map(b=>b.label.text),['START GAME','INSTRUCTIONS']);
 click(g,'INSTRUCTIONS');click(g,'BACK');click(g,'START GAME');assert.equal(g.auto.phase,'draft');
 const id=g.auto.offers[0];await g.autoChoose(id);assert.deepEqual(g.auto.traits,[id]);assert.equal(g.auto.phase,'match');assert.equal(g.auto.match.upstream,'soccer-js');assert.equal(g.auto.match.actors.length,22);assert.equal(g.actors.filter(a=>a.isVisible).length,22);
 assert.ok(!g.buttons.some(b=>/PLAY 2s|SPRINT|TACKLE|SHOOT/.test(b.label.text)));
 const point=g.point({x:0,z:0}),[clientX,clientY]=g.field.layerToCssPx(point.x,point.y),ev={pointerId:1,button:0,clientX,clientY};
 g.pointerDown(ev);g.pointerUp(ev);assert.equal(g.drag,null);
 click(g,'PAUSE');const time=g.auto.match.time;g.advanceAuto(2);assert.equal(g.auto.match.time,time);click(g,'PLAY');click(g,'4×');
 for(let i=0;i<60&&g.auto.phase==='match';i++)g.advanceAuto(1);
 assert.equal(g.auto.phase,'result');assert.equal(g.auto.results.length,1);click(g,'DRAFT NEXT BEHAVIOUR');assert.equal(g.auto.phase,'draft');assert.ok(!g.auto.offers.includes(id));
 for(let round=1;round<=2;round++){
  await g.autoChoose(g.auto.offers[0]);assert.equal(g.auto.match.upstream,'soccer-js');assert.equal(g.auto.traits.length,round+1);
  for(let i=0;i<60&&g.auto.phase==='match';i++)g.advanceAuto(1);
  assert.equal(g.auto.phase,'result');assert.equal(g.auto.results.length,round+1);
  if(round===1)click(g,'DRAFT NEXT BEHAVIOUR');
 }
 click(g,'MAIN MENU');assert.equal(g.auto,null);
});
test('native autoplay controls remain in view on portrait and desktop',async()=>{
 for(const opts of [{},{width:960,height:2000,left:130,top:-600,cssScale:.375}]){
  const g=new Sunday(runtime(opts));click(g,'START GAME');await g.autoChoose(g.auto.offers[0]);
  for(const b of g.buttons)assert.ok(b.x>=g.v.left&&b.x+b.w<=g.v.right&&b.y>=g.v.top&&b.y+b.h<=g.v.bottom);
  assert.ok(g.actors.slice(0,22).every(a=>Number.isFinite(a.x)&&Number.isFinite(a.y)&&a.isVisible));
  assert.ok(!g.ring.isVisible);
 }
});

test('cancelled asynchronous match creation cannot overwrite a different career',async()=>{
 const g=new Sunday(runtime());g.startAuto();const first=g.auto;const pending=g.autoChoose(first.offers[0]);assert.equal(first.phase,'loading');
 g.exitAuto();g.startAuto();const second=g.auto;await pending;assert.equal(g.auto,second);assert.equal(second.phase,'draft');assert.equal(second.match,null);
});
