// SUNDAY adapter for Soccer-JS, pinned upstream revision in engine-evaluation.yml.
// This file is copied to the upstream checkout and bundled as a browser ESM.
// No upstream rendering, audio, network fetches, or DOM controls are needed.
const {Simulator}=require('./kernel/providers/simulator/simulator.js');
const {Settings}=require('./kernel/settings.js');
const {Time}=require('./kernel/core/lib/time.js');
const {Utils}=require('./kernel/core/lib/utils.js');
const statsPreset=require('./presets/player_stats.json');
const formations=require('./presets/formations.json');
const upstreamDefaults={...Settings.AI};
delete upstreamDefaults.A;delete upstreamDefaults.B;
export const SOCCER_STEP=.05;
const side=t=>t==='A'?0:1;
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
const TRAIT_MODS={
 overlap:{SUPPORT_WIDTH:.85,ATTACK_SUPPORT_INTENSITY:.88,ATTACK_DEPTH_BIAS_REF:10.5},
 touch:{PASS_AGGRESSION:.78,FIRST_TOUCH_FUMBLE_BASE:.015,FIRST_TOUCH_FUMBLE_SCALE:.2},
 hunt:{DEFENSIVE_PRESS_INTENSITY:.76,COUNTERPRESS_MAX_SURGE:4},
 rifle:{SHOOT_RANGE_REF:49},
 counter:{COUNTERPRESS_DURATION:5.5,ATTACK_DEPTH_BIAS_REF:12,ATTACK_SUPPORT_INTENSITY:.8},
 shield:{FORMATION_HOLD:.8,DEFEND_DEPTH_BIAS_REF:-7,DEFENSIVE_PRESS_INTENSITY:.55}
};

// SUNDAY's chip deck: deliberate arcade-scale, team-local effects.
export const CHIPS={
 nitro:{name:'Nitro',tag:'PACE',minutes:12,color:[.95,.52,.16,1],detail:'+55 speed for every outfielder for 12 min.',stats:{speed:55}},
 rocket:{name:'Rocket Boot',tag:'SHOT',minutes:12,color:[.92,.28,.24,1],detail:'+45 shooting; shots fly 45% faster for 12 min.',stats:{shooting:45},ai:{SHOOT_RANGE_REF:12},shot:1.45},
 wall:{name:'Brick Wall',tag:'KEEPER',minutes:15,color:[.38,.63,.98,1],detail:'Keeper +50 goalkeeping for 15 min.',keeper:{goalkeeping:50}},
 magnet:{name:'Ball Magnet',tag:'SKILL',minutes:12,color:[.35,.83,.66,1],detail:'+45 passing and dribbling for 12 min.',stats:{passing:45,dribbling:45},ai:{FIRST_TOUCH_FUMBLE_SCALE:-.25,FIRST_TOUCH_FUMBLE_BASE:-.03}},
 scrapper:{name:'Scrapper',tag:'TACKLE',minutes:12,color:[.85,.63,.28,1],detail:'+50 tackling for 12 min.',stats:{tackling:50},ai:{DEFENSIVE_PRESS_INTENSITY:.25}},
 oneTwo:{name:'One-Two',tag:'COMBO',minutes:12,color:[.71,.50,.95,1],detail:'Arm it: two consecutive passes unlock +30 pace and shooting for 12 min.',stats:{speed:30,shooting:30}},
 double:{name:'Double Time',tag:'COMBO',color:[.90,.46,.76,1],detail:'Doubles the duration of the next timed chip this half.'},
 fresh:{name:'Fresh Legs',tag:'ENERGY',minutes:12,color:[.75,.88,.32,1],detail:'Restore team stamina; +25 speed for 12 min.',stats:{speed:25},restore:true}
};
const bounded=new Set(['SUPPORT_WIDTH','ATTACK_SUPPORT_INTENSITY','PASS_AGGRESSION','FIRST_TOUCH_FUMBLE_BASE','FIRST_TOUCH_FUMBLE_SCALE','DEFENSIVE_PRESS_INTENSITY','FORMATION_HOLD']);
export const RELOAD_COST=4;
export function chipOffers(seed,owned,stage){
 const ids=Object.keys(CHIPS).filter(id=>!owned.includes(id)&&(owned.length>0||id!=='double'));
 // Shuffle without replacement, seeded separately from match RNG.
 let n=((seed>>>0)^Math.imul(stage+1,0x9e3779b9))>>>0;
 for(let i=ids.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1);[ids[i],ids[j]]=[ids[j],ids[i]];}
 return ids.slice(0,3);
}
function teamSettings(traits){
 const out=Object.create(upstreamDefaults);
 for(const trait of traits)for(const [key,value] of Object.entries(TRAIT_MODS[trait]||{})){
  if(typeof upstreamDefaults[key]!=='number')throw Error('Unknown upstream AI setting: '+key);
  const delta=value-upstreamDefaults[key];out[key]=(Object.hasOwn(out,key)?out[key]:upstreamDefaults[key])+delta;
  if(['SUPPORT_WIDTH','ATTACK_SUPPORT_INTENSITY','PASS_AGGRESSION','FIRST_TOUCH_FUMBLE_BASE','FIRST_TOUCH_FUMBLE_SCALE','DEFENSIVE_PRESS_INTENSITY','FORMATION_HOLD'].includes(key))out[key]=clamp(out[key],0,1);
 }
 return out;
}
// Five-a-side house rules: both teams use the same lively base profile.
// All decisions remain in Soccer-JS; the adapter only changes rules and knobs.
const FIVE_PROFILE={FORMATION_HOLD:.43,ATTACK_SUPPORT_INTENSITY:.84,ATTACK_SUPPORT_OWN_HALF_BLEND:.62,ATTACK_SUPPORT_FORM_PULL:.78,ATTACK_SUPPORT_PUSH_SCALE:1.15,ATTACK_DEPTH_BIAS_REF:10,DEFENSIVE_PRESS_INTENSITY:.65,PASS_AGGRESSION:.76,SUPPORT_WIDTH:.72,SHOOT_RANGE_REF:46,SHOOT_CONTESTED_CHANCE:.45,SHOOT_FORCE_BLOCKED_CHANCE:.18,SHORT_PASS_MIN_DIST:2,SHORT_PASS_MAX_DIST:18,LONG_PASS_MIN_DIST:16,LONG_PASS_MAX_DIST:35,GK_HOLD_DURATION:.65,COUNTERPRESS_MAX_SURGE:2,PRESS_MAX_SECONDARY_DANGER:1,BODY_FOUL_CHANCE:.19,BODY_SUCCESS_FOUL_CHANCE:.07,SLIDE_FOUL_CHANCE:.09,FOOT_FOUL_CHANCE:.02};
export async function createSoccerMatch(seed,traits=[],opponent=0,duration=75,format=11,profile='express'){
 // Soccer-JS uses shared Settings; this proof runs one active match at a time.
 const baseHome=teamSettings(traits),away=teamSettings([['shield'],['hunt','touch'],['overlap','rifle']][Math.min(2,Math.max(0,opponent))]);
 const shape=format===5&&profile==='shape',express=format===5&&(profile==='express'||shape),arcade=format===5&&profile!=='original';
 if(arcade)for(const team of [baseHome,away])for(const [k,v] of Object.entries(FIVE_PROFILE)){if(typeof upstreamDefaults[k]!=='number')throw Error('Missing five-a-side setting '+k);team[k]=v;}
 if(express)for(const team of [baseHome,away])Object.assign(team,{PASS_AGGRESSION:.86,ATTACK_SUPPORT_INTENSITY:.9,ATTACK_SUPPORT_FORM_PULL:.64,ATTACK_SUPPORT_OWN_HALF_BLEND:.72,THROUGH_BALL_LEAD_EXTRA:1.8,SHORT_PASS_MAX_DIST:24,LONG_PASS_MIN_DIST:23,LONG_PASS_MAX_DIST:44,SHOOT_RANGE_REF:39,SHOOT_FORCE_BLOCKED_CHANCE:.07,SHOOT_CONTESTED_CHANCE:.38,SHOOT_SPEED_BASE:23,SHOOT_ANGLE_NOISE_SCALE:.0035,GK_SHOT_SAVE_MULT:.38,GK_DIVE_CHANCE_SHOT:.65,FIRST_TOUCH_FUMBLE_BASE:.015,FIRST_TOUCH_FUMBLE_SCALE:.19});
 if(shape)for(const team of [baseHome,away])Object.assign(team,{FORMATION_HOLD:.72,ATTACK_SUPPORT_INTENSITY:.66,DEFENSIVE_PRESS_INTENSITY:.42,PASS_AGGRESSION:.65,SHOOT_RANGE_REF:32,SHOOT_FORCE_BLOCKED_CHANCE:0,COUNTERPRESS_MAX_SURGE:1,FIRST_TOUCH_FUMBLE_BASE:.005,FIRST_TOUCH_FUMBLE_SCALE:.12});
 let home=baseHome;
 Settings.HEADLESS=true;Settings.soundsMuted=true;Settings.TIME_SPEED=1;
 Settings.FIELD_SIZE_MULTIPLIER=format===5?.60:1;
 Settings.SUNDAY_NO_OFFSIDE=arcade;Settings.SUNDAY_EXPRESS=express;Settings.SUNDAY_SHAPE=shape;
 Settings.MATCH_DURATION=duration;Settings.AI.A=home;Settings.AI.B=away;Settings.AI.dynamicStrategyShifting=false;
 Settings.batchConfig={teamA:'England',teamB:'Scotland',formationA:format===5?'SUNDAY-5':'4-4-2',formationB:format===5?'SUNDAY-5':'4-3-3'};
 Settings.app={camX:0,camY:0,canvas:{width:720,height:528}};
 const sim=new Simulator({seed:seed>>>0||1});
 // Seed the preset fields directly; bootstrapMatch.loadPresets returns early.
 sim.defaultStats=statsPreset.default_stats;sim.teamStatsPreset=statsPreset.teams;sim.formationsPreset=format===5?{...formations,'SUNDAY-5':[{role:'GK',x:5,y:50},{role:'CB',x:24,y:50},{role:'LM',x:40,y:22},{role:'RM',x:40,y:78},{role:'CF',x:59,y:50}]}:formations;
 if(format===5)sim.teamStatsPreset={};
 if(express){const stats=(o)=>({...statsPreset.default_stats,...o});const squad=[stats({goalkeeping:67,speed:63,passing:78}),stats({speed:66,tackling:76,passing:80}),stats({speed:84,dribbling:84,passing:85,shooting:76}),stats({speed:80,dribbling:79,passing:87,shooting:78}),stats({speed:76,shooting:90,accuracy:88,dribbling:80})];sim.teamStatsPreset={England:squad,Scotland:squad};}
 await sim.start();sim.active=true;
 const field=Utils.getFieldBounds(),events=[],stats=[0,1].map(()=>({passes:0,completed:0,shots:0,tackles:0,interceptions:0,saves:0,blocks:0,possession:0,bestChain:0,progressive:0}));
 let lastCompleted=null;
 let frames=0,lastState='',lastScore=[0,0],pending=null,chain=0,chainSide=-1,lastLaunch=null;
 const originals=new Map();
 const flow={crowdedTicks:0,shapeTicks:0,spreadSum:0,ownedTicks:0,threePassChains:0,returnPasses:0,shotZones:[0,0,0],playTicks:0,deadTicks:0,boardBounces:0,turnovers:0,shots:0,goals:0,longestQuiet:0,quiet:0,phases:{}};
 const state={flow,profile:shape?'shape':express?'express':arcade?'arcade':'original',duration,time:0,finished:false,phase:'kickoff',actors:[],ball:{x:0,z:0,y:0},score:[0,0],stats,events,step,upstream:'soccer-js',stepSeconds:SOCCER_STEP,chips:[],charge:0,chipRevision:0,grantChip,useChip,canUseChip,chipStats:{shotsPowered:0,combos:0,used:0,reloads:0},playerAttributes:()=>sim.players.map(p=>({team:p.team,role:p.role,...p.stats,currentStamina:p.currentStamina}))};
 // Let the original goal geometry decide whether a shot really crosses the line.
 // Only non-scoring exits reflect; no invented goals, teleports, or new AI.
 if(arcade){
  const originalCollision=sim.checkBallCollisions;
  sim.checkBallCollisions=function(){
   const ball=this.ball;
   if(ball&&this.matchState==='play'){
    const {left,right}=this.getGoals();
    if(!left.isGoalEvent(ball)&&!right.isGoalEvent(ball)){
     let hit=false;
     if(ball.y<0||ball.y>field.height){ball.y=clamp(ball.y,.04,field.height-.04);ball.vy=ball.y<field.height/2?Math.abs(ball.vy)*(shape?.62:.82):-Math.abs(ball.vy)*(shape?.62:.82);hit=true;}
     if(ball.x<0||ball.x>field.width){ball.x=clamp(ball.x,.04,field.width-.04);ball.vx=ball.x<field.width/2?Math.abs(ball.vx)*(shape?.62:.8):-Math.abs(ball.vx)*(shape?.62:.8);hit=true;}
     if(hit){if(ball.owner){ball.owner=null;}ball.offsideReceiver=null;ball.offsideLineX=null;ball.isThrowInFlight=false;flow.boardBounces++;event('OFF THE BOARDS',null,'board');return;}
    }
   }
   return originalCollision.call(this);
  };
 }
 // Keep roles spread in a diamond, with a distinct attacking/defending shape.
 // Positions are targets, not teleports: upstream steering and FSMs still move players.
 if(shape){
  const sticky={A:null,B:null};
  sim.shapeChasers=function(){
   const ball=this.ball, picks=[];
   if(!ball||ball.owner?.role==='GK')return picks;
   for(const key of ['A','B']){
    if(ball.owner?.team===key){sticky[key]=null;continue;}
    const team=this.getTeam(key),receiver=team?.receivingPlayer;
    if(!ball.owner&&receiver&&receiver.fsm.getNameOfCurrentState()==='Receive'){sticky[key]=null;continue;}
    const candidates=this.players.filter(p=>p.team===key&&this.canBecomeChaser(p)).map(p=>({p,d:Math.hypot(p.x-ball.x,p.y-ball.y)})).sort((a,b)=>a.d-b.d);
    const best=candidates[0],prior=candidates.find(c=>c.p===sticky[key]);
    if(best){sticky[key]=prior&&prior.d<best.d+2.5?prior.p:best.p;picks.push(sticky[key]);}
   }
   return picks;
  };
  for(const p of sim.players){
   if(p.role==='GK')continue;
   const original=p.getIdleMoveTarget.bind(p);
   p.getIdleMoveTarget=function(){
    if(sim.matchState!=='play'||sim.setPieceType)return original();
    const ball=sim.ball,right=sim.isSecondHalf()?p.team==='B':p.team==='A',sign=right?1:-1;
    const bx=right?ball.x:field.width-ball.x,by=right?ball.y:field.height-ball.y;
    const team=sim.getTeam(p.team),attacking=ball.owner?ball.owner.team===p.team:team?.receivingPlayer!=null;
    const depth=bx/field.width,wide=field.height;
    let x,y;
    if(p.role==='CB'){x=clamp(bx-field.width*.23,field.width*.12,field.width*.57);y=wide*.5+(by-wide*.5)*.30;}
    else if(p.role==='CF'){x=clamp(bx+field.width*(attacking?.22:.12),field.width*.40,field.width*.88);y=wide*.5+(by-wide*.5)*.20;}
    else {const left=p.role==='LM';x=clamp(bx+field.width*(attacking?.065:-.13),field.width*.22,field.width*.78);y=wide*(left?.20:.80)+(by-wide*.5)*.15;}
    // A supporting teammate in the carrier's lane offers a diagonal instead.
    if(ball.owner?.team===p.team&&Math.hypot(x-bx,y-by)<field.width*.13){x=clamp(x+(p.role==='CB'?-1:1)*field.width*.12,field.width*.10,field.width*.90);}
    return {x:right?x:field.width-x,y:right?y:field.height-y};
   };
  }
 }
 const halfEnd=()=>state.time<duration/2?duration/2:duration;
 function remember(p){if(!originals.has(p))originals.set(p,{...p.stats});return originals.get(p);}
 function applyPlayer(p){
  if(p.team!=='A')return;
  const base=remember(p),next={...base};
  for(const chip of state.chips.filter(c=>c.status==='active')){
   const def=CHIPS[chip.id],mods=p.role==='GK'?def.keeper:def.stats;
   for(const [k,delta] of Object.entries(mods||{}))next[k]=Math.min(130,(next[k]??60)+delta);
  }
  Object.assign(p.stats,next);
 }
 function rebuildHome(){
  const next=Object.create(baseHome);
  for(const chip of state.chips.filter(c=>c.status==='active'))for(const [key,delta] of Object.entries(CHIPS[chip.id].ai||{})){
   const value=next[key]+delta;next[key]=bounded.has(key)?clamp(value,0,1):value;
  }
  home=next;Settings.AI.A=home;for(const p of sim.players)applyPlayer(p);
 }
 function gainCharge(){const before=state.charge;state.charge=Math.min(8,state.charge+1);if(before!==state.charge)state.chipRevision++;}
 function grantChip(id){
  if(!Object.hasOwn(CHIPS,id)||state.chips.length>=6||state.chips.some(c=>c.id===id)||!(frames===0||state.phase==='halftime'))return false;
  state.chips.push({id,status:'ready',until:null,progress:0,reloaded:false});state.chipRevision++;return true;
 }
 function activate(chip){
  const def=CHIPS[chip.id],double=state.chips.find(c=>c.id==='double'&&c.status==='armed');
  const multiplier=double?2:1;if(double){double.status='spent';state.chipStats.combos++;event('DOUBLE TIME ×2 · '+def.name.toUpperCase(),'A','chip');}
  chip.status='active';chip.until=Math.min(halfEnd(),state.time+duration*def.minutes/90*multiplier);
  if(def.restore)for(const p of sim.players)if(p.team==='A'&&!p.isSentOff)p.currentStamina=1;
  rebuildHome();state.chipRevision++;event(def.name.toUpperCase()+' ACTIVE','A','chip');
 }
 function available(c){return c.status==='ready'||(c.status==='spent'&&!c.reloaded&&state.charge>=RELOAD_COST);}
 function canUseChip(id){
  const chip=state.chips.find(c=>c.id===id);
  if(!chip||!available(chip)||state.phase!=='play'||state.finished)return false;
  if(id==='double'&&!state.chips.some(c=>c.id!=='double'&&c.status==='ready'&&CHIPS[c.id].minutes))return false;
  return true;
 }
 function useChip(id){
  if(!canUseChip(id))return false;
  const chip=state.chips.find(c=>c.id===id);
  if(chip.status==='spent'){state.charge-=RELOAD_COST;chip.reloaded=true;state.chipStats.reloads++;event('RELOADED · '+CHIPS[id].name.toUpperCase(),'A','chip');}
  state.chipStats.used++;
  if(id==='double'||id==='oneTwo'){chip.status='armed';chip.progress=0;state.chipRevision++;event(CHIPS[id].name.toUpperCase()+' ARMED','A','chip');}
  else activate(chip);
  return true;
 }
 function comboPass(){
  const c=state.chips.find(c=>c.id==='oneTwo'&&c.status==='armed');if(!c)return;
  c.progress++;state.chipRevision++;
  if(c.progress===2){state.chipStats.combos++;activate(c);}else event('ONE-TWO · 1/2 PASSES','A','chip');
 }
 function breakCombo(){const c=state.chips.find(c=>c.id==='oneTwo'&&c.status==='armed');if(c&&c.progress){c.progress=0;state.chipRevision++;}}
 let rocketKick=false;
 const upstreamKick=sim.ball.kick;
 sim.ball.kick=function(vx,vy,vz,curve){if(rocketKick){vx*=CHIPS.rocket.shot;vy*=CHIPS.rocket.shot;rocketKick=false;state.chipStats.shotsPowered++;event('ROCKET SHOT!','A','chip');}return upstreamKick.call(this,vx,vy,vz,curve);};
 for(const p of sim.players)if(p.team==='A')remember(p);
 function event(text,team,kind='play'){events.unshift({time:state.time,text,side:team==='A'||team==='B'?side(team):-1,kind});if(events.length>8)events.pop();}
 sim._telemetry={
  onTackleAttempt({tackler,success}){if(success&&tackler){stats[side(tackler.team)].tackles++;if(tackler.team==='A')gainCharge();event('BALL WON',tackler.team,'tackle');}},
  onShotKicked({team}){flow.shots++;const p=sim.ball.owner||sim.ball.lastKicker;if(p){const right=sim.isSecondHalf()?team==='B':team==='A',dist=Math.abs(p.x-(right?field.width:0))/field.width;flow.shotZones[Math.min(2,Math.floor(dist*3))]++;}stats[side(team)].shots++;event('SHOT!',team,'shot');rocketKick=team==='A'&&state.chips.some(c=>c.id==='rocket'&&c.status==='active');},
  onProgressivePass({team}){stats[side(team)].progressive++;},
  onBlock(info){if(info?.team==='A'||info?.team==='B')stats[side(info.team)].blocks++;event('SHOT BLOCKED',info?.team,'save');}
 };
 function point(p){return {x:(p.y/field.height-.5)*68,z:(.5-p.x/field.width)*94};}
 function snapshot(){
  state.actors=sim.players.map((p,i)=>({id:i,...point(p),team:p.role==='GK'?2:side(p.team),side:side(p.team),role:p.role,visible:!p.isSentOff,frame:Math.floor(frames/3)%2}));
  state.ball={...point(sim.ball),y:Math.max(0,sim.ball.z||0)+.4};
  state.score=[sim.scoreA,sim.scoreB];state.time=clamp(sim.matchTimer/5400*duration,0,duration);
  state.phase=sim.matchState;state.finished=state.phase==='fulltime';
 }
 function step(){
  if(state.finished)return;
  if(arcade&&sim.ball){sim.ball.offsideReceiver=null;sim.ball.offsideLineX=null;}
  // Reapply team-local knobs before the tick; upstream owns every decision.
  Settings.AI.A=home;Settings.AI.B=away;Time.deltaTime=SOCCER_STEP;
  for(const p of sim.players)if(p.team==='A'&&!originals.has(p))applyPlayer(p);
  const before=sim.ball.owner,beforeShot=sim.ball.isShot,phaseBefore=sim.matchState,shotBefore=flow.shots;sim.updateAll();frames++;
  if(arcade&&sim.matchState!==phaseBefore){const limits={kickoff:1,goal:2,halftime:2.5,freekick:1.1,penalty:1.3,card:1.2};const limit=limits[sim.matchState];if(limit!=null&&sim.stateTimer>limit)sim.stateTimer=limit;}
  snapshot();rocketKick=false;
  flow.phases[phaseBefore]=(flow.phases[phaseBefore]||0)+1;if(phaseBefore==='play'){flow.playTicks++;if(sim.ball.owner)flow.ownedTicks++;if(frames%5===0){flow.shapeTicks++;const players=sim.players.filter(p=>p.role!=='GK'&&!p.isSentOff);const near=players.filter(p=>Math.hypot(p.x-sim.ball.x,p.y-sim.ball.y)<field.height*.13).length;if(near>=4)flow.crowdedTicks++;for(const key of ['A','B']){const ps=players.filter(p=>p.team===key);let n=0,d=0;for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){d+=Math.hypot(ps[i].x-ps[j].x,ps[i].y-ps[j].y)/field.height;n++;}flow.spreadSum+=n?d/n/2:0;}}flow.quiet=flow.shots>shotBefore?0:flow.quiet+SOCCER_STEP;flow.longestQuiet=Math.max(flow.longestQuiet,flow.quiet);}else flow.deadTicks++;
  let changed=false;for(const chip of state.chips){if((chip.status==='active'&&(state.time>=chip.until||state.phase==='halftime'||state.finished))||(chip.status==='armed'&&(state.phase==='halftime'||state.finished))){chip.status='spent';changed=true;}}
  if(changed){rebuildHome();state.chipRevision++;}
  const after=sim.ball.owner;
  // Count a single actual pass launch, not a transient AI state. A pending
  // flight may span many ticks and an attempted pass can be aborted before contact.
  const kicker=sim.ball.lastKicker;
  if(sim.ball.passFromX!=null&&kicker&&!after){
   const key=String(sim.players.indexOf(kicker))+':'+sim.ball.passFromX+':'+sim.ball.passFromY;
   if(key!==lastLaunch){lastLaunch=key;pending={kicker,team:kicker.team};stats[side(kicker.team)].passes++;}
  }else if(after||sim.ball.passFromX==null){lastLaunch=null;}
  if(after&&pending){
   if(after!==pending.kicker&&after.team===pending.team){const a=stats[side(after.team)];a.completed++;if(lastCompleted&&lastCompleted.from===after&&lastCompleted.to===pending.kicker&&frames-lastCompleted.frame<100){flow.returnPasses++;event('QUICK RETURN PASS',after.team,'play');}lastCompleted={from:pending.kicker,to:after,frame:frames};if(chainSide!==side(after.team)){chain=0;chainSide=side(after.team);}chain++;if(chain===3)flow.threePassChains++;a.bestChain=Math.max(a.bestChain,chain);if(after.team==='A'){gainCharge();comboPass();}else breakCombo();}
   else if(after.team!==pending.team){stats[side(after.team)].interceptions++;event('INTERCEPTION',after.team,'tackle');if(after.team==='A')gainCharge();chain=0;chainSide=-1;breakCombo();}
   pending=null;
  }
  if(before&&after&&before.team!==after.team){flow.turnovers++;lastCompleted=null;chain=0;chainSide=-1;}if(after?.team==='B')breakCombo();
  if(after){stats[side(after.team)].possession+=SOCCER_STEP;if(beforeShot&&after.role==='GK'&&after!==before){stats[side(after.team)].saves++;if(after.team==='A')gainCharge();event('KEEPER SAVES',after.team,'save');}}
  if(state.score[0]!==lastScore[0]||state.score[1]!==lastScore[1]){flow.goals++;lastCompleted=null;const team=state.score[0]>lastScore[0]?'A':'B';event('GOAL! '+state.score.join('–'),team,'goal');lastScore=[...state.score];chain=0;chainSide=-1;breakCombo();}
  const phase=sim.matchState;
  if(phase!==lastState){if(['corner','goalkick','throwin','freekick','offside','penalty','halftime','fulltime','kickoff'].includes(phase)){event(phase.toUpperCase(),sim.setPieceKickingTeam,'match');pending=null;lastLaunch=null;chain=0;chainSide=-1;breakCombo();}lastState=phase;}
 }
 snapshot();state.format=format;if(format===5&&state.actors.length!==10)throw Error('Expected exactly ten players, got '+state.actors.length);event('KICK OFF',null,'match');return state;
}
