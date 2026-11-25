// Native Construct 3 presentation and input. The shared engine alone decides outcomes.
import {Run, GEAR, GOAL, PASS_RANGE, STRIDE, ACTORS, readProfile, saveProfile, purchase, UPGRADES, distance, route, clamp} from './engine.js';

const C={navy:[.09,.15,.25,.96],yellow:[1,.88,.35,1],cream:[.96,.96,.82,1],cyan:[.64,.9,.87,1],orange:[1,.66,.36,.8],red:[1,.39,.3,1],clear:[0,0,0,0]};
const rgb=c=>c.slice(0,3);
const randomSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
export class Sunday{
 constructor(runtime){
  this.runtime=runtime;this.field=runtime.layout.getLayer('Pitch');this.hud=runtime.layout.getLayer('HUD');
  this.pitch=runtime.objects.Pitch.getFirstInstance();this.actors=[...runtime.objects.Footballer.instances()];
  this.ball=runtime.objects.Ball.getFirstInstance();this.ring=runtime.objects.StrikerRing.getFirstInstance();this.ghost=runtime.objects.Ghost.getFirstInstance();
  this.plans=runtime.objects.Plans.getFirstInstance();this.canvas=runtime.objects.HudCanvas.getFirstInstance();this.pickups=[...runtime.objects.Pickup.instances()];
  this.labels=[...runtime.objects.Label.instances()];this.ghost.opacity=.4;
  this.storage=null;try{this.storage=localStorage;}catch{}
  this.profile=readProfile(this.storage);this.intro=true;this.modal=null;this.busy=false;this.order=null;this.preview=null;this.burst=false;this.chip=false;this.anim=null;this.drag=null;
  this.labelCount=0;this.buttons=[];this.displayPositions=[];this.reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  runtime.framerateMode='fixed';runtime.fixedFramerate=30;
  this.newRun(true);this.resize();
  for(const canvas of [this.plans,this.canvas])canvas.addEventListener('resolutionchange',()=>this.refresh());
  runtime.addEventListener('resize',()=>this.resize());runtime.addEventListener('tick',()=>this.tick());
  runtime.addEventListener('pointerdown',e=>this.pointerDown(e));runtime.addEventListener('pointermove',e=>this.pointerMove(e));
  runtime.addEventListener('pointerup',e=>this.pointerUp(e));runtime.addEventListener('pointercancel',()=>{this.drag=null;});
  runtime.addEventListener('keydown',e=>this.key(e));runtime.addEventListener('resume',()=>{if(this.anim)this.anim.last=performance.now();});
 }
 newRun(intro=false){
  this.run=new Run(randomSeed(),this.profile);this.run.start();this.intro=intro;this.modal=null;this.busy=false;this.anim=null;this.chip=false;this.clear(false);
  if(this.v){this.updateActors();this.refresh();}
 }
 resize(){
  this.v=this.field.getViewport();const a=this.field.layerToCssPx(this.v.left,this.v.top),b=this.field.layerToCssPx(this.v.left+1,this.v.top);
  this.u=1/Math.max(.01,Math.abs(b[0]-a[0]));this.narrow=this.v.width/this.v.height<1;
  this.scale=Math.min(this.v.width/78,(this.v.height-140*this.u)/58);this.top=this.v.top+80*this.u;this.cx=this.v.left+this.v.width/2;
  Object.assign(this.pitch,{x:this.cx-44*this.scale,y:this.top-6*this.scale,width:88*this.scale,height:110*this.scale});
  for(const canvas of [this.plans,this.canvas]){canvas.x=this.v.left;canvas.y=this.v.top;canvas.width=this.v.width;canvas.height=this.v.height;}
  if(this.anim)this.drawFrame(this.anim.result,Math.min(1,this.anim.elapsed/this.anim.duration));else this.updateActors();
  this.refresh();
 }
 point(p){return {x:this.cx+p.x*this.scale,y:this.top+(p.z+49)*this.scale};}
 ground(x,y){return {x:(x-this.cx)/this.scale,z:(y-this.top)/this.scale-49};}
 planning(){return !this.intro&&!this.modal&&!this.busy&&this.run.phase==='planning';}
 clear(refresh=true){this.order=null;this.preview=null;this.burst=false;if(refresh)this.refresh();}
 planPath(points){
  if(!this.planning())return;
  const old=this.order,kind=['pass','call','one-two'].includes(old?.kind)?old.kind:'run';
  this.order={kind,ally:old?.ally,burst:this.burst,path:points};this.preview=this.run.preview(this.order);this.refresh();
 }
 pass(ally){
  if(!this.planning())return;
  if(ally===this.run.state.ballOwner){this.call();return;}
  if(this.order?.kind==='pass'&&this.order.ally===ally){this.clear();return;}
  this.burst=false;this.order={kind:'pass',ally,path:[]};this.preview=this.run.preview(this.order);this.refresh();
 }
 oneTwo(ally=1){
  if(!this.planning())return;
  if(this.order?.kind==='one-two'&&this.order.ally===ally){this.clear();return;}
  this.order={...(this.run.suggestOneTwo(ally,{burst:this.burst})||{kind:'one-two',ally,burst:this.burst,path:[]}),auto:true};
  this.preview=this.run.preview(this.order);this.refresh();
 }
 call(){if(!this.planning())return;this.burst=false;this.order={kind:'call',path:[]};this.preview=this.run.preview(this.order);this.refresh();}
 aim(x){if(!this.planning())return;this.burst=false;this.order={kind:'shot',target:{x,z:GOAL.z},chip:this.chip};this.preview=this.run.preview(this.order);this.refresh();}
 dink(){if(!this.planning()||!this.run.buffs.chip)return;this.chip=!this.chip;if(this.order?.kind==='shot')this.aim(this.order.target.x);else this.refresh();}
 directional(dx,dz){
  const p=this.run.state.actors[0],budget=this.run.runRange+(this.burst?7:0)+(this.order?.kind==='one-two'?2:0),length=Math.hypot(dx,dz);
  this.planPath([{x:p.x+dx/length*budget,z:p.z+dz/length*budget}]);
 }
 sprint(){
  if(!this.planning()||this.run.state.bursts<1)return;
  this.burst=!this.burst;
  if(this.order?.auto){this.order={...this.run.suggestOneTwo(this.order.ally,{burst:this.burst}),auto:true};this.preview=this.run.preview(this.order);}
  else if(this.order?.kind==='shot'){this.order=null;this.preview=null;}
  else if(this.order){this.order={...this.order,burst:this.burst};this.preview=this.run.preview(this.order);}
  this.refresh();
 }
 play(){
  if(!this.planning()||!this.preview?.valid)return;
  const result=this.run.commit(this.order);if(result.type==='invalid')return;
  this.busy=true;this.clear(false);this.anim={result,elapsed:0,last:performance.now(),duration:this.reduced ? .12 : Math.max(.2,result.duration)};
  this.refresh();
 }
 tick(){
  if(!this.anim)return;
  const now=performance.now();this.anim.elapsed+=(now-this.anim.last)/1000;this.anim.last=now;
  const progress=Math.min(1,this.anim.elapsed/this.anim.duration);this.drawFrame(this.anim.result,progress);
  if(progress>=1){this.anim=null;this.busy=false;this.updateActors();this.refresh();}
 }
 drawFrame(result,progress){
  const f=progress*(result.count-1),a=Math.floor(f),b=Math.min(result.count-1,a+1),mix=f-a;
  const value=k=>result.frames[a*STRIDE+k]*(1-mix)+result.frames[b*STRIDE+k]*mix;
  for(let i=0;i<ACTORS;i++)this.placeActor(i,value(i*2),value(i*2+1),Math.floor(progress*result.duration*6+i)%2);
  this.placeBall({x:value(ACTORS*2),z:value(ACTORS*2+1),y:value(ACTORS*2+2)});
 }
 placeActor(i,x,z,frame=0){
  const p=this.point({x,z}),a=this.actors[i],team=this.run.state.actors[i].team;
  a.x=Math.round(p.x);a.y=Math.round(p.y);a.width=a.height=Math.round(3.2*this.scale);
  const animation=['Home','Away','Keeper','Official'][team];if(a.animationName!==animation)a.setAnimation(animation);a.animationFrame=frame;
  this.displayPositions[i]={x:a.x,y:a.y};
  if(i===0){this.ring.x=a.x;this.ring.y=a.y;this.ring.width=4.7*this.scale;this.ring.height=2.8*this.scale;}
 }
 placeBall(ball){const p=this.point(ball);this.ball.x=Math.round(p.x);this.ball.y=Math.round(p.y-ball.y*this.scale*.65);this.ball.width=this.ball.height=Math.max(4*this.u,.7*this.scale);this.ball.moveToTop();}
 updateActors(){
  for(const a of this.run.state.actors)this.placeActor(a.id,a.x,a.z);
  for(const a of [...this.actors].sort((a,b)=>a.y-b.y))a.moveToTop();this.placeBall(this.run.state.ball);
 }
 rewind(){if(this.busy||this.intro||this.modal)return;if(this.run.rewind()){this.clear(false);this.updateActors();this.refresh();}}
 next(){if(this.busy)return;if(this.run.continue()){this.clear(false);this.updateActors();this.refresh();}}
 collect(id){if(this.run.collect(id)){this.clear(false);this.updateActors();this.refresh();}}
 bank(){if(this.run.claim(this.profile))saveProfile(this.storage,this.profile);}

 // Pool native Text instances. No DOM overlays or third-party UI renderer.
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
 refresh(){
  if(!this.v)return;
  this.canvas.clearCanvas(C.clear);this.plans.clearCanvas(C.clear);this.ghost.isVisible=false;this.buttons=[];this.labelCount=0;for(const p of this.pickups)p.isVisible=false;
  const {left:L,top:T,right:R,bottom:B,width:W}=this.v,u=this.u,view=this.busy?this.run.before.state:this.run.state,legs=this.busy?this.run.before.lives:this.run.lives;
  this.rect(L+12*u,T+12*u,204*u,86*u);
  this.label('SUNDAY',L+22*u,T+18*u,180*u,22*u,20,C.yellow);
  this.label(`ANCHOR & CROWN   ${!this.busy&&['goal','pickup','champion'].includes(this.run.phase)?1:0}\n${this.run.fixture.short.padEnd(17)}0`,L+22*u,T+44*u,190*u,40*u,13);
  const mode=this.busy?'BALL IN PLAY':this.run.phase==='planning'?'TIME IS FROZEN':'SUNDAY CUP';
  this.label(`SUNDAY ${this.run.fixtureIndex+1}/4 · ${mode}`,this.narrow?L+12*u:L+230*u,this.narrow?T+105*u:T+20*u,this.narrow?W-24*u:300*u,22*u,12,C.yellow);
  this.button('?',R-42*u,T+12*u,30*u,30*u,()=>{this.modal='help';this.refresh();},!this.busy);
  this.button('SHED',R-108*u,T+12*u,58*u,30*u,()=>{this.modal='shed';this.refresh();},!this.busy);
  if(this.planning()&&this.run.buffs.chip)this.button(this.chip?'DINK ON':'DINK',R-108*u,T+52*u,96*u,30*u,()=>this.dink(),true,this.chip);
  if(!this.intro){
   this.rect(L+12*u,B-192*u,150*u,55*u);
   this.label(`LEGS ${'▰'.repeat(legs)}${'·'.repeat(3-legs)}\n${view.beats*2} SEC LEFT`,L+20*u,B-184*u,140*u,48*u,14,C.yellow);
  }
  if(this.planning()){this.drawPlans();this.drawTargets();this.orders();}
  else if(!this.intro&&!this.modal&&!this.busy&&this.run.phase==='pickup')this.pickupUi();
  if(this.busy)this.label('Watch the run…',L+W*.25,B-110*u,W*.5,25*u,14,C.cream,'center');
  if(this.intro)this.introUi();else if(!this.busy&&['goal','setback','over','champion'].includes(this.run.phase))this.resultUi();
  if(this.modal)this.modalUi();
  for(let i=this.labelCount;i<this.labels.length;i++)this.labels[i].isVisible=false;
 }
 orders(){
  const {left:L,right:R,bottom:B,width:W}=this.v,u=this.u,kind=this.order?.kind,owner=this.run.state.ballOwner,name=this.run.state.actors[this.order?.ally??owner].role.toUpperCase();
  let title=kind==='pass'?`PASS TO ${name}`:kind==='one-two'?`ONE–TWO WITH ${name}`:kind==='call'?'CALL FOR THE BALL':kind==='shot'?'PICK YOUR CORNER':owner!==0?`OFF THE BALL · ${name}`:this.burst?'SPRINT':'PLOT YOUR RUN';
  let text=owner!==0?`Tap grass to run. Tap ${name} · BALL to call.`:'Tap grass to run. Tap a red shirt to pass, or 1–2.';
  let danger=false;
  if(this.preview){
   if(!this.preview.valid){text=this.preview.error;danger=true;}
   else if(['tackle','save','intercept','whistle'].includes(this.preview.type)){text=this.preview.detail;danger=true;}
   else if(kind==='pass')text=`${name} keeps possession. Tap grass to pass and move.`;
   else if(kind==='one-two')text='Return run ready. Play now, or tap grass to change it.';
   else if(kind==='call')text='Return pass ready. Tap grass to receive into space.';
   else text=kind==='shot'?'There is no dice roll. Find the gap.':'Your run is set. Play the next two seconds.';
  }
  const height=this.narrow?124:98,y=B-height*u-12*u;
  this.rect(L+12*u,y,W-24*u,height*u);
  this.label(title,L+23*u,y+9*u,W-46*u,24*u,16,danger?C.orange:C.yellow);
  this.label(text,L+23*u,y+34*u,W-46*u,30*u,12,danger?C.orange:C.cream);
  const by=B-47*u,bh=32*u,playWidth=this.narrow?Math.max(124*u,W-210*u):210*u;
  this.button(`SPRINT ${this.run.state.bursts}`,L+22*u,by,78*u,bh,()=>this.sprint(),this.run.state.bursts>0,this.burst);
  this.button('REWIND',L+108*u,by,72*u,bh,()=>this.rewind(),!!this.run.before&&this.run.rewinds>0);
  this.button('PLAY 2 SECONDS',R-playWidth-22*u,by,playWidth,bh,()=>this.play(),!!this.preview?.valid,false,true);
 }
 drawPlans(){
  const u=this.u,local=p=>{const q=this.point(p);return {x:q.x-this.v.left,y:q.y-this.v.top};};
  const draw=(points,color,dash=false)=>{for(let i=1;i<points.length;i++){const a=local(points[i-1]),b=local(points[i]);if(dash)this.plans.lineDashed(a.x,a.y,b.x,b.y,color,1.3*u,4*u);else this.plans.line(a.x,a.y,b.x,b.y,color,1.6*u);}};
  for(const a of this.run.state.actors){if(!a.active&&a.id!==14)continue;const intent=this.run.intents[a.id],p=local(intent);draw([a,intent],C.orange,true);this.plans.outlineEllipse(p.x,p.y,4*u,4*u,C.orange,u,false);}
  if(!this.order)return;
  const p=this.preview?.valid?this.preview.order:this.order;
  if(p.kind==='shot')draw([this.run.state.ball,p.target],C.yellow,true);
  else{
   const budget=this.run.runRange+(this.burst?7:0)+(p.kind==='one-two'?2:0),path=route(this.run.state.actors[0],p.path,budget),end=this.point(path.at(-1));
   draw(path,C.yellow);this.ghost.isVisible=true;this.ghost.x=end.x;this.ghost.y=end.y;this.ghost.width=this.ghost.height=this.scale*3.2;
   if(this.preview?.passPoints)draw(this.preview.passPoints,C.cyan,true);
  }
  if(this.preview?.point){const p=local(this.preview.point),r=5*u;this.plans.line(p.x-r,p.y-r,p.x+r,p.y+r,C.red,2*u);this.plans.line(p.x-r,p.y+r,p.x+r,p.y-r,C.red,2*u);}
 }
 drawTargets(){
  const {left:L,top:T,right:R,bottom:B}=this.v,u=this.u,owner=this.run.state.ballOwner,holder=this.run.state.actors[owner];
  for(const x of [-5.8,5.8]){const p=this.point({x,z:-47});this.button(x<0?'LEFT':'RIGHT',p.x-27*u,p.y-25*u,54*u,24*u,()=>this.aim(x),true,this.order?.kind==='shot'&&Math.sign(this.order.target.x)===Math.sign(x));}
  for(const i of [1,2,3,4,5,6]){
   const a=this.run.state.actors[i],p=this.point(a),carrier=i===owner,near=distance(holder,a)<=PASS_RANGE;
   if(p.y<T+144*u||p.y>B-210*u||(!near&&!carrier&&i>3))continue;
   const w=carrier?125*u:57*u,combo=owner===0;let x=clamp(p.x-w/2,L+13*u,R-w-(combo?39*u:0)-13*u),y=p.y-37*u;
   this.button(a.role.toUpperCase()+(carrier?' · BALL':''),x,y,w,27*u,()=>this.pass(i),near,this.order?.kind==='pass'&&this.order.ally===i);
   if(combo)this.button('1–2',x+w+2*u,y,37*u,27*u,()=>this.oneTwo(i),distance(this.run.state.actors[0],a)<=29&&this.run.state.passes>0,this.order?.kind==='one-two'&&this.order.ally===i);
  }
  if(owner!==0){const p=this.point(this.run.state.actors[0]);this.button('CALL',clamp(p.x-30*u,L+12*u,R-72*u),p.y-37*u,60*u,27*u,()=>this.call());}
 }
 panel(width,height){const u=this.u,v=this.v,w=Math.min(width*u,v.width-26*u),h=Math.min(height*u,v.height-170*u),x=v.left+(v.width-w)/2,y=v.top+(v.height-h)/2;this.rect(x,y,w,h);return {x,y,w,h,u};}
 introUi(){
  const {x,y,w,h,u}=this.panel(465,310);
  this.label('THE NEXT TWO SECONDS.',x+20*u,y+20*u,w-40*u,65*u,27,C.yellow);
  this.label('The match freezes. You plot your run.\nThen everybody moves together.\n\nOrange lines show their intentions.\nTap a red shirt to pass.\nTap 1–2 for a suggested give-and-go.\nFind the finish before time runs out.',x+20*u,y+100*u,w-40*u,h-150*u,14);
  this.button('STEP ONTO THE PITCH',x+20*u,y+h-48*u,w-40*u,32*u,()=>{this.intro=false;this.refresh();},true,false,true);
 }
 resultUi(){
  if(['over','champion'].includes(this.run.phase))this.bank();
  const phase=this.run.phase,headline=phase==='goal'?'GET IN!':phase==='champion'?'PUB LEGEND.':phase==='over'?'LEGS GONE.':({save:'SAVED.',tackle:'CAUGHT.',intercept:'CUT OUT.',whistle:'CHANCE GONE.'})[this.run.lastResult.type];
  const {x,y,w,h,u}=this.panel(465,240);this.label(headline,x+20*u,y+20*u,w-40*u,45*u,26,phase==='setback'?C.orange:C.yellow);
  this.label(['over','champion'].includes(phase)?`${this.run.goals} GOALS · £${this.run.bank} BANKED\nWork in the morning.`:this.run.message,x+20*u,y+77*u,w-40*u,h-133*u,14);
  if(phase==='setback'&&this.run.rewinds>0)this.button('REWIND',x+20*u,y+h-88*u,w-40*u,30*u,()=>this.rewind());
  this.button(phase==='goal'?'NEXT SUNDAY':phase==='setback'?'NEXT ATTACK':'ONE MORE SUNDAY',x+20*u,y+h-48*u,w-40*u,32*u,()=>['goal','setback'].includes(phase)?this.next():this.newRun(),true,false,true);
 }
 pickupUi(){
  const u=this.u,v=this.v;
  this.label('THE GAFFER FOUND THESE IN HIS CAR.\nTAKE ONE. LEAVE THE REST.',v.left+16*u,v.top+145*u,v.width-32*u,65*u,18,C.yellow,'center');
  this.run.offers.forEach((id,i)=>{
   const g=GEAR[id],p=this.point({x:0,z:-15}),inst=this.pickups[i],w=Math.min(165*u,(v.width-40*u)/3);
   p.x=this.cx+(i-1)*Math.min(180*u,(v.width-32*u)/3);const x=p.x-w/2;
   inst.isVisible=true;inst.x=p.x;inst.y=p.y;inst.width=inst.height=36*u;inst.setAnimation(g.icon);
   this.button(g.name.toUpperCase(),x,p.y+12*u,w,48*u,()=>this.collect(id),true,false,true);
   this.label(g.text,x,p.y+69*u,w,90*u,12,C.cream,'center');
  });
 }
 modalUi(){
  // Modal controls take precedence over pitch hit targets.
  this.buttons=[];const help=this.modal==='help',{x,y,w,h,u}=this.panel(510,help?520:350);
  this.label(help?'THE QUICK TEAM TALK':'THE CLUB SHED',x+20*u,y+18*u,w-40*u,38*u,23,C.yellow);
  if(help)this.label('You are always the striker with the yellow ring.\n\nRUN: tap grass, or drag from your ring.\nPASS: tap a red shirt. He keeps the ball.\nThen run off the ball and tap CALL to receive.\n1–2: tap beside a name. A return run is ready.\nTap grass only if you want to change it.\n\nOrange lines are locked defender intentions.\nThe preview warns of actual interceptions.\nGet the ball back, then choose LEFT or RIGHT.\n\nSpace: play · P: pass/call · O: one-two\nArrows/WASD: run · Q/E: diagonal · B: sprint\nR: rewind · 1/2: aim · C: learned dink\nEnter: continue · Escape: cancel\n\nFour Sundays. Three legs. One second thought.',x+20*u,y+67*u,w-40*u,h-124*u,13);
  else{
   this.label(`CLUB KITTY: £${this.profile.kitty}\nUpgrades apply to the next run.`,x+20*u,y+67*u,w-40*u,52*u,14);
   Object.entries(UPGRADES).forEach(([id,a],i)=>{this.label(`${a.name}\n${a.text}`,x+20*u,y+(135+i*70)*u,w-135*u,56*u,13);this.button(this.profile[id]>=a.max?'SORTED':`£${a.price}`,x+w-100*u,y+(139+i*70)*u,80*u,34*u,()=>{if(purchase(this.profile,id)){saveProfile(this.storage,this.profile);this.refresh();}},this.profile[id]<a.max&&this.profile.kitty>=a.price);});
  }
  this.button('BACK TO THE PITCH',x+20*u,y+h-45*u,w-40*u,30*u,()=>{this.modal=null;this.refresh();});
 }
 pointerDown(e){
  if(e.button!==undefined&&e.button!==0)return;
  const [x,y]=this.field.cssPxToLayer(e.clientX,e.clientY),button=[...this.buttons].reverse().find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
  if(button){this.drag={id:e.pointerId,button,x,y,moved:false};return;}
  if(!this.planning())return;
  const p=this.ground(x,y);this.drag={id:e.pointerId,x,y,points:[],near:distance(p,this.run.state.actors[0])<6,moved:false};
 }
 pointerMove(e){
  const d=this.drag;if(!d||d.id!==e.pointerId)return;
  const [x,y]=this.field.cssPxToLayer(e.clientX,e.clientY);if(Math.hypot(x-d.x,y-d.y)>5*this.u)d.moved=true;
  if(d.button||!this.planning()||!d.near||!d.moved)return;
  const p=this.ground(x,y);if(!d.points.length||distance(d.points.at(-1),p)>.8){d.points.push(p);if(d.points.length>40)d.points=d.points.filter((_,i)=>i%2===0);this.planPath(d.points);}
 }
 pointerUp(e){
  const d=this.drag;this.drag=null;if(!d||d.id!==e.pointerId)return;
  const [x,y]=this.field.cssPxToLayer(e.clientX,e.clientY);
  if(d.button){const b=d.button;if(!d.moved&&b.enabled&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)b.action();return;}
  if(!this.planning())return;
  const p=this.ground(x,y);
  if(!d.moved){
   if(p.z<-43&&Math.abs(p.x)<7){this.aim(p.x);return;}
   const a=this.run.state.actors.slice(1,7).sort((a,b)=>distance(p,a)-distance(p,b))[0];
   if(distance(p,a)<3.4){if(e.shiftKey&&this.run.state.ballOwner===0)this.oneTwo(a.id);else this.pass(a.id);return;}
   if(this.run.state.ballOwner!==0&&distance(p,this.run.state.actors[0])<3.4){this.call();return;}
  }
  this.planPath(d.near&&d.moved&&d.points.length?d.points:[p]);
 }
 key(e){
  if(e.repeat)return;const k=e.key.toLowerCase();
  if(this.modal){if(k==='escape')this.modal=null;this.refresh();return;}
  if(this.busy)return;
  if(k==='enter'){if(this.intro){this.intro=false;this.refresh();}else if(['goal','setback'].includes(this.run.phase))this.next();else if(['champion','over'].includes(this.run.phase))this.newRun();return;}
  if(this.intro)return;
  if(k==='r'){this.rewind();return;}
  if(this.run.phase==='pickup'&&['1','2','3'].includes(k)){this.collect(this.run.offers[Number(k)-1]);return;}
  if(!this.planning())return;
  const directions={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0],q:[-1,-1],e:[1,-1]};
  if(directions[k])this.directional(...directions[k]);else if(k===' ')this.play();else if(k==='p'){if(this.run.state.ballOwner===0)this.pass(1);else this.call();}
  else if(k==='o')this.oneTwo(1);else if(k==='b')this.sprint();else if(k==='1')this.aim(-5.8);else if(k==='2')this.aim(5.8);
  else if(k==='c')this.dink();
  else if(k==='escape')this.clear();
 }
}
