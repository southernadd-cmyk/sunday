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
 function canActivate(){return sim.matchState==='play'&&!sim.setPieceType&&!drop;}
 function activate(id,target){
  const def=MUTATIONS[id];if(!def||used.has(id)||!canActivate())return false;
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
 function fall(p,h){if(sim.ball.owner===p)enterHole(h);const team=sim.getTeam?.(p.team);if(team?.receivingPlayer===p)team.receivingPlayer=null;resetPlayer(p);fallen.set(p,{x:h.x,y:h.y,until:tick+Math.round(2/dt)});p.isSentOff=true;zero(p);metrics.falls++;event(p.team+' '+p.role+' FELL IN!',p.team,'mutation');}
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
  if(giant&&!giant.isSentOff)for(const p of outfield())if(p!==giant&&push(p,giant,1.7)){p.x=clamp(p.x,.25,field.width-.25);p.y=clamp(p.y,lo+.25,hi-.25);zero(p);metrics.giantContacts++;}
  for(const h of geometry()){
   for(const p of outfield()){
    if(h.kind==='hole'&&dist(p,h)<h.r-.3){fall(p,h);continue;}
    if(h.kind==='bumper'&&push(p,h,h.r+.35*size(p))){zero(p);if(b.owner===p){clearBall();b.x=p.x;b.y=p.y;}}
   }
   if(!drop)collideBall(h,prev);
  }
  if(active.has('squeeze')){
   for(const p of sim.players)if(!p.isSentOff){const y=clamp(p.y,lo+.25,hi-.25);if(y!==p.y){p.y=y;p.vy=0;}}
   if(!drop&&(b.y<lo||b.y>hi)){if(b.owner)b.owner=null;b.y=clamp(b.y,lo+.03,hi-.03);b.vy=(b.y<field.centerY?1:-1)*Math.abs(b.vy)*.85;metrics.wallHits++;}
  }
 }
 function snapshot(project){return {canActivate:canActivate(),active:[...active.values()].map(e=>({id:e.id,player:e.player?sim.players.indexOf(e.player):null,seconds:Math.max(0,(e.until-tick)*dt)})),used:[...used],geometry:geometry().map(h=>({...project(h),radius:h.r/field.height*68,depthRadius:h.r/field.width*94,kind:h.kind})),squeeze:active.has('squeeze'),ballHidden:!!drop,fallen:[...fallen.keys()].map(p=>sim.players.indexOf(p)),metrics:{...metrics}};}
 return {activate,before,after,snapshot,metrics,limits,active,fallen,used,recoverAll(){for(const [p,f] of fallen)recover(p,f);},shot(p){if(p?.sundayMutationShot>1)metrics.cannonShots++;}};
}

// Environmental sandbox: one placement per equipped effect, reusable after its
// duration plus a recovery window. Legacy mutations remain only for lab tests.
export const ENVIRONMENT=Object.freeze({
 lightning:{name:'STORM',detail:'Cloud strikes blue outfield players; briefly stuns them.',radius:5,duration:7,cooldown:5,color:[.98,.80,.30,1],art:['011110','111111','011100','001100','011000','010000']},
 snow:{name:'SNOW',detail:'Ice preserves momentum; both teams overshoot turns.',radius:7,duration:10,cooldown:4,color:[.78,.91,1,1],art:['101101','011110','111111','111111','011110','101101']},
 sinkhole:{name:'HOLE',detail:'Swallows low balls and outfield players.',radius:3.2,duration:10,cooldown:5,color:[.65,.50,.30,1],art:['011110','100001','101101','101101','100001','011110']},
 hill:{name:'HILL',detail:'Slope rolls the loose ball downhill and slows uphill runs.',radius:6,duration:10,cooldown:4,color:[.67,.83,.39,1],art:['000100','001110','011110','011111','111111','111111']},
 wall:{name:'WALL',detail:'Solid cross-pitch barrier redirects runs and low balls.',radius:5,duration:8,cooldown:5,color:[.78,.78,.71,1],art:['111111','100101','111111','101001','111111','100101']},
 wind:{name:'WIND',detail:'Gust pushes loose balls toward your attacking end.',radius:7,duration:8,cooldown:4,color:[.56,.87,.83,1],art:['111100','000110','111111','000011','111110','000000']},
 mud:{name:'MUD',detail:'Sticky ground slows both teams and stops loose balls.',radius:6,duration:10,cooldown:4,color:[.73,.48,.31,1],art:['011100','111110','110111','011111','111110','001100']},
 pinball:{name:'BUMPER',detail:'Two solid posts rebound low balls and obstruct runs.',radius:4,duration:10,cooldown:4,color:[.96,.54,.64,1],art:['011000','111100','011000','000110','001111','000110']}
});
export const ENVIRONMENT_GRAPH=Object.freeze([
 {a:'lightning',b:'snow',kind:'amplify',detail:'Frozen ground extends strike radius.'},
 {a:'lightning',b:'mud',kind:'amplify',detail:'Stunned opponents stay down longer in mud.'},
 {a:'lightning',b:'wall',kind:'setup',detail:'Stop runners in a blocked channel.'},
 {a:'lightning',b:'sinkhole',kind:'setup',detail:'Leave a loose ball beside the hole.'},
 {a:'snow',b:'hill',kind:'amplify',detail:'Icy slopes accelerate downhill rolls.'},
 {a:'snow',b:'wall',kind:'amplify',detail:'Icy rebounds retain more speed.'},
 {a:'snow',b:'pinball',kind:'setup',detail:'Longer sliding approaches feed rebounds.'},
 {a:'snow',b:'mud',kind:'counter',detail:'Mud cancels ice momentum in the overlap.'},
 {a:'hill',b:'sinkhole',kind:'setup',detail:'Downhill roll into a hole placed beside the hill.'},
 {a:'hill',b:'wall',kind:'setup',detail:'Deflect rolling balls off a barrier.'},
 {a:'hill',b:'wind',kind:'amplify',detail:'Gust adds to the slope acceleration.'},
 {a:'hill',b:'mud',kind:'counter',detail:'Mud brakes rolling balls on the slope.'},
 {a:'wind',b:'sinkhole',kind:'setup',detail:'Push a loose ball toward a hole.'},
 {a:'wind',b:'wall',kind:'setup',detail:'Redirect a gust-driven ball across the pitch.'},
 {a:'wind',b:'pinball',kind:'setup',detail:'Feed a moving ball into the bumpers.'},
 {a:'wind',b:'mud',kind:'counter',detail:'Sticky ground resists gusts.'},
 {a:'wall',b:'sinkhole',kind:'setup',detail:'Use the rebound to feed a hole.'},
 {a:'wall',b:'pinball',kind:'setup',detail:'Create a ricochet corridor.'},
 {a:'wall',b:'mud',kind:'setup',detail:'Trap loose balls in a slow channel.'},
 {a:'mud',b:'sinkhole',kind:'setup',detail:'Slow runners trying to escape the hole.'},
 {a:'pinball',b:'sinkhole',kind:'setup',detail:'Bounce a low ball into the hole.'}
]);
export const DEFAULT_ENVIRONMENT=Object.freeze(['lightning','snow','sinkhole']);
export function validLoadout(ids){return Array.isArray(ids)&&ids.length===3&&new Set(ids).size===3&&ids.every(id=>Object.hasOwn(ENVIRONMENT,id));}
export function createEnvironment({sim,field,dt,event,resetPlayer,loadout=DEFAULT_ENVIRONMENT}){
 if(!validLoadout(loadout))throw Error('Choose exactly three distinct environmental effects');
 const equipped=[...loadout],legacy=createMutations({sim,field,dt,event,resetPlayer});
 // The native player update is skipped only during a storm stun. This prevents
 // stunned players from kicking or tackling before their position is restored.
 for(const p of sim.players)if(typeof p.update==='function'){const update=p.update;p.update=function(...args){if(!this.sundayStunned)return update.apply(this,args);};}
 const active=new Map(),ready=new Map(),used=new Set(),stunned=new Map(),motion=new Map();
 const metrics={activations:0,reuses:0,strikes:0,stuns:0,iceSteps:0,mudSteps:0,hillRolls:0,windRolls:0,wallHits:0,synergies:{}};
 let tick=0,previousPlayers=new Map();
 const ticks=s=>Math.round(s/dt);
 const isPlay=()=>sim.matchState==='play'&&!sim.setPieceType;
 const inZone=(id,p)=>{const e=active.get(id);return !!e&&dist(e,p)<=e.r;};
 const count=(a,b)=>{const k=[a,b].sort().join('+');metrics.synergies[k]=(metrics.synergies[k]||0)+1;};
 const canActivate=()=>isPlay()&&legacy.snapshot(p=>p).canActivate;
 const remaining=id=>Math.max(0,((ready.get(id)||0)-tick)*dt);
 function activate(id,target){
  if(!equipped.includes(id)||active.has(id)||remaining(id)>0||!canActivate()||!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))return false;
  const d=ENVIRONMENT[id],r=d.radius,x=clamp(target.x,Math.max(8,r+1),field.width-Math.max(8,r+1)),y=clamp(target.y,r+1,field.height-r-1);
  const e={id,x,y,r,until:tick+ticks(d.duration),nextStrike:tick+ticks(.45)};
  if(id==='sinkhole'||id==='pinball'){
   legacy.used.delete(id);
   if(!legacy.activate(id,{x,y}))return false;
  }else event(d.name+'!', 'A','mutation');
  if(used.has(id))metrics.reuses++;used.add(id);active.set(id,e);ready.set(id,e.until+ticks(d.cooldown));metrics.activations++;return true;
 }
 function unfreeze(p){p.sundayStunned=false;stunned.delete(p);}
 function recoverAll(){legacy.recoverAll();for(const p of stunned.keys())unfreeze(p);motion.clear();}
 function before(){
  tick++;
  for(const [id,e] of active)if(tick>=e.until){active.delete(id);if(id!=='sinkhole'&&id!=='pinball')event(ENVIRONMENT[id].name+' ENDED','A','mutation');}
  for(const [p,t] of stunned)if(tick>=t||!isPlay()||p.isSentOff)unfreeze(p);
  const proceed=legacy.before();
  previousPlayers=new Map(sim.players.map(p=>[p,{x:p.x,y:p.y}]));
  if(!isPlay())motion.clear();
  return proceed;
 }
 function strike(e){
  metrics.strikes++;e.flashUntil=tick+ticks(.20);
  const b=sim.ball;
  for(const p of sim.players){
   if(p.team!=='B'||p.role==='GK'||p.isSentOff||stunned.has(p))continue;
   const ice=inZone('snow',p),mud=inZone('mud',p),range=e.r*(ice?1.25:1);
   if(dist(p,e)>range)continue;
   if(ice)count('lightning','snow');if(mud)count('lightning','mud');
   stunned.set(p,tick+ticks(mud?2.5:1.8));p.sundayStunned=true;resetPlayer(p);zero(p);metrics.stuns++;
   if(b.owner===p){b.owner=null;b.x=p.x;b.y=p.y;b.vx=b.vy=b.vz=0;b.z=0;b.isShot=false;}
  }
  event('LIGHTNING STRIKE!', 'A','mutation');
 }
 function constrainPlayer(p,old){
  if(!old||p.isSentOff)return;
  if(stunned.has(p)){p.x=old.x;p.y=old.y;zero(p);return;}
  const dx=p.x-old.x,dy=p.y-old.y,ice=inZone('snow',p),mud=inZone('mud',p),hill=active.get('hill');
  let mx=dx,my=dy;
  if(ice&&!mud){const v=motion.get(p)||{x:dx,y:dy};mx=.62*dx+.38*v.x;my=.62*dy+.38*v.y;metrics.iceSteps++;}
  if(mud){mx*=.53;my*=.53;metrics.mudSteps++;if(ice)count('snow','mud');}
  if(hill&&dist(p,hill)<hill.r&&dist(p,hill)<dist(old,hill)){mx*=.76;my*=.76;}
  if(mx!==dx||my!==dy){p.x=clamp(old.x+mx,.2,field.width-.2);p.y=clamp(old.y+my,.2,field.height-.2);}
  motion.set(p,{x:mx,y:my});
  const w=active.get('wall');
  if(w&&Math.abs(p.y-w.y)<w.r+.35&&(Math.abs(p.x-w.x)<.65||(old.x-w.x)*(p.x-w.x)<0)){p.x=w.x+(old.x<=w.x?-.66:.66);zero(p);motion.delete(p);}
 }
 function after(prev){
  if(!isPlay())return;
  if(!active.size&&!stunned.size)return;
  const cloud=active.get('lightning');if(cloud&&tick>=cloud.nextStrike){strike(cloud);cloud.nextStrike=tick+ticks(2.4);}
  for(const p of sim.players)if(!p.isSentOff&&p.role!=='GK')constrainPlayer(p,previousPlayers.get(p));
  const b=sim.ball;if(b.owner?.sundayStunned){b.owner=null;b.vx=b.vy=b.vz=0;b.z=0;b.isShot=false;}
  if(!b.owner&&b.z<.65&&!legacy.snapshot(p=>p).ballHidden){
   const ice=inZone('snow',b),mud=inZone('mud',b),h=active.get('hill'),wind=active.get('wind'),w=active.get('wall');
   if(ice&&!mud){b.vx*=1.012;b.vy*=1.012;}
   if(h&&dist(b,h)<h.r){const d=Math.max(.25,dist(b,h)),a=dt*13*(ice&&!mud?1.7:1);b.vx+=(b.x-h.x)/d*a;b.vy+=(b.y-h.y)/d*a;metrics.hillRolls++;if(ice&&!mud)count('hill','snow');}
   if(wind&&dist(b,wind)<wind.r){b.vx+=(sim.isSecondHalf?.()?-1:1)*dt*9;metrics.windRolls++;if(h&&dist(b,h)<h.r)count('hill','wind');}
   if(mud){b.vx*=.88;b.vy*=.88;if(h&&dist(b,h)<h.r)count('hill','mud');if(wind&&dist(b,wind)<wind.r)count('mud','wind');}
   if(w&&(prev.x-w.x)*(b.x-w.x)<=0&&Math.abs(b.x-prev.x)>.0001){
    const t=clamp((w.x-prev.x)/(b.x-prev.x),0,1),y=prev.y+(b.y-prev.y)*t;
    if(Math.abs(y-w.y)<w.r){b.x=w.x+(prev.x<=w.x?-.18:.18);b.y=y;b.vx=-b.vx*(ice&&!mud?.98:.76);metrics.wallHits++;if(ice&&!mud)count('snow','wall');}
   }
   const v=Math.hypot(b.vx,b.vy);if(v>65){b.vx*=65/v;b.vy*=65/v;}
  }
  legacy.after(prev);
 }
 function snapshot(project){
  const base=legacy.snapshot(project);
  return {...base,loadout:equipped.slice(),used:[...used],canActivate:canActivate(),active:[...active.values()].map(e=>({id:e.id,seconds:Math.max(0,(e.until-tick)*dt)})),
   cooldowns:Object.fromEntries(equipped.map(id=>[id,remaining(id)])),
   geometry:[...base.geometry,...[...active.values()].filter(e=>e.id!=='sinkhole'&&e.id!=='pinball').map(e=>({...project(e),kind:e.id,radius:e.r/field.height*68,depthRadius:e.r/field.width*94,flash:(e.flashUntil||0)>tick}))],
   stunned:[...stunned.keys()].map(p=>sim.players.indexOf(p)),metrics:{...base.metrics,...metrics,synergies:{...metrics.synergies}}};
 }
 return {activate,before,after,snapshot,metrics,active,used,fallen:legacy.fallen,recoverAll,shot(){}};
}
