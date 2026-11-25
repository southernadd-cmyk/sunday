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

// Stances change the underlying AI rather than injecting actions or modifying scores.
// Values are additive to the drafted behaviour build, with bounded team-local knobs.
export const HALF_PLANS={
 balanced:{name:'Keep the plan',detail:'Trust the drafted behaviours; no additional risk.',mods:{}},
 attack:{name:'Go for it',detail:'More attacking support and forward passes; less defensive cover.',mods:{ATTACK_SUPPORT_INTENSITY:.20,PASS_AGGRESSION:.20,ATTACK_DEPTH_BIAS_REF:5,FORMATION_HOLD:-.18}},
 protect:{name:'Stay compact',detail:'Deeper, tighter shape; fewer players committed forward.',mods:{FORMATION_HOLD:.25,DEFEND_DEPTH_BIAS_REF:-4,ATTACK_SUPPORT_INTENSITY:-.20,PASS_AGGRESSION:-.14}},
 press:{name:'Raise the press',detail:'Close opponents harder; sacrifice formation discipline.',mods:{DEFENSIVE_PRESS_INTENSITY:.30,COUNTERPRESS_MAX_SURGE:1,FORMATION_HOLD:-.16}}
};
export const TOUCHLINE_CALLS={
 press:{name:'Press',detail:'More aggressive closing down; less shape.',mods:{DEFENSIVE_PRESS_INTENSITY:.35,COUNTERPRESS_MAX_SURGE:1,FORMATION_HOLD:-.18}},
 push:{name:'Push up',detail:'More forward support and risky passes.',mods:{ATTACK_SUPPORT_INTENSITY:.22,ATTACK_DEPTH_BIAS_REF:5,PASS_AGGRESSION:.15,FORMATION_HOLD:-.12}},
 settle:{name:'Settle',detail:'Hold shape and reduce risky passing.',mods:{FORMATION_HOLD:.26,PASS_AGGRESSION:-.25,ATTACK_SUPPORT_INTENSITY:-.16}}
};
const bounded=new Set(['SUPPORT_WIDTH','ATTACK_SUPPORT_INTENSITY','PASS_AGGRESSION','FIRST_TOUCH_FUMBLE_BASE','FIRST_TOUCH_FUMBLE_SCALE','DEFENSIVE_PRESS_INTENSITY','FORMATION_HOLD']);

function teamSettings(traits){
 const out=Object.create(upstreamDefaults);
 for(const trait of traits)for(const [key,value] of Object.entries(TRAIT_MODS[trait]||{})){
  if(typeof upstreamDefaults[key]!=='number')throw Error('Unknown upstream AI setting: '+key);
  const delta=value-upstreamDefaults[key];out[key]=(Object.hasOwn(out,key)?out[key]:upstreamDefaults[key])+delta;
  if(['SUPPORT_WIDTH','ATTACK_SUPPORT_INTENSITY','PASS_AGGRESSION','FIRST_TOUCH_FUMBLE_BASE','FIRST_TOUCH_FUMBLE_SCALE','DEFENSIVE_PRESS_INTENSITY','FORMATION_HOLD'].includes(key))out[key]=clamp(out[key],0,1);
 }
 return out;
}
export async function createSoccerMatch(seed,traits=[],opponent=0,duration=75){
 // Soccer-JS uses shared Settings; this proof runs one active match at a time.
 const baseHome=teamSettings(traits),away=teamSettings([['shield'],['hunt','touch'],['overlap','rifle']][Math.min(2,Math.max(0,opponent))]);
 let home=baseHome;
 Settings.HEADLESS=true;Settings.soundsMuted=true;Settings.TIME_SPEED=1;
 Settings.MATCH_DURATION=duration;Settings.AI.A=home;Settings.AI.B=away;Settings.AI.dynamicStrategyShifting=false;
 Settings.batchConfig={teamA:'England',teamB:'Scotland',formationA:'4-4-2',formationB:'4-3-3'};
 Settings.app={camX:0,camY:0,canvas:{width:720,height:528}};
 const sim=new Simulator({seed:seed>>>0||1});
 // Seed the preset fields directly; bootstrapMatch.loadPresets returns early.
 sim.defaultStats=statsPreset.default_stats;sim.teamStatsPreset=statsPreset.teams;sim.formationsPreset=formations;
 await sim.start();sim.active=true;
 const field=Utils.getFieldBounds(),events=[],stats=[0,1].map(()=>({passes:0,completed:0,shots:0,tackles:0,interceptions:0,saves:0,blocks:0,possession:0,bestChain:0,progressive:0}));
 let frames=0,lastState='',lastScore=[0,0],pending=null,chain=0,chainSide=-1,lastLaunch=null;
 const state={duration,time:0,finished:false,phase:'kickoff',actors:[],ball:{x:0,z:0,y:0},score:[0,0],stats,events,step,upstream:'soccer-js',stepSeconds:SOCCER_STEP,halfPlan:'balanced',halfPlanChosen:false,call:null,callsLeft:2,chooseHalfPlan,callTouchline,tacticalSettings:()=>Object.fromEntries([...bounded,'ATTACK_DEPTH_BIAS_REF','DEFEND_DEPTH_BIAS_REF','COUNTERPRESS_MAX_SURGE'].map(k=>[k,home[k]]))};
 function rebuildHome(){
  const next=Object.create(baseHome);
  for(const mods of [HALF_PLANS[state.halfPlan].mods,state.call?TOUCHLINE_CALLS[state.call.id].mods:{}])for(const [key,delta] of Object.entries(mods)){
   const value=next[key]+delta;next[key]=bounded.has(key)?clamp(value,0,1):value;
  }
  home=next;Settings.AI.A=home;
 }
 function chooseHalfPlan(id){
  if(state.phase!=='halftime'||state.halfPlanChosen||!Object.hasOwn(HALF_PLANS,id))return false;
  state.halfPlan=id;state.halfPlanChosen=true;state.call=null;state.callsLeft=2;rebuildHome();
  event('SECOND HALF · '+HALF_PLANS[id].name.toUpperCase(),'A','tactic');return true;
 }
 function callTouchline(id){
  if(state.phase!=='play'||state.finished||state.callsLeft<=0||state.call||!Object.hasOwn(TOUCHLINE_CALLS,id))return false;
  state.callsLeft--;state.call={id,until:Math.min(state.time<duration/2?duration/2:duration,state.time+duration*10/90)};rebuildHome();
  event('TOUCHLINE · '+TOUCHLINE_CALLS[id].name.toUpperCase(),'A','tactic');return true;
 }
 function event(text,team,kind='play'){events.unshift({time:state.time,text,side:team==='A'||team==='B'?side(team):-1,kind});if(events.length>8)events.pop();}
 sim._telemetry={
  onTackleAttempt({tackler,success}){if(success&&tackler){stats[side(tackler.team)].tackles++;event('BALL WON',tackler.team,'tackle');}},
  onShotKicked({team}){stats[side(team)].shots++;event('SHOT!',team,'shot');},
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
  const before=sim.ball.owner,beforeShot=sim.ball.isShot;sim.updateAll();frames++;snapshot();
  if(state.call&&(state.time>=state.call.until||state.phase==='halftime'||state.finished)){state.call=null;rebuildHome();}
  const after=sim.ball.owner;
  // Count a single actual pass launch, not a transient AI state. A pending
  // flight may span many ticks and an attempted pass can be aborted before contact.
  const kicker=sim.ball.lastKicker;
  if(sim.ball.passFromX!=null&&kicker&&!after){
   const key=String(sim.players.indexOf(kicker))+':'+sim.ball.passFromX+':'+sim.ball.passFromY;
   if(key!==lastLaunch){lastLaunch=key;pending={kicker,team:kicker.team};stats[side(kicker.team)].passes++;}
  }else if(after||sim.ball.passFromX==null){lastLaunch=null;}
  if(after&&pending){
   if(after!==pending.kicker&&after.team===pending.team){const a=stats[side(after.team)];a.completed++;if(chainSide!==side(after.team)){chain=0;chainSide=side(after.team);}chain++;a.bestChain=Math.max(a.bestChain,chain);}
   else if(after.team!==pending.team){stats[side(after.team)].interceptions++;event('INTERCEPTION',after.team,'tackle');chain=0;chainSide=-1;}
   pending=null;
  }
  if(before&&after&&before.team!==after.team){chain=0;chainSide=-1;}
  if(after){stats[side(after.team)].possession+=SOCCER_STEP;if(beforeShot&&after.role==='GK'&&after!==before){stats[side(after.team)].saves++;event('KEEPER SAVES',after.team,'save');}}
  if(state.score[0]!==lastScore[0]||state.score[1]!==lastScore[1]){const team=state.score[0]>lastScore[0]?'A':'B';event('GOAL! '+state.score.join('–'),team,'goal');lastScore=[...state.score];chain=0;chainSide=-1;}
  const phase=sim.matchState;
  if(phase!==lastState){if(['corner','goalkick','throwin','freekick','offside','penalty','halftime','fulltime','kickoff'].includes(phase)){event(phase.toUpperCase(),sim.setPieceKickingTeam,'match');pending=null;lastLaunch=null;chain=0;chainSide=-1;}lastState=phase;}
 }
 snapshot();event('KICK OFF',null,'match');return state;
}
