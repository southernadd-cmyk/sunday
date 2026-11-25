// Native Construct presentation for the current five-a-side Soccer-JS engine.
// All playing surfaces, sprites, text and hit targets are Construct objects.
import {createSoccerMatch,SOCCER_STEP,ENVIRONMENT,ENVIRONMENT_GRAPH,DEFAULT_ENVIRONMENT} from './engine.js';
const C={navy:[.055,.085,.105,1],panel:[.10,.15,.16,1],cream:[.94,.91,.77,1],muted:[.57,.64,.60,1],gold:[1,.80,.30,1],red:[.88,.27,.22,1],blue:[.27,.49,.83,1],clear:[0,0,0,0],line:[.34,.43,.39,1],green:[.19,.35,.26,1]};
const rgb=c=>c.slice(0,3),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const randomSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const mix=(a,b,t)=>a+(b-a)*t;
export const ARCADE_RATE=1.5;
export function playerSpriteSize(scale,u,multiplier=1){return Math.max(2.15*scale,8.5*u)*multiplier;}
// Follow the ball with short velocity look-ahead, while keeping it in the visible central band.
export function cameraGoal(ball,previous,scale,playHeight){
 const half=playHeight/(2*scale),limit=Math.max(0,55-half);
 const lead=previous?clamp((ball.z-previous.z)*3,-half*.24,half*.24):0;
 return clamp(ball.z+lead,-limit,limit);
}
export const heading=(dx,dz,fallback=0)=>Math.hypot(dx,dz)<.025?fallback:(Math.round(Math.atan2(dx,-dz)/(Math.PI/4))+8)%8;
export function interpolatePose(previous,current,t,limit=10){
 if(!previous||previous.visible!==current.visible||Math.hypot(current.x-previous.x,current.z-previous.z)>limit)return {...current};
 t=clamp(t,0,1);return {...current,x:mix(previous.x,current.x,t),z:mix(previous.z,current.z,t),...(Number.isFinite(current.y)?{y:mix(previous.y??current.y,current.y,t)}:{})};
}
export function advanceStride(previous,actor,old,reset=false){
 const dx=old?actor.x-old.x:0,dz=old?actor.z-old.z:0,d=Math.hypot(dx,dz),moving=!reset&&d>=.025&&d<10;
 const dir=moving?heading(dx,dz,previous?.dir):previous?.dir??(actor.side===0?0:4);
 const stride=moving?((previous?.stride||0)+d/1.15)%4:previous?.stride||0;
 return {dir,stride,frame:dir*6+(actor.sliding?5:moving?1+Math.floor(stride):0)};
}
const POWERS=Object.entries(ENVIRONMENT).map(([id,p])=>({id,...p,type:'pitch'}));
export function gameLayout(v,u){
 const {left:L,top:T,width:W,height:H}=v;
 const cols=6,rows=1,small=H/u<430;
 const header=(small?34:42)*u,cardH=(small?40:51)*u,gap=2*u,bottom=cardH+19*u;
 const play={x:L,y:T+header,w:W,h:Math.max(1,H-header-bottom)};
 const scale=Math.max(.01,Math.min(W/88,play.h/40));
 return {cols,rows,header,cardH,gap,bottom,play,scale,cx:L+W/2};
}
export class Sunday{
 constructor(runtime){
  this.runtime=runtime;this.field=runtime.layout.getLayer('Pitch');this.hud=runtime.layout.getLayer('HUD');
  this.pitch=runtime.objects.Pitch.getFirstInstance();this.actors=[...runtime.objects.Footballer.instances()];
  this.ball=runtime.objects.Ball.getFirstInstance();this.ring=runtime.objects.StrikerRing.getFirstInstance();this.ghost=runtime.objects.Ghost.getFirstInstance();
  this.plans=runtime.objects.Plans.getFirstInstance();this.canvas=runtime.objects.HudCanvas.getFirstInstance();this.pickups=[...runtime.objects.Pickup.instances()];
  this.labels=[...runtime.objects.Label.instances()];this.tokens=[];this.labelCount=0;this.auto=null;this.drag=null;this.camera=0;
  runtime.framerateMode='vsync';this.resize();
  for(const c of [this.plans,this.canvas])c.addEventListener('resolutionchange',()=>this.refresh());
  runtime.addEventListener('resize',()=>this.resize());runtime.addEventListener('tick',()=>this.tick());
  runtime.addEventListener('pointerdown',e=>this.pointerDown(e));runtime.addEventListener('pointermove',e=>this.pointerMove(e));runtime.addEventListener('pointerup',e=>this.pointerUp(e));runtime.addEventListener('pointercancel',e=>{if(this.drag?.id===e.pointerId||e.pointerId===undefined)this.cancelDrag();});
  runtime.addEventListener('keydown',e=>this.key(e));runtime.addEventListener('resume',()=>{this.cancelDrag();if(this.auto)this.auto.last=performance.now();});
 }
 startDraft(seed=randomSeed()){
  this.auto={seed,phase:'draft',selected:[],last:performance.now()};this.drag=null;this.refresh();
 }
 async startAuto(seed=randomSeed(),loadout=DEFAULT_ENVIRONMENT){
  const s=this.auto={seed,phase:'loading',match:null,speed:ARCADE_RATE,paused:false,armed:null,halfSeen:false,acc:0,hud:0,last:performance.now(),message:''};this.camera=0;this.refresh();
  try{
   const m=await createSoccerMatch(seed,[],0,90,5,'intent',['diamond','diamond'],{environment:loadout,adaptiveOpponent:true});
   if(this.auto!==s)return;s.match=m;s.phase='match';s.last=performance.now();this.captureMotion(true);this.drawAuto(1);this.refresh();
  }catch(error){if(this.auto!==s)return;s.phase='error';s.message='Could not start match';console.error(error);this.refresh();}
 }
 exitAuto(){this.auto=null;this.drag=null;this.refresh();}
 resumeHalf(){const s=this.auto;if(s?.phase!=='halftime')return;s.phase='match';s.acc=0;s.last=performance.now();this.refresh();}
 advanceAuto(dt){
  const s=this.auto;if(!s||s.phase!=='match'||!s.match)return;
  const m=s.match;if(!s.paused&&!s.armed){
   s.acc+=Math.max(0,dt)*s.speed;
   while(s.acc>=SOCCER_STEP&&!m.finished){
    m.step();s.acc-=SOCCER_STEP;this.captureMotion();
    if(m.phase==='halftime'&&!s.halfSeen){s.halfSeen=true;s.phase='halftime';s.acc=0;break;}
   }
   if(m.finished){s.phase='result';s.armed=null;this.captureMotion(true);}
  }
  this.drawAuto(dt);s.hud+=dt;if(s.hud>=.1||s.phase!=='match'){s.hud=0;this.refresh();}
 }
 resize(){
  if(this.drag){this.drag=null;if(this.auto)this.auto.armed=null;}
  this.v=this.field.getViewport();const a=this.field.layerToCssPx(this.v.left,this.v.top),b=this.field.layerToCssPx(this.v.left+1,this.v.top);
  this.u=1/Math.max(.01,Math.abs(b[0]-a[0]));this.layout=gameLayout(this.v,this.u);this.scale=this.layout.scale;this.cx=this.layout.cx;
  for(const canvas of [this.plans,this.canvas]){canvas.x=this.v.left;canvas.y=this.v.top;canvas.width=this.v.width;canvas.height=this.v.height;}
  if(this.auto?.match)this.drawAuto(1);this.refresh();
 }
 point(p){const q=this.layout.play;return {x:this.cx+p.x*this.scale,y:q.y+q.h/2+(p.z-this.camera)*this.scale};}
 ground(x,y){const q=this.layout.play;return {x:(x-this.cx)/this.scale,z:(y-q.y-q.h/2)/this.scale+this.camera};}
 captureMotion(reset=false){
  const s=this.auto,m=s.match,prior=s.motion;
  const snap={phase:m.phase,hidden:m.mutations.ballHidden,actors:m.actors.map(a=>({...a})),ball:{...m.ball}};
  reset=reset||!prior||prior.current.phase!==snap.phase;
  const previous=reset?snap:prior.current,oldById=new Map(previous.actors.map(a=>[a.id,a]));
  const stride=new Map(snap.actors.map(a=>[a.id,advanceStride(prior?.stride.get(a.id),a,oldById.get(a.id),reset)]));
  s.motion={previous,current:snap,stride};
 }
 drawAuto(dt=.033){
  const s=this.auto,m=s?.match;if(!m)return;
  if(!s.motion)this.captureMotion(true);
  const {previous,current,stride}=s.motion,alpha=clamp(s.acc/SOCCER_STEP,0,1);
  const oldById=new Map(previous.actors.map(a=>[a.id,a]));
  this.visualActors=m.actors.map(a=>{
   const now=current.actors.find(p=>p.id===a.id)||a;
   return {...interpolatePose(oldById.get(a.id),now,alpha),size:a.size,visible:a.visible,stunned:a.stunned};
  });
  this.visualBall=current.hidden!==previous.hidden?{...m.ball}:interpolatePose(previous.ball,current.ball,alpha,18);
  const q=this.layout.play,limit=Math.max(0,55-q.h/(2*this.scale)),target=cameraGoal(current.ball,previous.ball,this.scale,q.h);
  if(!s.armed&&!s.paused)this.camera=clamp(this.camera+(target-this.camera)*(1-Math.exp(-Math.max(0,dt)*15)),-limit,limit);
  else this.camera=clamp(this.camera,-limit,limit);
  const origin=this.point({x:-44,z:-55});
  Object.assign(this.pitch,{x:origin.x,y:origin.y,width:88*this.scale,height:110*this.scale,angle:0,isVisible:true});
  for(const a of this.visualActors){
   let sprite=this.actors[a.id];if(!sprite){sprite=this.runtime.objects.Footballer.createInstance('Pitch',0,0);this.actors[a.id]=sprite;}
   const p=this.point(a),size=playerSpriteSize(this.scale,this.u,a.size||1),animation=['Home','Away','Keeper','Official'][a.team]||'Home';
   sprite.x=p.x;sprite.y=p.y;sprite.width=sprite.height=size;sprite.isVisible=a.visible!==false;
   if(sprite.animationName!==animation)sprite.setAnimation(animation);
   sprite.animationFrame=stride.get(a.id)?.frame||0;
  }
  for(let i=m.actors.length;i<this.actors.length;i++)this.actors[i].isVisible=false;
  for(const a of this.actors.filter(a=>a.isVisible).sort((a,b)=>a.y-b.y))a.moveToTop();
  const p=this.point(this.visualBall);this.ball.x=p.x;this.ball.y=p.y-this.visualBall.y*this.scale*.65;this.ball.width=this.ball.height=Math.max(3*this.u,.55*this.scale);this.ball.isVisible=!m.mutations.ballHidden;this.ball.moveToTop();
  this.drawPitchEffects();
 }
 pitchRect(x,y,w,h,c){const q=this.layout.play,L=this.v.left,T=this.v.top;const x1=Math.max(q.x,x),y1=Math.max(q.y,y),x2=Math.min(q.x+q.w,x+w),y2=Math.min(q.y+q.h,y+h);if(x2>x1&&y2>y1)this.plans.fillRect(x1-L,y1-T,x2-L,y2-T,c);}
 pitchDisk(x,y,rx,ry,c){const steps=16;for(let i=0;i<steps;i++){const v=-1+2*(i+.5)/steps,k=Math.sqrt(Math.max(0,1-v*v));this.pitchRect(x-rx*k,y+ry*(v-1/steps),2*rx*k,2*ry/steps+.3*this.u,c);}}
 drawPitchEffects(){
  this.plans.clearCanvas(C.clear);const m=this.auto?.match;if(!m)return;const scale=this.scale;
  if(m.mutations.squeeze){
   for(const side of [-1,1]){const a=this.point({x:side<0?-34:20.4,z:-47}),w=13.6*scale,h=94*scale;
    this.pitchRect(a.x,a.y,w,h,[.23,.24,.18,1]);const x=side<0?a.x+w-2*this.u:a.x;
    this.pitchRect(x,a.y,3*this.u,h,C.gold);
   }
  }
  for(const h of m.mutations.geometry){const p=this.point(h),rx=h.radius*scale,ry=h.depthRadius*scale;
   if(h.kind==='hole'){this.pitchDisk(p.x,p.y,rx*1.1,ry*1.1,[.28,.22,.13,1]);this.pitchDisk(p.x,p.y,rx,ry,[.025,.04,.035,1]);this.pitchDisk(p.x,p.y,rx*.65,ry*.62,[.005,.01,.01,1]);}
   else{this.pitchDisk(p.x,p.y,rx,ry,[.69,.28,.13,1]);this.pitchDisk(p.x,p.y,rx*.75,ry*.75,C.gold);this.pitchDisk(p.x,p.y,rx*.40,ry*.40,C.red);}
  }
  for(const a of this.visualActors||m.actors){if(!a.visible)continue;const p=this.point(a);if(a.turbo)this.pitchRect(p.x-4*this.u,p.y+1*this.u,8*this.u,2*this.u,C.gold);if(a.cannon)this.pitchRect(p.x-4*this.u,p.y+3*this.u,8*this.u,2*this.u,C.red);}
  if(this.auto.armed&&this.drag?.kind==='power'){
   const power=POWERS.find(p=>p.id===this.auto.armed),drop=this.dropTarget(power,this.drag.x,this.drag.y);
   if(power.type==='player'){
    for(const a of (this.visualActors||m.actors).filter(p=>p.side===0&&p.role!=='GK'&&p.visible)){
     const p=this.point(a);if(p.y>this.layout.play.y&&p.y<this.layout.play.y+this.layout.play.h){
      const chosen=drop?.value===a.id;
      this.plans.outlineEllipse(p.x-this.v.left,p.y-this.v.top,Math.max(12*this.u,3*scale*(a.size||1)),Math.max(8*this.u,1.6*scale*(a.size||1)),chosen?power.color:[.76,.82,.63,.8],(chosen?3:1)*this.u,false);
     }
    }
   }else if(drop&&power.id==='squeeze'){
    for(const side of [-1,1]){const p=this.point({x:side*20.4,z:-47});this.pitchRect(p.x-1.5*this.u,p.y,3*this.u,94*scale,[.49,.77,.88,.75]);}
   }else if(drop&&power.type==='pitch'){
    const p=this.point(drop.value),radius=power.id==='sinkhole'?5.33:2.67;
    this.plans.outlineEllipse(p.x-this.v.left,p.y-this.v.top,radius*scale*2,radius*scale*2,power.color,2*this.u,false);
   }
  }
 }
 label(text,x,y,width,height,size=14,color=C.cream,align='left'){
  let l=this.labels[this.labelCount];if(!l){l=this.runtime.objects.Label.createInstance('HUD',x,y);this.labels.push(l);}
  this.labelCount++;l.isVisible=true;l.x=x;l.y=y;l.width=Math.max(1,width);l.height=Math.max(1,height);l.text=String(text);l.sizePt=size*this.u*.75;l.fontColor=rgb(color);l.horizontalAlign=align;l.isBold=true;l.moveToTop();return l;
 }
 rect(x,y,w,h,color=C.navy,border=null){
  if(w<=0||h<=0)return;const L=this.v.left,T=this.v.top;
  this.canvas.fillRect(x-L,y-T,x-L+w,y-T+h,color);if(border)this.canvas.outlineRect(x-L,y-T,x-L+w,y-T+h,border,this.u);
 }
 icon(power,x,y,size,color=power.color){const d=size/6;for(let row=0;row<6;row++)for(let col=0;col<6;col++)if(power.art[row][col]==='1')this.rect(x+col*d,y+row*d,d+.15*this.u,d+.15*this.u,color);}
 refresh(){
  if(!this.v)return;this.canvas.clearCanvas(C.clear);this.tokens=[];this.labelCount=0;this.ring.isVisible=false;this.ghost.isVisible=false;for(const p of this.pickups)p.isVisible=false;
  if(this.auto?.match){this.drawPitchEffects();this.matchUi();}else{
   this.pitch.isVisible=false;this.ball.isVisible=false;for(const a of this.actors)a.isVisible=false;this.plans.clearCanvas(C.clear);if(this.auto?.phase==='draft')this.draftUi();else this.introUi();
  }
  for(let i=this.labelCount;i<this.labels.length;i++)this.labels[i].isVisible=false;
 }
 introUi(){
  const {left:L,top:T,width:W,height:H}=this.v,u=this.u,w=Math.min(W-20*u,480*u),x=L+(W-w)/2,k=Math.min(1,H/(310*u)),y=T+Math.max(8*u,(H-270*u*k)/2);
  this.rect(L,T,W,H,C.navy);
  const px=L+W*.12,py=T+H*.06,pw=W*.76,ph=H*.88;this.rect(px,py,pw,ph,[.09,.20,.15,1],[.18,.29,.21,1]);this.rect(px,py+ph*.49,pw,2*u,[.22,.34,.25,1]);
  this.canvas.outlineEllipse(W/2,H/2,Math.min(pw,ph)*.19,Math.min(pw,ph)*.19,[.22,.34,.25,1],u,false);
  this.rect(x-4*u,y-4*u,w+8*u,Math.min(H-8*u,270*u*k+8*u),C.navy);
  this.label('S U N D A Y',x,y,w,60*u*k,Math.min(49,W/u/8)*k,C.gold,'center');
  this.label('FIVE-A-SIDE  /  ANYTHING GOES',x,y+62*u*k,w,25*u*k,13*k,C.cream,'center');
  if(this.auto?.phase==='loading'){this.label('KICK OFF IN A MOMENT',x,y+120*u*k,w,30*u*k,16*k,C.gold,'center');return;}
  if(this.auto?.phase==='error'){this.label(this.auto.message,x,y+110*u*k,w,30*u*k,13*k,C.red,'center');this.label('TAP TO RETURN',x,y+160*u*k,w,30*u*k,14*k,C.gold,'center');return;}
  this.label('Football plays itself.\nChoose three forces of nature.\nDrag them onto the pitch; reuse after cooldown.\nTap the clock to pause; hold it to quit.',x,y+95*u*k,w,96*u*k,Math.min(13,W/u/28)*k,C.cream,'center');
  this.label('TAP ANYWHERE TO CHOOSE POWERS',x,y+199*u*k,w,30*u*k,16*k,C.gold,'center');
  this.label('THE LEISURE CENTRE CUP',x,y+238*u*k,w,20*u*k,11*k,C.muted,'center');
 }
 tokenDisc(cx,cy,r,color){
  // Cut-corner arcade token, not a rectangular card or button.
  for(let i=0;i<12;i++){const v=-1+2*(i+.5)/12,k=Math.sqrt(Math.max(0,1-v*v));this.rect(cx-r*k,cy+r*(v-1/12),2*r*k,2*r/12+.2*this.u,color);}
 }
 matchUi(){
  const s=this.auto,m=s.match,{left:L,top:T,right:R,bottom:B,width:W}=this.v,u=this.u,l=this.layout,q=l.play;
  const sec=Math.max(0,Math.min(5400,Math.floor(m.matchSeconds||0))),clock=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
  const compact=W/u<470;
  this.rect(L,T,W,l.header,C.navy);
  this.rect(L+5*u,T+5*u,4*u,l.header-10*u,C.red);this.rect(R-9*u,T+5*u,4*u,l.header-10*u,C.blue);
  this.label(compact?'SUN':'SUNDAY',L+13*u,T+7*u,W*.27,20*u,compact?11:14,C.cream);
  this.label(compact?'OPP':'OPPOSITION',R-W*.27-13*u,T+7*u,W*.27,20*u,compact?11:14,C.cream,'right');
  this.label(m.score.join('  -  '),L+W*.29,T,W*.42,24*u,21,C.gold,'center');
  this.label(clock+'  '+(m.half===2?'2ND':'1ST'),L+W*.30,T+21*u,W*.40,13*u,10,C.cream,'center');
  const hudY=q.y+q.h;this.rect(L,hudY,W,B-hudY,C.navy);this.rect(L,hudY,W,1*u,C.line);
  const armed=POWERS.find(p=>p.id===s.armed),state=m.mutations;
  const drop=armed&&this.drag?this.dropTarget(armed,this.drag.x,this.drag.y):null;
  const hint=armed?(drop?'RELEASE: '+armed.name:armed.type==='player'?'DRAG TO A RED PLAYER':'DRAG ONTO PITCH'):s.paused?'PAUSED · TAP CLOCK TO RESUME':s.message||(!state.canActivate?'WAIT FOR OPEN PLAY':state.used.length===0?'DRAG A POWER ONTO THE PITCH':m.events[0]?.text||'DRAG ANOTHER POWER');
  this.label(hint,L+3*u,hudY+1*u,W-6*u,16*u,Math.min(10,W/u/33),armed?C.gold:C.cream,'center');
  const hand=POWERS.filter(p=>state.loadout.includes(p.id)),cw=W/hand.length;
  hand.forEach((p,i)=>{
   const cx=L+(i+.5)*cw,y=hudY+17*u,active=state.active.find(a=>a.id===p.id),cooldown=state.cooldowns[p.id]||0,spent=cooldown>0&&!active,selected=s.armed===p.id,enabled=state.canActivate&&cooldown<=0&&s.phase==='match';
   const r=Math.min(14*u,cw*.33,l.cardH*.30),cy=y+r;
   const color=spent&&!active?C.muted:p.color;
   this.tokenDisc(cx,cy,r,selected?C.line:spent&&!active?[.12,.17,.17,1]:C.panel);
   this.tokenDisc(cx,cy,r-2*u,selected?[.20,.23,.18,1]:[.08,.12,.13,1]);
   if(!selected)this.icon(p,cx-r*.59,cy-r*.59,r*1.18,color);
   if(active)this.rect(cx-r,y+2*r+1*u,2*r*clamp(active.seconds/p.duration,0,1),2*u,p.color);
   this.label(active?(active.seconds/s.speed).toFixed(1)+'s':spent?'RECHARGE '+(cooldown/s.speed).toFixed(1)+'s':p.name,L+i*cw,y+2*r+3*u,cw,13*u,Math.max(8,Math.min(11,cw/u/7)),color,'center');
   this.tokens.push({id:p.id,x:L+i*cw,y:hudY+16*u,w:cw,h:l.cardH,enabled});
  });
  if(armed&&this.drag?.kind==='power'){
   const cx=clamp(this.drag.x,L+19*u,R-19*u),cy=clamp(this.drag.y-25*u,T+19*u,B-19*u),r=15*u;
   this.tokenDisc(cx,cy,r,drop?armed.color:C.muted);this.tokenDisc(cx,cy,r-2*u,C.navy);this.icon(armed,cx-r*.6,cy-r*.6,r*1.2);
  }
  if(s.phase==='halftime'||s.phase==='result'){
   this.tokens=[];this.rect(L,T,W,this.v.height,[.055,.085,.105,.96]);
   const k=Math.min(1,this.v.height/(265*u)),d=u*k,w=Math.min(W-24*u,430*u),x=L+(W-w)/2,y=T+Math.max(8*u,(this.v.height-230*d)/2),a=m.stats[0],b=m.stats[1];
   this.label(s.phase==='halftime'?'HALF TIME':m.score[0]>m.score[1]?'VICTORY':m.score[0]<m.score[1]?'DEFEAT':'FULL TIME · DRAW',x,y,w,45*d,28*k,C.gold,'center');
   this.label(m.score.join('  -  '),x,y+49*d,w,50*d,36*k,C.cream,'center');
   this.label('SHOTS   '+a.shots+'  /  '+b.shots+'\nPASSES   '+a.completed+'  /  '+b.completed+'\nDEPLOYMENTS   '+state.metrics.activations,x,y+104*d,w,73*d,13*k,C.cream,'center');
   this.label(s.phase==='halftime'?'TAP ANYWHERE FOR SECOND HALF':'TAP ANYWHERE TO PLAY AGAIN',x,y+192*d,w,28*d,14*k,C.gold,'center');
  }
 }
 dropTarget(power,x,y){
  const m=this.auto?.match,q=this.layout.play;if(!m||!power||!m.mutations.canActivate||m.mutations.cooldowns[power.id]>0||x<q.x||x>q.x+q.w||y<q.y||y>q.y+q.h)return null;
  const p=this.ground(x,y);
  if(Math.abs(p.x)>34||Math.abs(p.z)>47)return null;
  return {value:p};
 }
 cancelDrag(){
  this.drag=null;const s=this.auto;if(s?.armed){s.armed=null;s.last=performance.now();this.refresh();}
 }
 tick(){if(!this.auto)return;const now=performance.now(),dt=Math.min(.25,Math.max(0,(now-this.auto.last)/1000));this.auto.last=now;this.advanceAuto(dt);}
 pointerDown(e){
  if(this.drag||e.button!==undefined&&e.button!==0)return;
  const [x,y]=this.field.cssPxToLayer(e.clientX,e.clientY),s=this.auto;
  if(s?.phase==='draft'){
   const token=this.tokens.find(t=>x>=t.x&&x<=t.x+t.w&&y>=t.y&&y<=t.y+t.h);
   if(token)this.drag={kind:'draft',power:token.id,id:e.pointerId,startX:x,startY:y,x,y,moved:false};return;
  }
  if(s?.phase==='match'){
   const token=this.tokens.find(t=>t.enabled&&x>=t.x&&x<=t.x+t.w&&y>=t.y&&y<=t.y+t.h);
   if(token){this.drag={kind:'power',id:e.pointerId,power:token.id,x,y,startX:x,startY:y,moved:false};s.armed=token.id;s.message='';this.refresh();return;}
   if(y>=this.v.top&&y<=this.layout.play.y)this.drag={kind:'clock',id:e.pointerId,x,y,startX:x,startY:y,started:performance.now(),moved:false};
  }else if(!s||['halftime','result','error'].includes(s.phase))this.drag={kind:'screen',id:e.pointerId,x,y,startX:x,startY:y,moved:false};
 }
 pointerMove(e){
  const d=this.drag;if(!d||d.id!==e.pointerId)return;const [x,y]=this.field.cssPxToLayer(e.clientX,e.clientY);
  d.x=x;d.y=y;if(Math.hypot(x-d.startX,y-d.startY)>5*this.u)d.moved=true;
  if(d.kind==='power')this.refresh();
 }
 pointerUp(e){
  const d=this.drag;if(!d||d.id!==e.pointerId)return;
  const [x,y]=this.field.cssPxToLayer(e.clientX,e.clientY),s=this.auto;
  if(d.kind==='power'){
   const moved=d.moved||Math.hypot(x-d.startX,y-d.startY)>5*this.u;
   const drop=moved?this.dropTarget(POWERS.find(p=>p.id===d.power),x,y):null;
   const ok=drop&&s.match.activateMutation(d.power,drop.value);
   this.cancelDrag();if(ok){s.message='';this.drawAuto(0);this.refresh();}return;
  }
  this.drag=null;if(d.moved||Math.hypot(x-d.startX,y-d.startY)>5*this.u)return;
  if(d.kind==='draft'&&s?.phase==='draft'){
   if(s.selected.includes(d.power))s.selected=s.selected.filter(id=>id!==d.power);else s.selected.push(d.power);
   if(s.selected.length===3)this.startAuto(s.seed,s.selected);else this.refresh();return;
  }
  if(d.kind==='clock'&&s?.phase==='match'){
   if(performance.now()-d.started>750){this.exitAuto();return;}s.paused=!s.paused;s.last=performance.now();this.refresh();
  }else if(d.kind==='screen'){
   if(!s||s.phase==='result')this.startDraft();else if(s.phase==='halftime')this.resumeHalf();else if(s.phase==='error')this.exitAuto();
  }
 }
 key(e){if(e.repeat)return;const k=e.key.toLowerCase(),s=this.auto;if(k==='escape'){if(this.drag)this.cancelDrag();else this.exitAuto();return;}if(!s){if(k==='enter'||k===' ')this.startDraft();return;}if(k==='enter'&&s.phase==='halftime')this.resumeHalf();else if(k==='enter'&&s.phase==='result')this.startDraft();else if(k===' '&&s.phase==='match'){s.paused=!s.paused;this.refresh();}}
}
