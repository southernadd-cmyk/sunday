// Native Construct presentation for the current five-a-side Soccer-JS engine.
// All playing surfaces, sprites, text and hit targets are Construct objects.
import {createSoccerMatch,SOCCER_STEP} from './engine.js';
const C={navy:[.055,.085,.105,1],panel:[.10,.15,.16,1],cream:[.94,.91,.77,1],muted:[.57,.64,.60,1],gold:[1,.80,.30,1],red:[.88,.27,.22,1],blue:[.27,.49,.83,1],clear:[0,0,0,0],line:[.34,.43,.39,1],green:[.19,.35,.26,1]};
const rgb=c=>c.slice(0,3),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const randomSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const POWERS=[
 {id:'giant',name:'GIANT',type:'player',color:[.80,.65,.94,1],hint:'Triple size & reach',art:['001100','011110','111111','001100','011110','010010']},
 {id:'turbo',name:'TURBO',type:'player',color:[.98,.86,.39,1],hint:'Double running speed',art:['000110','001100','011000','111111','001100','011000']},
 {id:'cannon',name:'CANNON',type:'player',color:[1,.48,.25,1],hint:'2.2× shot power',art:['000111','001110','011100','111000','010000','100000']},
 {id:'sinkhole',name:'SINKHOLE',type:'pitch',color:[.55,.78,.56,1],hint:'Swallow ball & players',art:['011110','100001','101101','101101','100001','011110']},
 {id:'squeeze',name:'SQUEEZE',type:'instant',color:[.49,.77,.88,1],hint:'Narrow pitch to 60%',art:['100001','110011','111111','111111','110011','100001']},
 {id:'pinball',name:'PINBALL',type:'pitch',color:[.96,.54,.64,1],hint:'Two physical bumpers',art:['011000','111100','011000','000110','001111','000110']}
];
export function gameLayout(v,u){
 const {left:L,top:T,width:W,height:H}=v;
 const cols=W/u>=650?6:3,rows=6/cols,small=H/u<430;
 const header=(small?38:49)*u,cardH=(small?42:55)*u,gap=3*u,bottom=(rows*cardH+(rows-1)*gap)+28*u;
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
  this.labels=[...runtime.objects.Label.instances()];this.buttons=[];this.labelCount=0;this.auto=null;this.drag=null;this.menuPage='main';this.camera=0;
  runtime.framerateMode='fixed';runtime.fixedFramerate=30;this.resize();
  for(const c of [this.plans,this.canvas])c.addEventListener('resolutionchange',()=>this.refresh());
  runtime.addEventListener('resize',()=>this.resize());runtime.addEventListener('tick',()=>this.tick());
  runtime.addEventListener('pointerdown',e=>this.pointerDown(e));runtime.addEventListener('pointermove',e=>this.pointerMove(e));runtime.addEventListener('pointerup',e=>this.pointerUp(e));runtime.addEventListener('pointercancel',()=>{this.drag=null;});
  runtime.addEventListener('keydown',e=>this.key(e));runtime.addEventListener('resume',()=>{if(this.auto)this.auto.last=performance.now();});
 }
 async startAuto(seed=randomSeed()){
  const s=this.auto={seed,phase:'loading',match:null,speed:1,paused:false,armed:null,halfSeen:false,acc:0,hud:0,last:performance.now(),message:''};this.camera=0;this.refresh();
  try{
   const m=await createSoccerMatch(seed,[],0,90,5,'intent',['diamond','diamond'],{mutations:true,adaptiveOpponent:true});
   if(this.auto!==s)return;s.match=m;s.phase='match';s.last=performance.now();this.drawAuto(1);this.refresh();
  }catch(error){if(this.auto!==s)return;s.phase='error';s.message='Could not start match';console.error(error);this.refresh();}
 }
 exitAuto(){this.auto=null;this.menuPage='main';this.drag=null;this.refresh();}
 resumeHalf(){const s=this.auto;if(s?.phase!=='halftime')return;s.phase='match';s.acc=0;s.last=performance.now();this.refresh();}
 advanceAuto(dt){
  const s=this.auto;if(!s||s.phase!=='match'||!s.match)return;
  const m=s.match;if(!s.paused&&!s.armed){
   s.acc+=Math.max(0,dt)*s.speed;
   while(s.acc>=SOCCER_STEP&&!m.finished){
    m.step();s.acc-=SOCCER_STEP;
    if(m.phase==='halftime'&&!s.halfSeen){s.halfSeen=true;s.phase='halftime';s.acc=0;break;}
   }
   if(m.finished){s.phase='result';s.armed=null;}
  }
  this.drawAuto(dt);s.hud+=dt;if(s.hud>=.1||s.phase!=='match'){s.hud=0;this.refresh();}
 }
 resize(){
  this.v=this.field.getViewport();const a=this.field.layerToCssPx(this.v.left,this.v.top),b=this.field.layerToCssPx(this.v.left+1,this.v.top);
  this.u=1/Math.max(.01,Math.abs(b[0]-a[0]));this.layout=gameLayout(this.v,this.u);this.scale=this.layout.scale;this.cx=this.layout.cx;
  for(const canvas of [this.plans,this.canvas]){canvas.x=this.v.left;canvas.y=this.v.top;canvas.width=this.v.width;canvas.height=this.v.height;}
  if(this.auto?.match)this.drawAuto(1);this.refresh();
 }
 point(p){const q=this.layout.play;return {x:this.cx+p.x*this.scale,y:q.y+q.h/2+(p.z-this.camera)*this.scale};}
 ground(x,y){const q=this.layout.play;return {x:(x-this.cx)/this.scale,z:(y-q.y-q.h/2)/this.scale+this.camera};}
 drawAuto(dt=.033){
  const m=this.auto?.match;if(!m)return;
  const q=this.layout.play,limit=Math.max(0,55-q.h/(2*this.scale)),target=clamp(m.ball.z,-limit,limit);
  if(!this.auto.armed)this.camera=clamp(this.camera+(target-this.camera)*(1-Math.exp(-Math.max(0,dt)*8)),-limit,limit);
  const origin=this.point({x:-44,z:-55});
  Object.assign(this.pitch,{x:Math.round(origin.x),y:Math.round(origin.y),width:88*this.scale,height:110*this.scale,angle:0,isVisible:true});
  for(let i=0;i<this.actors.length;i++)this.actors[i].isVisible=false;
  for(const a of m.actors){
   let sprite=this.actors[a.id];if(!sprite){sprite=this.runtime.objects.Footballer.createInstance('Pitch',0,0);this.actors[a.id]=sprite;}
   const p=this.point(a),size=Math.max(3.7*this.scale,12*this.u)*(a.size||1),animation=['Home','Away','Keeper','Official'][a.team]||'Home';
   sprite.x=Math.round(p.x);sprite.y=Math.round(p.y);sprite.width=sprite.height=size;sprite.isVisible=a.visible!==false;
   if(sprite.animationName!==animation)sprite.setAnimation(animation);sprite.animationFrame=a.frame%2;
  }
  for(const a of [...this.actors].sort((a,b)=>a.y-b.y))a.moveToTop();
  const p=this.point(m.ball);this.ball.x=Math.round(p.x);this.ball.y=Math.round(p.y-m.ball.y*this.scale*.65);this.ball.width=this.ball.height=Math.max(4*this.u,.8*this.scale);this.ball.isVisible=!m.mutations.ballHidden;this.ball.moveToTop();
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
  for(const a of m.actors){if(!a.visible)continue;const p=this.point(a);if(a.turbo)this.pitchRect(p.x-4*this.u,p.y+1*this.u,8*this.u,2*this.u,C.gold);if(a.cannon)this.pitchRect(p.x-4*this.u,p.y+3*this.u,8*this.u,2*this.u,C.red);}
  if(this.auto.armed&&POWERS.find(p=>p.id===this.auto.armed)?.type==='player'){
   for(const a of m.actors.filter(p=>p.side===0&&p.role!=='GK'&&p.visible)){const p=this.point(a);if(p.y>this.layout.play.y&&p.y<this.layout.play.y+this.layout.play.h)this.plans.outlineEllipse(p.x-this.v.left,p.y-this.v.top,Math.max(8*this.u,3*scale),Math.max(5*this.u,2*scale),C.gold,2*this.u,false);}
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
 button(text,x,y,w,h,action,enabled=true,primary=false){
  this.rect(x,y,w,h,primary?C.gold:C.panel,enabled?C.line:C.muted);
  const label=this.label(text,x+2*this.u,y+Math.max(0,(h-17*this.u)/2),w-4*this.u,19*this.u,12,primary?C.navy:enabled?C.cream:C.muted,'center');
  this.buttons.push({x,y,w,h,action,enabled,label});
 }
 icon(power,x,y,size){const d=size/6;for(let row=0;row<6;row++)for(let col=0;col<6;col++)if(power.art[row][col]==='1')this.rect(x+col*d,y+row*d,d+.15*this.u,d+.15*this.u,power.color);}
 refresh(){
  if(!this.v)return;this.canvas.clearCanvas(C.clear);this.buttons=[];this.labelCount=0;this.ring.isVisible=false;this.ghost.isVisible=false;for(const p of this.pickups)p.isVisible=false;
  if(this.auto?.match){this.drawPitchEffects();this.matchUi();}else{
   this.pitch.isVisible=false;this.ball.isVisible=false;for(const a of this.actors)a.isVisible=false;this.plans.clearCanvas(C.clear);this.introUi();
  }
  for(let i=this.labelCount;i<this.labels.length;i++)this.labels[i].isVisible=false;
 }
 introUi(){
  const {left:L,top:T,width:W,height:H}=this.v,u=this.u,w=Math.min(W-24*u,420*u),x=L+(W-w)/2,compact=H/u<400,k=Math.min(1,H/(370*u)),y=T+Math.max(8*u,(H-330*u*k)/2);
  this.rect(L,T,W,H,C.navy);
  // Floodlit pitch motif behind the title, all authored via native DrawingCanvas.
  const px=L+W*.12,py=T+H*.06,pw=W*.76,ph=H*.88;this.rect(px,py,pw,ph,[.09,.20,.15,1],[.18,.29,.21,1]);this.rect(px,py+ph*.49,pw,2*u,[.22,.34,.25,1]);
  this.canvas.outlineEllipse(L+W/2-L,T+H/2-T,Math.min(pw,ph)*.19,Math.min(pw,ph)*.19,[.22,.34,.25,1],u,false);
  this.rect(x-8*u,y-8*u,w+16*u,Math.min(H-16*u,330*u*k+16*u),C.navy);
  this.label('S U N D A Y',x,y,w,60*u*k,Math.min(49,W/u/8)*k,C.gold,'center');
  this.label('FIVE-A-SIDE  /  ANYTHING GOES',x,y+60*u*k,w,25*u*k,13*k,C.cream,'center');
  if(this.auto?.phase==='loading'){this.label('KICK OFF IN A MOMENT',x,y+120*u*k,w,30*u*k,16*k,C.gold,'center');return;}
  if(this.auto?.phase==='error'){this.label(this.auto.message,x,y+110*u*k,w,30*u*k,13*k,C.red,'center');this.button('BACK',x,y+160*u*k,w,38*u*k,()=>this.exitAuto());return;}
  if(this.menuPage==='help'){
   this.label('The teams play football automatically.\nPick a power, then target your player or pitch.\nTargeting freezes play. Stack powers for 10s.\nEach power can be used once per match.',x,y+100*u*k,w,122*u*k,compact?11:14,C.cream,'center');
   this.button('BACK',x,y+244*u*k,w,38*u*k,()=>{this.menuPage='main';this.refresh();});
  }else{
   this.button('START GAME',x,y+120*u*k,w,43*u*k,()=>this.startAuto(),true,true);
   this.button('INSTRUCTIONS',x,y+174*u*k,w,37*u*k,()=>{this.menuPage='help';this.refresh();});
   this.label('THE LEISURE CENTRE CUP',x,y+242*u*k,w,25*u*k,12*k,C.muted,'center');
  }
 }
 matchUi(){
  const s=this.auto,m=s.match,{left:L,top:T,right:R,bottom:B,width:W}=this.v,u=this.u,l=this.layout,q=l.play;
  const sec=Math.max(0,Math.min(5400,Math.floor(m.matchSeconds||0))),clock=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
  const compact=W/u<470,sideW=compact?56*u:100*u;
  this.rect(L,T,W,l.header,C.navy);this.rect(L,T+l.header-2*u,W,2*u,C.line);
  this.rect(L+5*u,T+5*u,5*u,l.header-12*u,C.red);this.rect(R-10*u,T+5*u,5*u,l.header-12*u,C.blue);
  this.label(compact?'SUN':'SUNDAY',L+15*u,T+5*u,sideW,18*u,compact?11:14,C.cream);
  this.label(compact?'OPP':'OPPOSITION',R-sideW-15*u,T+5*u,sideW,18*u,compact?11:14,C.cream,'right');
  this.label(m.score.join('  -  '),L+W*.30,T+1*u,W*.40,28*u,23,C.gold,'center');
  this.label(clock+'  '+(m.half===2?'2ND':'1ST'),L+W*.31,T+Math.min(26*u,l.header-13*u),W*.38,13*u,10,C.cream,'center');
  const actionW=compact?42*u:62*u,ay=T+Math.min(23*u,l.header-18*u),ah=Math.min(21*u,l.header-20*u);
  this.button(s.paused?'PLAY':'PAUSE',L+14*u,ay,actionW,ah,()=>{s.paused=!s.paused;this.refresh();},s.phase==='match');
  this.button(s.speed+'×',R-actionW-14*u,ay,actionW,ah,()=>{s.speed=s.speed===1?2:s.speed===2?4:1;this.refresh();},s.phase==='match');
  const hudY=q.y+q.h;this.rect(L,hudY,W,B-hudY,C.navy);this.rect(L,hudY,W,2*u,C.line);
  const armed=POWERS.find(p=>p.id===s.armed),state=m.mutations;
  const hint=armed?'TARGET: '+armed.name+'  /  '+(armed.type==='player'?'SELECT A RED PLAYER':'SELECT PITCH') : s.paused?'PAUSED':s.message||(!state.canActivate?'WAIT FOR OPEN PLAY':(m.events[0]?.text||'CHOOSE A POWER'));
  this.label(hint,L+8*u,hudY+4*u,W-78*u,19*u,11,armed?C.gold:C.cream);
  this.button(armed?'CANCEL':'MENU',R-65*u,hudY+3*u,59*u,19*u,()=>{if(s.armed){s.armed=null;s.message='';this.refresh();}else this.exitAuto();});
  const inset=5*u,cw=(W-2*inset-(l.cols-1)*l.gap)/l.cols;
  POWERS.forEach((p,i)=>{
   const x=L+inset+(i%l.cols)*(cw+l.gap),y=hudY+25*u+Math.floor(i/l.cols)*(l.cardH+l.gap),active=state.active.find(a=>a.id===p.id),spent=state.used.includes(p.id),selected=s.armed===p.id,enabled=state.canActivate&&!spent&&s.phase==='match';
   const border=selected?C.gold:spent&&!active?C.line:p.color;
   this.rect(x,y,cw,l.cardH,active?[.20,.25,.20,1]:selected?[.23,.20,.12,1]:C.panel,border);
   this.rect(x+1*u,y+1*u,cw-2*u,3*u,spent&&!active?C.line:p.color);
   const iconSize=Math.min(20*u,l.cardH-19*u,cw*.22),tx=x+iconSize+8*u;
   this.icon(p,x+4*u,y+8*u,iconSize);
   const label=this.label(p.name,tx,y+7*u,cw-(tx-x)-3*u,16*u,cw/u<100?9:11,spent&&!active?C.muted:p.color);
   const status=active?active.seconds.toFixed(1)+'s':spent?'SPENT':selected?'TARGET':String(i+1)+'  READY';
   this.label(status,tx,y+23*u,cw-(tx-x)-3*u,14*u,10,spent&&!active?C.muted:C.cream);
   if(active)this.rect(x+1*u,y+l.cardH-4*u,(cw-2*u)*clamp(active.seconds/10,0,1),3*u,p.color);
   this.buttons.push({x,y,w:cw,h:l.cardH,action:()=>this.selectPower(p.id),enabled,label});
  });
  if(s.phase==='halftime'||s.phase==='result'){
   this.buttons=[];this.rect(L,T,W,this.v.height,[.055,.085,.105,.96]);
   const k=Math.min(1,this.v.height/(300*u)),d=u*k,w=Math.min(W-24*u,430*u),x=L+(W-w)/2,y=T+Math.max(8*u,(this.v.height-260*d)/2),a=m.stats[0],b=m.stats[1];
   this.label(s.phase==='halftime'?'HALF TIME':m.score[0]>m.score[1]?'VICTORY':m.score[0]<m.score[1]?'DEFEAT':'FULL TIME · DRAW',x,y,w,45*d,28*k,C.gold,'center');
   this.label(m.score.join('  -  '),x,y+49*d,w,50*d,36*k,C.cream,'center');
   this.label('SHOTS   '+a.shots+'  /  '+b.shots+'\nPASSES   '+a.completed+'  /  '+b.completed+'\nPOWERS USED   '+state.used.length+' / 6',x,y+104*d,w,73*d,13*k,C.cream,'center');
   this.button(s.phase==='halftime'?'SECOND HALF':'PLAY AGAIN',x,y+182*d,w,38*d,()=>s.phase==='halftime'?this.resumeHalf():this.startAuto(),true,true);
   this.button('MAIN MENU',x,y+230*d,w,30*d,()=>this.exitAuto());
  }
 }
 selectPower(id){
  const s=this.auto,m=s?.match,p=POWERS.find(p=>p.id===id);
  if(!m||!p||s.phase!=='match'||!m.mutations.canActivate||m.mutations.used.includes(id))return;
  if(p.type==='instant'){m.activateMutation(id);s.armed=null;}else{s.armed=s.armed===id?null:id;}
  s.message='';s.acc=0;this.refresh();
 }
 target(x,y){
  const s=this.auto,m=s?.match,p=POWERS.find(p=>p.id===s?.armed),q=this.layout.play;
  if(!p||!m||x<q.x||x>q.x+q.w||y<q.y||y>q.y+q.h)return;
  let target=this.ground(x,y);if(Math.abs(target.x)>34||Math.abs(target.z)>47)return;
  if(p.type==='player'){
   const nearest=m.actors.filter(a=>a.side===0&&a.role!=='GK'&&a.visible).map(a=>({id:a.id,d:Math.hypot(a.x-target.x,a.z-target.z)})).sort((a,b)=>a.d-b.d)[0];
   if(!nearest||nearest.d>5)return;target=nearest.id;
  }
  if(m.activateMutation(p.id,target)){s.armed=null;s.acc=0;s.last=performance.now();this.drawAuto(0);this.refresh();}
 }
 tick(){if(!this.auto)return;const now=performance.now(),dt=Math.min(.25,Math.max(0,(now-this.auto.last)/1000));this.auto.last=now;this.advanceAuto(dt);}
 pointerDown(e){if(e.button!==undefined&&e.button!==0)return;const [x,y]=this.field.cssPxToLayer(e.clientX,e.clientY),button=[...this.buttons].reverse().find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(button||this.auto?.armed)this.drag={id:e.pointerId,button,x,y,moved:false};}
 pointerMove(e){const d=this.drag;if(!d||d.id!==e.pointerId)return;const [x,y]=this.field.cssPxToLayer(e.clientX,e.clientY);if(Math.hypot(x-d.x,y-d.y)>5*this.u)d.moved=true;}
 pointerUp(e){const d=this.drag;this.drag=null;if(!d||d.id!==e.pointerId||d.moved)return;const [x,y]=this.field.cssPxToLayer(e.clientX,e.clientY),b=d.button;if(b){if(b.enabled&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)b.action();}else this.target(x,y);}
 key(e){if(e.repeat)return;const k=e.key.toLowerCase(),s=this.auto;if(!s){if(k==='enter')this.startAuto();return;}if(k==='escape'){if(s.armed){s.armed=null;this.refresh();}else this.exitAuto();}else if(k===' '&&s.phase==='match'){s.paused=!s.paused;this.refresh();}else if(/^[1-6]$/.test(k)&&s.phase==='match')this.selectPower(POWERS[Number(k)-1].id);}
}
