import {createSoccerMatch,SOCCER_STEP} from './construct/scripts/engine.js';
import {makeRenderer} from './src/scroll-pitch.js';
const $=id=>document.getElementById(id),renderer=makeRenderer($('view'));
let m=null,paused=false,busy=false,acc=0,last=performance.now(),nextHud=0;
function drawStats(){if(!m)return;let [a,b]=m.stats;$('status').textContent=(m.events[0]?.text||'PLAY')+' · '+m.phase.toUpperCase()+' · '+m.actors.filter(p=>p.visible).length+' players';$('stats').textContent='Shots '+a.shots+'–'+b.shots+' | Completed passes '+a.completed+'–'+b.completed+' | Tackles '+a.tackles+'–'+b.tackles+' | Saves '+a.saves+'–'+b.saves;}
$('start').onclick=async()=>{if(busy)return;busy=true;$('start').disabled=true;$('status').textContent='Starting Soccer-JS…';try{m=await createSoccerMatch(12345,[],0,90,5);renderer.reset();paused=false;acc=0;$('pause').disabled=false;$('pause').textContent='Pause';drawStats()}catch(err){m=null;$('status').textContent='Engine startup failed: '+err.message;console.error(err)}finally{busy=false;$('start').disabled=false}};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause'};
function frame(now){let dt=Math.min(.1,(now-last)/1000);last=now;if(m){if(!paused&&!m.finished&&!busy){acc+=dt*Number($('speed').value);while(acc>=SOCCER_STEP&&!m.finished){m.step();acc-=SOCCER_STEP}}renderer.render(m,dt);if(now>nextHud){drawStats();nextHud=now+200}}requestAnimationFrame(frame)}requestAnimationFrame(frame);
