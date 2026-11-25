import {createSoccerMatch,SOCCER_STEP} from './construct/scripts/engine.js';
import {makeRenderer} from './src/scroll-pitch.js';
import {scoreboard} from './src/match-clock.js';
import {MUTATIONS} from './scripts/engine-evaluation/mutations.js';
import {SYSTEMS} from './scripts/engine-evaluation/five-tactics.js';
const $=id=>document.getElementById(id),renderer=makeRenderer($('view'));
let armed=null;
let seed=12345,m=null,paused=false,busy=false,acc=0,last=performance.now(),nextHud=0;
const buttons={};
for(const [id,def] of Object.entries(MUTATIONS)){
 const button=document.createElement('button');button.type='button';button.title=def.detail;button.innerHTML='<span>'+def.name+'</span><small></small>';buttons[id]=button;$('mutationHand').appendChild(button);
 button.onclick=()=>{
  if(!m?.activateMutation)return;
  if(def.target==='instant'){if(m.activateMutation(id))armed=null;else $('mutationHint').textContent='Wait for open play.';}
  else armed=armed===id?null:id;
  drawMutationHand();
 };
}
function drawMutationHand(){
 const available=!!m?.mutations;$('mutationHand').hidden=!available;$('mutationHand').style.display=available?'grid':'none';
 if(!available){$('mutationHint').textContent='Mutation lab disabled.';return;}
 const state=m.mutations;
 for(const [id,button] of Object.entries(buttons)){
  const active=state.active.find(e=>e.id===id),spent=state.used.includes(id);
  button.classList.toggle('active',!!active);button.classList.toggle('armed',armed===id);
  button.disabled=spent||m.finished||!state.canActivate;
  button.querySelector('small').textContent=active?active.seconds.toFixed(1)+'s LEFT':spent?'SPENT':armed===id?'SELECT TARGET':MUTATIONS[id].detail;
 }
 $('view').classList.toggle('targeting',!!armed);
 $('mutationHint').textContent=armed?(MUTATIONS[armed].target==='player'?'Click a red outfield player.':'Click the pitch to place '+MUTATIONS[armed].name+'.'):'Select a power. Effects last 10 seconds at 1× and can overlap.';
}
$('view').addEventListener('click',e=>{
 if(!armed||!m?.activateMutation)return;
 const point=renderer.pick(e.clientX,e.clientY);if(!point)return;
 let target=point;
 if(MUTATIONS[armed].target==='player'){
  const nearest=m.actors.filter(p=>p.side===0&&p.role!=='GK'&&p.visible).map(p=>({p,d:Math.hypot(p.x-point.x,p.z-point.z)})).sort((a,b)=>a.d-b.d)[0];
  if(!nearest||nearest.d>5){$('mutationHint').textContent='Click closer to a red outfield player.';return;}target=nearest.p.id;
 }
 if(m.activateMutation(armed,target))armed=null;
 drawMutationHand();
});
function drawStats(){if(!m)return;const h=scoreboard(m);$('homeScore').textContent=h.home;$('awayScore').textContent=h.away;$('matchClock').textContent=h.clock;$('matchPhase').textContent=h.phase;let [a,b]=m.stats;$('status').textContent=(m.events[0]?.text||'PLAY')+' · '+m.phase.toUpperCase()+' · '+m.actors.filter(p=>p.visible).length+' players';$('stats').textContent='Shots '+a.shots+'–'+b.shots+' | Completed passes '+a.completed+'–'+b.completed+' | Tackles won/attempted '+a.tackles+'/'+a.tackleAttempts+' – '+b.tackles+'/'+b.tackleAttempts+' | Slides won/launched '+a.slideWins+'/'+a.slideStarts+' – '+b.slideWins+'/'+b.slideStarts+' | Interceptions '+a.interceptions+'–'+b.interceptions+' | Saves '+a.saves+'–'+b.saves;const f=m.flow,total=f.playTicks+f.deadTicks;$('flow').textContent='Ball in play '+(total?Math.round(100*f.playTicks/total):0)+'% | Board rebounds '+f.boardBounces+' | Direct turnovers '+f.turnovers+' | Longest spell without a shot '+f.longestQuiet.toFixed(1)+'s | Quick returns '+f.returnPasses+' | Crowding '+Math.round(100*f.crowdedTicks/Math.max(1,f.shapeTicks))+'% | Controlled ball '+Math.round(100*f.ownedTicks/Math.max(1,f.playTicks))+'% | Final third entries '+f.finalThirdEntries+' | Shots after pass '+f.createdShots+' | Tactical assignments '+(f.assignmentTicks||0)+' | Clean touches '+a.cleanTouches+'/'+a.firstTouches+' – '+b.cleanTouches+'/'+b.firstTouches+' | Clean pass receptions '+a.cleanPassTouches+'/'+a.passTouches+' – '+b.cleanPassTouches+'/'+b.passTouches;$('tacticalNote').textContent=m.profile==='intent'?'Playing: '+SYSTEMS[m.systems[0]].name+' vs '+SYSTEMS[m.systems[1]].name+(m.adaptiveOpponent?' · adaptive · '+(m.lastTacticalChange?m.lastTacticalChange.reason:'awaiting review'):''):'Historical profile: tactical systems inactive';drawMutationHand();$('seed').textContent='Seed '+seed+' · '+m.profile.toUpperCase()+(m.intent?' · '+m.intent.toUpperCase():'');}
async function startMatch(replay=false){if(busy)return;busy=true;$('start').disabled=true;$('status').textContent='Starting Soccer-JS…';try{if(m&&!replay)seed=crypto.getRandomValues(new Uint32Array(1))[0];m=await createSoccerMatch(seed,[],0,90,5,$('profile').value,[$('homeTactic').value,$('awayTactic').value],{mutations:$('mutationMode').checked,adaptiveOpponent:$('adaptiveOpponent').checked});armed=null;renderer.reset();paused=false;acc=0;$('pause').disabled=false;$('pause').textContent='Pause';drawStats()}catch(err){m=null;$('status').textContent='Engine startup failed: '+err.message;console.error(err)}finally{busy=false;$('start').disabled=false}}
$('start').onclick=()=>startMatch(false);$('repeat').onclick=()=>startMatch(true);
function updateTactics(){const inactive=$('profile').value!=='intent';$('homeTactic').disabled=inactive;$('awayTactic').disabled=inactive;$('mutationMode').disabled=inactive;$('adaptiveOpponent').disabled=inactive;}
$('profile').onchange=updateTactics;updateTactics();
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause'};
function frame(now){let dt=Math.min(.1,(now-last)/1000);last=now;if(m){if(!paused&&!m.finished&&!busy){acc+=dt*Number($('speed').value);while(acc>=SOCCER_STEP&&!m.finished){m.step();acc-=SOCCER_STEP}}renderer.render(m,dt);if(now>nextHud){drawStats();nextHud=now+200}}requestAnimationFrame(frame)}requestAnimationFrame(frame);
