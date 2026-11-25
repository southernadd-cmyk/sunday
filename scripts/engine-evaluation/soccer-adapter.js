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
export async function createSoccerMatch(seed,traits=[],opponent=0,duration=75,format=11){
 // Soccer-JS uses shared Settings; this proof runs one active match at a time.
 const baseHome=teamSettings(traits),away=teamSettings([['shield'],['hunt','touch'],['overlap','rifle']][Math.min(2,Math.max(0,opponent))]);
 let home=baseHome;
 Settings.HEADLESS=true;Settings.soundsMuted=true;Settings.TIME_SPEED=1;
 Settings.FIELD_SIZE_MULTIPLIER=format===5?.60:1;
 Settings.MATCH_DURATION=duration;Settings.AI.A=home;Settings.AI.B=away;Settings.AI.dynamicStrategyShifting=false;
 Settings.batchConfig={teamA:'England',teamB:'Scotland',formationA:format===5?'SUNDAY-5':'4-4-2',formationB:format===5?'SUNDAY-5':'4-3-3'};
 Settings.app={camX:0,camY:0,canvas:{width:720,height:528}};
 const sim=new Simulator({seed:seed>>>0||1});
 // Seed the preset fields directly; bootstrapMatch.loadPresets returns early.
 sim.defaultStats=statsPreset.default_stats;sim.teamStatsPreset=statsPreset.teams;sim.formationsPreset=format===5?{...formations,'SUNDAY-5':[{role:'GK',x:5,y:50},{role:'CB',x:24,y:50},{role:'LM',x:40,y:22},{role:'RM',x:40,y:78},{role:'CF',x:59,y:50}]}:formations;
 if(format===5)sim.teamStatsPreset={};
 await sim.start();sim.active=true;
 const field=Utils.getFieldBounds(),events=[],stats=[0,1].map(()=>({passes:0,completed:0,shots:0,tackles:0,interceptions:0,saves:0,blocks:0,possession:0,bestChain:0,progressive:0}));
 let frames=0,lastState='',lastScore=[0,0],pending=null,chain=0,chainSide=-1,lastLaunch=null;
 const originals=new Map();
 const state={duration,time:0,finished:false,phase:'kickoff',actors:[],ball:{x:0,z:0,y:0},score:[0,0],stats,events,step,upstream:'soccer-js',stepSeconds:SOCCER_STEP,chips:[],charge:0,chipRevision:0,grantChip,useChip,canUseChip,chipStats:{shotsPowered:0,combos:0,used:0,reloads:0},playerAttributes:()=>sim.players.map(p=>({team:p.team,role:p.role,...p.stats,currentStamina:p.currentStamina}))};
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
  onShotKicked({team}){stats[side(team)].shots++;event('SHOT!',team,'shot');rocketKick=team==='A'&&state.chips.some(c=>c.id==='rocket'&&c.status==='active');},
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
  // Reapply team-local knobs before the tick; upstream owns every decision.
  Settings.AI.A=home;Settings.AI.B=away;Time.deltaTime=SOCCER_STEP;
  for(const p of sim.players)if(p.team==='A'&&!originals.has(p))applyPlayer(p);
  const before=sim.ball.owner,beforeShot=sim.ball.isShot;sim.updateAll();frames++;snapshot();rocketKick=false;
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
   if(after!==pending.kicker&&after.team===pending.team){const a=stats[side(after.team)];a.completed++;if(chainSide!==side(after.team)){chain=0;chainSide=side(after.team);}chain++;a.bestChain=Math.max(a.bestChain,chain);if(after.team==='A'){gainCharge();comboPass();}else breakCombo();}
   else if(after.team!==pending.team){stats[side(after.team)].interceptions++;event('INTERCEPTION',after.team,'tackle');if(after.team==='A')gainCharge();chain=0;chainSide=-1;breakCombo();}
   pending=null;
  }
  if(before&&after&&before.team!==after.team){chain=0;chainSide=-1;}if(after?.team==='B')breakCombo();
  if(after){stats[side(after.team)].possession+=SOCCER_STEP;if(beforeShot&&after.role==='GK'&&after!==before){stats[side(after.team)].saves++;if(after.team==='A')gainCharge();event('KEEPER SAVES',after.team,'save');}}
  if(state.score[0]!==lastScore[0]||state.score[1]!==lastScore[1]){const team=state.score[0]>lastScore[0]?'A':'B';event('GOAL! '+state.score.join('–'),team,'goal');lastScore=[...state.score];chain=0;chainSide=-1;breakCombo();}
  const phase=sim.matchState;
  if(phase!==lastState){if(['corner','goalkick','throwin','freekick','offside','penalty','halftime','fulltime','kickoff'].includes(phase)){event(phase.toUpperCase(),sim.setPieceKickingTeam,'match');pending=null;lastLaunch=null;chain=0;chainSide=-1;breakCombo();}lastState=phase;}
 }
 snapshot();state.format=format;if(format===5&&state.actors.length!==10)throw Error('Expected exactly ten players, got '+state.actors.length);event('KICK OFF',null,'match');return state;
}
