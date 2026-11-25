// Football in two-second turns. Preview and playback use the same rules.
export const BEAT=2, STEPS=60, ACTORS=20, STRIDE=43;
export const GOAL={z:-47,left:-6.1,right:6.1};
export const BOUNDS={left:-34,right:34,top:-44.5,bottom:36};
export const PASS_RANGE=32;
export const ACTION_TIMES=Object.freeze([.5,1,1.5,2]);
const validTime=t=>Number.isFinite(t)&&t>=.1&&t<=BEAT;
export const HOME_IDS=Object.freeze([0,1,2,3,4,5,6,15]);
export const isHome=id=>HOME_IDS.includes(id);
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
  const p=start.id===15?{x:clamp(raw.x,-34,34),z:clamp(raw.z,-44.5,45)}:cleanPoint(raw),prev=points.at(-1),d=distance(prev,p);
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
   beats:this.fixture.beats,bursts:1+this.profile.warmup+this.buffs.bursts,passes:1+this.buffs.passes,ballOwner:0,lastMove:{x:0,z:-1},
  };
  this.state.ball={x:this.state.actors[0].x+.5,z:this.state.actors[0].z-1,y:.6};
  this.intents=this.makeIntents();this.phase='planning';this.before=null;this.lastResult=null;
  this.message=this.attempt===1?'Find a way through. They move when you do.':'New attack. A different angle. Same dodgy knee.';
 }
 makeIntents(){
  const player=this.state.actors[0],holder=this.state.actors[this.state.ballOwner];
  return this.state.actors.map((a,i)=>{
   if(a.active){
    const target=a.role==='marker'?{x:holder.x+(this.state.ballOwner===0?this.state.lastMove.x*3:0),z:holder.z+(this.state.ballOwner===0?this.state.lastMove.z*3:0)}:{x:holder.x*.55+(i===8?6:i===9?-6:0),z:Math.min(holder.z-8,-29)};
    return {...toward(a,cleanPoint(target),this.fixture.speed),id:i};
   }
   if(i===14)return {...toward(a,{x:clamp(holder.x*.48,-4.8,4.8),z:-44.8},this.fixture.keeper),id:i};
   if(i>0&&i<4)return {x:clamp(a.x+(player.x-a.x)*.07,-29,29),z:Math.max(-37,a.z-2),id:i};
   return {x:a.x,z:a.z,id:i};
  });
 }
 normalise(order){
  if(this.phase!=='planning'||!order||!['run','pass','call','one-two','shot'].includes(order.kind))return {error:'Choose a run, a teammate or a corner of the goal.'};
  const actor=order.actor??0,owner=this.state.ballOwner,holder=this.state.actors[owner];
  if(!isHome(actor))return {error:'Select one of your outfield players.'};
  const player=this.state.actors[actor],support={};
  for(const [id,points] of Object.entries(order.support||{})){
   const i=Number(id);if(isHome(i)&&i!==actor&&Array.isArray(points)){
    const path=route(this.state.actors[i],points,this.runRange);if(path.length>1)support[i]=path;
   }
  }
  if(order.kind==='shot'){
   if(owner!==actor)return {error:'Select the ball carrier before shooting.'};
   if(!Number.isFinite(order.target?.x))return {error:'Pick a corner of the goal.'};
   const target={x:clamp(order.target.x,GOAL.left,GOAL.right),z:GOAL.z-1};
   if(distance(player,target)>this.shotRange)return {error:`Too far out. Get within ${this.shotRange}m of goal.`};
   if(order.chip&&!this.buffs.chip)return {error:'You have not learned the cheeky dink yet.'};
   return {kind:'shot',actor,support,target,chip:!!order.chip,path:[{x:player.x,z:player.z}]};
  }
  const burst=!!order.burst;
  if(burst&&this.state.bursts<1)return {error:'No sprints left in this attack.'};
  if(order.kind==='one-two'){
   const ally=this.state.actors[order.ally];
   if(owner!==actor)return {error:'Select the ball carrier before starting a one-two.'};
   if(!isHome(order.ally)||order.ally===actor||!ally)return {error:'Pick one of your red shirts.'};
   if(this.state.passes<1)return {error:'No one-twos left in this attack.'};
   if(distance(player,ally)>29)return {error:'He is too far away to hear you.'};
   if(!order.path?.length){const suggested=this.suggestOneTwo(order.ally,{burst,actor,support:order.support});return suggested?this.normalise(suggested):{error:'No return run available.'};}
  }
  if(order.kind==='pass'){
   if(!isHome(order.ally)||order.ally===owner)return {error:'Pick another red shirt to pass to.'};
   if(order.receiveAt==null&&distance(holder,this.state.actors[order.ally])>PASS_RANGE)return {error:`That pass is too far. Find a teammate within ${PASS_RANGE}m.`};
  }
  if(order.kind==='call'){
   if(owner===actor)return {error:'This player already has the ball.'};
   if(distance(holder,player)>PASS_RANGE)return {error:'Move closer before calling for the ball.'};
  }
  const budget=this.runRange+(burst?7:0)+(order.kind==='one-two'?2:0),path=route(player,order.path,budget);
  if(path.length<2&&!['pass','call'].includes(order.kind)&&!(order.kind==='run'&&Object.keys(support).length))return {error:'Click the grass to choose your run.'};
  if(order.kind==='call'&&distance(holder,along(path,budget*.8))>PASS_RANGE)return {error:'That return run is too far from the ball. Choose a closer spot.'};
  const clean={kind:order.kind,actor,support,path,budget,burst:burst&&path.length>1,ally:order.ally};
  if(order.kind==='pass'&&order.receiveAt!=null){
   if(actor!==owner)return {error:'Select the ball carrier to time a pass.'};
   if(!validTime(order.receiveAt))return {error:'Choose an arrival time within the two-second turn.'};
   const receiveStep=Math.round(order.receiveAt/BEAT*STEPS),fraction=receiveStep/STEPS;
   const receiver=this.state.actors[order.ally];
   const p=support[order.ally]?along(support[order.ally],this.runRange*fraction):lerp(receiver,this.intents[order.ally],fraction);
   const target={x:p.x+.5,z:p.z-1,y:.6};
   let best=null;
   for(let step=0;step<receiveStep;step++){
    const f=step/STEPS,a=along(path,budget*f),from=step===0?{...this.state.ball}:{x:a.x+.5,z:a.z-1,y:.6};
    const length=distance(from,target),duration=(receiveStep-step)/STEPS*BEAT,speed=length/duration;
    if(length>PASS_RANGE||speed>38||speed<7)continue;
    const cost=Math.abs(speed-28)+step*.025;
    if(!best||cost<best.cost)best={from,target,releaseStep:step,receiveStep,speed,cost};
   }
   if(!best)return {error:'That reception is out of reach at this time. Pick another point on the run.'};
   clean.receiveAt=receiveStep/STEPS*BEAT;clean.delivery=best;
  }
  return clean;
 }
 suggestOneTwo(ally,{burst=false,actor=0,support={}}={}){
  if(!isHome(actor)||!isHome(ally)||ally===actor||this.state.ballOwner!==actor)return null;
  const player=this.state.actors[actor],budget=this.runRange+(burst?7:0)+2;
  let best=null,score=-Infinity;
  for(const angle of [0,-.35,.35,-.7,.7,-1.05,1.05,-1.5,1.5,Math.PI]){
   const end={x:player.x+Math.sin(angle)*budget,z:player.z-Math.cos(angle)*budget};
   for(const bend of [0,-1,1]){
    const path=bend?[{x:player.x+bend*budget*.35,z:player.z-budget*.25},end]:[end];
    const order={kind:'one-two',ally,burst,path,actor,support},p=this.preview(order);
    if(!p.valid)continue;
    const value=(p.type==='move'?10000:0)+(player.z-p.end.z)*3-distance(p.end,{x:0,z:GOAL.z})*.15;
    if(value>score){best=order;score=value;}
   }
  }
  return best;
 }
 preview(order){
  const clean=this.normalise(order);if(clean.error)return {valid:false,error:clean.error};
  const r=this.simulate(clean,false);
  return {valid:true,order:clean,type:r.type,hit:r.hit,point:r.point,detail:r.detail,end:r.end.actors[clean.actor],ball:r.end.ball,ballOwner:r.end.ballOwner,passPoints:r.passPoints,delivery:clean.delivery,tacklePoint:r.tacklePoint,tackleOutcome:r.tackleOutcome,challenge:r.challenge};
 }
 simulate(order,record=false){
  const start=this.state,actor=order.actor??0,positions=start.actors.map(a=>({...a})),origin={...start.actors[actor]},end=clone(start);
  const frames=record?new Float32Array((STEPS+1)*STRIDE):null;
  let count=0,type='move',detail='',hit=null,point=null,ball={...start.ball},owner=start.ballOwner;
  const pathLength=order.kind==='shot'?0:routeLength(order.path),travelTime=order.kind==='shot'?distance(start.ball,order.target)/(order.chip?27:38):BEAT;
  const moving=order.kind!=='shot',foot=p=>({x:p.x+.5,z:p.z-1,y:.6});
  const positionAt=(id,f)=>order.support?.[id]?along(order.support[id],this.runRange*f):lerp(start.actors[id],this.intents[id],f);
  const firstPass=order.kind==='one-two'?foot(positionAt(order.ally,.3)):null;
  const returnPoint=['one-two','call'].includes(order.kind)?foot(along(order.path,order.budget*.8)):null;
  let passTime=0,passTarget=null;
  if(order.kind==='pass'&&!order.delivery){
   passTime=distance(start.ball,foot(start.actors[order.ally]))/28;
   for(let i=0;i<4;i++){passTarget=foot(positionAt(order.ally,Math.min(1,passTime/BEAT)));passTime=distance(start.ball,passTarget)/28;}
  }
  const callStart=order.kind==='call'?foot(positionAt(start.ballOwner,.2)):null;
  const passPoints=order.kind==='pass'?(order.delivery?[order.delivery.from,order.delivery.target]:[start.ball,passTarget]):order.kind==='call'?[callStart,returnPoint]:order.kind==='one-two'?[start.ball,firstPass,returnPoint]:null;
  for(let step=0;step<=STEPS;step++){
   const f=step/STEPS,time=f*BEAT;
   for(let i=0;i<ACTORS;i++)Object.assign(positions[i],positionAt(i,f));
   Object.assign(positions[actor],moving?along(order.path,Math.min(pathLength,order.budget*f)):origin);
   let inFlight=false;
   if(order.kind==='shot'){
    const progress=Math.min(1,time/travelTime);ball={...lerp(start.ball,order.target,progress),y:.6+(order.chip?Math.sin(progress*Math.PI)*7:Math.sin(progress*Math.PI)*.7)};
   }else if(order.kind==='one-two'&&f<.8){
    ball=f<=.3?{...lerp(start.ball,firstPass,f/.3),y:.6}:{...lerp(firstPass,returnPoint,(f-.3)/.5),y:.6};inFlight=true;owner=f<.3?start.ballOwner:order.ally;
   }else if(order.kind==='pass'&&order.delivery){
    const d=order.delivery;
    if(step<d.releaseStep)ball=step===0?{...start.ball}:foot(positions[owner]);
    else if(step<d.receiveStep){ball={...lerp(d.from,d.target,(step-d.releaseStep)/(d.receiveStep-d.releaseStep)),y:.6};inFlight=true;}
    else{owner=order.ally;ball=foot(positions[owner]);}
   }else if(order.kind==='pass'){
    if(time<passTime){ball={...lerp(start.ball,passTarget,time/passTime),y:.6};inFlight=true;}else{owner=order.ally;ball=foot(positions[owner]);}
   }else if(order.kind==='call'&&f<.8){
    if(f<.2)ball=foot(positions[owner]);else{ball={...lerp(callStart,returnPoint,(f-.2)/.6),y:.6};inFlight=true;}
   }else{if(['one-two','call'].includes(order.kind))owner=actor;ball=foot(positions[owner]);}
   if(step>0){
    for(let i=7;i<=14;i++){
     if(i!==14&&!positions[i].active)continue;
     const radius=i===14?2.7:this.tackleRadius;
     if(ball.y<(i===14?3:2.2)&&distance(positions[i],ball)<radius){
      type=i===14&&order.kind==='shot'?'save':inFlight?'intercept':'tackle';hit=i;point={x:ball.x,z:ball.z};
      detail=type==='save'?'Keeper got there. Could you pull him towards the other post?':type==='intercept'?'He cut out the pass. The dashed line crossed his run.':owner===0?'Caught in possession. Go around his path, or find a red shirt.':`${start.actors[owner].role.toUpperCase()} was caught in possession. Call for it or move the ball on sooner.`;break;
     }
    }
    if(hit===null&&type==='move'&&order.kind==='shot'&&time>=travelTime){type='goal';detail='In the corner. Someone has spilled their tea.';}
   }
   if(frames){const offset=count*STRIDE;for(let i=0;i<ACTORS;i++){frames[offset+i*2]=positions[i].x;frames[offset+i*2+1]=positions[i].z;}frames[offset+ACTORS*2]=ball.x;frames[offset+ACTORS*2+1]=ball.z;frames[offset+ACTORS*2+2]=ball.y;}
   count++;if(type!=='move')break;
  }
  end.actors=positions;end.ball=ball;end.ballOwner=owner;end.beats--;
  if(moving){const delta={x:positions[actor].x-origin.x,z:positions[actor].z-origin.z},length=Math.hypot(delta.x,delta.z)||1;if(actor===0)end.lastMove={x:delta.x/length,z:delta.z/length};if(order.burst)end.bursts--;if(order.kind==='one-two')end.passes--;}
  if(type==='move'&&end.beats<=0){type='whistle';detail='The chance has gone. Use a sprint or a one-two to get there sooner.';}
  return {type,detail,hit,point,end,frames,count,duration:(count-1)/STEPS*BEAT,order,passPoints};
 }
 commit(order){
  const clean=this.normalise(order);if(clean.error)return {type:'invalid',detail:clean.error};
  this.before={state:clone(this.state),intents:clone(this.intents),lives:this.lives,message:this.message};
  const r=this.simulate(clean,true);this.state=r.end;
  if(r.type==='goal'){this.goals++;this.bank+=20;this.phase='goal';this.history.push({name:this.fixture.short,attempt:this.attempt});}
  else if(r.type!=='move'){this.lives--;this.phase='setback';}
  else{this.phase='planning';this.intents=this.makeIntents();}
  this.message=r.detail||(clean.kind==='one-two'?`${this.state.actors[clean.ally].role.toUpperCase()} gives it back. Now find the finish.`:clean.kind==='pass'?`${this.state.actors[clean.ally].role.toUpperCase()} has the ball. Build the next move.`:clean.kind==='call'?'Back at your feet. Find the finish.':this.state.ballOwner!==clean.actor?'Off-ball run complete. Choose your next player.':'New positions. New intentions. Look before you go.');
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


// Native Construct cup mode. The legacy browser prototype still uses Run.
export const MATCH_GEAR={...GEAR,
 press:{name:'Sunday league press',short:'COUNTERPRESS',icon:'boots',text:'Tackle or intercept from 0.7m further away.',effect:'press',amount:.7},
 counter:{name:'Hit them on the break',short:'COUNTERATTACK',icon:'shirt',text:'+3m on the first two turns after a regain.',effect:'counter',amount:3},
 gloves:{name:'Proper goalie gloves',short:'SAFE HANDS',icon:'tape',text:'Your keeper covers another 0.8m.',effect:'gloves',amount:.8}};
const AWAY=[7,8,9,10,11,12,13,14],foot=p=>({x:p.x+.5,z:p.z-1,y:.6});
const nearest=(ids,a,p)=>ids.reduce((b,i)=>distance(a[i],p)<distance(a[b],p)?i:b,ids[0]);
const pitchToward=(a,b,m)=>toward(a,{x:clamp(b.x,-33,33),z:clamp(b.z,-44,44)},m);
export class MatchRun extends Run{
 constructor(seed,profile){super(seed,profile);Object.assign(this.buffs,{press:0,counter:0,gloves:0});this.scored=0;this.conceded=0;this.regains=0;}
 get defending(){return !isHome(this.state?.ballOwner);}
 get runRange(){return super.runRange+(!this.defending&&this.state?.counter>0?this.buffs.counter:0);}
 selection(){return this.defending?nearest(HOME_IDS,this.state.actors,this.state.ball):this.state.ballOwner;}
 newAttack(){
  super.newAttack();
  Object.assign(this.state,{scoreFor:0,scoreAgainst:0,beats:16+this.fixtureIndex*2,extra:false,defended:false,engaged:false,counter:0,regains:0,tackleRecovery:{},freeKick:false,fouls:0});
  if(this.fixtureIndex>0)this.kickoff(false);else this.intents=this.makeIntents();
  this.message=this.defending?'They have the ball. Cut off the attack, then hit back.':'Build an attack. If you lose it, win it back.';
 }
 activate(s){for(const i of AWAY)s.actors[i].active=i!==14;s.engaged=true;}
 kickoff(home){
  const s=this.state,m=(this.seed+this.fixtureIndex+s.scoreFor+s.scoreAgainst)%2?1:-1;
  const h=[[-8,-10],[-23,-19],[22,-19],[8,5],[-19,22],[20,20],[0,31]],a=[[5,1],[-20,12],[19,13],[-8,-15],[20,-28],[-20,-29],[0,-35]];
  for(let i=0;i<7;i++){Object.assign(s.actors[i],{x:h[i][0]*m,z:h[i][1]});Object.assign(s.actors[i+7],{x:a[i][0]*m,z:a[i][1]});}
  Object.assign(s.actors[14],{x:0,z:-45});Object.assign(s.actors[15],{x:0,z:45});
  s.ballOwner=home?0:7;Object.assign(s.actors[s.ballOwner],{x:home?-3:3,z:0});s.ball=foot(s.actors[s.ballOwner]);s.lastMove={x:0,z:-1};s.counter=0;s.freeKick=false;
  this.activate(s);this.intents=this.makeIntents();
 }
 makeIntents(){
  const s=this.state;
  if(!s||isHome(s.ballOwner)){
   this.threat=null;const intents=super.makeIntents();
   if(!s.engaged)return intents;
   const holder=s.actors[s.ballOwner],ids=AWAY.slice(0,-1),press=ids.slice().sort((a,b)=>distance(s.actors[a],holder)-distance(s.actors[b],holder)).slice(0,this.fixtureIndex===3?3:2);
   for(const id of ids){
    const lane=[-20,0,20,-25,25,0,0][id-7],target=press.includes(id)?{x:holder.x,z:holder.z-1}:{x:lane*.7+holder.x*.3,z:clamp(holder.z-9-(id%3)*5,-40,32)};
    intents[id]={...pitchToward(s.actors[id],target,this.fixture.speed),id};
   }
   return intents;
  }
  const owner=s.ballOwner,h=s.actors[owner],speed=this.fixture.speed,ints=s.actors.map(a=>({x:a.x,z:a.z,id:a.id}));
  for(const id of HOME_IDS.filter(i=>i!==15)){
   const a=s.actors[id],z=Math.min(39,Math.max(a.z,Math.min(h.z+7,32)));
   ints[id]={...pitchToward(a,{x:a.x+(h.x-a.x)*.12,z},2.3),id};
  }
  for(const id of AWAY.filter(i=>i!==owner&&i!==14)){
   const a=s.actors[id],lane=[-20,0,20,-14,14,-25,25][id-7];
   ints[id]={...pitchToward(a,{x:lane,z:Math.min(38,Math.max(a.z,h.z+6))},speed*.72),id};
  }
  const k=s.actors[15];ints[15]={...toward(k,{x:clamp(h.x*.45,-4.5,4.5),z:44.8},4),id:15};
  const goal={x:k.x>=0?-5.5:5.5,z:48};
  const from={...s.ball};
  if((h.z>=24||s.freeKick&&h.z>=19)&&owner!==14&&distance(h,goal)<=30){this.threat={kind:'shot',from,target:goal,owner,detail:'Shot incoming. Block the orange line or cover the goal.'};return ints;}
  const options=AWAY.filter(i=>i!==owner&&i!==14).map(id=>{
   const target=foot(lerp(s.actors[id],ints[id],.65)),d=distance(s.actors[nearest(HOME_IDS,s.actors,target)],target);
   return {id,target,score:(target.z-h.z)*.75+d*.8,forward:target.z-h.z,range:distance(from,target)};
  }).filter(o=>o.range>=6&&o.range<=30&&o.forward>=3).sort((a,b)=>b.score-a.score);
  const defender=s.actors[nearest(HOME_IDS,s.actors,h)];
  if(options.length&&(s.freeKick||owner===14||distance(defender,h)<7||this.fixtureIndex===2&&s.beats%2===0)){
   const {id,target}=options[0];this.threat={kind:'pass',from,target,owner,receiver:id,detail:'Pass incoming. Cut the orange lane or mark the receiver.'};return ints;
  }
  if(s.freeKick){const id=AWAY.filter(i=>i!==owner&&i!==14).sort((a,b)=>distance(s.actors[a],h)-distance(s.actors[b],h))[0];this.threat={kind:'pass',from,target:foot(lerp(s.actors[id],ints[id],.65)),owner,receiver:id,detail:'Free kick. Cover the passing lane.'};return ints;}
  const dest=pitchToward(h,{x:h.x+(defender.x<=h.x?4:-4),z:Math.min(37,h.z+speed+1)},speed);
  ints[owner]={...dest,id:owner};this.threat={kind:'dribble',from,target:foot(dest),owner,detail:'They are driving forward. Press or cover the space.'};return ints;
 }
 normalise(order){
  if(!this.defending&&order?.kind!=='hold')return super.normalise(order);
  if(this.phase!=='planning'||!order||!['run','hold','tackle'].includes(order.kind))return {error:'Select a defender and plan a run or hold.'};
  const actor=order.actor??this.selection();if(!isHome(actor))return {error:'Select a home player.'};
  const burst=!!order.burst;if(burst&&this.state.bursts<1)return {error:'No sprints left in this match.'};
  const recovery=this.state.tackleRecovery||{},range=id=>this.runRange*(recovery[id]>0?.5:1);
  const budget=range(actor)+(burst?7:0),support={};
  for(const [key,points] of Object.entries(order.support||{})){const id=Number(key);if(isHome(id)&&id!==actor&&Array.isArray(points)){const p=route(this.state.actors[id],points,range(id));if(p.length>1)support[id]=p;}}
  const path=route(this.state.actors[actor],order.path||[],budget);
  if(order.kind==='run'&&path.length<2&&!Object.keys(support).length)return {error:'Tap grass to plan a run, or choose HOLD.'};
  if(order.kind==='tackle'){
   if(actor===15)return {error:'The keeper saves by covering the ball. Select an outfielder to tackle.'};
   if(recovery[actor]>0)return {error:'This player is recovering from a challenge. Choose another defender.'};
   if(!['stand','slide'].includes(order.tackle)||!validTime(order.tackleAt))return {error:'Choose a tackle type and time.'};
   return {kind:'tackle',actor,path,support,budget,burst:burst&&path.length>1,tackle:order.tackle,tackleAt:Math.round(order.tackleAt/BEAT*STEPS)/STEPS*BEAT};
  }
  return {kind:'run',actor,path,support,budget,burst:burst&&path.length>1};
 }
 tacklePointAt(time){
  const t=this.threat;if(!t)return null;
  const f=clamp(time/BEAT,0,1);
  if(t.kind==='dribble')return lerp(t.from,t.target,f);
  if(t.kind==='pass'&&f>=.65)return foot(lerp(this.state.actors[t.receiver],this.intents[t.receiver],f));
  return lerp(t.from,t.target,t.kind==='shot'?Math.min(1,time/(distance(t.from,t.target)/34)):f/.65);
 }
 defensivePoint(actor,cover=false){
  const t=this.threat;if(!t)return null;const a=this.state.actors[actor];
  if(cover)return t.kind==='dribble'?{x:t.target.x*.7,z:Math.min(39,t.target.z+5)}:lerp(t.from,t.target,.65);
  const p=[.25,.5,.75,1].map(f=>({f,p:lerp(t.from,t.target,f)}));
  p.sort((x,y)=>(distance(a,x.p)-this.runRange*x.f)-(distance(a,y.p)-this.runRange*y.f));return p[0].p;
 }
 simulate(order,record=false){
  if(!this.defending){
   const r=super.simulate(order,record);
   r.end.tackleRecovery=Object.fromEntries(Object.entries(this.state.tackleRecovery||{}).map(([id,n])=>[id,Math.max(0,n-1)]));
   if(['tackle','intercept','save'].includes(r.type)){r.end.ballOwner=r.hit;r.end.ball=foot(r.end.actors[r.hit]);r.type='turnover';r.detail='Possession lost. Recover your shape and win it back.';}
   else if(r.type==='whistle'){r.type='move';r.detail='The clock is up.';}
   return r;
  }
  const s=this.state,end=clone(s),positions=s.actors.map(a=>({...a})),actor=order.actor,t=this.threat;
  const frames=record?new Float32Array((STEPS+1)*STRIDE):null;
  let ball={...s.ball},owner=s.ballOwner,type='move',detail='',hit=null,point=null,count=0,tackleOutcome=null,tacklePoint=null,challenge=null;
  const recovery=s.tackleRecovery||{},challengeStep=order.kind==='tackle'?Math.round(order.tackleAt/BEAT*STEPS):-1;
  const length=routeLength(order.path),flight=t.kind==='shot'?distance(t.from,t.target)/34:BEAT*.65;
  for(let step=0;step<=STEPS;step++){
   const f=step/STEPS,time=f*BEAT;
   for(let i=0;i<ACTORS;i++)Object.assign(positions[i],order.support?.[i]?along(order.support[i],this.runRange*(recovery[i]>0?.5:1)*f):lerp(s.actors[i],this.intents[i],f));
   Object.assign(positions[actor],along(order.path,Math.min(length,order.budget*f)));
   const flying=t.kind==='shot'||t.kind==='pass'&&time<flight;
   if(flying){const k=Math.min(1,time/flight);ball={...lerp(t.from,t.target,k),y:.6+(t.kind==='shot'?Math.sin(k*Math.PI)*.7:0)};}
   else{if(t.kind==='pass')owner=t.receiver;ball=foot(positions[owner]);}
   if(step>0){
    // Blocks and interceptions are positional; challenges against a carrier are explicit.
    if(!s.freeKick||step>=3)for(const id of HOME_IDS){
     const radius=id===15?2.5+this.buffs.gloves:1.6+this.buffs.press;
     if((flying||id===15)&&distance(positions[id],ball)<radius&&ball.y<2.6){
      hit=id;point={x:ball.x,z:ball.z};owner=id;ball=foot(positions[id]);type='regain';detail=id===15?'Safe hands! Build from the back.':'Interception! Break forward.';break;
     }
    }
    if(type==='move'&&step===challengeStep){
     const a=positions[actor],carrier=positions[owner],slide=order.tackle==='slide',d=distance(a,ball),body=distance(a,carrier);
     const motion={x:this.intents[owner].x-s.actors[owner].x,z:this.intents[owner].z-s.actors[owner].z},speed=Math.hypot(motion.x,motion.z);
     const behind=speed>.1?((a.x-carrier.x)*motion.x+(a.z-carrier.z)*motion.z)/speed< -1.2:a.z<carrier.z-1.2;
     const reach=(slide?3.7:2.1)+this.buffs.press;challenge={defender:{x:a.x,z:a.z},ball:{x:ball.x,z:ball.z},distance:d,reach,behind,protected:flying||s.freeKick,time};
     tacklePoint={x:ball.x,z:ball.z};
     if(flying||s.freeKick){tackleOutcome='miss';detail='Ball in flight or protected. Cover the passing lane instead.';}
     else if(slide&&behind&&body<=4.2){
      tackleOutcome='foul';type='foul';point=tacklePoint;hit=actor;detail='Slide from behind: foul. They have a free kick.';
     }else if(d<=reach){
      tackleOutcome='won';type='regain';point=tacklePoint;hit=actor;owner=actor;ball=foot(a);detail=slide?'Sliding tackle won! Break forward.':'Standing tackle won! Break forward.';
     }else{tackleOutcome='miss';detail='Out of reach: '+d.toFixed(1)+'m away, '+reach.toFixed(1)+'m reach. Close down or change timing.';}
    }
    if(type==='move'&&t.kind==='shot'&&time>=flight){type='conceded';detail='They found the corner. Reset and respond.';}
   }
   if(frames){const o=count*STRIDE;for(let i=0;i<ACTORS;i++){frames[o+i*2]=positions[i].x;frames[o+i*2+1]=positions[i].z;}frames[o+ACTORS*2]=ball.x;frames[o+ACTORS*2+1]=ball.z;frames[o+ACTORS*2+2]=ball.y;}
   count++;if(type!=='move')break;
  }
  Object.assign(end,{actors:positions,ball,ballOwner:owner,beats:s.beats-1,defended:true,freeKick:type==='foul',tackleRecovery:Object.fromEntries(Object.entries(recovery).map(([id,n])=>[id,Math.max(0,n-1)]))});
  if(tackleOutcome&&(order.tackle==='slide'||tackleOutcome!=='won'))end.tackleRecovery[actor]=1;
  if(type==='foul')end.fouls=(s.fouls||0)+1;
  if(order.burst)end.bursts--;
  if(type==='regain'){end.regains++;end.counter=2;if(order.kind==='tackle'&&!challenge)detail+=' Before the scheduled tackle.';}
  return {type,detail,hit,point,end,frames,count,duration:(count-1)/STEPS*BEAT,order,passPoints:t.kind==='dribble'?null:[t.from,t.target],tacklePoint,tackleOutcome,challenge};
 }
 commit(order){
  const clean=this.normalise(order);if(clean.error)return {type:'invalid',detail:clean.error};
  this.before={state:clone(this.state),intents:clone(this.intents),threat:clone(this.threat),lives:this.lives,message:this.message,goals:this.goals,bank:this.bank,scored:this.scored,conceded:this.conceded,regains:this.regains,history:clone(this.history)};
  const defending=this.defending,r=this.simulate(clean,true);this.state=clone(r.end);this.phase='planning';const s=this.state;
  this.message=r.detail||(!defending&&clean.kind==='pass'?'Pass complete. Build the next move.':defending?'Hold your shape. Watch their next intention.':'Keep the ball moving.');
  if(!defending&&s.counter>0)s.counter--;
  if(r.type==='regain'){this.regains++;this.activate(s);}
  if(r.type==='turnover')this.activate(s);
  if(r.type==='goal'){s.scoreFor++;this.scored++;if(!s.defended)s.beats=Math.max(s.beats,4);this.kickoff(false);this.message='GET IN! Now defend the restart.';}
  else if(r.type==='conceded'){s.scoreAgainst++;this.conceded++;this.kickoff(true);this.message='They scored. Get one back.';}
  if(s.beats<=0){
   if(s.scoreFor===s.scoreAgainst&&!s.extra){s.beats=6;s.extra=true;this.message='All square. Twelve seconds of extra time.';}
   else if(s.scoreFor>s.scoreAgainst){this.phase='goal';this.goals++;this.bank+=20+(s.scoreAgainst===0?5:0)+Math.min(6,s.regains*2);this.history.push({name:this.fixture.short,attempt:this.attempt,score:[s.scoreFor,s.scoreAgainst]});this.message='Full time. '+s.scoreFor+'–'+s.scoreAgainst+'! £'+this.bank+' in the cup kitty.';}
   else{this.phase='setback';this.lives--;this.message=s.scoreFor===s.scoreAgainst?'Full time. Still level after extra time. Replay costs a leg.':'Full time. '+s.scoreFor+'–'+s.scoreAgainst+'. A replay costs a leg.';}
  }
  if(this.phase==='planning')this.intents=this.makeIntents();
  this.lastResult={type:r.type,detail:this.message};return r;
 }
 rewind(){
  if(!this.before||!['planning','setback'].includes(this.phase)||this.rewinds<1)return false;
  const b=this.before;this.state=clone(b.state);this.intents=clone(b.intents);this.threat=clone(b.threat);
  for(const k of ['lives','goals','bank','scored','conceded','regains','history'])this[k]=clone(b[k]);
  this.rewinds--;this.before=null;this.phase='planning';this.lastResult=null;this.message='Same two seconds. Try a different plan.';return true;
 }
 continue(){
  if(this.phase!=='goal')return super.continue();
  this.before=null;if(this.fixtureIndex===FIXTURES.length-1){this.phase='champion';return true;}
  const available=Object.keys(MATCH_GEAR).filter(id=>!this.gear.includes(id)||['thought','tape'].includes(id)),tactical=available.filter(id=>['press','counter','gloves'].includes(id));
  this.offers=[];if(tactical.length)this.offers.push(tactical[Math.floor(this.random()*tactical.length)]);
  while(this.offers.length<3&&available.length){const id=available.splice(Math.floor(this.random()*available.length),1)[0];if(!this.offers.includes(id))this.offers.push(id);}
  this.phase='pickup';return true;
 }
 collect(id){
  if(this.phase!=='pickup'||!this.offers.includes(id))return false;
  if(GEAR[id])return super.collect(id);
  const g=MATCH_GEAR[id];if(!g)return false;this.gear.push(id);this.buffs[g.effect]+=g.amount;this.fixtureIndex++;this.attempt=0;this.newAttack();return true;
 }
}

export const PRACTICE=[
 {title:'1/5 · MOVE',hint:'Tap grass ahead of the striker, then PLAY 2s.',actor:0},
 {title:'2/5 · PASS INTO SPACE',hint:'Select KEV, plot a run, select the passer, PASS to KEV and choose 1.0s or 1.5s.',actor:0},
 {title:'3/5 · FINISH',hint:'Choose SHOOT, pick a goal corner and PLAY 2s.',actor:0},
 {title:'4/5 · STANDING TACKLE',hint:'Select LEE. Choose STAND. Check the reach and timing, then PLAY 2s.',actor:4},
 {title:'5/5 · SLIDING TACKLE',hint:'Choose SLIDE. Approach from the side, not behind. Pick a clean timing and PLAY 2s.',actor:4}
];
export function practiceRun(index){
 const run=new MatchRun(8123,defaultProfile());run.start();const s=run.state;
 for(const a of s.actors)if(a.id>=7&&a.id<=14){a.x=32;a.z=-40;a.active=false;}
 for(const id of HOME_IDS)Object.assign(s.actors[id],{x:-28+(id%3)*4,z:22+(id%2)*7});
 const set=(id,x,z)=>Object.assign(s.actors[id],{x,z});
 set(15,0,45);set(0,0,0);set(1,8,0);
 if(index===2){set(0,4,-37);set(14,-4,-44);}
 if(index>=3){set(7,0,12);s.actors[7].active=true;set(4,index===3?5:7,17);s.ballOwner=7;}else s.ballOwner=0;
 s.ball=foot(s.actors[s.ballOwner]);s.beats=16;
 run.intents=s.actors.map(a=>({x:a.x,z:a.z,id:a.id}));
 if(index>=3){run.intents[7]={x:0,z:18,id:7};run.threat={kind:'dribble',from:{...s.ball},target:foot(run.intents[7]),owner:7,detail:'Watch the orange dribble line.'};}else run.threat=null;
 run.message=PRACTICE[index].hint;return run;
}
export function practicePassed(index,result){
 const o=result.order;
 if(index===0)return o.kind==='run'&&o.actor===0&&result.type==='move'&&distance(o.path[0],result.end.actors[0])>=3;
 if(index===1)return o.kind==='pass'&&o.ally===1&&!!o.delivery&&!!o.support[1]&&result.type==='move'&&result.end.ballOwner===1;
 if(index===2)return o.kind==='shot'&&result.type==='goal';
 return o.kind==='tackle'&&o.tackle===(index===3?'stand':'slide')&&result.tackleOutcome==='won'&&result.hit===4;
}


// Autoplay prototype: a continuous, fixed-step football simulation.
// All decisions, touches, goals and statistics come from the same seeded world.
export const AUTO_STEP=1/30;
export const AUTO_TRAITS={
 overlap:{name:'Overlap',detail:'Wide players push beyond the ball carrier.'},
 touch:{name:'One-touch',detail:'Earlier passes, quicker combinations.'},
 hunt:{name:'Ball hunters',detail:'Two players press instead of one; faster closing.'},
 rifle:{name:'Have a go',detail:'Shoot from further out, with faster strikes.'},
 counter:{name:'Counter runners',detail:'Attack quickly after winning possession.'},
 shield:{name:'Safety first',detail:'Defenders hold a deeper shape and tackle more reliably.'}
};
const AUTO_TEAMS=[HOME_IDS,[7,8,9,10,11,12,13,14]],AUTO_SHAPE=[[0,-23],[-23,-14],[23,-14],[0,0],[-18,17],[18,17],[0,28]];
const autoSide=id=>HOME_IDS.includes(id)?0:1;
const attackDir=side=>side===0?-1:1;
export class AutoMatch{
 constructor(seed=1,traits=[],opponent=0,duration=75){
  this.seed=seed>>>0;this.rng=this.seed||1;this.traits=[...new Set(traits)];this.opponent=opponent;this.duration=duration;
  this.time=0;this.finished=false;this.score=[0,0];this.stats=[0,1].map(()=>({passes:0,completed:0,shots:0,tackles:0,saves:0,interceptions:0,possession:0,bestChain:0}));this.events=[];this.chain=0;this.chainSide=-1;this.lastGain=[-99,-99];this.kickoffWait=0;
  this.actors=Array.from({length:20},(_,id)=>({id,x:44,z:24,team:id===14||id===15?2:id>=16?3:autoSide(id),role:'',cool:0,pace:5.6+this.random()*.9}));
  this.actors[16].x=-29;this.actors[16].z=0;this.actors[17].x=44;this.actors[18].x=44;this.actors[19].x=-44;
  this.kickoff(this.seed%2);this.event('KICK OFF',-1,'match');
 }
 random(){let t=this.rng+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
 has(side,trait){return side===0?this.traits.includes(trait):[['shield'],['hunt','touch'],['overlap','rifle']][Math.min(2,this.opponent)].includes(trait);}
 event(text,side,kind='play'){this.events.unshift({time:this.time,text,side,kind});if(this.events.length>8)this.events.pop();}
 kickoff(side){
  for(let t=0;t<2;t++){const dir=attackDir(t);AUTO_TEAMS[t].slice(0,7).forEach((id,i)=>{const [x,z]=AUTO_SHAPE[i];Object.assign(this.actors[id],{x:x*(t===0?1:-1),z:z*-dir*.58-dir*(t===side?0:9),cool:0});});const g=this.actors[AUTO_TEAMS[t][7]];Object.assign(g,{x:0,z:-dir*43,cool:0});}
  const id=AUTO_TEAMS[side][3];Object.assign(this.actors[id],{x:0,z:attackDir(side)*.5});this.owner=id;this.ball={x:0,z:0,y:.6};this.flight=null;this.chain=0;this.chainSide=side;this.decision=.4;this.protect=.9;this.kickoffWait=.65;this.lastGain[side]=this.time;
 }
 foot(id){const a=this.actors[id];return {x:a.x+.35,z:a.z+attackDir(autoSide(id))*.65,y:.6};}
 gain(id,kind){
  const side=autoSide(id),prior=this.flight?.side??(this.owner==null?-1:autoSide(this.owner));
  if(prior!==side||this.chainSide!==side){this.chain=0;this.chainSide=side;this.lastGain[side]=this.time;}
  this.owner=id;this.flight=null;this.ball=this.foot(id);this.protect=(id===14||id===15)?2.2:1.25;this.decision=this.has(side,'touch')?.17:.32;
  if(kind==='tackle'){this.stats[side].tackles++;this.event('BALL WON',side,'tackle');}
  if(kind==='intercept'){this.stats[side].interceptions++;this.event('INTERCEPTION',side,'tackle');}
  if(kind==='save'){this.stats[side].saves++;this.event('KEEPER SAVES',side,'save');}
 }
 launch(kind,target,receiver=null){
  const id=this.owner,side=autoSide(id),origin={...this.ball},speed=kind==='shot'?(this.has(side,'rifle')?40:35):20;
  this.flight={kind,from:origin,target,receiver,side,kicker:id,t:0,duration:Math.max(.15,distance(origin,target)/speed)};
  this.owner=null;
  if(kind==='shot'){this.stats[side].shots++;this.event('SHOT!',side,'shot');}
  else{this.stats[side].passes++;}
 }
 goal(side){
  this.score[side]++;this.event('GOAL! '+this.score[0]+'–'+this.score[1],side,'goal');this.kickoff(1-side);this.kickoffWait=1.1;
 }
 move(a,target,speed){
  const p=toward(a,{x:clamp(target.x,-32,32),z:clamp(target.z,-44,44)},speed*AUTO_STEP);a.x=p.x;a.z=p.z;
 }
 laneClear(a,b,opponents){
  const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz||1;
  let min=20;
  for(const p of opponents){const f=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/len,0,1);min=Math.min(min,distance(p,{x:a.x+dx*f,z:a.z+dz*f}));}return min;
 }
 decide(){
  if(this.owner==null)return;
  const a=this.actors[this.owner],side=autoSide(a.id),dir=attackDir(side),ids=AUTO_TEAMS[side],opp=AUTO_TEAMS[1-side].map(i=>this.actors[i]),keeper=opp[7],pressure=Math.min(...opp.map(p=>distance(p,a))),goalDist=Math.hypot(a.x,dir*47-a.z);
  if(a.id===ids[7]){const candidates=ids.slice(0,7).map(id=>{const p=this.actors[id],d=distance(a,p);return {id,p,d,score:this.laneClear(a,p,opp)*2-d*.16+Math.min(...opp.map(o=>distance(o,p)))};}).sort((a,b)=>b.score-a.score);const best=candidates[0];this.launch('pass',{x:best.p.x,z:clamp(best.p.z+dir*2,-43,43)},best.id);return;}
  const targets=[-5.1,0,5.1].map(x=>({x,z:dir*47}));
  const goal=targets.map(p=>({...p,value:distance(p,keeper)+this.laneClear(a,p,opp.slice(0,7))*.65+this.random()*4})).sort((p,q)=>q.value-p.value)[0];
  const range=this.has(side,'rifle')?30:23;
  if(a.id!==ids[7]&&goalDist<range&&(Math.abs(a.x)<18||goalDist<16)&&(this.laneClear(a,goal,opp.slice(0,7))>1.5||pressure<2.6||goalDist<10)){
   const error=(this.random()-.5)*(goalDist*.16+Math.max(0,4-pressure)*1.1);this.launch('shot',{...goal,x:goal.x+error});return;
  }
  const options=ids.slice(0,7).filter(i=>i!==a.id).map(id=>{
   const p=this.actors[id],forward=(p.z-a.z)*dir,d=distance(a,p),target={x:p.x,z:clamp(p.z+dir*Math.min(3,d*.12),-43,43)},space=Math.min(...opp.map(o=>distance(o,target))),lane=this.laneClear(a,target,opp);
   return {id,target,d,forward,score:forward*.65+Math.min(12,space)*.75+Math.min(8,lane)*1.3-d*.16+(this.random()-.5)*2,lane};
  }).filter(p=>p.d>3&&p.d<38&&p.lane>1.1).sort((a,b)=>b.score-a.score);
  const best=options[0],one=this.has(side,'touch');
  if(best&&(a.id===ids[7]||pressure<7||best.forward>4&&best.score>6||one&&best.score>5)){
   this.launch('pass',best.target,best.id);return;
  }
  this.decision=one?.22:.42;
 }
 step(){
  if(this.finished)return;
  this.time=Math.min(this.duration,this.time+AUTO_STEP);
  if(this.time>=this.duration-1e-8){this.finished=true;this.event('FULL TIME',-1,'match');return;}
  if(this.kickoffWait>0){this.kickoffWait-=AUTO_STEP;return;}
  const owner=this.owner,poss=owner==null?this.flight?.side:autoSide(owner);if(poss!=null)this.stats[poss].possession+=AUTO_STEP;
  const b={...this.ball},flight=this.flight;
  for(let side=0;side<2;side++){
   const ids=AUTO_TEAMS[side],dir=attackDir(side),attacking=poss===side,keeper=this.actors[ids[7]],pressers=ids.slice(0,7).sort((i,j)=>distance(this.actors[i],b)-distance(this.actors[j],b)).slice(0,this.has(side,'hunt')?2:1);
   const counter=this.has(side,'counter')&&this.time-this.lastGain[side]<4;
   for(let i=0;i<7;i++){
    const a=this.actors[ids[i]],wide=i===1||i===2,[baseX,baseZ]=AUTO_SHAPE[i];a.cool=Math.max(0,a.cool-AUTO_STEP);
    let target,speed=a.pace+(side===1?this.opponent*.22:0);
    if(owner===a.id){
     const goal={x:a.x*.48,z:dir*43},enemy=AUTO_TEAMS[1-side].map(id=>this.actors[id]).sort((x,y)=>distance(x,a)-distance(y,a))[0];
     target={x:goal.x+(distance(a,enemy)<5?(a.x>=enemy.x?6:-6):0),z:goal.z};speed*=.95;
    }else if(flight?.receiver===a.id){target=flight.target;speed+=.9;}
    else if(!attacking&&pressers.includes(a.id)){target={x:b.x,z:b.z};speed+=this.has(side,'hunt')?1.6:.85;}
    else{
     const forward=attacking?(i<3?9:1):this.has(side,'shield')?-9:-4;
     let z=b.z+dir*(baseZ*-1*.68+forward);
     if(attacking&&wide&&this.has(side,'overlap')){z+=dir*12;speed+=.65;}
     if(counter){z+=dir*8;speed+=1.4;}
     target={x:baseX*(side===0?1:-1)+(wide?b.x*.12:b.x*.26),z:clamp(z,-40,40)};
    }
    this.move(a,target,speed);
   }
   const goalZ=-dir*43,keeperTarget={x:clamp(b.x*.35,-5.2,5.2),z:goalZ};
   if(flight?.kind==='shot'&&flight.side!==side&&flight.t>.16)keeperTarget.x=clamp(flight.target.x,-5.2,5.2);
   else if(!attacking&&distance(keeper,b)<9&&owner!=null)Object.assign(keeperTarget,{x:b.x,z:b.z});
   this.move(keeper,keeperTarget,flight?.kind==='shot'?3.4:4.1);
  }
  this.actors[16].z=clamp(b.z+5,-32,32);
  this.protect=Math.max(0,this.protect-AUTO_STEP);this.decision-=AUTO_STEP;
  if(this.flight){
   const f=this.flight;f.t+=AUTO_STEP;const p=Math.min(1,f.t/f.duration);
   this.ball={...lerp(f.from,f.target,p),y:.6+(f.kind==='shot'?Math.sin(p*Math.PI)*.65:0)};
   const defenders=AUTO_TEAMS[1-f.side].map(id=>this.actors[id]).filter(a=>a.id!==f.kicker);
   const hit=defenders.sort((a,b)=>distance(a,this.ball)-distance(b,this.ball)).find(a=>distance(a,this.ball)<(a.id===14||a.id===15?1.65:1.35)&&p>.08);
   if(hit){this.gain(hit.id,hit.id===14||hit.id===15?'save':'intercept');return;}
   if(p>=1){
    if(f.kind==='shot'){if(Math.abs(f.target.x)<=GOAL.right){this.goal(f.side);}else{this.event('JUST WIDE',f.side,'shot');this.gain(AUTO_TEAMS[1-f.side][7]);}return;}
    const candidate=AUTO_TEAMS[f.side].map(id=>this.actors[id]).sort((a,b)=>distance(a,this.ball)-distance(b,this.ball))[0];
    const other=defenders[0];
    if(other&&distance(other,this.ball)<distance(candidate,this.ball)){this.gain(other.id,'intercept');}
    else if(distance(candidate,this.ball)<3.8){this.stats[f.side].completed++;this.chain++;this.stats[f.side].bestChain=Math.max(this.chain,this.stats[f.side].bestChain);this.gain(candidate.id);if(this.chain===3||this.chain===5)this.event(this.chain+'-PASS MOVE',f.side,'combo');}
    else{this.flight=null;this.owner=null;}
   }
  }else if(this.owner!=null){
   this.ball=this.foot(this.owner);const side=autoSide(this.owner),a=this.actors[this.owner];
   if(this.protect<=0){
    const rival=AUTO_TEAMS[1-side].map(id=>this.actors[id]).filter(p=>p.cool<=0).sort((x,y)=>distance(x,this.ball)-distance(y,this.ball))[0];
    const reach=rival&&(this.has(1-side,'shield')?2:1.6);
    if(rival&&distance(rival,this.ball)<reach){a.cool=2.8;this.gain(rival.id,rival.id===14||rival.id===15?'save':'tackle');return;}
   }
   if(this.decision<=0)this.decide();
  }else{
   const all=AUTO_TEAMS.flat().map(id=>this.actors[id]).sort((a,b)=>distance(a,this.ball)-distance(b,this.ball));
   // Loose-ball chase: both closest players converge, rather than freezing.
   for(const a of all.slice(0,2))this.move(a,this.ball,a.pace);
   if(distance(all[0],this.ball)<2.3)this.gain(all[0].id);
  }
 }
}
