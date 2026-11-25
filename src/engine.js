// Football in two-second turns. Preview and playback use the same rules.
export const BEAT=2, STEPS=60, ACTORS=20, STRIDE=43;
export const GOAL={z:-47,left:-6.1,right:6.1};
export const BOUNDS={left:-34,right:34,top:-44.5,bottom:36};
export const FIXTURES=[
 {name:'The Railway Arms',short:'RAILWAY',ground:'Recreation Ground',mood:'Their back line has just finished a night shift.',defenders:3,speed:6.5,keeper:4,beats:6},
 {name:'AFC Municipal',short:'MUNICIPAL',ground:'Council Pitch No. 3',mood:'A tighter back four. Make them commit, then go around.',defenders:4,speed:7,keeper:4.5,beats:6},
 {name:'Station Road Social',short:'STATION RD',ground:'The Playing Fields',mood:'They crowd the middle. Kev still has a bit of space.',defenders:5,speed:7.4,keeper:5,beats:6},
 {name:'The Dog & Duck',short:'DOG & DUCK',ground:'Saltmere Common',mood:'The holders. One good run and you are a pub legend.',defenders:6,speed:7.8,keeper:5.5,beats:7},
];
export const GEAR={
 boots:{name:'Borrowed boots',short:'BOOTS',icon:'boots',text:'Run 3 metres further each turn.',effect:'range',amount:3},
 wind:{name:'Second wind',short:'SECOND WIND',icon:'orange',text:'One extra sprint in every attack.',effect:'bursts',amount:1},
 kev:{name:'Kev gets it',short:'KEV GETS IT',icon:'shirt',text:'One extra one-two in every attack.',effect:'passes',amount:1},
 touch:{name:'Close control',short:'CLOSE CONTROL',icon:'ball',text:'Defenders must get 0.55m closer to tackle.',effect:'control',amount:.55},
 dink:{name:'Cheeky dink',short:'CHEEKY DINK',icon:'ball',text:'Unlock a chip that lifts the ball over tackles.',effect:'chip',amount:1},
 range:{name:'Have a go',short:'HAVE A GO',icon:'boots',text:'Shoot from 8 metres further out.',effect:'shotRange',amount:8},
 thought:{name:'Second thought',short:'SECOND THOUGHT',icon:'watch',text:'Another rewind. Change your last decision.',effect:'rewind',amount:1},
 tape:{name:'Tape it up',short:'TAPE IT UP',icon:'tape',text:'Recover one of your three legs.',effect:'heal',amount:1},
};
export const UPGRADES={
 training:{name:'Wednesday five-a-side',price:35,max:3,text:'+0.5m to every run. Three levels.'},
 warmup:{name:'An actual warm-up',price:50,max:1,text:'One extra sprint in every attack.'},
};
export const clone=v=>structuredClone(v);
export const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const lerp=(a,b,f)=>({x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f});
const cleanPoint=p=>({x:clamp(p.x,BOUNDS.left,BOUNDS.right),z:clamp(p.z,BOUNDS.top,BOUNDS.bottom)});
export function route(start,requested,budget){
 const points=[{x:start.x,z:start.z}];let remaining=budget;
 for(const raw of requested||[]){
  if(!Number.isFinite(raw?.x)||!Number.isFinite(raw?.z))continue;
  const p=cleanPoint(raw),prev=points.at(-1),d=distance(prev,p);
  if(d<.15)continue;
  if(d>=remaining){points.push(lerp(prev,p,remaining/d));break;}
  points.push(p);remaining-=d;
 }
 return points;
}
export function routeLength(points){let d=0;for(let i=1;i<points.length;i++)d+=distance(points[i-1],points[i]);return d;}
export function along(points,travelled){
 for(let i=1;i<points.length;i++){const d=distance(points[i-1],points[i]);if(travelled<=d)return lerp(points[i-1],points[i],d?travelled/d:0);travelled-=d;}
 return {...points.at(-1)};
}
const toward=(a,b,metres)=>lerp(a,b,Math.min(1,metres/(distance(a,b)||1)));
export function defaultProfile(){return {version:2,kitty:0,training:0,warmup:0,runs:0,cups:0,best:0};}
export function readProfile(storage){
 try{
  const saved=JSON.parse(storage.getItem('sunday-pitch-profile')||storage.getItem('sunday-profile')||'null');
  if(!saved||![1,2].includes(saved.version))return defaultProfile();
  const p=defaultProfile();
  for(const k of ['kitty','runs','cups','best'])if(Number.isSafeInteger(saved[k])&&saved[k]>=0)p[k]=saved[k];
  p.training=clamp(Math.floor(Number(saved.training)||0),0,3);p.warmup=clamp(Math.floor(Number(saved.warmup)||0),0,1);return p;
 }catch{return defaultProfile();}
}
export function saveProfile(storage,p){try{storage.setItem('sunday-pitch-profile',JSON.stringify(p));return true;}catch{return false;}}
export function purchase(p,id){const u=UPGRADES[id];if(!u||p[id]>=u.max||p.kitty<u.price)return false;p.kitty-=u.price;p[id]++;return true;}

export class Run{
 constructor(seed=Date.now(),profile=defaultProfile()){
  this.seed=Number(seed)>>>0;this.rng=this.seed||1;this.profile={...profile};
  this.fixtureIndex=0;this.phase='ready';this.lives=3;this.goals=0;this.bank=0;this.rewinds=1;
  this.gear=[];this.history=[];this.attempt=0;this.claimed=false;
  this.buffs={range:0,bursts:0,passes:0,control:0,chip:0,shotRange:0};
 }
 get fixture(){return FIXTURES[this.fixtureIndex];}
 get runRange(){return 11+this.profile.training*.5+this.buffs.range;}
 get shotRange(){return 26+this.buffs.shotRange;}
 get tackleRadius(){return 2.15-this.buffs.control;}
 random(){let t=this.rng+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
 start(){if(this.phase!=='ready')return false;this.newAttack();return true;}
 newAttack(){
  this.attempt++;
  const mirror=this.attempt===1?1:(this.random()>.5?-1:1),shift=this.fixtureIndex?(this.random()-.5)*3:0;
  const p=[
   [[-11,9,-3,6][this.fixtureIndex],this.fixtureIndex*1.5,0,'you'],[-21,-22,0,'kev'],[20,-24,0,'daz'],[7,-1,0,'mo'],[-22,16,0,'lee'],[24,20,0,'al'],[1,30,0,'gaz'],
   [-3,-21,1,'marker'],[10,-29,1,'cover'],[-15,-33,1,'cover'],[13,-14,1,'marker'],[-23,-25,1,'cover'],[0,-37,1,'cover'],
   [25,24,1,'deep'],[0,-45,2,'keeper'],[0,45,2,'home-keeper'],[-29,-2,3,'ref'],[44,16,3,'bench'],[44,23,0,'bench'],[-44,-17,3,'bench'],
  ];
  const activeEnd=7+this.fixture.defenders;
  this.state={
   actors:p.map((a,i)=>({id:i,x:a[0]*(i<14?mirror:1)+(i>=7&&i<activeEnd?shift:0),z:i>=activeEnd&&i<13?19+(i-10)*6:a[1],team:a[2],role:a[3],active:i>=7&&i<activeEnd})),
   beats:this.fixture.beats,bursts:1+this.profile.warmup+this.buffs.bursts,passes:1+this.buffs.passes,lastMove:{x:0,z:-1},
  };
  this.state.ball={x:this.state.actors[0].x+.5,z:this.state.actors[0].z-1,y:.6};
  this.intents=this.makeIntents();this.phase='planning';this.before=null;this.lastResult=null;
  this.message=this.attempt===1?'Find a way through. They move when you do.':'New attack. A different angle. Same dodgy knee.';
 }
 makeIntents(){
  const player=this.state.actors[0];
  return this.state.actors.map((a,i)=>{
   if(a.active){
    const target=a.role==='marker'?{x:player.x+this.state.lastMove.x*3,z:player.z+this.state.lastMove.z*3}:{x:player.x*.55+(i===8?6:i===9?-6:0),z:Math.min(player.z-8,-29)};
    return {...toward(a,cleanPoint(target),this.fixture.speed),id:i};
   }
   if(i===14)return {...toward(a,{x:clamp(player.x*.48,-4.8,4.8),z:-44.8},this.fixture.keeper),id:i};
   if(i>0&&i<4)return {x:clamp(a.x+(player.x-a.x)*.07,-29,29),z:Math.max(-37,a.z-2),id:i};
   return {x:a.x,z:a.z,id:i};
  });
 }
 normalise(order){
  if(this.phase!=='planning'||!order||!['run','one-two','shot'].includes(order.kind))return {error:'Choose a run, a teammate or a corner of the goal.'};
  const player=this.state.actors[0];
  if(order.kind==='shot'){
   if(!Number.isFinite(order.target?.x))return {error:'Pick a corner of the goal.'};
   const target={x:clamp(order.target.x,GOAL.left,GOAL.right),z:GOAL.z-1};
   if(distance(player,target)>this.shotRange)return {error:`Too far out. Get within ${this.shotRange}m of goal.`};
   if(order.chip&&!this.buffs.chip)return {error:'You have not learned the cheeky dink yet.'};
   return {kind:'shot',target,chip:!!order.chip,path:[{x:player.x,z:player.z}]};
  }
  const burst=!!order.burst;
  if(burst&&this.state.bursts<1)return {error:'No sprints left in this attack.'};
  if(order.kind==='one-two'){
   const ally=this.state.actors[order.ally];
   if(![1,2,3].includes(order.ally)||!ally)return {error:'Pick one of your red shirts.'};
   if(this.state.passes<1)return {error:'No one-twos left in this attack.'};
   if(distance(player,ally)>29)return {error:'He is too far away to hear you.'};
  }
  const budget=this.runRange+(burst?7:0)+(order.kind==='one-two'?2:0),path=route(player,order.path,budget);
  if(path.length<2)return {error:'Click the grass to choose your run.'};
  return {kind:order.kind,path,budget,burst,ally:order.ally};
 }
 preview(order){
  const clean=this.normalise(order);if(clean.error)return {valid:false,error:clean.error};
  const r=this.simulate(clean,false);
  return {valid:true,order:clean,type:r.type,hit:r.hit,point:r.point,detail:r.detail,end:r.end.actors[0],ball:r.end.ball};
 }
 simulate(order,record=false){
  const start=this.state,positions=start.actors.map(a=>({...a})),origin={...start.actors[0]},end=clone(start);
  const frames=record?new Float32Array((STEPS+1)*STRIDE):null;
  let count=0,type='move',detail='',hit=null,point=null,ball={...start.ball};
  const pathLength=order.kind==='shot'?0:routeLength(order.path),travelTime=order.kind==='shot'?distance(start.ball,order.target)/(order.chip?27:38):BEAT;
  const moving=order.kind!=='shot',firstPass=order.kind==='one-two'?lerp(start.actors[order.ally],this.intents[order.ally],.3):null;
  const returnPoint=order.kind==='one-two'?along(order.path,order.budget*.8):null;
  for(let step=0;step<=STEPS;step++){
   const f=step/STEPS,time=f*BEAT;
   for(let i=0;i<ACTORS;i++){const a=start.actors[i],intent=this.intents[i];positions[i].x=a.x+(intent.x-a.x)*f;positions[i].z=a.z+(intent.z-a.z)*f;}
   if(moving)Object.assign(positions[0],along(order.path,Math.min(pathLength,order.budget*f)));
   if(order.kind==='shot'){
    const progress=Math.min(1,time/travelTime);ball={...lerp(start.ball,order.target,progress),y:.6+(order.chip?Math.sin(progress*Math.PI)*7:Math.sin(progress*Math.PI)*.7)};
   }else if(order.kind==='one-two'&&f<.8){
    ball=f<=.3?{...lerp(start.ball,firstPass,f/.3),y:.7}:{...lerp(firstPass,{x:returnPoint.x+.5,z:returnPoint.z-1},(f-.3)/.5),y:.7};
   }else ball={x:positions[0].x+.5,z:positions[0].z-1,y:.6};
   if(step>0){
    for(let i=7;i<=14;i++){
     if(i!==14&&!positions[i].active)continue;
     const radius=i===14?2.7:this.tackleRadius;
     if(ball.y<(i===14?3:2.2)&&distance(positions[i],ball)<radius){
      type=i===14?'save':order.kind==='one-two'&&f<.8?'intercept':'tackle';hit=i;point={x:ball.x,z:ball.z};
      detail=i===14?'Keeper got there. Could you pull him towards the other post?':type==='intercept'?'He cut out the return ball. The dashed line crossed his run.':'Caught in possession. Go around his path, or get the ball to Kev.';break;
     }
    }
    if(hit===null&&type==='move'&&order.kind==='shot'&&time>=travelTime){type='goal';detail='In the corner. Someone has spilled their tea.';}
   }
   if(frames){const offset=count*STRIDE;for(let i=0;i<ACTORS;i++){frames[offset+i*2]=positions[i].x;frames[offset+i*2+1]=positions[i].z;}frames[offset+ACTORS*2]=ball.x;frames[offset+ACTORS*2+1]=ball.z;frames[offset+ACTORS*2+2]=ball.y;}
   count++;if(type!=='move')break;
  }
  end.actors=positions;end.ball=ball;end.beats--;
  if(moving){const delta={x:positions[0].x-origin.x,z:positions[0].z-origin.z},length=Math.hypot(delta.x,delta.z)||1;end.lastMove={x:delta.x/length,z:delta.z/length};if(order.burst)end.bursts--;if(order.kind==='one-two')end.passes--;}
  if(type==='move'&&end.beats<=0){type='whistle';detail='The chance has gone. Use a sprint or a one-two to get there sooner.';}
  return {type,detail,hit,point,end,frames,count,duration:(count-1)/STEPS*BEAT,order};
 }
 commit(order){
  const clean=this.normalise(order);if(clean.error)return {type:'invalid',detail:clean.error};
  this.before={state:clone(this.state),intents:clone(this.intents),lives:this.lives,message:this.message};
  const r=this.simulate(clean,true);this.state=r.end;
  if(r.type==='goal'){this.goals++;this.bank+=20;this.phase='goal';this.history.push({name:this.fixture.short,attempt:this.attempt});}
  else if(r.type!=='move'){this.lives--;this.phase='setback';}
  else{this.phase='planning';this.intents=this.makeIntents();}
  this.message=r.detail||(clean.kind==='one-two'?'Kev actually gave it back. Now find the finish.':'New positions. New intentions. Look before you go.');
  this.lastResult={type:r.type,detail:this.message};return r;
 }
 rewind(){
  if(!this.before||!['planning','setback'].includes(this.phase)||this.rewinds<1)return false;
  this.state=clone(this.before.state);this.intents=clone(this.before.intents);this.lives=this.before.lives;this.rewinds--;this.before=null;this.phase='planning';this.lastResult=null;this.message='Same two seconds. Make a different decision.';return true;
 }
 continue(){
  if(this.phase==='setback'){if(this.lives<=0)this.phase='over';else this.newAttack();return true;}
  if(this.phase==='goal'){
   this.before=null;if(this.fixtureIndex===FIXTURES.length-1){this.phase='champion';return true;}
   const available=Object.keys(GEAR).filter(id=>!this.gear.includes(id)||['thought','tape'].includes(id));this.offers=[];
   while(this.offers.length<3&&available.length)this.offers.push(available.splice(Math.floor(this.random()*available.length),1)[0]);
   this.phase='pickup';return true;
  }return false;
 }
 collect(id){
  if(this.phase!=='pickup'||!this.offers.includes(id))return false;
  const g=GEAR[id];this.gear.push(id);
  if(g.effect==='rewind')this.rewinds++;else if(g.effect==='heal')this.lives=Math.min(3,this.lives+1);else this.buffs[g.effect]+=g.amount;
  this.fixtureIndex++;this.attempt=0;this.newAttack();return true;
 }
 claim(profile){
  if(!['over','champion'].includes(this.phase)||this.claimed)return false;
  profile.kitty+=this.bank;profile.runs++;profile.best=Math.max(profile.best,this.goals);if(this.phase==='champion')profile.cups++;
  this.claimed=true;return true;
 }
}
