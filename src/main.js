import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-700.css';
import './style.css';
import { Run, GEAR, FIXTURES, GOAL, PASS_RANGE, UPGRADES, readProfile, saveProfile, purchase, distance, route } from './engine.js';
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
function pathOrder(points){return {kind:['pass','call','one-two'].includes(order?.kind)?order.kind:'run',ally,burst,path:points};}
function setPath(points){
 if(!isPlanning())return;
 order=pathOrder(points);preview=run.preview(order);
 refreshOrders();requestPaint();
}
function aim(x){if(!isPlanning())return;ally=null;burst=false;order={kind:'shot',target:{x,z:GOAL.z},chip};preview=run.preview(order);refreshOrders();paint();}
function choosePass(index){
 if(!isPlanning())return;
 if(index===run.state.ballOwner){chooseCall();return;}
 if(order?.kind==='pass'&&ally===index){clearPlan();return;}
 ally=index;burst=false;order={kind:'pass',ally,path:[]};preview=run.preview(order);refreshOrders();paint();
}
function chooseOneTwo(index){
 if(!isPlanning())return;
 if(order?.kind==='one-two'&&ally===index){clearPlan();return;}
 ally=index;order={...(run.suggestOneTwo(index,{burst})||{kind:'one-two',ally,burst,path:[]}),auto:true};preview=run.preview(order);refreshOrders();paint();
}
function chooseCall(){
 if(!isPlanning())return;
 ally=null;burst=false;order={kind:'call',path:[]};preview=run.preview(order);refreshOrders();paint();
}
function directional(dx,dz){
 const p=run.state.actors[0],length=Math.hypot(dx,dz),budget=run.runRange+(burst?7:0)+(order?.kind==='one-two'?2:0);
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
 if(intro)$('#intro').innerHTML=`<div class="intro-label">A NEW WAY TO PLAY SUNDAY</div><h1>THE NEXT<br>TWO SECONDS.</h1><p>The match freezes. You draw your run.<br>Then everybody moves together.</p><div class="intro-rules"><span><b>LOOK</b>Orange paths are their next moves.</span><span><b>PASS</b>Tap a red shirt. Tap 1–2 to give and go.</span><span><b>PLAY</b>Pick a corner when the shot is on.</span></div><button class="primary" data-action="start">STEP ONTO THE PITCH <small>ENTER</small></button><button class="quiet" data-action="help">THE QUICK TEAM TALK</button><div class="intro-footer">FOUR SUNDAYS. THREE LEGS. ONE SECOND THOUGHT.</div>`;
 $('#moment').hidden=busy||!['goal','setback','over','champion','pickup'].includes(run.phase);
 if(!busy&&run.phase==='goal')$('#moment').innerHTML=`<div class="moment-flag">GET IN!</div><h2>THAT'S HOW YOU FIND SPACE.</h2><p>${esc(run.message)}</p><button class="primary" data-action="continue">${run.fixtureIndex===3?'LIFT THE CUP':'BACK TO THE TOUCHLINE'} <small>ENTER</small></button>`;
 else if(!busy&&run.phase==='setback')$('#moment').innerHTML=`<div class="moment-flag bad">${({tackle:'CAUGHT.',intercept:'CUT OUT.',save:'SAVED.',whistle:'CHANCE GONE.'})[run.lastResult.type]}</div><p>${esc(run.message)}</p><div class="result-actions">${run.rewinds>0?'<button class="secondary" data-action="rewind">CHANGE THOSE TWO SECONDS <small>R</small></button>':''}<button class="primary" data-action="continue">${run.lives?'NEXT ATTACK':'BACK TO THE CLUBHOUSE'} <small>ENTER</small></button></div>`;
 else if(!busy&&run.phase==='pickup')$('#moment').innerHTML=`<div class="pickup-heading"><span>THE GAFFER FOUND THESE IN HIS CAR.</span><h2>TAKE ONE. LEAVE THE REST.</h2><p>Click a bit of kit on the pitch. Keep it for this run.</p></div>`;
 else if(['over','champion'].includes(run.phase)){
  bank();$('#moment').innerHTML=`<div class="moment-flag ${run.phase==='over'?'bad':''}">${run.phase==='champion'?'PUB LEGEND.':'LEGS GONE.'}</div><p>${run.phase==='champion'?'Four Sundays. One very dented cup. Work in the morning.':'Off to the touchline. The next run starts with a different idea.'}</p><div class="end-record"><b>${run.goals} GOALS</b><b>£${run.bank} BANKED</b></div><div class="result-actions"><button class="primary" data-action="new">ONE MORE SUNDAY</button><button class="secondary" data-action="shed">CLUB SHED · £${profile.kitty}</button></div>`;
 }
 pitch?.showPickups(run.phase==='pickup'?run.offers:[]);
 $('#situation').textContent=busy?'Playing the next two seconds.':`${f.name}. ${run.lives} legs left. ${run.state.beats*2} seconds left. Ball with ${run.state.actors[run.state.ballOwner].role}. ${run.state.bursts} sprints and ${run.state.passes} one-twos available. ${run.message}`;
 refreshOrders();paint();
}
function refreshOrders(){
 const planning=!intro&&!busy&&run.phase==='planning';
 $('#orders').hidden=!planning;
 if(!planning)return;
 const owner=run.state.ballOwner,name=run.state.actors[ally??owner].role.toUpperCase(),kind=order?.kind;
 let title=kind==='one-two'?`ONE–TWO WITH ${name}`:kind==='pass'?`PASS TO ${name}`:kind==='call'?'CALL FOR THE BALL':kind==='shot'?(chip?'CHEEKY DINK':'PICK YOUR CORNER'):burst?'SPRINT':owner!==0?`OFF THE BALL · ${name}`:'PLOT YOUR RUN';
 let detail=owner!==0?`Click grass to run off the ball. Tap ${name} · BALL to call for it.`:`Tap a red shirt to pass, 1–2 to combine, or grass to run. Range ${run.runRange+(burst?7:0)}m.`;
 if(preview){
  if(!preview.valid)detail=preview.error;
  else if(['tackle','intercept','save'].includes(preview.type))detail=preview.type==='save'?'The keeper can reach this shot. Try the other corner.':preview.type==='intercept'?'That pass crosses a defender’s path. Try a different red shirt or run.':preview.detail;
  else if(preview.type==='whistle')detail='This uses the last two seconds. You need a shot.';
  else if(order.kind==='shot')detail='Follow the ball. There is no dice roll.';
  else if(kind==='one-two')detail='Return run suggested. Press Space to go, or tap grass to change it.';
  else if(kind==='pass')detail=`${name} keeps the ball. Space to pass; tap grass to pass and move.`;
  else if(kind==='call')detail='He plays it back to you. Space to call; tap grass to receive into space.';
  else detail=owner!==0?'Your off-ball run is set. Your teammate keeps possession.':'Your run is set. Space to play the next two seconds.';
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
  if(!order){const range=run.runRange+(burst?7:0),circle=[];for(let i=0;i<=40;i++){const a=i/40*Math.PI*2;circle.push({x:player.x+Math.cos(a)*range,z:player.z+Math.sin(a)*range});}markup+=line(circle,'range-circle','3 8');}
  for(const a of run.state.actors){if(!a.active&&a.id!==14)continue;const target=run.intents[a.id];const end=point(target.x,target.z);
   markup+=line([a,target],'enemy-path','5 6');markup+=`<circle class="enemy-end" cx="${end.x}" cy="${end.y}" r="${a.id===14?8:6}"/>`;
  }
  if(order){
   const p=preview?.valid?preview.order:order;
   if(p.kind==='shot')markup+=line([run.state.ball,p.target],'shot-path','7 5');
   else{
    const budget=run.runRange+(burst?7:0)+(p.kind==='one-two'?2:0),path=p.path?.length?p.path:[];
    const limited=route(player,path,budget),end=point(limited.at(-1).x,limited.at(-1).z);
    markup+=line(limited,'your-path');markup+=`<g class="your-ghost" transform="translate(${end.x-5},${end.y-15})"><rect x="2" width="6" height="5"/><rect y="6" width="10" height="7"/><rect y="14" width="3" height="4"/><rect x="7" y="14" width="3" height="4"/></g>`;
    if(preview?.passPoints)markup+=line(preview.passPoints,'pass-path','5 5');
   }
   if(preview?.point){const p=point(preview.point.x,preview.point.z);markup+=`<path class="collision-mark" d="M${p.x-7} ${p.y-7}l14 14m0-14l-14 14"/>`;}
  }
  $('#vision').innerHTML=markup;
 }
 const targetMarkup=[];
 if(!intro&&!busy&&run.phase==='planning'){
  for(const x of [-5.8,5.8]){const p=point(x,-47,1);const near=run.state.ballOwner===0&&distance(run.state.actors[0],{x,z:-48})<=run.shotRange;
   targetMarkup.push(`<button class="world-target goal-target ${near?'in-range':'out-of-range'} ${order?.kind==='shot'&&Math.sign(order.target.x)===Math.sign(x)?'selected':''}" style="left:${p.x}px;top:${p.y}px" data-goal="${x}" aria-label="Aim at ${x<0?'left':'right'} corner${near?'':' — out of range'}"><i></i><span>${x<0?'LEFT':'RIGHT'}</span></button>`);
  }
  const owner=run.state.ballOwner,holder=run.state.actors[owner],player=run.state.actors[0];
  for(const i of [1,2,3,4,5,6]){const a=run.state.actors[i],p=point(a.x,a.z,2.5),near=distance(holder,a)<=PASS_RANGE,carrier=owner===i,combo=owner===0&&distance(run.state.actors[0],a)<=29&&run.state.passes>0;
   if(p.y>height-145||p.y<95||(!near&&!carrier&&i>3))continue;
   targetMarkup.push(`<div class="world-target ally-marker" style="left:${Math.max(65,Math.min(width-65,p.x))}px;top:${p.y-23}px"><button class="ally-target ${ally===i&&order?.kind==='pass'?'selected':''} ${carrier?'carrier':''}" data-ally="${i}" ${!near?'disabled':''} aria-label="${carrier?'Call for ball from':'Pass to'} ${a.role.toUpperCase()}">${a.role.toUpperCase()}${carrier?' <span>· BALL ↩</span>':''}</button>${owner===0?`<button class="ally-target combo-target ${ally===i&&order?.kind==='one-two'?'selected':''}" data-combo="${i}" ${!combo?'disabled':''} aria-label="One-two with ${a.role.toUpperCase()}">1–2</button>`:''}</div>`);
  }
  if(owner!==0){const p=point(player.x,player.z,2.5);targetMarkup.push(`<button class="world-target ally-target call-target" style="left:${Math.max(65,Math.min(width-65,p.x))}px;top:${p.y-23}px" data-action="call" aria-label="Call for the ball">CALL ↩</button>`);}
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
function help(){openModal(`<span class="eyebrow">FOOTBALL THAT WAITS FOR YOU</span><h2 id="modal-title">THE NEXT TWO SECONDS.</h2><p>The pitch is frozen. You are always the striker with the yellow ring, including when a teammate has the ball.</p><ol><li><b>Read the orange lines.</b> Defenders and the keeper have already chosen their next moves. Their circles show where they are heading.</li><li><b>Draw your run.</b> Tap grass or drag a route from your ring. The ghost shows your destination. Sprint goes further, with a limited supply.</li><li><b>Pass and move.</b> Tap a red shirt or his name to pass. He keeps possession. You can also tap grass before playing to run while passing. On the next turn, run off the ball, pass to another teammate, or tap BALL / CALL to get it back. After choosing CALL, tap grass to receive into space. Ordinary passes do not use your one-twos.</li><li><b>Make a one-two.</b> Tap the separate 1–2 button beside a name. A return run is suggested immediately: press Space to play. Tap grass only if you want a different route. The preview warns when either pass crosses a defender. Tap the selected name or 1–2 again to cancel.</li><li><b>Finish.</b> Get the ball back at your feet, reach shooting range, then select LEFT or RIGHT. A learned dink can clear a tackle. Goals and interceptions come from the actual paths.</li><li><b>Play it.</b> Space or PLAY 2 SECONDS moves everyone together, then freezes the pitch again. Six or seven turns to finish.</li></ol><p>Score to reach next Sunday. A failed attack costs one of three legs. Rewind changes your last decision. Pick up kit after each goal.</p><div class="help-keys">Arrows / WASD: run · Q/E: diagonal · P: pass to Kev / call back · O: one-two with Kev · 1/2: aim · B: sprint · C: dink · R: rewind · Space: play · Enter: continue</div><p class="muted">£20 per goal is banked when the run ends. Club Shed upgrades apply to the next run. Refreshing ends the current run; your saved kitty and upgrades stay.</p>`);}
function shed(){openModal(`<span class="eyebrow">THE CLUB KITTY · £${profile.kitty}</span><h2 id="modal-title">THE CLUB SHED.</h2><p>A little preparation carries into every new run. Existing kitty and upgrades from the first prototype are kept.</p><div class="upgrades">${Object.entries(UPGRADES).map(([id,u])=>`<div><section><strong>${u.name}</strong><p>${u.text}</p><span>LEVEL ${profile[id]}/${u.max}</span></section><button class="secondary" data-upgrade="${id}" ${profile[id]>=u.max||profile.kitty<u.price?'disabled':''}>${profile[id]>=u.max?'SORTED':`£${u.price}`}</button></div>`).join('')}</div>`);}
app.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.goal!==undefined){aim(Number(b.dataset.goal));return;}
 if(b.dataset.ally!==undefined){choosePass(Number(b.dataset.ally));return;}
 if(b.dataset.combo!==undefined){chooseOneTwo(Number(b.dataset.combo));return;}
 if(b.dataset.gear){if(run.collect(b.dataset.gear)){order=null;preview=null;burst=false;ally=null;pitch?.showPickups([]);pitch?.update(run);refresh();beep();}return;}
 if(b.dataset.upgrade){if(purchase(profile,b.dataset.upgrade)){if(!saveProfile(storage,profile))notify('This browser could not save the purchase.');shed();}return;}
 switch(b.dataset.action){
  case 'start':start();break;case 'new':newRun();break;case 'play':play();break;case 'rewind':rewind();break;case 'continue':continueRun();break;case 'call':chooseCall();break;
  case 'burst':if(isPlanning()){burst=!burst;if(order?.kind==='shot'){order=null;preview=null;}else if(order){order=order.auto?{...(run.suggestOneTwo(ally,{burst})||order),auto:true}:{...order,burst};preview=run.preview(order);}refreshOrders();paint();}break;
  case 'chip':if(isPlanning()){chip=!chip;if(order?.kind==='shot'){order={...order,chip};preview=run.preview(order);}refreshOrders();paint();}break;
  case 'help':help();break;case 'shed':shed();break;case 'close':$('#modal').close();break;
  case 'sound':sound=!sound;b.textContent=sound?'SOUND ON':'SOUND OFF';b.setAttribute('aria-pressed',String(sound));beep();break;
  case 'low':low=!low;pitch?.setLow(low);b.setAttribute('aria-pressed',String(low));notify(low?'LO-FI: 384 pixels. Smaller is faster.':'Pixel pitch: 640 pixels.');break;
  case 'fullscreen':if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>notify('Use your browser fullscreen control.'));break;
 }
});
const host=$('#pitch-host');
host.addEventListener('pointerdown',e=>{if(!isPlanning()||e.button!==0)return;const p=pitch?.groundPoint(e.clientX,e.clientY);if(!p)return;drag={id:e.pointerId,start:p,points:[],x:e.clientX,y:e.clientY,near:distance(p,run.state.actors[0])<7,moved:false};host.setPointerCapture(e.pointerId);});
host.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId||!isPlanning())return;const p=pitch?.groundPoint(e.clientX,e.clientY);if(!p)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)drag.moved=true;if(drag.near&&drag.moved&&(!drag.points.length||distance(drag.points.at(-1),p)>.8)){drag.points.push(p);if(drag.points.length>40)drag.points=drag.points.filter((_,i)=>i%2===0);order=pathOrder(drag.points);preview=null;requestPaint();}});
host.addEventListener('pointerup',e=>{
 if(!drag||drag.id!==e.pointerId)return;
 const p=pitch?.groundPoint(e.clientX,e.clientY),d=drag;drag=null;if(!isPlanning()||!p)return;
 if(!d.moved){
  if(p.z<-43&&Math.abs(p.x)<7){aim(p.x);return;}
  const teammate=run.state.actors.slice(1,7).sort((a,b)=>distance(p,a)-distance(p,b))[0];
  if(distance(p,teammate)<3.4){if(e.shiftKey&&run.state.ballOwner===0)chooseOneTwo(teammate.id);else choosePass(teammate.id);return;}
  if(run.state.ballOwner!==0&&distance(p,run.state.actors[0])<3.4){chooseCall();return;}
 }
 setPath(d.near&&d.moved&&d.points.length?d.points:[p]);
});
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
 else if(k===' '){e.preventDefault();play();}else if(k==='1')aim(-5.8);else if(k==='2')aim(5.8);else if(k==='p'){if(run.state.ballOwner!==0)chooseCall();else choosePass(1);}else if(k==='o')chooseOneTwo(1);else if(k==='b')$('[data-action="burst"]')?.click();else if(k==='c')$('[data-action="chip"]')?.click();else if(k==='escape')clearPlan();
});
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))$('#modal').close();});
reduced.addEventListener('change',e=>{if(pitch)pitch.reducedMotion=e.matches;});
if(pitch)pitch.onFrame=()=>{if(!busy)requestPaint();};
window.sundayPerformance=()=>pitch?.metrics()||{fallback:true};
newRun(true);
