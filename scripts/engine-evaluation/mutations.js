// Prototype mutations use fixed simulation seconds, never wall-clock time.
// The same adapter runs unchanged if this controller is not constructed.
export const MUTATIONS=Object.freeze({
 giant:{name:'GIANT',target:'player',detail:'Triple size, wider ball reach and physical body blocks.'},
 turbo:{name:'TURBO',target:'player',detail:'Double movement speed for one player.'},
 cannon:{name:'CANNON FOOT',target:'player',detail:'Shots leave the boot at 2.2× speed.'},
 sinkhole:{name:'SINKHOLE',target:'pitch',detail:'A hole swallows low balls and outfield players.'},
 squeeze:{name:'SQUEEZE',target:'instant',detail:'Side boards close in to 60% of the pitch width.'},
 pinball:{name:'PINBALL',target:'pitch',detail:'Two solid bumpers reflect the ball and obstruct players.'}
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const zero=p=>{p.vx=0;p.vy=0;};
export function createMutations({sim,field,dt,event,resetPlayer}){
 let tick=0,drop=null;const active=new Map(),used=new Set(),fallen=new Map();
 const metrics={activations:0,falls:0,ballDrops:0,respawns:0,bumperHits:0,wallHits:0,giantContacts:0,cannonShots:0,turboTicks:0};
 const outfield=()=>sim.players.filter(p=>p.role!=='GK'&&!p.isSentOff);
 const size=p=>active.get('giant')?.player===p?3:1;
 function limits(){const inset=active.has('squeeze')?field.height*.20:0;return {lo:inset,hi:field.height-inset};}
 function clearBall(){const b=sim.ball;b.owner=null;b.vx=b.vy=b.vz=b.z=0;b.isShot=false;b.isThrowInFlight=false;b.offsideReceiver=null;b.offsideLineX=null;b.passFromX=null;b.passFromY=null;b.lastKicker=null;}
 function safePoint(x,y){
  const {lo,hi}=limits(),hazards=[...geometry()];
  const valid=p=>hazards.every(h=>dist(p,h)>h.r+1.2)&&outfield().every(q=>dist(p,q)>1);
  const choices=[];for(let radius of [3,5,8,12,18])for(let i=0;i<16;i++){const a=i*Math.PI/8;choices.push({x:clamp(x+Math.cos(a)*radius,2,field.width-2),y:clamp(y+Math.sin(a)*radius,lo+1,hi-1)});}
  return choices.find(valid)||{x:field.centerX,y:clamp(field.centerY,lo+1,hi-1)};
 }
 function geometry(){const out=[];for(const [id,e] of active)if(id==='sinkhole'||id==='pinball')out.push(...e.points);return out;}
 function activate(id,target){
  const def=MUTATIONS[id];if(!def||used.has(id)||sim.matchState!=='play'||sim.setPieceType||drop)return false;
  const e={id,until:tick+Math.round(10/dt)};
  if(def.target==='player'){
   if(!Number.isInteger(target))return false;const p=sim.players[target];if(!p||p.team!=='A'||p.role==='GK'||p.isSentOff)return false;e.player=p;
  }else if(def.target==='pitch'){
   if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))return false;
   const {lo,hi}=limits(),x=clamp(target.x,8,field.width-8),y=clamp(target.y,lo+4,hi-4);
   e.points=id==='sinkhole'?[{x,y,r:3.2,kind:'hole'}]:[{x,y:clamp(y-3.5,lo+2.4,hi-2.4),r:1.6,kind:'bumper'},{x:clamp(x+4,8,field.width-8),y:clamp(y+3.5,lo+2.4,hi-2.4),r:1.6,kind:'bumper'}];
  }
  active.set(id,e);used.add(id);metrics.activations++;event(def.name+'!', 'A','mutation');syncFlags();return true;
 }
 function syncFlags(){for(const p of sim.players){p.sundayMutationSize=size(p);p.sundayMutationSpeed=active.get('turbo')?.player===p?2:1;p.sundayMutationShot=active.get('cannon')?.player===p?2.2:1;}}
 function recover(p,f){const pos=safePoint(f.x,f.y);p.isSentOff=false;p.x=pos.x;p.y=pos.y;zero(p);resetPlayer(p);fallen.delete(p);metrics.respawns++;}
 function before(){
  tick++;
  for(const [id,e] of active)if(tick>=e.until){active.delete(id);event(MUTATIONS[id].name+' ENDED','A','mutation');}
  syncFlags();
  for(const [p,f] of fallen)if(tick>=f.until||sim.matchState!=='play')recover(p,f);
  if(drop){
   if(tick<drop.until)return false;
   const pos=safePoint(drop.x,drop.y);clearBall();sim.ball.x=pos.x;sim.ball.y=pos.y;sim.ball.prevX=pos.x;sim.ball.prevY=pos.y;drop=null;event('BALL BACK IN PLAY',null,'mutation');
  }
  if(active.get('turbo')&&!active.get('turbo').player.isSentOff)metrics.turboTicks++;
  return true;
 }
 function enterHole(h){if(drop)return;clearBall();sim.ball.x=h.x;sim.ball.y=h.y;drop={...h,until:tick+Math.round(.65/dt)};metrics.ballDrops++;event('BALL SWALLOWED!',null,'mutation');}
 function fall(p,h){if(sim.ball.owner===p)enterHole(h);fallen.set(p,{x:h.x,y:h.y,until:tick+Math.round(2/dt)});p.isSentOff=true;zero(p);metrics.falls++;event(p.team+' '+p.role+' FELL IN!',p.team,'mutation');}
 function push(p,o,r){const dx=p.x-o.x,dy=p.y-o.y,d=Math.hypot(dx,dy);if(d>=r)return false;const nx=d>.001?dx/d:0,ny=d>.001?dy/d:1;p.x=o.x+nx*r;p.y=o.y+ny*r;return true;}
 function collideBall(h,prev){
  const b=sim.ball;if(b.z>1.5||b.owner||drop)return;
  const dx=b.x-prev.x,dy=b.y-prev.y,den=dx*dx+dy*dy||1,u=clamp(((h.x-prev.x)*dx+(h.y-prev.y)*dy)/den,0,1),p={x:prev.x+dx*u,y:prev.y+dy*u};
  if(dist(p,h)>h.r+.12)return;
  if(h.kind==='hole'){if(b.z<.55)enterHole(h);return;}
  let nx=p.x-h.x,ny=p.y-h.y,d=Math.hypot(nx,ny);
  if(d<.01){nx=-b.vx;ny=-b.vy;d=Math.hypot(nx,ny);if(d<.01){nx=0;ny=1;d=1;}}nx/=d;ny/=d;
  const dot=b.vx*nx+b.vy*ny;if(dot>=0&&dist(b,h)>h.r)return;
  b.x=h.x+nx*(h.r+.15);b.y=h.y+ny*(h.r+.15);
  if(dot<0){b.vx=(b.vx-2*dot*nx)*1.08;b.vy=(b.vy-2*dot*ny)*1.08;const speed=Math.hypot(b.vx,b.vy);if(speed>65){b.vx*=65/speed;b.vy*=65/speed;}metrics.bumperHits++;}
 }
 function after(prev){
  if(sim.matchState!=='play'||sim.setPieceType||!active.size)return;
  const b=sim.ball,{lo,hi}=limits(),giant=active.get('giant')?.player;
  if(giant&&!giant.isSentOff)for(const p of outfield())if(p!==giant&&push(p,giant,1.7)){zero(p);metrics.giantContacts++;}
  for(const h of geometry()){
   for(const p of outfield()){
    if(h.kind==='hole'&&dist(p,h)<h.r-.3){fall(p,h);continue;}
    if(h.kind==='bumper'&&push(p,h,h.r+.35*size(p))){zero(p);if(b.owner===p){b.owner=null;b.x=p.x;b.y=p.y;zero(b);}}
   }
   if(!drop)collideBall(h,prev);
  }
  if(active.has('squeeze')){
   for(const p of sim.players)if(!p.isSentOff){const y=clamp(p.y,lo+.25,hi-.25);if(y!==p.y){p.y=y;p.vy=0;}}
   if(!drop&&(b.y<lo||b.y>hi)){if(b.owner)b.owner=null;b.y=clamp(b.y,lo+.03,hi-.03);b.vy=(b.y<field.centerY?1:-1)*Math.abs(b.vy)*.85;metrics.wallHits++;}
  }
 }
 function snapshot(project){return {active:[...active.values()].map(e=>({id:e.id,player:e.player?sim.players.indexOf(e.player):null,seconds:Math.max(0,(e.until-tick)*dt)})),used:[...used],geometry:geometry().map(h=>({...project(h),radius:h.r/field.height*68,depthRadius:h.r/field.width*94,kind:h.kind})),squeeze:active.has('squeeze'),ballHidden:!!drop,fallen:[...fallen.keys()].map(p=>sim.players.indexOf(p)),metrics:{...metrics}};}
 return {activate,before,after,snapshot,metrics,limits,active,fallen,used,shot(p){if(p?.sundayMutationShot>1)metrics.cannonShots++;}};
}
