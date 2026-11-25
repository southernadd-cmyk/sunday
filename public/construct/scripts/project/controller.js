// SUNDAY: native Construct autoplay presentation. Match logic stays in engine.js.
import {createSoccerMatch,AUTO_TRAITS,SOCCER_STEP} from './engine.js';
const SIM_DURATION=300,BASE_PLAYBACK=4;
const C={navy:[.09,.15,.25,.96],yellow:[1,.88,.35,1],cream:[.96,.96,.82,1],cyan:[.64,.9,.87,1],orange:[1,.66,.36,.8],red:[1,.39,.3,1],clear:[0,0,0,0]};
const rgb=c=>c.slice(0,3);
const randomSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
export class Sunday{
 constructor(runtime){
  this.runtime=runtime;this.field=runtime.layout.getLayer('Pitch');this.hud=runtime.layout.getLayer('HUD');
  this.pitch=runtime.objects.Pitch.getFirstInstance();this.actors=[...runtime.objects.Footballer.instances()];
  while(this.actors.length<22)this.actors.push(runtime.objects.Footballer.createInstance('Pitch',0,0));
  this.ball=runtime.objects.Ball.getFirstInstance();this.ring=runtime.objects.StrikerRing.getFirstInstance();this.ghost=runtime.objects.Ghost.getFirstInstance();
  this.plans=runtime.objects.Plans.getFirstInstance();this.canvas=runtime.objects.HudCanvas.getFirstInstance();this.pickups=[...runtime.objects.Pickup.instances()];
  this.labels=[...runtime.objects.Label.instances()];this.buttons=[];this.labelCount=0;this.displayPositions=[];this.auto=null;this.drag=null;this.intro=true;this.menuPage='main';
  runtime.framerateMode='fixed';runtime.fixedFramerate=30;
  this.resize();
  for(const canvas of [this.plans,this.canvas])canvas.addEventListener('resolutionchange',()=>this.refresh());
  runtime.addEventListener('resize',()=>this.resize());runtime.addEventListener('tick',()=>this.tick());
  runtime.addEventListener('pointerdown',e=>this.pointerDown(e));runtime.addEventListener('pointermove',e=>this.pointerMove(e));runtime.addEventListener('pointerup',e=>this.pointerUp(e));runtime.addEventListener('pointercancel',()=>{this.drag=null;});
  runtime.addEventListener('keydown',e=>this.key(e));runtime.addEventListener('resume',()=>{if(this.auto)this.auto.last=performance.now();});
 }
 startAuto(){
  this.auto={seed:randomSeed(),traits:[],round:0,phase:'draft',speed:1,paused:false,last:performance.now(),acc:0,hud:0,match:null,results:[]};
  this.intro=false;this.modal=null;this.drag=null;this.ring.isVisible=false;this.autoOffers();this.refresh();
 }
 autoOffers(){
  const s=this.auto,remaining=Object.keys(AUTO_TRAITS).filter(id=>!s.traits.includes(id));
  // Seeded rotation of the six available team behaviours; all are selectable across a run.
  const start=(s.seed+s.round*7)%remaining.length;s.offers=remaining.slice(start).concat(remaining.slice(0,start)).slice(0,3);
 }
 async autoChoose(id){
  const s=this.auto;if(!s||s.phase!=='draft'||!s.offers.includes(id))return;
  s.phase='loading';s.error=null;this.refresh();
  try{
   const traits=[...s.traits,id],match=await createSoccerMatch((s.seed+s.round*7919)>>>0,traits,s.round,SIM_DURATION);
   if(this.auto!==s)return;
   s.traits=traits;s.match=match;s.phase='match';s.paused=false;s.acc=0;s.hud=0;s.last=performance.now();this.drawAuto();this.refresh();
  }catch(error){if(this.auto!==s)return;s.phase='draft';s.error='Could not start match. Choose again.';console.error('Soccer-JS startup:',error);this.refresh();}
 }
 advanceAuto(dt){
  const s=this.auto;if(!s||s.phase!=='match'||s.paused)return;
  s.acc+=Math.max(0,dt)*s.speed*BASE_PLAYBACK;
  while(s.acc>=SOCCER_STEP&&!s.match.finished){s.match.step();s.acc-=SOCCER_STEP;}
  this.drawAuto();s.hud+=dt;
  if(s.match.finished){s.results.push([...s.match.score]);s.phase='result';this.refresh();}
  else if(s.hud>=.2){s.hud=0;this.refresh();}
 }
 autoNext(){
  const s=this.auto;if(!s||s.phase!=='result')return;
  if(s.round>=2){this.startAuto();return;}
  s.round++;s.phase='draft';this.autoOffers();this.refresh();
 }
 exitAuto(){
  this.auto=null;this.intro=true;this.menuPage='main';this.modal=null;this.drag=null;this.ring.isVisible=false;this.refresh();
 }
 drawAuto(){
  const m=this.auto?.match;if(!m)return;
  this.ring.isVisible=false;
  for(const a of m.actors){this.placeActor(a.id,a.x,a.z,a.frame);this.actors[a.id].isVisible=a.visible!==false;}
  for(const a of [...this.actors].sort((a,b)=>a.y-b.y))a.moveToTop();this.placeBall(m.ball);
 }
 autoUi(){
  const s=this.auto,m=s.match,{left:L,top:T,right:R,bottom:B,width:W,height:H}=this.v,u=this.u;
  const opponent=['RAILWAY','MUNICIPAL','DOG & DUCK'][s.round];
  if(s.phase==='loading'){
   this.rect(L,T,W,H,[.055,.105,.16,1],null);this.label('PREPARING MATCH',L+20*u,T+H*.44,W-40*u,42*u,24,C.yellow,'center');return;
  }
  if(s.phase==='draft'){
   this.rect(L,T,W,H,[.055,.105,.16,.97],null);
   const w=Math.min(520*u,W-28*u),x=L+(W-w)/2,y=T+Math.max(12*u,(H-360*u)/2),rh=Math.min(66*u,(H-145*u)/4);
   this.label('BUILD THE TEAM',x,y,w,42*u,29,C.yellow);
   this.label('MATCH '+(s.round+1)+'/3 · '+opponent+' · CHOOSE ONE BEHAVIOUR',x,y+43*u,w,28*u,12,C.cyan);
   s.offers.forEach((id,i)=>{const g=AUTO_TRAITS[id],yy=y+76*u+i*rh;this.button(g.name.toUpperCase(),x,yy,w,29*u,()=>this.autoChoose(id));this.label(g.detail,x+4*u,yy+31*u,w-8*u,rh-31*u,12,C.cream);});
   this.label(s.error||'ACTIVE: '+(s.traits.map(id=>AUTO_TRAITS[id].name).join(' + ')||'None yet'),x,y+79*u+3*rh,w,32*u,12,C.cyan);
   this.button('BACK TO MENU',x,y+112*u+3*rh,w,32*u,()=>this.exitAuto());return;
  }
  const elapsed=Math.min(90,Math.floor(m.time/m.duration*90)),clock=String(elapsed).padStart(2,'0')+':'+String(Math.floor((m.time/m.duration*90-elapsed)*60)).padStart(2,'0');
  this.rect(L+12*u,T+12*u,W-24*u,44*u,C.navy,null);
  this.label('A&C '+m.score[0]+'–'+m.score[1]+' '+opponent,L+22*u,T+17*u,W-106*u,18*u,16,C.cream);
  this.label('MATCH '+(s.round+1)+'/3 · '+clock,L+22*u,T+36*u,W-106*u,16*u,11,C.yellow);
  this.button('MENU',R-78*u,T+18*u,64*u,30*u,()=>this.exitAuto());
  const wide=this.landscape,x=wide?R-250*u:L+12*u,y=wide?T+66*u:B-210*u,pw=wide?238*u:W-24*u,inner=pw-20*u,bw=(inner-9*u)/4;
  this.rect(x,y,pw,wide?Math.min(410*u,H-75*u):198*u,C.navy,null);
  this.label(s.paused?'PAUSED':'LIVE FOOTBALL',x+10*u,y+9*u,inner,20*u,14,C.yellow);
  const rowY=y+34*u;this.button(s.paused?'PLAY':'PAUSE',x+10*u,rowY,bw,30*u,()=>{s.paused=!s.paused;this.refresh();},s.phase==='match',false,true);
  [1,2,4].forEach((speed,i)=>this.button(speed+'×',x+10*u+(i+1)*(bw+3*u),rowY,bw,30*u,()=>{s.speed=speed;this.refresh();},s.phase==='match',s.speed===speed));
  const a=m.stats[0],b=m.stats[1];
  this.label('A&C     '+a.completed+' PASSES / '+a.shots+' SHOTS / '+(a.tackles+a.interceptions)+' WINS',x+10*u,y+73*u,inner,25*u,11,C.cream);
  this.label('OPP     '+b.completed+' PASSES / '+b.shots+' SHOTS / '+(b.tackles+b.interceptions)+' WINS',x+10*u,y+100*u,inner,25*u,11,C.cream);
  this.label('BUILD: '+s.traits.map(id=>AUTO_TRAITS[id].name).join(' + '),x+10*u,y+126*u,inner,wide?50*u:27*u,11,C.cyan);
  const ev=m.events[0];
  this.label(ev?(ev.side===0?'A&C · ':ev.side===1?'OPP · ':'')+ev.text:'WATCH THE PLAY',x+10*u,y+(wide?180:157)*u,inner,30*u,14,ev?.kind==='goal'?C.yellow:C.cream);
  if(wide)m.events.slice(1,5).forEach((ev,i)=>this.label((ev.side===0?'A&C ':ev.side===1?'OPP ':'')+ev.text,x+10*u,y+(216+i*32)*u,inner,28*u,11,C.cyan));
  if(s.phase==='result'){
   this.buttons=[];const {x,y,w,h,u}=this.panel(460,260);
   const result=m.score[0]>m.score[1]?'WIN':m.score[0]<m.score[1]?'DEFEAT':'DRAW';
   this.label('FULL TIME · '+result,x+16*u,y+15*u,w-32*u,36*u,23,C.yellow);
   this.label('A&C '+m.score[0]+'–'+m.score[1]+' '+opponent+'\n'+a.completed+' passes completed · '+a.shots+' shots\n'+(a.tackles+a.interceptions)+' balls won · best chain '+a.bestChain+'\n'+s.results.map(q=>q.join('–')).join(' / '),x+16*u,y+56*u,w-32*u,100*u,14,C.cream);
   this.button(s.round===2?'PLAY AGAIN':'DRAFT NEXT BEHAVIOUR',x+16*u,y+h-83*u,w-32*u,34*u,()=>this.autoNext(),true,false,true);
   this.button('MAIN MENU',x+16*u,y+h-43*u,w-32*u,29*u,()=>this.exitAuto());
  }
 }

 resize(){
  this.v=this.field.getViewport();const a=this.field.layerToCssPx(this.v.left,this.v.top),b=this.field.layerToCssPx(this.v.left+1,this.v.top);
  this.u=1/Math.max(.01,Math.abs(b[0]-a[0]));this.narrow=this.v.width/this.v.height<1;
  const {left:L,top:T,width:W,height:H}=this.v,u=this.u;
  this.landscape=W/u>=740&&W/H>=1.25;
  const fieldWidth=W-(this.landscape?258*u:0);
  this.cx=L+fieldWidth/2;
  this.scale=Math.max(.1,this.landscape?Math.min((fieldWidth-16*u)/110,(H-72*u)/88):Math.min((W-8*u)/88,(H-(278)*u)/110));
  if(this.landscape){
   this.pitchRight=this.cx+55*this.scale;this.pitchTop=T+62*u+(H-72*u-88*this.scale)/2;
   Object.assign(this.pitch,{x:this.pitchRight,y:this.pitchTop,width:88*this.scale,height:110*this.scale,angle:Math.PI/2});
  }else{
   this.top=T+62*u+6*this.scale+(H-(278)*u-110*this.scale)/2;
   Object.assign(this.pitch,{x:this.cx-44*this.scale,y:this.top-6*this.scale,width:88*this.scale,height:110*this.scale,angle:0});
  }
  for(const canvas of [this.plans,this.canvas]){canvas.x=this.v.left;canvas.y=this.v.top;canvas.width=this.v.width;canvas.height=this.v.height;}
  if(this.auto?.match)this.drawAuto();
  this.refresh();
 }
 point(p){return this.landscape?{x:this.pitchRight-(p.z+55)*this.scale,y:this.pitchTop+(p.x+44)*this.scale}:{x:this.cx+p.x*this.scale,y:this.top+(p.z+49)*this.scale};}
 ground(x,y){return this.landscape?{x:(y-this.pitchTop)/this.scale-44,z:(this.pitchRight-x)/this.scale-55}:{x:(x-this.cx)/this.scale,z:(y-this.top)/this.scale-49};}

 placeActor(i,x,z,frame=0){
  const p=this.point({x,z}),a=this.actors[i],team=this.auto.match.actors[i].team;
  a.x=Math.round(p.x);a.y=Math.round(p.y);a.width=a.height=Math.max(Math.round(3.5*this.scale),Math.round(12*this.u));
  const animation=['Home','Away','Keeper','Official'][team];if(a.animationName!==animation)a.setAnimation(animation);a.animationFrame=frame;
  this.displayPositions[i]={x:a.x,y:a.y};
 }
 placeBall(ball){const p=this.point(ball);this.ball.x=Math.round(p.x);this.ball.y=Math.round(p.y-ball.y*this.scale*.65);this.ball.width=this.ball.height=Math.max(4*this.u,.7*this.scale);this.ball.moveToTop();}

 label(text,x,y,width,height,size=14,color=C.cream,align='left'){
  let l=this.labels[this.labelCount];if(!l){l=this.runtime.objects.Label.createInstance('HUD',x,y);this.labels.push(l);}
  this.labelCount++;l.isVisible=true;l.x=x;l.y=y;l.width=width;l.height=height;l.text=String(text);l.sizePt=size*this.u*.75;l.fontColor=rgb(color);l.horizontalAlign=align;l.isBold=true;l.moveToTop();return l;
 }
 rect(x,y,w,h,color=C.navy,border=C.cyan){
  x-=this.v.left;y-=this.v.top;
  this.canvas.fillRect(x,y,x+w,y+h,color);if(border)this.canvas.outlineRect(x,y,x+w,y+h,border,this.u);
 }
 button(text,x,y,w,h,action,enabled=true,selected=false,primary=false){
  const color=primary?C.yellow:C.navy;this.rect(x,y,w,h,color,enabled?selected?C.yellow:C.cyan:[.38,.49,.45,1]);
  const label=this.label(text,x+3*this.u,y+Math.max(3,(h/this.u-15)/2)*this.u,w-6*this.u,h-3*this.u,13,primary?C.navy:enabled?C.cream:[.43,.53,.48,1],'center');
  this.buttons.push({x,y,w,h,action,enabled,label});
 }

 panel(width,height){const u=this.u,v=this.v,w=Math.min(width*u,v.width-26*u),h=Math.min(height*u,v.height-170*u),x=v.left+(v.width-w)/2,y=v.top+(v.height-h)/2;this.rect(x,y,w,h);return {x,y,w,h,u};}
 refresh(){
  if(!this.v)return;
  this.canvas.clearCanvas(C.clear);this.plans.clearCanvas(C.clear);this.ring.isVisible=false;this.ghost.isVisible=false;this.buttons=[];this.labelCount=0;
  for(const p of this.pickups)p.isVisible=false;
  const visible=!!this.auto?.match&&['match','result'].includes(this.auto.phase);
  for(let i=0;i<this.actors.length;i++)this.actors[i].isVisible=visible&&!!this.auto.match.actors[i]&&this.auto.match.actors[i].visible!==false;this.ball.isVisible=visible;this.pitch.isVisible=visible;
  if(this.auto)this.autoUi();else this.introUi();
  for(let i=this.labelCount;i<this.labels.length;i++)this.labels[i].isVisible=false;
 }
 introUi(){
  const {left:L,top:T,width:W,height:H}=this.v,u=this.u;
  this.rect(L,T,W,H,[.055,.105,.16,1],null);
  const wide=W/u>=740&&W/H>=1.25,w=Math.min(440*u,wide?W*.44:W-32*u),x=wide?L+W*.52:L+(W-w)/2,y=T+Math.max(12*u,(H-300*u)/2);
  if(wide){
   const px=L+W*.07,py=T+H*.22,pw=W*.36,ph=H*.55;
   this.rect(px,py,pw,ph,[.12,.31,.23,1],C.cyan);this.canvas.line(px-L+pw/2,py-T,px-L+pw/2,py-T+ph,C.cyan,u);
   this.canvas.outlineEllipse(px-L+pw/2,py-T+ph/2,ph*.24,ph*.24,C.cyan,u,false);
   for(const [fx,fy] of [[.18,.5],[.35,.25],[.35,.75],[.66,.5]])this.canvas.outlineEllipse(px-L+pw*fx,py-T+ph*fy,12*u,12*u,C.yellow,2*u,false);
   this.canvas.lineDashed(px-L+pw*.35,py-T+ph*.25,px-L+pw*.66,py-T+ph*.5,C.cyan,2*u,5*u);
  }
  this.label('SUNDAY',x,y,w,64*u,44,C.yellow);this.label('BUILD THE TEAM. WATCH THE FOOTBALL.',x,y+68*u,w,40*u,13,C.cyan);
  if(this.menuPage==='help'){
   this.label('Draft one behaviour before each match.\nYour team plays automatically.\nBuild a stronger team over three fixtures.\nPause or change the viewing speed at any time.',x,y+115*u,w,100*u,14,C.cream);
   this.button('BACK',x,y+230*u,w,37*u,()=>{this.menuPage='main';this.refresh();});
  }else{
   this.button('START GAME',x,y+122*u,w,43*u,()=>this.startAuto(),true,false,true);
   this.button('INSTRUCTIONS',x,y+177*u,w,37*u,()=>{this.menuPage='help';this.refresh();});
   this.label('11-a-side football autobattler',x,y+235*u,w,28*u,13,C.cream);
  }
 }
 tick(){if(!this.auto)return;const now=performance.now(),dt=Math.min(.25,Math.max(0,(now-this.auto.last)/1000));this.auto.last=now;this.advanceAuto(dt);}
 pointerDown(e){
  if(e.button!==undefined&&e.button!==0)return;
  const [x,y]=this.field.cssPxToLayer(e.clientX,e.clientY),button=[...this.buttons].reverse().find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
  if(button)this.drag={id:e.pointerId,button,x,y,moved:false};
 }
 pointerMove(e){const d=this.drag;if(!d||d.id!==e.pointerId)return;const [x,y]=this.field.cssPxToLayer(e.clientX,e.clientY);if(Math.hypot(x-d.x,y-d.y)>5*this.u)d.moved=true;}
 pointerUp(e){const d=this.drag;this.drag=null;if(!d||d.id!==e.pointerId||d.moved)return;const [x,y]=this.field.cssPxToLayer(e.clientX,e.clientY),b=d.button;if(b.enabled&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)b.action();}
 key(e){if(e.repeat)return;const k=e.key.toLowerCase(),s=this.auto;if(!s){if(k==='enter')this.startAuto();else if(k==='escape'){this.menuPage='main';this.refresh();}return;}
  if(k==='escape'&&s.phase!=='loading')this.exitAuto();else if(k===' '&&s.phase==='match'){s.paused=!s.paused;this.refresh();}else if(['1','2','4'].includes(k)&&s.phase==='match'){s.speed=Number(k);this.refresh();}
 }
}
