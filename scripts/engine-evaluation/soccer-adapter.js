// SUNDAY adapter for Soccer-JS, pinned upstream revision in engine-evaluation.yml.
// This file is copied to the upstream checkout and bundled as a browser ESM.
// No upstream rendering, audio, network fetches, or DOM controls are needed.
import {systemAssignment,resolveSystem,systemCanPress,freeKickLayout,planDirectFreeKick,adaptiveTactic,ADAPTIVE_REVIEW_SECONDS} from './five-tactics.js';
import {createMutations,MUTATIONS,createEnvironment,ENVIRONMENT,ENVIRONMENT_GRAPH,DEFAULT_ENVIRONMENT,validLoadout} from './mutations.js';
export {ENVIRONMENT,ENVIRONMENT_GRAPH,DEFAULT_ENVIRONMENT,validLoadout};
import {possessionIntent,possessionAction} from './possession-intent.js';
const {PlayerStates,computeShootKick,computeTackleType}=require('./kernel/core/entities/player.js');
const {Simulator,MatchStates}=require('./kernel/providers/simulator/simulator.js');
const {Settings}=require('./kernel/settings.js');
const {predict3D}=require('./kernel/core/lib/ball_prediction.js');
const {estimateShotGroundSpeed,estimatePassGroundSpeed,isPassSafeFromAllOpponents}=require('./kernel/core/lib/pass_safety.js');
const {clearWallPlayers}=require('./kernel/core/lib/freekick_wall.js');
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
export async function createSoccerMatch(seed,traits=[],opponent=0,duration=75,format=11,profile='express',systems=['diamond','diamond'],options={}){
 // Soccer-JS uses shared Settings; this proof runs one active match at a time.
 if(!Array.isArray(systems)||systems.length!==2)throw Error('Select one tactical system per team');
 const systemIds=systems.slice(),startingSystems=systems.slice();const teamSystems=systemIds.map(resolveSystem);
 const baseHome=teamSettings(traits),away=teamSettings([['shield'],['hunt','touch'],['overlap','rifle']][Math.min(2,Math.max(0,opponent))]);
 const intent=format===5&&profile==='intent',zones=format===5&&(profile==='zones'||intent),attack=format===5&&(profile==='attack'||zones),shape=format===5&&(profile==='shape'||attack),express=format===5&&(profile==='express'||shape),arcade=format===5&&profile!=='original';
 if(arcade)for(const team of [baseHome,away])for(const [k,v] of Object.entries(FIVE_PROFILE)){if(typeof upstreamDefaults[k]!=='number')throw Error('Missing five-a-side setting '+k);team[k]=v;}
 if(express)for(const team of [baseHome,away])Object.assign(team,{PASS_AGGRESSION:.86,ATTACK_SUPPORT_INTENSITY:.9,ATTACK_SUPPORT_FORM_PULL:.64,ATTACK_SUPPORT_OWN_HALF_BLEND:.72,THROUGH_BALL_LEAD_EXTRA:1.8,SHORT_PASS_MAX_DIST:24,LONG_PASS_MIN_DIST:23,LONG_PASS_MAX_DIST:44,SHOOT_RANGE_REF:39,SHOOT_FORCE_BLOCKED_CHANCE:.07,SHOOT_CONTESTED_CHANCE:.38,SHOOT_SPEED_BASE:23,SHOOT_ANGLE_NOISE_SCALE:.0035,GK_SHOT_SAVE_MULT:.38,GK_DIVE_CHANCE_SHOT:.65,FIRST_TOUCH_FUMBLE_BASE:.015,FIRST_TOUCH_FUMBLE_SCALE:.19});
 if(shape)for(const team of [baseHome,away])Object.assign(team,{FORMATION_HOLD:.72,ATTACK_SUPPORT_INTENSITY:.66,DEFENSIVE_PRESS_INTENSITY:.42,PASS_AGGRESSION:.65,SHOOT_RANGE_REF:32,SHOOT_FORCE_BLOCKED_CHANCE:0,COUNTERPRESS_MAX_SURGE:1,FIRST_TOUCH_FUMBLE_BASE:.005,FIRST_TOUCH_FUMBLE_SCALE:.12});
 if(attack)for(const team of [baseHome,away])Object.assign(team,{PASS_AGGRESSION:.76,SHOOT_RANGE_REF:37,SHOOT_FORCE_BLOCKED_CHANCE:.025,SHOOT_CONTESTED_CHANCE:.36,SHORT_PASS_MAX_DIST:28,LONG_PASS_MAX_DIST:52,THROUGH_BALL_LEAD_EXTRA:2.0});
 if(zones)for(const team of [baseHome,away])Object.assign(team,{TACKLE_ATTEMPT_COOLDOWN:.75,FIRST_TOUCH_MIN_SPEED:4.5,FIRST_TOUCH_FUMBLE_BASE:.015,FIRST_TOUCH_FUMBLE_SCALE:.19,FIRST_TOUCH_CLAIM_LOCK:.22,FIRST_TOUCH_RESIDUAL_MIN:.25,FIRST_TOUCH_RESIDUAL_MAX:.48});
 let home=baseHome;
 Settings.HEADLESS=true;Settings.soundsMuted=true;Settings.TIME_SPEED=1;
 Settings.FIELD_SIZE_MULTIPLIER=format===5?.60:1;
 Settings.SUNDAY_NO_OFFSIDE=arcade;Settings.SUNDAY_EXPRESS=express;Settings.SUNDAY_SHAPE=shape;Settings.SUNDAY_ATTACK=attack;Settings.SUNDAY_ZONES=zones;Settings.SUNDAY_INTENT=intent;Settings.SUNDAY_FREEKICK=intent&&options.freeKicks!==false;Settings.SUNDAY_FIVE=format===5;
 Settings.MATCH_DURATION=duration;Settings.AI.A=home;Settings.AI.B=away;Settings.AI.dynamicStrategyShifting=false;
 Settings.batchConfig={teamA:'England',teamB:'Scotland',formationA:format===5?'SUNDAY-5':'4-4-2',formationB:format===5?'SUNDAY-5':'4-3-3'};
 Settings.app={camX:0,camY:0,canvas:{width:720,height:528}};
 const sim=new Simulator({seed:seed>>>0||1});
 // Seed the preset fields directly; bootstrapMatch.loadPresets returns early.
 sim.defaultStats=statsPreset.default_stats;sim.teamStatsPreset=statsPreset.teams;sim.formationsPreset=format===5?{...formations,'SUNDAY-5':[{role:'GK',x:5,y:50},{role:'CB',x:24,y:50},{role:'LM',x:40,y:22},{role:'RM',x:40,y:78},{role:'CF',x:59,y:50}]}:formations;
 if(format===5)sim.teamStatsPreset={};
 if(express){const stats=(o)=>({...statsPreset.default_stats,...o});const squad=[stats({goalkeeping:67,speed:63,passing:78}),stats({speed:66,tackling:76,passing:80}),stats({speed:84,dribbling:84,passing:85,shooting:76}),stats({speed:80,dribbling:79,passing:87,shooting:78}),stats({speed:76,shooting:90,accuracy:88,dribbling:80})];sim.teamStatsPreset={England:squad,Scotland:squad};}
 await sim.start();sim.active=true;
 const field=Utils.getFieldBounds(),events=[],stats=[0,1].map(()=>({passes:0,completed:0,shots:0,tackleAttempts:0,tackles:0,slideStarts:0,slideAttempts:0,slideWins:0,firstTouches:0,cleanTouches:0,passTouches:0,cleanPassTouches:0,touchControlSum:0,interceptions:0,saves:0,blocks:0,possession:0,bestChain:0,progressive:0}));
 let lastCompleted=null,lastThirdSide=null;
 let directFlight=null,layoff=null,wallContact=false,mutations=null;
 let frames=0,lastState='',lastScore=[0,0],pending=null,chain=0,chainSide=-1,lastLaunch=null;
 const originals=new Map();
 const flow={tacticalReviews:0,tacticalChanges:[],freeKicks:{awarded:0,planned:0,eligible:0,probed:0,driven:0,curled:0,dipped:0,layoffs:0,layoffShots:0,returnAttempts:0,returnCompleted:0,returnShots:0,combinationGoals:0,shotGoals:0,shotSaves:0,shotWallBlocks:0,shotDeflections:0,shotMisses:0,shotUnresolved:0,shots:0,passes:0,releasedShots:0,releasedPasses:0,completedPasses:0,interceptedPasses:0,indirect:0,wallPlayers:0,clearanceViolations:0,byTeam:[0,0]},intentDecisions:0,intentCounts:{},intentActions:{},teamAssignments:[{},{}],teamIntentActions:[{},{}],assignmentTicks:0,assignmentCounts:{},kickoffTicks:0,kickoffCrowdedTicks:0,finalThirdEntries:0,createdShots:0,crowdedTicks:0,shapeTicks:0,spreadSum:0,ownedTicks:0,threePassChains:0,returnPasses:0,shotZones:[0,0,0],playTicks:0,deadTicks:0,boardBounces:0,turnovers:0,shots:0,goals:0,longestQuiet:0,quiet:0,phases:{}};
 const state={flow,systems:systemIds,startingSystems,adaptiveOpponent:intent&&options.adaptiveOpponent===true,profile:intent?'intent':zones?'zones':attack?'attack':shape?'shape':express?'express':arcade?'arcade':'original',duration,time:0,matchSeconds:0,half:1,finished:false,phase:'kickoff',actors:[],ball:{x:0,z:0,y:0},score:[0,0],stats,events,step,upstream:'soccer-js',stepSeconds:SOCCER_STEP,chips:[],charge:0,chipRevision:0,grantChip,useChip,canUseChip,chipStats:{shotsPowered:0,combos:0,used:0,reloads:0},playerAttributes:()=>sim.players.map(p=>({team:p.team,role:p.role,...p.stats,currentStamina:p.currentStamina}))};
 // Contextual decision hook: the upstream Dribble state still owns timing,
 // movement, kick windup, and the actual pass/shot state transitions.
 if(intent){
  let plan=null,lastOwner=null,planTeam=null;
  sim.sundayPossessionDecision=function(p,{pass,shot,threat}){
   const right=this.isSecondHalf()?p.team==='B':p.team==='A',goalX=right?field.width:0;
   const depth=clamp(1-Math.abs(p.x-goalX)/field.width,0,1);
   const central=1-Math.min(1,Math.abs(p.y-field.centerY)/(field.height*.5));
   const opponents=this.players.filter(o=>o.team!==p.team&&o.role!=='GK'&&!o.isSentOff);
   const close=opponents.filter(o=>Math.hypot(o.x-p.x,o.y-p.y)<field.width*.09).length;
   const gain=pass?.teammate? (pass.teammate.x-p.x)*(right?1:-1)/field.width:0;
   const config=teamSystems[side(p.team)];
   const ctx={depth,central,pressure:!!threat.threatened||close>0,isolated:close===1,forwardPass:!!pass&&gain>config.passGain,backwardPass:!!pass&&gain<=config.passGain,clearShot:!!shot?.ok&&depth>config.shotDepth&&central>config.shotCentral,breaksLine:gain>config.lineGain||(depth<2/3&&depth+gain>=2/3)};
   if(planTeam!==p.team){plan=null;planTeam=p.team;}
   // A teammate receiving a pass inherits the team's attacking intent.
   plan=possessionIntent(plan,ctx);
   let action=possessionAction(plan,ctx,intent?systemIds[side(p.team)]:'diamond');
   if(options.deliveryRoutines===false&&layoff&&layoff.team===p.team&&layoff.receiver===p&&frames<=layoff.until&&ctx.clearShot){action='shoot';flow.freeKicks.layoffShots++;layoff=null;}
   flow.intentDecisions++;flow.intentCounts[plan]=(flow.intentCounts[plan]||0)+1;flow.intentActions[action]=(flow.intentActions[action]||0)+1;
   const actions=flow.teamIntentActions[side(p.team)];actions[action]=(actions[action]||0)+1;
   state.intent=plan;lastOwner=p;return action;
  };
  sim.sundayResetIntent=function(){plan=null;planTeam=null;lastOwner=null;state.intent=null;};
 }
 // Preserve upstream fouls, restart FSM and actual kick physics, replacing
 // only the eleven-a-side free-kick walk targets and choice policy.
 if(intent&&options.freeKicks!==false){
  const setup=sim.setupSetPiecePositions.bind(sim);
  sim.setupSetPiecePositions=function(type,sideName,kickingTeam,...rest){
   mutations?.recoverAll();
   const before=this.players.filter(p=>!p.isSentOff).map(p=>({p,x:p.x,y:p.y}));
   setup(type,sideName,kickingTeam,...rest);
   if(type!=='freekick'){this.sundayFreekickPlan=null;this.sundayFreekickTaker=null;return;}
   this.sundayFreekickPlan=null;this.sundayFreekickTaker=null;layoff=null;
   const right=this.isSecondHalf()?kickingTeam==='B':kickingTeam==='A';
   const flip=(x,y)=>right?{x,y}:{x:field.width-x,y:field.height-y};
   const bx=this.setPieceX,by=this.setPieceY,ball=flip(bx,by);
   const attackers=before.filter(q=>q.p.team===kickingTeam&&q.p.role!=='GK').sort((a,b)=>Math.hypot(a.x-bx,a.y-by)-Math.hypot(b.x-bx,b.y-by));
   const defenders=before.filter(q=>q.p.team!==kickingTeam&&q.p.role!=='GK').sort((a,b)=>Math.hypot(a.x-bx,a.y-by)-Math.hypot(b.x-bx,b.y-by));
   clearWallPlayers(this.freekickWallPlayers);this.freekickWallPlayers=[];
   if(!attackers.length)return;
   const taker=attackers.shift().p;this.sundayFreekickTaker=taker;
   const plan=freeKickLayout({width:field.width,height:field.height,...ball,attackers:attackers.map(q=>q.p),defenders:defenders.map(q=>q.p),indirect:!!this.setPieceIndirect});
   this.sundayFreekickPlan=plan;
   const place=(p,point,wall=false)=>{
    const target=flip(point.x,point.y);
    p.setPieceTarget=target;p.isWalkingToSetPiece=true;
    if(wall){p.isInWall=true;p.wallHoldX=target.x;p.wallHoldY=target.y;p.wallJumpTimer=0;p.wallJumpActive=false;p.wallJumpVz=0;this.freekickWallPlayers.push(p);}
   };
   place(taker,ball);taker.orientation=right?2:6;
   for(const p of [...plan.attack,...plan.defend])place(p.id,p);
   for(const p of plan.wall){place(p.id,p,true);p.id.orientation=right?6:2;}
   this.ball.owner=null;this.ball.x=bx;this.ball.y=by;
   const fk=flow.freeKicks;fk.planned++;if(plan.direct)fk.eligible++;fk.wallPlayers+=plan.wall.length;
   for(const p of [...plan.wall,...plan.defend])if(Math.hypot(p.x-ball.x,p.y-ball.y)<plan.clearance-.02)fk.clearanceViolations++;
  };
 }
 // Exposed only to deterministic scenario tests, not ordinary gameplay.
 if(options.testHooks){
  state.forceFreeKick=({team='A',depth=.45,lateral=.5,half=1,indirect=false}={})=>{
   if(half===2&&!sim.isSecondHalf()){sim.matchTimer=2700;sim.halfTimeTriggered=true;sim.swapSides();}
   const right=sim.isSecondHalf()?team==='B':team==='A';
   sim.setPieceX=(right?depth:1-depth)*field.width;sim.setPieceY=(right?lateral:1-lateral)*field.height;
   sim.setPieceKickingTeam=team;sim.setPieceType='freekick';sim.setPieceSide=sim.setPieceX<field.centerX?'left':'right';sim.setPieceIndirect=indirect;
   sim.ball.owner=null;sim.ball.x=sim.setPieceX;sim.ball.y=sim.setPieceY;
   sim.ball.vx=0;sim.ball.vy=0;sim.ball.vz=0;sim.ball.z=0;
   sim.setupSetPiecePositions('freekick',sim.setPieceSide,team);sim.fsm.changeState(MatchStates.Freekick);snapshot();
   const plan=sim.sundayFreekickPlan;return plan?{direct:plan.direct,wall:plan.wall.length,attack:plan.attack.length,defend:plan.defend.length,goalX:right?field.width:0}:null;
  };
 }
 if(intent&&options.freeKicks!==false&&options.directFreeKicks!==false){
  sim.sundayPlanDirectFreeKick=function(taker){
   const right=this.isSecondHalf()?taker.team==='B':taker.team==='A';
   const goal=this.getGoals()[right?'right':'left'];
   const from={x:taker.x,y:taker.y};
   const opponents=this.players.filter(p=>p.team!==taker.team&&!p.isSentOff);
   flow.freeKicks.probed++;
   if(options.testHooks&&options.forceCombination)return null;
   const result=planDirectFreeKick({from,goal,wall:this.freekickWallPlayers||[],defenders:opponents.filter(p=>p.role!=='GK'&&!p.isInWall),keeper:opponents.find(p=>p.role==='GK'),speed:estimateShotGroundSpeed(taker),shooting:taker.effectiveShooting||65,accuracy:taker.effectiveAccuracy||70,predict:predict3D,balancedSelection:options.balancedSelection!==false,variedDelivery:options.deliveryRoutines!==false});
   return result;
  };
  sim.sundayPrepareLayoff=function(taker,target){
   if(!this.sundayFreekickPlan?.direct||!target)return;
   const right=this.isSecondHalf()?taker.team==='B':taker.team==='A',sign=right?1:-1;
   const inward=taker.y<field.centerY?1:-1;
   layoff={team:taker.team,taker,receiver:target,stage:'first',until:frames+110,support:{x:clamp(taker.x+sign*2.0,1,field.width-1),y:clamp(taker.y-inward*3.4,1,field.height-1)}};
   flow.freeKicks.layoffs++;
  };
  // A routine is only attempted after actual control by the intended receiver.
  // If the safe options disappear, normal football takes over immediately.
  if(options.deliveryRoutines!==false)sim.sundayCombinationDecision=function(p){
   if(!layoff||frames>layoff.until||p.team!==layoff.team||this.ball.owner!==p||this.setPieceType)return null;
   const expected=layoff.stage==='first'?layoff.receiver:layoff.taker;
   if(p!==expected){layoff=null;return null;}
   const right=this.isSecondHalf()?p.team==='B':p.team==='A',goal=this.getGoals()[right?'right':'left'];
   const from={x:p.x,y:p.y},opponents=this.players.filter(q=>q.team!==p.team&&!q.isSentOff);
   const shot=planDirectFreeKick({from,goal,defenders:opponents.filter(q=>q.role!=='GK'),keeper:opponents.find(q=>q.role==='GK'),speed:estimateShotGroundSpeed(p),shooting:p.effectiveShooting||65,accuracy:p.effectiveAccuracy||70,predict:predict3D,balancedSelection:options.balancedSelection!==false});
   if(layoff.stage==='first'&&!layoff.taker.isSentOff){
    const mate=layoff.taker,aim={x:mate.x,y:mate.y},dist=Math.hypot(aim.x-p.x,aim.y-p.y);
    const returnShot=dist>1.8&&dist<8&&isPassSafeFromAllOpponents(from,aim,mate,opponents,estimatePassGroundSpeed(from,aim,p,'short'))?planDirectFreeKick({from:aim,goal,defenders:opponents.filter(q=>q.role!=='GK'),keeper:opponents.find(q=>q.role==='GK'),speed:estimateShotGroundSpeed(mate),shooting:mate.effectiveShooting||65,accuracy:mate.effectiveAccuracy||70,predict:predict3D,balancedSelection:options.balancedSelection!==false}):null;
    if(returnShot&&(!shot||returnShot.score>shot.score+.08)){
     layoff.stage='return';layoff.until=frames+55;flow.freeKicks.returnAttempts++;
     return {action:'pass',target:mate,aim};
    }
   }
   if(shot){
    p.sundayCombinationShot=layoff.stage==='return'?'return':'layoff';layoff=null;
    return {action:'shoot',...shot};
   }
   layoff=null;return null;
  };
 }
 sim.sundayOnWallBlock=function(){wallContact=true;};
 sim.sundayOnFreekickChoice=function(action,team,aim,routine){
  flow.freeKicks[action==='shoot'?'shots':'passes']++;
  if(routine&&Object.hasOwn(flow.freeKicks,routine)){flow.freeKicks[routine]++;event('FREE KICK: '+routine.toUpperCase(),team,'shot');}
  state.lastFreeKick={action,team,routine:routine||null,aim:aim?{x:aim.x,y:aim.y}:null,half:sim.isSecondHalf()?2:1};
 };
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
  const tacticalPhase={A:'defend',B:'defend'};
  sim.shapeChasers=function(){
   const ball=this.ball, picks=[];
   if(!ball||ball.owner?.role==='GK')return picks;
   for(const key of ['A','B']){
    if(ball.owner?.team===key){sticky[key]=null;continue;}
    const team=this.getTeam(key),receiver=team?.receivingPlayer;
    if(!ball.owner&&receiver&&receiver.fsm.getNameOfCurrentState()==='Receive'){sticky[key]=null;continue;}
    const candidates=this.players.filter(p=>p.team===key&&this.canBecomeChaser(p)).map(p=>({p,d:Math.hypot(p.x-ball.x,p.y-ball.y)})).sort((a,b)=>a.d-b.d);
    const best=candidates[0],prior=candidates.find(c=>c.p===sticky[key]);
    if(best&&intent&&!systemCanPress(systemIds[side(key)],{hasOpponentOwner:!!ball.owner,distance:best.d/field.width,depth:(sim.isSecondHalf()?key==='B':key==='A')?ball.x/field.width:1-ball.x/field.width})){sticky[key]=null;continue;}
    if(best){sticky[key]=prior&&prior.d<best.d+2.5?prior.p:best.p;picks.push(sticky[key]);}
   }
   return picks;
  };
  for(const p of sim.players){
   if(p.role==='GK')continue;
   const original=p.getIdleMoveTarget.bind(p);
   p.getIdleMoveTarget=function(){
    if(sim.matchState!=='play'||sim.setPieceType)return original();
    if(options.deliveryRoutines!==false&&layoff&&layoff.taker===p&&layoff.stage==='first'&&frames<=layoff.until&&!p.isSentOff)return layoff.support;
    const ball=sim.ball,right=sim.isSecondHalf()?p.team==='B':p.team==='A',sign=right?1:-1;
    const bx=right?ball.x:field.width-ball.x,by=right?ball.y:field.height-ball.y;
    const team=sim.getTeam(p.team),attacking=ball.owner?ball.owner.team===p.team:team?.receivingPlayer!=null;
    if(zones){
     // Retain the last controlled shape during a pass or brief loose ball.
     // A change of actual possession changes the entire team's assignment.
     if(ball.owner){tacticalPhase.A=ball.owner.team==='A'?'attack':'defend';tacticalPhase.B=ball.owner.team==='B'?'attack':'defend';}
     const mode=tacticalPhase[p.team],target=systemAssignment(intent?systemIds[side(p.team)]:'diamond',p.role,mode,clamp(bx/field.width,0,1),clamp(by/field.height,0,1));
     p.sundayAssignment=target.action;
     let tx=target.x*field.width,ty=target.y*field.height;
     // Protect the passing triangle: an off-ball player must not occupy
     // the carrier's immediate pocket, even between authored grid cells.
     if(ball.owner?.team===p.team&&ball.owner!==p&&Math.hypot(tx-bx,ty-by)<field.width*.13){
      tx=clamp(tx+(p.role==='CB'?-1:1)*field.width*.12,field.width*.10,field.width*.93);
     }
     return {x:right?tx:field.width-tx,y:right?ty:field.height-ty};
    }
    const depth=bx/field.width,wide=field.height;
    let x,y;
    if(p.role==='CB'){x=clamp(bx-field.width*.23,field.width*.12,field.width*.57);y=wide*.5+(by-wide*.5)*.30;}
    else if(p.role==='CF'){x=clamp(bx+field.width*(attacking?.22:.12),field.width*.40,field.width*.88);y=wide*.5+(by-wide*.5)*.20;}
    else {const left=p.role==='LM';x=clamp(bx+field.width*(attacking?.065:-.13),field.width*.22,field.width*.78);y=wide*(left?.20:.80)+(by-wide*.5)*.15;}
    if(attack&&attacking&&ball.owner&&ball.owner!==p){const carrier=ball.owner,farSide=(by<wide*.5)!==(p.role==='LM');if(p.role==='CF'){x=clamp(bx+field.width*.22,field.width*.48,field.width*.91);y=wide*(by<wide*.5?.57:.43);}else if(p.role==='LM'||p.role==='RM'){if(farSide){x=clamp(bx+field.width*.18,field.width*.40,field.width*.86);y=wide*(p.role==='LM'?.30:.70);}else{x=clamp(bx-field.width*.055,field.width*.22,field.width*.82);}}}
    // A supporting teammate in the carrier's lane offers a diagonal instead.
    if(ball.owner?.team===p.team&&Math.hypot(x-bx,y-by)<field.width*.13){x=clamp(x+(p.role==='CB'?-1:1)*field.width*.12,field.width*.10,field.width*.90);}
    return {x:right?x:field.width-x,y:right?y:field.height-y};
   };
  }
 }
 // Correct five-a-side kickoffs at startup, goals and halftime. Use authored
 // positions instead of eleven-a-side shifted regions. Only the pivot takes it.
 if(attack){
  const reset=sim.resetToKickoff.bind(sim),pin=sim.pinKickoffSpots.bind(sim);
  const arrange=()=>{
   const pins=sim._kickoffPins;if(!pins)return;
   const right=p=>sim.isSecondHalf()?p.team==='B':p.team==='A';
   const taker=sim.players.find(p=>p.team===sim.kickoffTeam&&p.role==='CF'&&!p.isSentOff)||pins.taker;
   const receiver=sim.players.find(p=>p.team===sim.kickoffTeam&&p.role==='LM'&&!p.isSentOff);
   for(const p of sim.players){
    if(p.isSentOff||p.role==='GK')continue;
    const positions={CB:[.19,.50],LM:[.36,.22],RM:[.32,.78],CF:[.37,.50]};
    let [x,y]=positions[p.role]||[.28,.5];
    if(p===taker){x=.492;y=.50;}else if(p===receiver){x=.40;y=.29;}
    p.x=field.width*(right(p)?x:1-x);p.y=field.height*(right(p)?y:1-y);p.vx=0;p.vy=0;p._currentSpeed=0;
   }
   sim.ball.owner=taker;
   Object.assign(pins,{taker,support:receiver||null,takerX:taker.x,takerY:taker.y,supportX:receiver?.x||0,supportY:receiver?.y||0});
   sim._sundayKickoffSpots=sim.players.filter(p=>!p.isSentOff&&p.role!=='GK').map(p=>({p,x:p.x,y:p.y}));
   pin();
  };
  sim.resetToKickoff=function(){reset();arrange();};
  sim.pinKickoffSpots=function(){
   if(this.matchState==='kickoff'&&this.ball.owner===this._kickoffPins?.taker)for(const spot of this._sundayKickoffSpots||[]){spot.p.x=spot.x;spot.p.y=spot.y;spot.p.vx=0;spot.p.vy=0;spot.p._currentSpeed=0;}
   return pin();
  };
  arrange();
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
  onTackleAttempt({tackler,success,tackleType}){if(!tackler)return;const a=stats[side(tackler.team)];a.tackleAttempts++;if(tackleType==='slide'){a.slideAttempts++;if(success)a.slideWins++;}if(success){a.tackles++;if(tackler.team==='A')gainCharge();event(tackleType==='slide'?'SLIDING TACKLE WON':'BALL WON',tackler.team,'tackle');}},
   onSlideStarted({player}){stats[side(player.team)].slideStarts++;event('SLIDING TACKLE',player.team,'tackle');},
   onFirstTouch({player,fumbled,control,receivedPass}){const a=stats[side(player.team)];a.firstTouches++;a.touchControlSum+=control;if(!fumbled)a.cleanTouches++;if(receivedPass){a.passTouches++;if(!fumbled)a.cleanPassTouches++;}if(fumbled)event('HEAVY TOUCH',player.team,'play');},
  onShotKicked({team}){mutations?.shot(sim.ball.owner||sim.ball.lastKicker);flow.shots++;const comboShooter=sim.ball.owner;if(comboShooter?.sundayCombinationShot){const kind=comboShooter.sundayCombinationShot;flow.freeKicks[kind==='return'?'returnShots':'layoffShots']++;directFlight={team,frame:frames+1,combination:true};comboShooter.sundayCombinationShot=null;}if(lastCompleted&&lastCompleted.to.team===team&&frames-lastCompleted.frame<80)flow.createdShots++;const p=sim.ball.owner||sim.ball.lastKicker;if(p){const right=sim.isSecondHalf()?team==='B':team==='A',dist=Math.abs(p.x-(right?field.width:0))/field.width;flow.shotZones[Math.min(2,Math.floor(dist*3))]++;}stats[side(team)].shots++;event('SHOT!',team,'shot');rocketKick=team==='A'&&state.chips.some(c=>c.id==='rocket'&&c.status==='active');},
  onProgressivePass({team}){stats[side(team)].progressive++;},
  onBlock(info){if(info?.team==='A'||info?.team==='B')stats[side(info.team)].blocks++;event('SHOT BLOCKED',info?.team,'save');}
 };
 if(intent&&(options.mutations===true||options.environment)){
  const config={sim,field,dt:SOCCER_STEP,event,resetPlayer:p=>{p.fsm.changeState(PlayerStates.Idle);p._currentSpeed=0;p.receiveTarget=null;p.passTarget=null;p.shotAim=null;}};
  mutations=options.environment?createEnvironment({...config,loadout:options.environment===true?DEFAULT_ENVIRONMENT:options.environment}):createMutations(config);
  state.activateMutation=(id,target)=>{const point=target&&typeof target==='object'?{x:(.5-target.z/94)*field.width,y:(target.x/68+.5)*field.height}:target;const ok=mutations.activate(id,point);snapshot();return ok;};
  state.mutationDefinitions=options.environment?ENVIRONMENT:MUTATIONS;
  if(options.testHooks)state.mutationTest={controller:mutations,sim,field,computeShootKick,computeTackleType};
 }
 function point(p){return {x:(p.y/field.height-.5)*68,z:(.5-p.x/field.width)*94};}
 // Match-clock review windows, not real-world time. Reviews occur in open
 // play only; starting selection remains untouched when adaptation is off.
 let reviewAt=ADAPTIVE_REVIEW_SECONDS,lastTacticChange=-Infinity;
 let windowStart={shots:[0,0],passes:[0,0],interceptions:0,control:[0,0],wide:0,entries:0};
 let observed={control:[0,0],wide:0,entries:0,inThird:false};
 function reviewOpponent(){
  if(!state.adaptiveOpponent||sim.matchState!=='play'||sim.setPieceType)return;
  const ball=sim.ball,owner=ball.owner;
  if(owner){
   const i=side(owner.team);observed.control[i]+=SOCCER_STEP;
   if(i===0){
    if(Math.abs(ball.y-field.centerY)>field.height*.26)observed.wide+=SOCCER_STEP;
    const depth=sim.isSecondHalf()?1-ball.x/field.width:ball.x/field.width;
    if(depth>.67&&!observed.inThird)observed.entries++;
    observed.inThird=depth>.67;
   }else observed.inThird=false;
  }
  if(sim.matchTimer<reviewAt)return;
  const second=sim.matchTimer;
  reviewAt=(Math.floor(second/ADAPTIVE_REVIEW_SECONDS)+1)*ADAPTIVE_REVIEW_SECONDS;
  const control=observed.control.map((v,i)=>v-windowStart.control[i]),total=control[0]+control[1];
  const players=sim.players.filter(p=>p.team==='B'&&p.role!=='GK'&&!p.isSentOff);
  const stamina=players.reduce((n,p)=>n+p.currentStamina,0)/Math.max(1,players.length);
  const window={controlSeconds:total,possessionShare:total?control[1]/total:.5,shots:stats[1].shots-windowStart.shots[1],opponentShots:stats[0].shots-windowStart.shots[0],opponentEntries:observed.entries-windowStart.entries,opponentWideShare:control[0]?(observed.wide-windowStart.wide)/control[0]:0,interceptions:stats[1].interceptions-windowStart.interceptions,opponentPasses:stats[0].passes-windowStart.passes[0]};
  windowStart={shots:stats.map(t=>t.shots),passes:stats.map(t=>t.passes),interceptions:stats[1].interceptions,control:observed.control.slice(),wide:observed.wide,entries:observed.entries};
  flow.tacticalReviews++;
  const decision=adaptiveTactic({current:systemIds[1],base:startingSystems[1],second,goalDifference:sim.scoreB-sim.scoreA,stamina,window,lastChange:lastTacticChange});
  if(decision.system!==systemIds[1]){
   const change={second,from:systemIds[1],to:decision.system,reason:decision.reason,score:[sim.scoreA,sim.scoreB],stamina,window};
   systemIds[1]=decision.system;teamSystems[1]=resolveSystem(decision.system);lastTacticChange=second;
   flow.tacticalChanges.push(change);state.lastTacticalChange=change;
   sim.sundayResetIntent?.();
   event('OPP: '+decision.reason,'B','match');
  }
 }
 function snapshot(){
  state.actors=sim.players.map((p,i)=>({id:i,...point(p),team:p.role==='GK'?2:side(p.team),side:side(p.team),role:p.role,assignment:zones?p.sundayAssignment||null:null,visible:!p.isSentOff,size:p.sundayMutationSize||1,turbo:p.sundayMutationSpeed>1,cannon:p.sundayMutationShot>1,sliding:!!p.isSliding,stunned:!!p.sundayStunned,frame:Math.floor(frames/3)%2}));
  state.ball={...point(sim.ball),y:Math.max(0,sim.ball.z||0)+.4};
  state.score=[sim.scoreA,sim.scoreB];state.time=clamp(sim.matchTimer/5400*duration,0,duration);
  if(mutations)state.mutations=mutations.snapshot(point);
  state.matchSeconds=clamp(sim.matchTimer,0,5400);state.half=sim.isSecondHalf()?2:1;state.phase=sim.matchState;state.finished=state.phase==='fulltime';
 }
 function step(){
  if(state.finished)return;
  if(mutations&&!mutations.before()){pending=null;lastLaunch=null;lastCompleted=null;lastThirdSide=null;chain=0;chainSide=-1;layoff=null;directFlight=null;snapshot();return;}
  if(arcade&&sim.ball){sim.ball.offsideReceiver=null;sim.ball.offsideLineX=null;}
  // Reapply team-local knobs before the tick; upstream owns every decision.
  Settings.AI.A=home;Settings.AI.B=away;Time.deltaTime=SOCCER_STEP;
  for(const p of sim.players){if(p.team==='A'&&!originals.has(p))applyPlayer(p);if(p.sundayTouchGrace>0)p.sundayTouchGrace=Math.max(0,p.sundayTouchGrace-SOCCER_STEP);}
  wallContact=false;
  const before=sim.ball.owner,beforeShot=sim.ball.isShot,phaseBefore=sim.matchState,wasFreeKick=sim.setPieceType==='freekick',shotBefore=flow.shots;const previousBall=mutations?{x:sim.ball.x,y:sim.ball.y}:null;sim.updateAll();frames++;if(mutations)mutations.after(previousBall);
  if(arcade&&sim.matchState!==phaseBefore){const limits={kickoff:1,goal:2,halftime:2.5,freekick:1.1,penalty:1.3,card:1.2};const limit=limits[sim.matchState];if(limit!=null&&sim.stateTimer>limit)sim.stateTimer=limit;}
  snapshot();rocketKick=false;
  flow.phases[phaseBefore]=(flow.phases[phaseBefore]||0)+1;if(phaseBefore==='kickoff'){flow.kickoffTicks++;if(sim.players.filter(p=>p.role!=='GK'&&Math.hypot(p.x-field.centerX,p.y-field.centerY)<field.width*.09).length>2)flow.kickoffCrowdedTicks++;}if(phaseBefore==='play'){flow.playTicks++;if(zones&&frames%5===0){for(const p of sim.players){if(p.sundayAssignment&&!p.isSentOff){flow.assignmentTicks++;flow.assignmentCounts[p.sundayAssignment]=(flow.assignmentCounts[p.sundayAssignment]||0)+1;const counts=flow.teamAssignments[side(p.team)];counts[p.sundayAssignment]=(counts[p.sundayAssignment]||0)+1;}}}const owner=sim.ball.owner;if(owner){const right=sim.isSecondHalf()?owner.team==='B':owner.team==='A';const third=right?owner.x>field.width*2/3:owner.x<field.width/3;if(third&&lastThirdSide!==owner.team){flow.finalThirdEntries++;lastThirdSide=owner.team;}else if(!third)lastThirdSide=null;}}if(phaseBefore==='play'){if(sim.ball.owner)flow.ownedTicks++;if(frames%5===0){flow.shapeTicks++;const players=sim.players.filter(p=>p.role!=='GK'&&!p.isSentOff);const near=players.filter(p=>Math.hypot(p.x-sim.ball.x,p.y-sim.ball.y)<field.height*.13).length;if(near>=4)flow.crowdedTicks++;for(const key of ['A','B']){const ps=players.filter(p=>p.team===key);let n=0,d=0;for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){d+=Math.hypot(ps[i].x-ps[j].x,ps[i].y-ps[j].y)/field.height;n++;}flow.spreadSum+=n?d/n/2:0;}}flow.quiet=flow.shots>shotBefore?0:flow.quiet+SOCCER_STEP;flow.longestQuiet=Math.max(flow.longestQuiet,flow.quiet);}else flow.deadTicks++;
  let changed=false;for(const chip of state.chips){if((chip.status==='active'&&(state.time>=chip.until||state.phase==='halftime'||state.finished))||(chip.status==='armed'&&(state.phase==='halftime'||state.finished))){chip.status='spent';changed=true;}}
  if(changed){rebuildHome();state.chipRevision++;}
  const after=sim.ball.owner;
  const releasedFreeKick=wasFreeKick&&sim.setPieceType!=='freekick';
  if(releasedFreeKick&&flow.shots>shotBefore){
   flow.freeKicks.releasedShots++;
   directFlight={team:sim.ball.lastKicker?.team||state.lastFreeKick?.team,frame:frames};
  }
  if(layoff&&(frames>layoff.until||(after&&after.team!==layoff.team)||(sim.matchState!=='play'&&sim.matchState!=='freekick')))layoff=null;
  if(layoff?.stage==='return'&&after===layoff.taker&&before!==after&&pending?.kicker===layoff.receiver){flow.freeKicks.returnCompleted++;}
  if(directFlight){
   const fk=flow.freeKicks,scored=state.score[side(directFlight.team)]>lastScore[side(directFlight.team)];
   let outcome=null;
   if(scored)outcome='shotGoals';
   else if(wallContact)outcome='shotWallBlocks';
   else if(after&&after.team!==directFlight.team&&after.role==='GK')outcome='shotSaves';
   else if(sim.matchState==='goalkick'||sim.matchState==='throwin'||sim.matchState==='corner')outcome='shotMisses';
   else if(after||(!sim.ball.isShot&&frames>directFlight.frame)||flow.shots>shotBefore&&!releasedFreeKick&&frames>directFlight.frame)outcome='shotDeflections';
   else if(frames-directFlight.frame>100||state.finished)outcome='shotUnresolved';
   if(outcome){if(directFlight.combination){if(outcome==='shotGoals')fk.combinationGoals++;state.lastCombinationOutcome=outcome;}else{fk[outcome]++;state.lastFreeKickOutcome=outcome;}directFlight=null;}
  }
  // Count a single actual pass launch, not a transient AI state. A pending
  // flight may span many ticks and an attempted pass can be aborted before contact.
  const kicker=sim.ball.lastKicker;
  if(sim.ball.passFromX!=null&&kicker&&!after){
   const key=String(sim.players.indexOf(kicker))+':'+sim.ball.passFromX+':'+sim.ball.passFromY;
   if(key!==lastLaunch){lastLaunch=key;pending={kicker,team:kicker.team,freeKick:releasedFreeKick};if(releasedFreeKick)flow.freeKicks.releasedPasses++;stats[side(kicker.team)].passes++;}
  }else if(after||sim.ball.passFromX==null){lastLaunch=null;}
  if(after&&pending){
   if(after!==pending.kicker&&after.team===pending.team){const a=stats[side(after.team)];a.completed++;if(pending.freeKick)flow.freeKicks.completedPasses++;if(lastCompleted&&lastCompleted.from===after&&lastCompleted.to===pending.kicker&&frames-lastCompleted.frame<100){flow.returnPasses++;event('QUICK RETURN PASS',after.team,'play');}lastCompleted={from:pending.kicker,to:after,frame:frames};if(chainSide!==side(after.team)){chain=0;chainSide=side(after.team);}chain++;if(chain===3)flow.threePassChains++;a.bestChain=Math.max(a.bestChain,chain);if(after.team==='A'){gainCharge();comboPass();}else breakCombo();}
   else if(after.team!==pending.team){if(pending.freeKick)flow.freeKicks.interceptedPasses++;stats[side(after.team)].interceptions++;event('INTERCEPTION',after.team,'tackle');if(after.team==='A')gainCharge();chain=0;chainSide=-1;breakCombo();}
   pending=null;
  }
  if(before&&after&&before.team!==after.team){flow.turnovers++;lastCompleted=null;chain=0;chainSide=-1;}if(after?.team==='B')breakCombo();
  if(after){stats[side(after.team)].possession+=SOCCER_STEP;if(beforeShot&&after.role==='GK'&&after!==before){stats[side(after.team)].saves++;if(after.team==='A')gainCharge();event('KEEPER SAVES',after.team,'save');}}
  if(state.score[0]!==lastScore[0]||state.score[1]!==lastScore[1]){flow.goals++;lastCompleted=null;lastThirdSide=null;const team=state.score[0]>lastScore[0]?'A':'B';event('GOAL! '+state.score.join('–'),team,'goal');lastScore=[...state.score];chain=0;chainSide=-1;breakCombo();}
  reviewOpponent();
  const phase=sim.matchState;
  if(intent&&phase!=='play')sim.sundayResetIntent();
  if(phase!==lastState){if(phase==='freekick'){flow.freeKicks.awarded++;if(sim.setPieceIndirect)flow.freeKicks.indirect++;flow.freeKicks.byTeam[side(sim.setPieceKickingTeam)]++;}if(['corner','goalkick','throwin','freekick','offside','penalty','halftime','fulltime','kickoff'].includes(phase)){event(phase.toUpperCase(),sim.setPieceKickingTeam,'match');pending=null;lastLaunch=null;chain=0;chainSide=-1;breakCombo();}lastState=phase;}
 }
 snapshot();state.format=format;if(format===5&&state.actors.length!==10)throw Error('Expected exactly ten players, got '+state.actors.length);event('KICK OFF',null,'match');return state;
}
