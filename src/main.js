import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-700.css';
import './style.css';
import { Run, GEAR, FIXTURES, GOAL, UPGRADES, readProfile, saveProfile, purchase, distance, route } from './engine.js';
import { Pitch } from './pitch.js';

const $=s=>document.querySelector(s), app=$('#app');
let storage;try{storage=localStorage;}catch{storage=null;}
const profile=readProfile(storage), reduced=matchMedia('(prefers-reduced-motion: reduce)');
let run, pitch, intro=true, busy=false, order=null, preview=null, burst=false, chip=false, ally=null;
let sound=false, low=false, audio, drag=null, paintPending=false;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
app.innerHTML=`<main id="game" aria-label="Sunday football tactics">
 <div id="pitch-host"><p id="pitch-failure" hidden>The pitch could not start. Try a browser with canvas support.</p></div>
 <svg id="vision" aria-hidden="true"></svg>
 <div id="targets"></div>
 <header id="scoreboard"></header>
 <div id="match-label"></div>
 <nav id="options" aria-label="Game options"><button data-action="help" title="How to play">?</button><button data-action="shed">SHED</button><button data-action="low" aria-pressed="false">LO-FI</button><button data-action="sound" aria-pressed="false">SOUND OFF</button><button data-action="fullscreen" class="fullscreen" title="Enter fullscreen">FULLSCREEN</button></nav>
 <div id="resources"></div>
 <div id="kit"></div>
 <div id="coach" role="status" aria-live="polite"></div>
 <div id="orders"></div>
 <section id="moment" hidden></section>
 <section id="intro"></section>
 <div id="notice" role="status"></div>
 <div id="situation" class="sr-only" aria-live="polite"></div>
</main><dialog id="modal" aria-labelledby="modal-title"><div id="modal-content"></div></dialog>`;
try{pitch=new Pitch($('#pitch-host'),{reducedMotion:reduced.matches});}catch(error){$('#pitch-failure').hidden=false;console.warn(error.message);}
function newRun(showIntro=false){
 run=new Run(seed(),profile);run.start();intro=showIntro;busy=false;order=null;preview=null;burst=false;chip=false;ally=null;
 pitch?.showPickups([]);pitch?.update(run);refresh();
}
function notify(text){$('#notice').textContent=text;$('#notice').classList.add('visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#notice').classList.remove('visible'),3200);}
function bank(){if(run.claim(profile)&&!saveProfile(storage,profile))notify('The run works, but this browser could not save your club kitty.');}
function beep(type='move'){
 if(!sound)return;
 try{audio||=new(window.AudioContext||window.webkitAudioContext)();audio.resume();
 const notes=type==='goal'?[392,494,587,784]:['tackle','save','intercept','whistle'].includes(type)?[220,164]:[330,440];
 notes.forEach((frequency,i)=>{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.09;o.type='square';o.frequency.value=frequency;g.gain.setValueAtTime(.025,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.13);});}catch{}
}
function isPlanning(){return !intro&&!busy&&run.phase==='planning'&&!$('#modal').open;}
function requestPaint(){if(!paintPending){paintPending=true;requestAnimationFrame(()=>{paintPending=false;paint();});}}
function clearPlan(){order=null;preview=null;burst=false;ally=null;paint();refreshOrders();}
function setPath(points){
 if(!isPlanning())return;
 order={kind:ally===null?'run':'one-two',ally,burst,path:points};preview=run.preview(order);
 refreshOrders();requestPaint();
}
function aim(x){if(!isPlanning())return;ally=null;burst=false;order={kind:'shot',target:{x,z:GOAL.z},chip};preview=run.preview(order);refreshOrders();paint();}
function chooseAlly(index){
 if(!isPlanning())return;
 ally=ally===index?null:index;
 if(ally===null){clearPlan();return;}
 const p=run.state.actors[0],a=run.state.actors[index];
 setPath([{x:p.x+(a.x-p.x)*.35,z:p.z-16}]);
}
function directional(dx,dz){
 const p=run.state.actors[0],length=Math.hypot(dx,dz),budget=run.runRange+(burst?7:0)+(ally===null?0:2);
 setPath([{x:p.x+dx/length*budget,z:p.z+dz/length*budget}]);
}
function refresh(){
 const f=run.fixture,view=busy&&run.before?run.before.state:run.state,legs=busy&&run.before?run.before.lives:run.lives;
 document.body.dataset.phase=intro?'intro':busy?'playing':run.phase;
 $('#scoreboard').innerHTML=`<div class="score-brand">SUNDAY<span>THE NEXT TWO SECONDS</span></div><div class="score-row"><span>ANCHOR & CROWN</span><b>${!busy&&['goal','pickup','champion'].includes(run.phase)?1:0}</b></div><div class="score-row away"><span>${f.short}</span><b>0</b></div><div class="score-bottom"><span>SUNDAY ${run.fixtureIndex+1}/4</span><span>NEXT GOAL WINS</span></div>`;
 $('#match-label').innerHTML=`<span>${f.ground.toUpperCase()}</span><b>${busy?'BALL IN PLAY':run.phase==='planning'?'TIME IS FROZEN':run.phase==='pickup'?'PICK SOMETHING UP':'SALTMERE SUNDAY CUP'}</b>`;
 $('#resources').innerHTML=`<div class="life-row"><span>LEGS</span><b aria-label="${legs} chances left">${[0,1,2].map(i=>`<i class="boot ${i<legs?'full':''}"></i>`).join('')}</b></div><div class="time-left"><strong>${view.beats*2}<small>SEC</small></strong><span>LEFT IN THIS ATTACK<br>TIME MOVES WITH YOUR PLAN</span></div>`;
 $('#kit').innerHTML=run.gear.length?`<span>IN YOUR KIT BAG</span>${run.gear.map(id=>`<b title="${esc(GEAR[id].text)}">${GEAR[id].short}</b>`).join('')}`:'';
 $('#coach').textContent=busy?'Watch the run…':run.message;
 $('#coach').hidden=intro||(!busy&&run.phase!=='planning');
 $('#intro').hidden=!intro;
 if(intro)$('#intro').innerHTML=`<div class="intro-label">A NEW WAY TO PLAY SUNDAY</div><h1>THE NEXT<br>TWO SECONDS.</h1><p>The match freezes. You draw your run.<br>Then everybody moves together.</p><div class="intro-rules"><span><b>LOOK</b>Orange paths are their next moves.</span><span><b>PLAN</b>Click grass. Red shirts give one-twos.</span><span><b>PLAY</b>Pick a corner when the shot is on.</span></div><button class="primary" data-action="start">STEP ONTO THE PITCH <small>ENTER</small></button><button class="quiet" data-action="help">THE QUICK TEAM TALK</button><div class="intro-footer">FOUR SUNDAYS. THREE LEGS. ONE SECOND THOUGHT.</div>`;
 $('#moment').hidden=busy||!['goal','setback','over','champion','pickup'].includes(run.phase);
 if(!busy&&run.phase==='goal')$('#moment').innerHTML=`<div class="moment-flag">GET IN!</div><h2>THAT'S HOW YOU FIND SPACE.</h2><p>${esc(run.message)}</p><button class="primary" data-action="continue">${run.fixtureIndex===3?'LIFT THE CUP':'BACK TO THE TOUCHLINE'} <small>ENTER</small></button>`;
 else if(!busy&&run.phase==='setback')$('#moment').innerHTML=`<div class="moment-flag bad">${({tackle:'CAUGHT.',intercept:'CUT OUT.',save:'SAVED.',whistle:'CHANCE GONE.'})[run.lastResult.type]}</div><p>${esc(run.message)}</p><div class="result-actions">${run.rewinds>0?'<button class="secondary" data-action="rewind">CHANGE THOSE TWO SECONDS <small>R</small></button>':''}<button class="primary" data-action="continue">${run.lives?'NEXT ATTACK':'BACK TO THE CLUBHOUSE'} <small>ENTER</small></button></div>`;
 else if(!busy&&run.phase==='pickup')$('#moment').innerHTML=`<div class="pickup-heading"><span>THE GAFFER FOUND THESE IN HIS CAR.</span><h2>TAKE ONE. LEAVE THE REST.</h2><p>Click a bit of kit on the pitch. Keep it for this run.</p></div>`;
 else if(['over','champion'].includes(run.phase)){
  bank();$('#moment').innerHTML=`<div class="moment-flag ${run.phase==='over'?'bad':''}">${run.phase==='champion'?'PUB LEGEND.':'LEGS GONE.'}</div><p>${run.phase==='champion'?'Four Sundays. One very dented cup. Work in the morning.':'Off to the touchline. The next run starts with a different idea.'}</p><div class="end-record"><b>${run.goals} GOALS</b><b>£${run.bank} BANKED</b></div><div class="result-actions"><button class="primary" data-action="new">ONE MORE SUNDAY</button><button class="secondary" data-action="shed">CLUB SHED · £${profile.kitty}</button></div>`;
 }
 pitch?.showPickups(run.phase==='pickup'?run.offers:[]);
 $('#situation').textContent=busy?'Playing the next two seconds.':`${f.name}. ${run.lives} legs left. ${run.state.beats*2} seconds left. ${run.state.bursts} sprints and ${run.state.passes} one-twos available. ${run.message}`;
 refreshOrders();paint();
}
function refreshOrders(){
 const planning=!intro&&!busy&&run.phase==='planning';
 $('#orders').hidden=!planning;
 if(!planning)return;
 let title=ally!==null?'ONE–TWO':order?.kind==='shot'?(chip?'CHEEKY DINK':'PICK YOUR CORNER'):burst?'SPRINT':'PLOT YOUR RUN';
 let detail=`Click grass. Runs reach ${run.runRange+(burst?7:0)}m; drag from your ring to bend the route.`;
 if(ally!==null)detail='Click grass to choose where you want the return ball.';
 if(preview){
  if(!preview.valid)detail=preview.error;
  else if(['tackle','intercept','save'].includes(preview.type))detail=preview.type==='save'?'The keeper can reach this shot. Try the other corner.':preview.type==='intercept'?'That return ball crosses a defender’s path.':'A defender reaches this run. Change the route.';
  else if(preview.type==='whistle')detail='This uses the last two seconds. You need a shot.';
  else if(order.kind==='shot')detail='Follow the ball. There is no dice roll.';
  else detail=ally!==null?'Kev plays it back while you move. Space to play.':'Your run is set. Space to play the next two seconds.';
 }
 const danger=preview?.valid&&['tackle','intercept','save','whistle'].includes(preview.type);
 $('#orders').innerHTML=`<div class="plan-copy ${danger?'warning':''}"><b>${title}</b><span>${esc(detail)}</span></div><div class="order-buttons"><button class="small-button ${burst?'selected':''}" data-action="burst" aria-pressed="${burst}" ${run.state.bursts<1?'disabled':''}>SPRINT <b>${run.state.bursts}</b><small>B</small></button><button class="small-button" data-action="rewind" ${!run.before||run.rewinds<1?'disabled':''}>REWIND <b>${run.rewinds}</b><small>R</small></button>${run.buffs.chip?`<button class="small-button ${chip?'selected':''}" data-action="chip" aria-pressed="${chip}">DINK <small>C</small></button>`:''}<button class="primary play-button" data-action="play" ${!preview?.valid?'disabled':''}>PLAY 2 SECONDS <small>SPACE</small></button></div>`;
}
function point(x,z,y=0){return pitch?.screenPoint(x,z,y)||{x:0,y:0};}
function line(points,css,dash=''){
 return `<polyline class="${css}" points="${points.map(p=>{const q=point(p.x,p.z);return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;}).join(' ')}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
}
function paint(){
 if(!pitch||!run?.state)return;
 const width=$('#pitch-host').clientWidth,height=$('#pitch-host').clientHeight;
 $('#vision').setAttribute('viewBox',`0 0 ${width} ${height}`);
 if(intro||busy||run.phase!=='planning'){$('#vision').innerHTML='';}
 else{
  let markup='';const player=run.state.actors[0];
  if(!order){const range=run.runRange+(burst?7:0)+(ally===null?0:2),circle=[];for(let i=0;i<=40;i++){const a=i/40*Math.PI*2;circle.push({x:player.x+Math.cos(a)*range,z:player.z+Math.sin(a)*range});}markup+=line(circle,'range-circle','3 8');}
  for(const a of run.state.actors){if(!a.active&&a.id!==14)continue;const target=run.intents[a.id];const end=point(target.x,target.z);
   markup+=line([a,target],'enemy-path','5 6');markup+=`<circle class="enemy-end" cx="${end.x}" cy="${end.y}" r="${a.id===14?8:6}"/>`;
  }
  if(order){
   const p=preview?.valid?preview.order:order;
   if(p.kind==='shot')markup+=line([run.state.ball,p.target],'shot-path','7 5');
   else{
    const budget=run.runRange+(burst?7:0)+(ally===null?0:2),path=p.path?.length?p.path:[];
    const limited=route(player,path,budget),end=point(limited.at(-1).x,limited.at(-1).z);
    markup+=line(limited,'your-path');markup+=`<g class="your-ghost" transform="translate(${end.x-5},${end.y-15})"><rect x="2" width="6" height="5"/><rect y="6" width="10" height="7"/><rect y="14" width="3" height="4"/><rect x="7" y="14" width="3" height="4"/></g>`;
    if(ally!==null)markup+=line([run.state.ball,run.intents[ally],limited.at(-1)],'pass-path','5 5');
   }
   if(preview?.point){const p=point(preview.point.x,preview.point.z);markup+=`<path class="collision-mark" d="M${p.x-7} ${p.y-7}l14 14m0-14l-14 14"/>`;}
  }
  $('#vision').innerHTML=markup;
 }
 const targetMarkup=[];
 if(!intro&&!busy&&run.phase==='planning'){
  for(const x of [-5.8,5.8]){const p=point(x,-47,1);const near=distance(run.state.actors[0],{x,z:-48})<=run.shotRange;
   targetMarkup.push(`<button class="world-target goal-target ${near?'in-range':'out-of-range'} ${order?.kind==='shot'&&Math.sign(order.target.x)===Math.sign(x)?'selected':''}" style="left:${p.x}px;top:${p.y}px" data-goal="${x}" aria-label="Aim at ${x<0?'left':'right'} corner${near?'':' — out of range'}"><i></i><span>${x<0?'LEFT':'RIGHT'}</span></button>`);
  }
  for(const i of [1,2,3]){const a=run.state.actors[i],p=point(a.x,a.z,2.5),near=distance(run.state.actors[0],a)<=29;
   targetMarkup.push(`<button class="world-target ally-target ${ally===i?'selected':''}" style="left:${Math.max(40,Math.min(width-40,p.x))}px;top:${p.y-23}px" data-ally="${i}" ${!near||run.state.passes<1?'disabled':''} aria-label="Ask ${a.role} for a one-two">${a.role.toUpperCase()} <span>1–2</span></button>`);
  }
 }else if(run.phase==='pickup'&&!busy){
  run.offers.forEach((id,i)=>{const g=GEAR[id],p=point((i-1)*13,-22,0);targetMarkup.push(`<button class="world-target pickup-target" style="left:${p.x}px;top:${p.y+19}px" data-gear="${id}" aria-label="Take ${esc(g.name)}. ${esc(g.text)}"><strong>${g.name.toUpperCase()}</strong><span>${g.text}</span><small>PRESS ${i+1} OR TAP</small></button>`);});
 }
 $('#targets').innerHTML=targetMarkup.join('');
}
async function play(){
 if(!isPlanning()||!preview?.valid)return;
 const result=run.commit(order);if(result.type==='invalid'){notify(result.detail);return;}
 busy=true;order=null;preview=null;ally=null;burst=false;pitch?.update(run);refresh();beep('move');
 if(pitch)await pitch.play(result);
 busy=false;refresh();if(result.type!=='move')beep(result.type);
}
function rewind(){if(busy||intro||$('#modal').open)return;if(run.rewind()){order=null;preview=null;burst=false;ally=null;pitch?.update(run);refresh();beep();}else notify('No second thoughts left for this run.');}
function continueRun(){if(busy)return;if(run.continue()){order=null;preview=null;burst=false;ally=null;pitch?.update(run);refresh();}}
function start(){intro=false;refresh();}
function openModal(content){$('#modal-content').innerHTML=content+'<button class="secondary" data-action="close">BACK TO THE PITCH</button>';if(!$('#modal').open)$('#modal').showModal();}
function help(){openModal(`<span class="eyebrow">FOOTBALL THAT WAITS FOR YOU</span><h2 id="modal-title">THE NEXT TWO SECONDS.</h2><p>The pitch is frozen. You are the striker with the yellow ring. Nothing moves while you think.</p><ol><li><b>Read the orange lines.</b> Defenders and the keeper have already chosen their next moves. Their circles show where they are heading.</li><li><b>Draw your run.</b> Click the grass, or drag a route starting from your yellow ring. The pale ghost shows where you will finish. Sprint goes further, but you only have a limited supply.</li><li><b>Use a teammate.</b> Tap a red-shirted teammate's name for a one-two, then click where to run. You can slip past a defender while the ball is away. A passing lane can still be cut out.</li><li><b>Take the shot.</b> The LEFT and RIGHT targets are inside the goal. Get into range, make the keeper commit, and aim for the gap. Goals, saves and tackles come from the actual paths, not percentages.</li><li><b>Play it.</b> Space or PLAY 2 SECONDS moves everyone together. Then the match freezes again. You have six or seven turns to finish the attack.</li></ol><p>Score to get to next Sunday. A failed attack costs one of your three legs. You have one rewind for the run: change a decision after seeing what happened. Pick up a bit of kit after each goal.</p><div class="help-keys">Arrows / WASD: plan a run · Q/E: diagonal run · 1/2: aim at goal · P: Kev · B: sprint · C: dink (if learned) · R: rewind · Space: play · Enter: continue</div><p class="muted">£20 per goal goes into the club kitty when your run ends. Club Shed upgrades apply to the next run. Closing or refreshing ends the current run; your saved kitty and upgrades stay.</p>`);}
function shed(){openModal(`<span class="eyebrow">THE CLUB KITTY · £${profile.kitty}</span><h2 id="modal-title">THE CLUB SHED.</h2><p>A little preparation carries into every new run. Existing kitty and upgrades from the first prototype are kept.</p><div class="upgrades">${Object.entries(UPGRADES).map(([id,u])=>`<div><section><strong>${u.name}</strong><p>${u.text}</p><span>LEVEL ${profile[id]}/${u.max}</span></section><button class="secondary" data-upgrade="${id}" ${profile[id]>=u.max||profile.kitty<u.price?'disabled':''}>${profile[id]>=u.max?'SORTED':`£${u.price}`}</button></div>`).join('')}</div>`);}
app.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.goal!==undefined){aim(Number(b.dataset.goal));return;}
 if(b.dataset.ally!==undefined){chooseAlly(Number(b.dataset.ally));return;}
 if(b.dataset.gear){if(run.collect(b.dataset.gear)){order=null;preview=null;burst=false;ally=null;pitch?.showPickups([]);pitch?.update(run);refresh();beep();}return;}
 if(b.dataset.upgrade){if(purchase(profile,b.dataset.upgrade)){if(!saveProfile(storage,profile))notify('This browser could not save the purchase.');shed();}return;}
 switch(b.dataset.action){
  case 'start':start();break;case 'new':newRun();break;case 'play':play();break;case 'rewind':rewind();break;case 'continue':continueRun();break;
  case 'burst':if(isPlanning()){burst=!burst;if(order?.kind==='shot'){order=null;preview=null;}else if(order){order={...order,burst};preview=run.preview(order);}refreshOrders();paint();}break;
  case 'chip':if(isPlanning()){chip=!chip;if(order?.kind==='shot'){order={...order,chip};preview=run.preview(order);}refreshOrders();paint();}break;
  case 'help':help();break;case 'shed':shed();break;case 'close':$('#modal').close();break;
  case 'sound':sound=!sound;b.textContent=sound?'SOUND ON':'SOUND OFF';b.setAttribute('aria-pressed',String(sound));beep();break;
  case 'low':low=!low;pitch?.setLow(low);b.setAttribute('aria-pressed',String(low));notify(low?'LO-FI: 384 pixels. Smaller is faster.':'Pixel pitch: 640 pixels.');break;
  case 'fullscreen':if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>notify('Use your browser fullscreen control.'));break;
 }
});
const host=$('#pitch-host');
host.addEventListener('pointerdown',e=>{if(!isPlanning()||e.button!==0)return;const p=pitch?.groundPoint(e.clientX,e.clientY);if(!p)return;drag={id:e.pointerId,start:p,points:[],x:e.clientX,y:e.clientY,near:distance(p,run.state.actors[0])<7,moved:false};host.setPointerCapture(e.pointerId);});
host.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId||!isPlanning())return;const p=pitch?.groundPoint(e.clientX,e.clientY);if(!p)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)drag.moved=true;if(drag.near&&drag.moved&&(!drag.points.length||distance(drag.points.at(-1),p)>.8)){drag.points.push(p);if(drag.points.length>40)drag.points=drag.points.filter((_,i)=>i%2===0);order={kind:ally===null?'run':'one-two',ally,burst,path:drag.points};preview=null;requestPaint();}});
host.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const p=pitch?.groundPoint(e.clientX,e.clientY),d=drag;drag=null;if(!isPlanning()||!p)return;if(!d.moved&&p.z<-43&&Math.abs(p.x)<7){aim(p.x);return;}setPath(d.near&&d.moved&&d.points.length?d.points:[p]);});
host.addEventListener('pointercancel',()=>{drag=null;});
document.addEventListener('keydown',e=>{
 if(e.repeat||$('#modal').open||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 const k=e.key.toLowerCase();
 if(k==='enter'&&e.target.tagName!=='BUTTON'){e.preventDefault();if(intro)start();else if(['goal','setback'].includes(run.phase))continueRun();else if(['champion','over'].includes(run.phase))newRun();return;}
 if(busy||intro)return;
 if(run.phase==='pickup'&&['1','2','3'].includes(k)){const id=run.offers[Number(k)-1];$(`[data-gear="${id}"]`)?.click();return;}
 if(k==='r'){e.preventDefault();rewind();return;}
 if(run.phase!=='planning')return;
 if(['arrowup','w','arrowdown','s','arrowleft','a','arrowright','d','q','e'].includes(k)){e.preventDefault();const dir={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0],q:[-1,-1],e:[1,-1]}[k];directional(...dir);}
 else if(k===' '){e.preventDefault();play();}else if(k==='1')aim(-5.8);else if(k==='2')aim(5.8);else if(k==='p')chooseAlly(1);else if(k==='b')$('[data-action="burst"]')?.click();else if(k==='c')$('[data-action="chip"]')?.click();else if(k==='escape')clearPlan();
});
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))$('#modal').close();});
reduced.addEventListener('change',e=>{if(pitch)pitch.reducedMotion=e.matches;});
if(pitch)pitch.onFrame=()=>{if(!busy)requestPaint();};
window.sundayPerformance=()=>pitch?.metrics()||{fallback:true};
newRun(true);
