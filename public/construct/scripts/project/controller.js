// Native Construct 3 presentation and input. The shared engine alone decides outcomes.
import {PRACTICE, practiceRun, practicePassed, MatchRun, MATCH_GEAR as GEAR, HOME_IDS, isHome, ACTION_TIMES, along, GOAL, PASS_RANGE, STRIDE, ACTORS, readProfile, saveProfile, purchase, UPGRADES, distance, route, clamp} from './engine.js';

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
  this.practice=null;this.practiceReturn=null;this.run=new MatchRun(randomSeed(),this.profile);this.run.start();this.selected=this.run.selection();this.intro=intro;this.modal=null;this.busy=false;this.anim=null;this.chip=false;this.clear(false);
  if(this.v){this.updateActors();this.refresh();}
 }
 startPractice(){
  if(this.busy)return;
  if(!this.practice)this.practiceReturn={run:this.run,selected:this.selected};
  this.loadDrill(0);
 }
 loadDrill(index){
  this.practice={index,outcome:null};this.run=practiceRun(index);this.selected=PRACTICE[index].actor;
  this.intro=false;this.modal=null;this.busy=false;this.anim=null;this.chip=false;this.clear(false);this.resize();
 }
 exitPractice(){
  if(!this.practice)return;
  const saved=this.practiceReturn;this.practice=null;this.practiceReturn=null;this.run=saved.run;this.selected=saved.selected;
  this.intro=false;this.modal=null;this.busy=false;this.anim=null;this.clear(false);this.resize();
 }
 practiceResult(result){
  const index=this.practice.index,passed=practicePassed(index,result);
  this.practice.outcome={passed,detail:result.detail||'Try the instruction again.'};this.refresh();
 }
 resize(){
  this.v=this.field.getViewport();const a=this.field.layerToCssPx(this.v.left,this.v.top),b=this.field.layerToCssPx(this.v.left+1,this.v.top);
  this.u=1/Math.max(.01,Math.abs(b[0]-a[0]));this.narrow=this.v.width/this.v.height<1;
  const {left:L,top:T,width:W,height:H}=this.v,u=this.u;
  this.landscape=W/u>=740&&W/H>=1.25;
  const fieldWidth=W-(this.landscape?258*u:0);
  this.cx=L+fieldWidth/2;
  this.scale=Math.max(.1,this.landscape?Math.min((fieldWidth-16*u)/110,(H-72*u)/88):Math.min((W-8*u)/88,(H-(this.practice?310:278)*u)/110));
  if(this.landscape){
   this.pitchRight=this.cx+55*this.scale;this.pitchTop=T+62*u+(H-72*u-88*this.scale)/2;
   Object.assign(this.pitch,{x:this.pitchRight,y:this.pitchTop,width:88*this.scale,height:110*this.scale,angle:Math.PI/2});
  }else{
   this.top=T+62*u+6*this.scale+(H-(this.practice?310:278)*u-110*this.scale)/2;
   Object.assign(this.pitch,{x:this.cx-44*this.scale,y:this.top-6*this.scale,width:88*this.scale,height:110*this.scale,angle:0});
  }
  for(const canvas of [this.plans,this.canvas]){canvas.x=this.v.left;canvas.y=this.v.top;canvas.width=this.v.width;canvas.height=this.v.height;}
  if(this.anim)this.drawFrame(this.anim.result,Math.min(1,this.anim.elapsed/this.anim.duration));else this.updateActors();
  this.refresh();
 }
 point(p){return this.landscape?{x:this.pitchRight-(p.z+55)*this.scale,y:this.pitchTop+(p.x+44)*this.scale}:{x:this.cx+p.x*this.scale,y:this.top+(p.z+49)*this.scale};}
 ground(x,y){return this.landscape?{x:(y-this.pitchTop)/this.scale-44,z:(this.pitchRight-x)/this.scale-55}:{x:(x-this.cx)/this.scale,z:(y-this.top)/this.scale-49};}
 planning(){return !this.intro&&!this.modal&&!this.busy&&!this.practice?.outcome&&this.run.phase==='planning';}
 clear(refresh=true){this.order=null;this.preview=null;this.burst=false;this.support={};this.targetMode=null;if(refresh)this.refresh();}
  previewOrder(order){this.order={...order,actor:this.selected,support:{...this.support}};this.preview=this.run.preview(this.order);}
  select(id){
   if(!this.planning()||!isHome(id)||id===this.selected)return;
   if(['run','tackle'].includes(this.order?.kind)&&this.order.path?.length)this.support[this.selected]=this.order.path;
   this.selected=id;this.burst=false;this.targetMode=null;
   const path=this.support[id]||[];delete this.support[id];
   if(path.length||Object.keys(this.support).length)this.previewOrder({kind:'run',path});
   else{this.order=null;this.preview=null;}
   this.updateActors();this.refresh();
  }
  target(mode){if(!this.planning())return;this.targetMode=this.targetMode===mode?null:mode;this.refresh();}
  ballAction(mode){
   if(this.run.defending)return;
   if(this.selected!==this.run.state.ballOwner)this.select(this.run.state.ballOwner);
   this.target(mode);
  }
 defend(cover=false){if(!this.planning()||!this.run.defending)return;const p=this.run.defensivePoint(this.selected,cover);if(p){this.targetMode=null;this.previewOrder({kind:'run',path:[p],burst:this.burst,autoPress:true});this.refresh();}}
 hold(){if(!this.planning())return;this.targetMode=null;this.previewOrder({kind:'hold',path:[]});this.refresh();}
 planPath(points){
  if(!this.planning())return;
  const old=this.order,kind=['pass','call','one-two','tackle'].includes(old?.kind)?old.kind:'run';
  this.targetMode=null;this.previewOrder({kind,ally:old?.ally,receiveAt:old?.receiveAt,tackle:old?.tackle,tackleAt:old?.tackleAt,burst:this.burst,path:points});this.refresh();
 }
 pass(ally){
  if(!this.planning())return;
  if(ally===this.run.state.ballOwner)return;
  if(this.order?.kind==='pass'&&this.order.ally===ally){this.clear();return;}
  this.targetMode=null;this.burst=false;this.previewOrder({kind:'pass',ally,path:this.order?.kind==='run'?this.order.path:[]});this.refresh();
 }
 reception(time){
  if(!this.planning()||this.order?.kind!=='pass')return;
  this.previewOrder({...this.order,receiveAt:time});this.refresh();
 }
 receptionMarkers(){
  if(this.order?.kind!=='pass')return [];
  const id=this.order.ally,a=this.run.state.actors[id],raw=this.support[id];
  if(!raw?.length)return [];
  const path=route(a,raw,this.run.runRange);
  return ACTION_TIMES.map(time=>({time,p:along(path,this.run.runRange*time/2)}));
 }
 challengeOrder(kind,time){
  const prior=this.order,manual=(prior?.kind==='run'&&prior.path?.length&&!prior.autoPress)||(prior?.kind==='tackle'&&!prior.autoTackle);
  const p=this.run.tacklePointAt(time);
  const target=p&&kind==='slide'?{x:p.x+(this.run.state.actors[this.selected].x>=p.x?1.6:-1.6),z:p.z+1}:p;
  return {kind:'tackle',tackle:kind,tackleAt:time,path:manual?prior.path:target?[target]:[],burst:this.burst,autoTackle:!manual,actor:this.selected,support:{...this.support}};
 }
 challengeChoices(kind){
  return ACTION_TIMES.map(time=>{const order=this.challengeOrder(kind,time);return {time,order,preview:this.run.preview(order)};});
 }
 tackle(kind,time){
  if(!this.planning()||!this.run.defending)return;
  const choices=this.challengeChoices(kind);
  const best=time==null?(choices.find(x=>x.preview.tackleOutcome==='won')||choices.find(x=>x.preview.type==='regain')||choices.filter(x=>x.preview.valid&&x.preview.tackleOutcome!=='foul').sort((a,b)=>(a.preview.challenge?.distance??99)-(b.preview.challenge?.distance??99))[0]||choices[2]):choices.find(x=>x.time===time);
  if(!best)return;
  this.targetMode=null;this.previewOrder(best.order);this.refresh();
 }
 tackleTiming(time){if(this.order?.kind==='tackle')this.tackle(this.order.tackle,time);}
 oneTwo(ally=1){
  if(!this.planning())return;
  if(this.order?.kind==='one-two'&&this.order.ally===ally){this.clear();return;}
  this.targetMode=null;this.previewOrder({...(this.run.suggestOneTwo(ally,{burst:this.burst,actor:this.selected,support:this.support})||{kind:'one-two',ally,burst:this.burst,path:[]}),auto:true});this.refresh();
 }
 call(){if(!this.planning())return;this.burst=false;this.previewOrder({kind:'call',path:this.order?.kind==='run'?this.order.path:[]});this.refresh();}
 aim(x){if(!this.planning())return;this.targetMode=null;this.burst=false;this.previewOrder({kind:'shot',target:{x,z:GOAL.z},chip:this.chip});this.refresh();}
 dink(){if(!this.planning()||!this.run.buffs.chip)return;this.chip=!this.chip;if(this.order?.kind==='shot')this.aim(this.order.target.x);else this.refresh();}
 directional(dx,dz){
  if(this.landscape)[dx,dz]=[dz,-dx];
  const p=this.run.state.actors[this.selected],budget=this.run.runRange+(this.burst?7:0)+(this.order?.kind==='one-two'?2:0),length=Math.hypot(dx,dz);
  this.planPath([{x:p.x+dx/length*budget,z:p.z+dz/length*budget}]);
 }
 sprint(){
  if(!this.planning()||this.run.state.bursts<1)return;
  this.burst=!this.burst;
  if(this.order?.auto){const suggested=this.run.suggestOneTwo(this.order.ally,{burst:this.burst,actor:this.selected,support:this.support});if(suggested)this.previewOrder({...suggested,auto:true});}
  else if(this.order?.kind==='shot'){this.order=null;this.preview=null;}
  else if(this.order){this.order={...this.order,burst:this.burst};this.preview=this.run.preview(this.order);}
  this.refresh();
 }
 play(){
  if(!this.planning()||!this.preview?.valid)return;
  if(this.targetMode)return;
  const result=this.run.commit(this.order);if(result.type==='invalid')return;
  this.busy=true;this.clear(false);this.anim={result,elapsed:0,last:performance.now(),duration:this.reduced ? .12 : Math.max(.2,result.duration)};
  this.refresh();
 }
 tick(){
  if(!this.anim)return;
  const now=performance.now();this.anim.elapsed+=(now-this.anim.last)/1000;this.anim.last=now;
  const progress=Math.min(1,this.anim.elapsed/this.anim.duration);this.drawFrame(this.anim.result,progress);
  if(progress>=1){const result=this.anim.result;if(this.run.state.ballOwner!==this.run.before.state.ballOwner)this.selected=this.run.selection();this.anim=null;this.busy=false;this.updateActors();if(this.practice)this.practiceResult(result);else this.refresh();}
 }
 drawFrame(result,progress){
  const f=progress*(result.count-1),a=Math.floor(f),b=Math.min(result.count-1,a+1),mix=f-a;
  const value=k=>result.frames[a*STRIDE+k]*(1-mix)+result.frames[b*STRIDE+k]*mix;
  for(let i=0;i<ACTORS;i++)this.placeActor(i,value(i*2),value(i*2+1),Math.floor(progress*result.duration*6+i)%2);
  this.placeBall({x:value(ACTORS*2),z:value(ACTORS*2+1),y:value(ACTORS*2+2)});
 }
 placeActor(i,x,z,frame=0){
  const p=this.point({x,z}),a=this.actors[i],team=this.run.state.actors[i].team;
  a.x=Math.round(p.x);a.y=Math.round(p.y);a.width=a.height=Math.max(Math.round(4.2*this.scale),Math.round(15*this.u));
  const animation=['Home','Away','Keeper','Official'][team];if(a.animationName!==animation)a.setAnimation(animation);a.animationFrame=frame;
  this.displayPositions[i]={x:a.x,y:a.y};
  if(i===this.selected){this.ring.x=a.x;this.ring.y=a.y;this.ring.width=5.3*this.scale;this.ring.height=3.1*this.scale;}
 }
 placeBall(ball){const p=this.point(ball);this.ball.x=Math.round(p.x);this.ball.y=Math.round(p.y-ball.y*this.scale*.65);this.ball.width=this.ball.height=Math.max(4*this.u,.7*this.scale);this.ball.moveToTop();}
 updateActors(){
  for(const a of this.run.state.actors)this.placeActor(a.id,a.x,a.z);
  for(const a of [...this.actors].sort((a,b)=>a.y-b.y))a.moveToTop();this.placeBall(this.run.state.ball);
 }
 rewind(){if(this.busy||this.intro||this.modal)return;if(this.practice){this.loadDrill(this.practice.index);return;}if(this.run.rewind()){this.selected=this.run.selection();this.clear(false);this.updateActors();this.refresh();}}
 next(){if(this.busy)return;if(this.run.continue()){this.selected=this.run.selection();this.clear(false);this.updateActors();this.refresh();}}
 collect(id){if(this.run.collect(id)){this.selected=this.run.selection();this.clear(false);this.updateActors();this.refresh();}}
 bank(){if(this.practice)return;if(this.run.claim(this.profile))saveProfile(this.storage,this.profile);}

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
  const score=view.scoreFor??0;
  this.rect(L+12*u,T+12*u,W-24*u,44*u,C.navy,null);
  const available=W-118*u;
  this.label(this.practice?'TRAINING · '+PRACTICE[this.practice.index].title:`A&C ${score}–${view.scoreAgainst??0} ${this.run.fixture.short}`,L+22*u,T+17*u,available,18*u,14,C.cream);
  this.label(this.practice?'NO PENALTIES · '+(this.busy?'LIVE':'PRACTICE'): `SUN ${this.run.fixtureIndex+1}/4  ·  ${view.beats*2}s  ·  LEGS ${legs}/3  ·  ${this.busy?'LIVE':this.run.defending?'DEFEND':'ATTACK'}`,L+22*u,T+36*u,available,16*u,11,C.yellow);
  this.button(this.practice?'EXIT':'SHED',R-94*u,T+18*u,50*u,30*u,()=>{if(this.practice)this.exitPractice();else{this.modal='shed';this.refresh();}},!this.busy);
  this.button('?',R-38*u,T+18*u,24*u,30*u,()=>{this.modal='help';this.refresh();},!this.busy);
  if(this.planning()){this.drawPlans();this.drawTargets();this.orders();}
  else if(!this.intro&&!this.modal&&!this.busy&&this.run.phase==='pickup')this.pickupUi();
  if(this.busy)this.label('BALL IN PLAY',this.landscape?R-250*u:L+W*.25,this.landscape?T+82*u:B-110*u,this.landscape?238*u:W*.5,25*u,14,C.cream,'center');
  if(this.intro)this.introUi();else if(this.practice?.outcome&&!this.busy)this.practiceOutcomeUi();else if(!this.practice&&!this.busy&&['goal','setback','over','champion'].includes(this.run.phase))this.resultUi();
  if(this.practice&&!this.practice.outcome&&!this.busy&&!this.modal)this.practiceHint();
  if(this.modal)this.modalUi();
  for(let i=this.labelCount;i<this.labels.length;i++)this.labels[i].isVisible=false;
 }
 orders(){
  if(this.run.defending){this.defenseOrders();return;}
  const {left:L,right:R,bottom:B,width:W}=this.v,u=this.u,kind=this.order?.kind,owner=this.run.state.ballOwner,selected=this.run.state.actors[this.selected],name=this.run.state.actors[this.order?.ally??owner].role.toUpperCase();
  const player=selected.role==='you'?'STRIKER':selected.role.toUpperCase();
  let title=player+(this.selected===owner?' · BALL':' · OFF BALL')+'  |  '+(this.targetMode==='pass'?'PICK PASS':this.targetMode==='one-two'?'PICK 1–2':this.targetMode==='shot'?'PICK CORNER':kind==='pass'?'PASS TO '+name:kind==='one-two'?'1–2 WITH '+name:kind==='shot'?'SHOT':kind==='call'?'RETURN PASS':'PLAN RUN');
  let text=this.targetMode==='pass'?'Tap a teammate to pass.':this.targetMode==='one-two'?'Tap a teammate for a return run.':this.targetMode==='shot'?'Tap either corner of the goal.': this.run.message||'Tap a player to select. Tap grass to run.';
  let danger=false;
  if(this.preview&&!this.targetMode){
   if(!this.preview.valid){text=this.preview.error;danger=true;}
   else if(this.preview.type!=='move'&&this.preview.type!=='goal'){text=this.preview.detail;danger=true;}
   else text=kind==='pass'?(this.preview.delivery?'Arrival '+this.preview.order.receiveAt.toFixed(1)+'s · '+Math.round(this.preview.delivery.speed)+'m/s.':'Automatic lead pass. Choose a reception time below.'):kind==='one-two'?'Return run ready. Adjust it on the grass.':'Plan ready. Select another player to add a run.';
  }
  const wide=this.landscape,x=wide?R-250*u:L+12*u,y=wide?this.v.top+66*u:B-210*u,panelWidth=wide?238*u:W-24*u,inner=panelWidth-20*u,w=(inner-12*u)/3,bh=wide?38*u:29*u,first=y+(wide?100:65)*u,second=first+bh+6*u;
  this.rect(x,y,panelWidth,wide?308*u:198*u,C.navy,null);
  this.label(title,x+10*u,y+8*u,inner,wide?40*u:20*u,14,danger?C.orange:C.yellow);
  this.label(text,x+10*u,y+(wide?50:28)*u,inner,wide?46*u:34*u,12,danger?C.orange:C.cream);
  if(kind==='pass'){
   this.label('RECEIVE AT',x+10*u,second+bh+5*u,inner,15*u,10,C.cyan);
   const times=[null,...ACTION_TIMES],tw=(inner-4*3*u)/5;
   times.forEach((time,i)=>this.button(time===null?'AUTO':time.toFixed(1)+'s',x+10*u+i*(tw+3*u),second+bh+21*u,tw,26*u,()=>this.reception(time),true,(this.order.receiveAt??null)===time));
  }else if(wide){const planned=Object.keys(this.support).length+(this.order?.path?.length?1:0);this.label(`${planned} RUN${planned===1?'':'S'} QUEUED\n${this.run.state.passes} ONE-TWO${this.run.state.passes===1?'':'S'} LEFT`,x+10*u,second+bh+12*u,inner,45*u,12,C.cyan);}
  const hasBall=this.selected===owner;
  this.button(hasBall?'PASS':'CALL',x+10*u,first,w,bh,()=>hasBall?this.target('pass'):this.call(),true,this.targetMode==='pass');
  this.button('1–2',x+10*u+w+6*u,first,w,bh,()=>this.ballAction('one-two'),this.run.state.passes>0,this.targetMode==='one-two');
  this.button(this.chip?'DINK':'SHOOT',x+10*u+2*(w+6*u),first,w,bh,()=>this.ballAction('shot'),true,this.targetMode==='shot');
  this.button('SPRINT '+this.run.state.bursts,x+10*u,second,w,bh,()=>this.sprint(),this.run.state.bursts>0,this.burst);
  this.button('REWIND',x+10*u+w+6*u,second,w,bh,()=>this.rewind(),!!this.run.before&&this.run.rewinds>0);
  this.button('PLAY 2s',x+10*u+2*(w+6*u),second,w,bh,()=>this.play(),!!this.preview?.valid&&!this.targetMode,false,true);
 }
 defenseOrders(){
  const {left:L,right:R,bottom:B,width:W}=this.v,u=this.u,wide=this.landscape,x=wide?R-250*u:L+12*u,y=wide?this.v.top+66*u:B-210*u,pw=wide?238*u:W-24*u,inner=pw-20*u,w=(inner-12*u)/3,bh=wide?35*u:27*u,first=y+(wide?100:60)*u,second=first+bh+5*u,third=second+bh+5*u,fourth=third+bh+5*u;
  const a=this.run.state.actors[this.selected],th=this.run.threat,pr=this.preview,challenge=this.order?.kind==='tackle',recovery=this.run.state.tackleRecovery?.[a.id]>0;
  const title=(a.id===15?'KEEPER':a.role.toUpperCase())+' · '+(recovery?'RECOVERING':challenge?this.order.tackle.toUpperCase()+' '+this.order.tackleAt.toFixed(1)+'s':this.run.state.freeKick?'FREE KICK':th.kind.toUpperCase());
  const msg=pr?.valid?(pr.type==='regain'||pr.tackleOutcome||pr.type==='foul'?pr.detail:pr.type==='conceded'?'Goal predicted. Try a block or another player.':'Plan set. '+th.detail):pr?.error||(this.run.state.freeKick?'Free kick. Intercept the pass or block the shot.':this.run.message+' '+th.detail);
  this.rect(x,y,pw,wide?308*u:198*u,C.navy,null);
  this.label(title,x+10*u,y+8*u,inner,wide?40*u:20*u,14,C.orange);
  const ch=pr?.challenge,check=ch?(ch.protected?'BALL IN FLIGHT':pr.tackleOutcome==='foul'?'FOUL · FROM BEHIND':(pr.tackleOutcome==='won'?'WIN':'MISS')+' · '+ch.distance.toFixed(1)+'m / '+ch.reach.toFixed(1)+'m reach'):msg;
  this.label(check,x+10*u,y+(wide?50:28)*u,inner,wide?46*u:32*u,12,pr?.type==='regain'?C.cyan:pr?.type==='foul'||pr?.tackleOutcome==='miss'?C.red:C.cream);
  this.button('PRESS',x+10*u,first,w,bh,()=>this.defend(false),true,this.order?.kind==='run');
  this.button('COVER',x+10*u+w+6*u,first,w,bh,()=>this.defend(true));
  this.button('SPRINT '+this.run.state.bursts,x+10*u+2*(w+6*u),first,w,bh,()=>this.sprint(),this.run.state.bursts>0,this.burst);
  this.button('STAND',x+10*u,second,w,bh,()=>this.tackle('stand'),a.id!==15&&!recovery,challenge&&this.order.tackle==='stand');
  this.button('SLIDE',x+10*u+w+6*u,second,w,bh,()=>this.tackle('slide'),a.id!==15&&!recovery,challenge&&this.order.tackle==='slide');
  this.button('HOLD',x+10*u+2*(w+6*u),second,w,bh,()=>this.hold());
  if(challenge){const tw=(inner-9*u)/4;this.challengeChoices(this.order.tackle).forEach(({time,preview},i)=>{const x0=x+10*u+i*(tw+3*u);this.button(time.toFixed(1)+'s',x0,third,tw,bh,()=>this.tackleTiming(time),true,time===this.order.tackleAt);const tone=preview.tackleOutcome==='won'?C.cyan:preview.tackleOutcome==='foul'?C.red:preview.type==='regain'?C.cyan:C.orange;this.rect(x0+3*u,third+bh-4*u,tw-6*u,2*u,tone,null);});}
  else this.label('Stand: safe reach. Slide: longer, foul risk.',x+10*u,third+3*u,inner,bh,11,C.cyan);
  this.button('REWIND',x+10*u,fourth,w,bh,()=>this.rewind(),!!this.run.before&&this.run.rewinds>0);
  this.button('PLAY 2s',x+10*u+w+6*u,fourth,2*w+6*u,bh,()=>this.play(),!!pr?.valid,false,true);
 }
 drawPlans(){
  const u=this.u,local=p=>{const q=this.point(p);return {x:q.x-this.v.left,y:q.y-this.v.top};};
  const draw=(points,color,dash=false)=>{for(let i=1;i<points.length;i++){const a=local(points[i-1]),b=local(points[i]);if(dash)this.plans.lineDashed(a.x,a.y,b.x,b.y,color,1.3*u,4*u);else this.plans.line(a.x,a.y,b.x,b.y,color,1.6*u);}};
  if(this.run.defending&&this.run.threat)draw([this.run.threat.from,this.run.threat.target],C.orange,true);
  for(const a of this.run.state.actors){if(!a.active&&a.id!==14)continue;const intent=this.run.intents[a.id],p=local(intent);draw([a,intent],C.orange,true);this.plans.outlineEllipse(p.x,p.y,4*u,4*u,C.orange,u,false);}
  for(const [id,points] of Object.entries(this.support)){const path=route(this.run.state.actors[id],points,this.run.runRange);draw(path,C.cyan);const p=local(path.at(-1));this.plans.outlineEllipse(p.x,p.y,6*u,6*u,C.cyan,u,false);}
  if(!this.order)return;
  const p=this.preview?.valid?this.preview.order:this.order;
  if(p.kind==='shot')draw([this.run.state.ball,p.target],C.yellow,true);
  else{
   const budget=p.budget??(this.run.runRange+(this.burst?7:0)+(p.kind==='one-two'?2:0)),path=route(this.run.state.actors[this.selected],p.path,budget),end=this.point(path.at(-1));
   draw(path,C.yellow);this.ghost.isVisible=true;this.ghost.x=end.x;this.ghost.y=end.y;this.ghost.width=this.ghost.height=this.scale*4.2;
   if(this.preview?.passPoints&&!this.run.defending)draw(this.preview.passPoints,C.cyan,true);
  }
  for(const mark of this.receptionMarkers()){const q=local(mark.p),chosen=this.order.receiveAt===mark.time;this.plans.outlineEllipse(q.x,q.y,(chosen?7:4)*u,(chosen?7:4)*u,chosen?C.yellow:C.cyan,1.5*u,false);}
  if(this.preview?.delivery){const q=local(this.preview.delivery.target);this.plans.outlineEllipse(q.x,q.y,7*u,7*u,C.yellow,2*u,false);}
  if(this.order?.kind==='tackle'){const ch=this.preview?.challenge;if(ch){const q=local(ch.defender),b=local(ch.ball),tone=this.preview.tackleOutcome==='won'?C.cyan:this.preview.tackleOutcome==='foul'?C.red:C.orange,r=ch.reach*this.scale;this.plans.outlineEllipse(q.x,q.y,r*2,r*2,tone,1.8*u,false);this.plans.outlineEllipse(b.x,b.y,5*u,5*u,C.yellow,1.5*u,false);this.plans.lineDashed(q.x,q.y,b.x,b.y,tone,1.5*u,3*u);}else{const tp=this.run.tacklePointAt(this.order.tackleAt);if(tp){const q=local(tp);this.plans.outlineEllipse(q.x,q.y,6*u,6*u,C.yellow,1.5*u,false);}}}
  if(this.preview?.point){const p=local(this.preview.point),r=5*u;this.plans.line(p.x-r,p.y-r,p.x+r,p.y+r,C.red,2*u);this.plans.line(p.x-r,p.y+r,p.x+r,p.y-r,C.red,2*u);}
 }
 drawTargets(){
  const u=this.u,owner=this.run.state.ballOwner,holder=this.run.state.actors[owner],local=p=>{const q=this.point(p);return {x:q.x-this.v.left,y:q.y-this.v.top};};
  if(this.run.defending){const q=local(holder);this.plans.outlineEllipse(q.x,q.y,Math.max(6*u,2.9*this.scale),Math.max(4*u,1.6*this.scale),C.orange,2*u,false);}
  for(const a of HOME_IDS.map(id=>this.run.state.actors[id])){
   const p=this.point(a),q=local(a),active=a.id===this.selected,carrier=a.id===owner;
   const eligible=this.targetMode==='pass'?a.id!==owner&&distance(holder,a)<=PASS_RANGE:this.targetMode==='one-two'?a.id!==owner&&distance(holder,a)<=29:false;
   if(eligible||carrier)this.plans.outlineEllipse(q.x,q.y,Math.max(6*u,2.9*this.scale),Math.max(4*u,1.6*this.scale),eligible?C.cyan:C.cream,1.5*u,false);
   if(active||carrier||eligible){
    const name=a.id===15?'GK':a.role==='you'?'ST':a.role.toUpperCase();
    this.label(name,p.x-25*u,p.y+3*u,50*u,14*u,10,active?C.yellow:C.cream,'center');
   }
  }
  if(this.targetMode==='shot'&&this.run.buffs.chip)this.button(this.chip?'DINK ON':'DINK',this.v.right-102*u,this.landscape?this.v.top+384*u:this.v.top+64*u,90*u,28*u,()=>this.dink(),true,this.chip);
  if(this.targetMode==='shot')for(const x of [-5.8,5.8]){const p=this.point({x,z:-47});this.button(this.landscape?(x<0?'HIGH':'LOW'):(x<0?'LEFT':'RIGHT'),p.x-(this.landscape?0:23*u),p.y-22*u,46*u,22*u,()=>this.aim(x));}
 }
 panel(width,height){const u=this.u,v=this.v,w=Math.min(width*u,v.width-26*u),h=Math.min(height*u,v.height-170*u),x=v.left+(v.width-w)/2,y=v.top+(v.height-h)/2;this.rect(x,y,w,h);return {x,y,w,h,u};}
 introUi(){
  const {x,y,w,h,u}=this.panel(465,295);
  this.label('THE NEXT TWO SECONDS.',x+20*u,y+20*u,w-40*u,65*u,27,C.yellow);
  this.label('Learn the controls on the pitch in five short drills.\nMove, pass into space, shoot and tackle.\nNo lives lost, no time pressure.',x+20*u,y+85*u,w-40*u,80*u,14);
  this.button('PLAY TUTORIAL',x+20*u,y+h-88*u,w-40*u,34*u,()=>this.startPractice(),true,false,true);
  this.button('STEP ONTO THE PITCH',x+20*u,y+h-48*u,w-40*u,32*u,()=>{this.intro=false;this.refresh();});
 }
 practiceHint(){
  const {left:L,top:T,right:R,bottom:B,width:W}=this.v,u=this.u;
  const x=this.landscape?R-250*u:L+12*u,y=this.landscape?T+380*u:B-239*u,w=this.landscape?238*u:W-24*u,h=this.landscape?68*u:27*u;
  this.rect(x,y,w,h,C.navy,null);this.label(PRACTICE[this.practice.index].hint,x+5*u,y+2*u,w-10*u,h-3*u,this.landscape?12:10,C.cream);
 }
 practiceOutcomeUi(){
  this.buttons=[];
  const {x,y,w,h,u}=this.panel(465,245),o=this.practice.outcome,i=this.practice.index;
  this.label(o.passed?(i===PRACTICE.length-1?'TRAINING COMPLETE':'WELL PLAYED!'):'HAVE ANOTHER GO',x+16*u,y+18*u,w-32*u,40*u,24,o.passed?C.yellow:C.orange);
  this.label(o.passed?'That worked. '+(i===PRACTICE.length-1?'Take it into the cup.':'Ready for the next drill?'):o.detail+'\n'+PRACTICE[i].hint,x+16*u,y+65*u,w-32*u,h-153*u,14);
  this.button(o.passed?(i===PRACTICE.length-1?'PLAY THE CUP':'NEXT DRILL'):'RETRY DRILL',x+16*u,y+h-82*u,w-32*u,32*u,()=>o.passed?(i===PRACTICE.length-1?this.exitPractice():this.loadDrill(i+1)):this.loadDrill(i),true,false,true);
  this.button(o.passed?'REPEAT DRILL':'EXIT TUTORIAL',x+16*u,y+h-43*u,w-32*u,28*u,()=>o.passed?this.loadDrill(i):this.exitPractice());
 }
 resultUi(){
  if(['over','champion'].includes(this.run.phase))this.bank();
  const phase=this.run.phase,headline=phase==='goal'?'FULL TIME · WIN':phase==='champion'?'PUB LEGEND.':phase==='over'?'LEGS GONE.':'FULL TIME · REPLAY';
  const {x,y,w,h,u}=this.panel(465,240);this.label(headline,x+20*u,y+20*u,w-40*u,45*u,26,phase==='setback'?C.orange:C.yellow);
  this.label(['over','champion'].includes(phase)?`${this.run.goals} WINS · ${this.run.scored} GOALS · £${this.run.bank} BANKED\nWork in the morning.`:this.run.message,x+20*u,y+77*u,w-40*u,h-133*u,14);
  if(phase==='setback'&&this.run.rewinds>0)this.button('REWIND',x+20*u,y+h-88*u,w-40*u,30*u,()=>this.rewind());
  this.button(phase==='goal'?'NEXT SUNDAY':phase==='setback'?'REPLAY MATCH':'ONE MORE SUNDAY',x+20*u,y+h-48*u,w-40*u,32*u,()=>['goal','setback'].includes(phase)?this.next():this.newRun(),true,false,true);
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
  if(help)this.label('Select a home player and tap grass to plan movement.\nSelect another to queue simultaneous runs.\nPASS: choose a teammate, then choose reception time.\n1–2: quick return run. SHOOT: pick a corner.\nPRESS: approach. COVER: block a passing lane.\nSTAND: 2.1m reach. SLIDE: 3.7m; avoid the rear.\nChoose timing: cyan = win, orange = miss, red = foul.\nThe ring shows your reach AT the chosen time.\n\nSpace: play · Tab: select · P: pass/press\nO: one-two/cover · T: stand · F: slide\nArrows/WASD: run · B: sprint · R: rewind\nEnter: continue · Escape: cancel',x+20*u,y+67*u,w-40*u,h-152*u,12);
  else{
   this.label(`CLUB KITTY: £${this.profile.kitty}\nUpgrades apply to the next run.`,x+20*u,y+67*u,w-40*u,52*u,14);
   Object.entries(UPGRADES).forEach(([id,a],i)=>{this.label(`${a.name}\n${a.text}`,x+20*u,y+(135+i*70)*u,w-135*u,56*u,13);this.button(this.profile[id]>=a.max?'SORTED':`£${a.price}`,x+w-100*u,y+(139+i*70)*u,80*u,34*u,()=>{if(purchase(this.profile,id)){saveProfile(this.storage,this.profile);this.refresh();}},this.profile[id]<a.max&&this.profile.kitty>=a.price);});
  }
  if(help&&!this.practice)this.button('PLAY TUTORIAL',x+20*u,y+h-78*u,w-40*u,29*u,()=>this.startPractice(),true,false,true);
  this.button('BACK TO THE PITCH',x+20*u,y+h-45*u,w-40*u,30*u,()=>{this.modal=null;this.refresh();});
 }
 pointerDown(e){
  if(e.button!==undefined&&e.button!==0)return;
  const [x,y]=this.field.cssPxToLayer(e.clientX,e.clientY),button=[...this.buttons].reverse().find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
  if(button){this.drag={id:e.pointerId,button,x,y,moved:false};return;}
  if(!this.planning())return;
  const p=this.ground(x,y);this.drag={id:e.pointerId,x,y,points:[],near:distance(p,this.run.state.actors[this.selected])<6,moved:false};
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
   if(!this.targetMode&&this.order?.kind==='pass'){const markers=this.receptionMarkers().sort((a,b)=>distance(a.p,p)-distance(b.p,p));if(markers.length&&distance(markers[0].p,p)<Math.max(1.2,7*this.u/this.scale)){this.reception(markers[0].time);return;}}
   if(this.targetMode==='shot'){if(p.z<-40&&Math.abs(p.x)<10)this.aim(p.x);return;}
   const a=HOME_IDS.map(id=>this.run.state.actors[id]).sort((a,b)=>distance(p,a)-distance(p,b))[0];
   if(distance(p,a)<Math.max(3.4,9*this.u/this.scale)){
    if(this.targetMode==='pass')this.pass(a.id);
    else if(this.targetMode==='one-two')this.oneTwo(a.id);
    else this.select(a.id);
    return;
   }
   if(this.targetMode)return;
  }
  this.planPath(d.near&&d.moved&&d.points.length?d.points:[p]);
 }
 key(e){
  if(e.repeat)return;const k=e.key.toLowerCase();
  if(this.modal){if(k==='escape')this.modal=null;this.refresh();return;}
  if(this.busy)return;
  if(k==='enter'){if(this.practice?.outcome){const {index,outcome}=this.practice;if(!outcome.passed)this.loadDrill(index);else if(index===PRACTICE.length-1)this.exitPractice();else this.loadDrill(index+1);}else if(this.intro){this.startPractice();}else if(['goal','setback'].includes(this.run.phase))this.next();else if(['champion','over'].includes(this.run.phase))this.newRun();return;}
  if(this.intro)return;
  if(this.practice?.outcome){if(k==='escape')this.exitPractice();return;}
  if(k==='r'){this.rewind();return;}
  if(this.run.phase==='pickup'&&['1','2','3'].includes(k)){this.collect(this.run.offers[Number(k)-1]);return;}
  if(!this.planning())return;
  const directions={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0],q:[-1,-1],e:[1,-1]};
  if(directions[k])this.directional(...directions[k]);else if(k===' ')this.play();else if(k==='tab'){e.preventDefault?.();this.select(HOME_IDS[(HOME_IDS.indexOf(this.selected)+(e.shiftKey?7:1))%8]);}else if(k==='p'){if(this.run.defending)this.defend(false);else if(this.selected===this.run.state.ballOwner)this.target('pass');else this.call();}
  else if(k==='o'){if(this.run.defending)this.defend(true);else this.ballAction('one-two');}else if(k==='h')this.hold();else if(k==='b')this.sprint();else if((k==='1'||k==='2')&&!this.run.defending){if(this.selected!==this.run.state.ballOwner)this.select(this.run.state.ballOwner);this.aim(k==='1'?-5.8:5.8);}
  else if(k==='t'&&this.run.defending)this.tackle('stand');else if(k==='f'&&this.run.defending)this.tackle('slide');
  else if(k==='c')this.dink();
  else if(k==='escape')this.clear();
 }
}
