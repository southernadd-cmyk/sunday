// SUNDAY: fixed-step, seeded, enclosed five-a-side. No browser dependencies.
export const STEP=1/60,W=480,H=270,GOAL=29,HALF=90;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const norm=(x,y)=>{let n=Math.hypot(x,y)||1;return [x/n,y/n]};
export const RULES={
 outlet:{name:'The Outlet',role:'GK',trigger:'save',effect:'Immediately release to the most open teammate.'},
 thief:{name:'Pickpocket',role:'FIXO',trigger:'win',effect:'A successful tackle releases a forward pass.'},
 relay:{name:'Hot Potato',role:'ALA',trigger:'receive',effect:'A first-time pass to an open teammate, without dwelling.'},
 runner:{name:'Give & Go',role:'ALA',trigger:'pass',effect:'After passing, sprint into a forward passing lane for the return.'},
 wall:{name:'Bank Job',role:'ALA',trigger:'receive',effect:'Bank a pass off the boards to a teammate beyond the defender.'},
 poach:{name:'Fox in the Box',role:'PIVOT',trigger:'receive',effect:'Shoot first-time if receiving within range of goal.'},
 rebound:{name:'Second Helping',role:'PIVOT',trigger:'rebound',effect:'Strike a loose ball from a saved or blocked shot.'},
 switch:{name:'Switchboard',role:'ALA',trigger:'receive',effect:'Move the ball to the opposite flank when crowded.'},
 stopper:{name:'The Screen',role:'FIXO',trigger:'loss',effect:'Drop between the ball and goal after a turnover.'},
 hound:{name:'Bloodhound',role:'ALA',trigger:'loss',effect:'Chase the new ball carrier rather than retreat.'},
 pivot:{name:'Lay-Off',role:'PIVOT',trigger:'receive',effect:'Lay the ball back to a supporting runner when closely marked.'},
 keeper:{name:'Sweeper Keeper',role:'GK',trigger:'loose',effect:'Leave the line to collect a loose ball in the defensive third.'}
};
export const DEFAULT=['outlet','thief','runner','relay','poach'];
const formations=[[26,135],[114,135],[165,62],[165,208],[210,135]];
export function makeMatch(seed=1,deck=DEFAULT,level=0,halfSeconds=HALF){
 let state=seed>>>0;const rand=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);
 const m={players:[],ball:{x:240,y:135,vx:0,vy:0,owner:null,flight:null},score:[0,0],time:0,half:1,phase:'play',halfSeconds,level,events:[],stats:[stats(),stats()],call:null,tokens:3,chain:0,best:0,seq:0,deck:[...deck]};
 function stats(){return {shots:0,passes:0,completed:0,tackles:0,saves:0,banks:0,combos:0,possession:0,goals:0}}
 function log(kind,p,detail='',link=null){let e={id:++m.seq,time:m.time,kind,team:p?.team??0,player:p?.id??null,detail,link};m.events.push(e);if(m.events.length>200)m.events.shift();return e}
 function kickoff(team){m.players=[];for(let t=0;t<2;t++)for(let i=0;i<5;i++){let [x,y]=formations[i];m.players.push({id:t*5+i,team:t,role:i,x:t?W-x:x,y,vx:0,vy:0,face:t?-1:1,rule:t?['keeper','stopper','hound','switch','rebound'][i]:m.deck[i],cool:0,ruleCool:0,run:0,screen:0,press:0,energy:1})}let p=m.players[team*5+4];p.x=team?247:233;Object.assign(m.ball,{x:p.x,y:p.y,vx:0,vy:0,owner:p.id,flight:null});m.chain=0;}
 kickoff(0);
 const mates=p=>m.players.filter(q=>q.team===p.team&&q.id!==p.id);
 const foes=p=>m.players.filter(q=>q.team!==p.team);
 const pressure=p=>Math.min(...foes(p).map(q=>d(p,q)));
 function lane(a,b,team){let dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy||1;return Math.min(40,...m.players.filter(q=>q.team!==team).map(q=>{let t=clamp(((q.x-a.x)*dx+(q.y-a.y)*dy)/l,0,1);return Math.hypot(q.x-a.x-t*dx,q.y-a.y-t*dy)}))}
 const dir=p=>p.team?-1:1,range=p=>p.team?p.x:W-p.x;
 function target(p,mode='normal'){let list=mates(p).filter(q=>q.role!==0);if(mode==='back')list=list.filter(q=>dir(p)*(q.x-p.x)<0);if(mode==='switch')list=list.filter(q=>Math.abs(q.y-p.y)>60);return list.map(q=>({q,s:lane(p,q,p.team)*1.5+pressure(q)*.65+dir(p)*(q.x-p.x)*.16+(q.run>0?24:0)-d(p,q)*.08})).sort((a,b)=>b.s-a.s)[0]?.q}
 function kick(p,x,y,speed,type,cause=null,to=null){if(m.ball.owner!==p.id)return false;let [nx,ny]=norm(x-p.x,y-p.y);if(type==='shot')m.stats[p.team].shots++;else m.stats[p.team].passes++;Object.assign(m.ball,{x:p.x+nx*5,y:p.y+ny*5,vx:nx*speed,vy:ny*speed,owner:null,flight:{team:p.team,from:p.id,to,type,age:0,bounces:0,cause,depth:cause?.depth??0}});p.cool=.5;log(type,p,to!==null?'To '+to:'',cause?.id??null);if(type!=='shot')trigger(p,'pass',cause);return true}
 function pass(p,q,cause=null,bank=false){if(!q)return false;let lead=clamp(d(p,q)/190,.1,.65),x=clamp(q.x+q.vx*lead,10,W-10),y=clamp(q.y+q.vy*lead,10,H-10);if(bank){let top=p.y<H/2,wallY=top?5:H-5;y=2*wallY-y;return kick(p,x,y,215,'bank',cause,q.id)}return kick(p,x,y,175,'pass',cause,q.id)}
 function shoot(p,cause=null){let keeper=m.players[(1-p.team)*5],y=H/2+(keeper.y<H/2?1:-1)*(GOAL-8)+(rand()-.5)*9;return kick(p,p.team?-8:W+8,y,255,'shot',cause)}
 function trigger(p,event,parent=null){let rule=RULES[p.rule];if(!rule||rule.trigger!==event||p.ruleCool>0)return false;let cause={id:m.seq+1,depth:(parent?.depth??0)+1},ok=false; // Reserve cooldown BEFORE nested pass triggers.
 p.ruleCool=1.3;
 switch(p.rule){
 case 'outlet':case 'thief':case 'relay':ok=pass(p,target(p),cause);break;
 case 'runner':p.run=3;ok=true;break;
 case 'wall':{let q=target(p);if(q&&d(p,q)>35&&Math.abs(p.y-H/2)>35)ok=pass(p,q,cause,true);break}
 case 'poach':if(range(p)<150)ok=shoot(p,cause);break;
 case 'rebound':if(range(p)<175)ok=shoot(p,cause);break;
 case 'switch':if(pressure(p)<30)ok=pass(p,target(p,'switch'),cause);break;
 case 'pivot':if(pressure(p)<26)ok=pass(p,target(p,'back'),cause);break;
 case 'stopper':p.screen=3;ok=true;break;
 case 'hound':p.press=3;ok=true;break;
 case 'keeper':if(m.ball.owner===null&&Math.abs(m.ball.x-(p.team?W:0))<90){p.press=1.1;ok=true}break;
 }
 if(ok){let e=log('rule',p,rule.name,parent?.id??null);cause.id=e.id;if(!p.team){m.chain=cause.depth;m.best=Math.max(m.best,m.chain);if(cause.depth>1)m.stats[0].combos++;}}else p.ruleCool=0;return ok}
 function receive(p){let f=m.ball.flight;Object.assign(m.ball,{owner:p.id,vx:0,vy:0,flight:null});p.cool=.28;let event='receive';if(f){if(f.team===p.team&&f.from!==p.id&&f.type!=='shot'){m.stats[p.team].completed++;if(f.bounces)m.stats[p.team].banks++}else if(f.team!==p.team){if(f.type==='shot'&&p.role===0){m.stats[p.team].saves++;event='save'}else{m.stats[p.team].tackles++;event='win'}}if(f.type==='shot'&&p.role!==0)event='rebound';log(event,p,'',f.cause?.id??null)}trigger(p,event,f?.team===p.team?f.cause:null)}
 function goal(t){m.score[t]++;m.stats[t].goals++;log('goal',{team:t},m.score.join('–'),m.ball.flight?.cause?.id??null);kickoff(1-t)}
 function command(id){if(m.phase!=='play'||m.tokens<=0||m.call)return false;if(!['left','right','hunt','reset'].includes(id))return false;m.tokens--;m.call={id,until:m.time+6};log('call',{team:0},id);return true}
 function move(p,dt){let b=m.ball,o=m.players[b.owner],sgn=dir(p),[hx,hy]=formations[p.role];if(p.team)hx=W-hx;let attack=o?.team===p.team,closest=m.players.filter(q=>q.team===p.team&&q.role!==0).sort((a,b)=>d(a,m.ball)-d(b,m.ball))[0];let x=hx,y=hy;
 if(p.role===0){x=p.team?W-22:22;y=clamp(b.y,H/2-GOAL+3,H/2+GOAL-3);if(p.press>0&&!o){x=b.x;y=b.y}}
 else if(o===p){x=p.x+sgn*55;y=H/2+(p.y-H/2)*.72;if(pressure(p)<20)y=clamp(p.y+(p.y<H/2?-35:35),19,H-19)}
 else if(!attack&&(p===closest||p.press>0||(!p.team&&m.call?.id==='hunt'&&d(p,b)<65))){x=clamp(b.x+(o?0:b.vx*.11),8,W-8);y=clamp(b.y+(o?0:b.vy*.11),8,H-8)}
 else{x=clamp(hx+(b.x-W/2)*.48+(attack?sgn*32:-sgn*15),55,W-55);y=clamp(hy+(b.y-H/2)*.18,15,H-15);if(p.run>0&&attack){x=clamp(p.x+sgn*85,65,W-40);y=clamp(p.y+(p.role===2?-7:7),20,H-20)}if(p.screen>0){x=clamp(b.x-sgn*52,40,W-40);y=(b.y+H/2)/2}if(!p.team&&attack&&m.call){if(m.call.id==='left'||m.call.id==='right'){if(p.role===2||p.role===3)y=m.call.id==='left'?35:235}if(m.call.id==='reset'){x=clamp(b.x-55,35,W-35)}}}
 for(let q of m.players){if(q===p)continue;let n=d(p,q);if(n>0&&n<16){x+=(p.x-q.x)/n*(16-n)*1.6;y+=(p.y-q.y)/n*(16-n)*1.6}}
 let dx=x-p.x,dy=y-p.y,[nx,ny]=norm(dx,dy),speed=(p.role===0?46:55+(p.team?level*3:0))*(.8+.2*p.energy)*(p.run>0||p.press>0?1.18:1),desired=Math.min(speed,Math.hypot(dx,dy)*5),a=Math.min(1,dt*8);p.vx+=(nx*desired-p.vx)*a;p.vy+=(ny*desired-p.vy)*a;p.x=clamp(p.x+p.vx*dt,9,W-9);p.y=clamp(p.y+p.vy*dt,9,H-9);if(Math.abs(p.vx)>3)p.face=Math.sign(p.vx);p.energy=clamp(p.energy-dt*(p.run>0||p.press>0?.006:.0007),.68,1)}
 function step(dt=STEP){if(m.phase!=='play')return;m.time+=dt;if(m.time>=m.half*m.halfSeconds){m.time=m.half*m.halfSeconds;m.phase=m.half===1?'half':'full';return}if(m.call&&m.time>=m.call.until)m.call=null;
 for(let p of m.players){for(let k of ['cool','ruleCool','run','screen','press'])p[k]=Math.max(0,p[k]-dt);if(p.role===0)trigger(p,'loose');move(p,dt)}
 let b=m.ball,o=m.players[b.owner];if(o){b.x=o.x+o.face*4;b.y=o.y;m.stats[o.team].possession+=dt;let q=foes(o).filter(q=>q.cool===0&&d(q,o)<10).sort((a,b)=>d(a,o)-d(b,o))[0];if(q&&o.cool===0&&rand()<dt*(2.4+(q.press>0?2:0))){b.owner=q.id;q.cool=.4;o.cool=.5;m.stats[q.team].tackles++;log('win',q);trigger(o,'loss');trigger(q,'win');return}
 if(o.cool===0){let t=target(o),r=range(o),open=lane(o,{x:o.team?0:W,y:H/2},o.team);if(o.role!==0&&r<140&&open>6&&rand()<dt*3)shoot(o);else if(t&&(o.role===0||pressure(o)<24||rand()<dt*.95)&&lane(o,t,o.team)>7)pass(o,t);else if(o.role===0&&t)pass(o,t)}return}
 let f=b.flight;if(f)f.age+=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.vx*=Math.pow(.88,dt);b.vy*=Math.pow(.88,dt);
 if(b.y<5||b.y>H-5){b.y=clamp(b.y,5,H-5);b.vy*=-.88;if(f)f.bounces++}
 if(b.x<5||b.x>W-5){if(Math.abs(b.y-H/2)<GOAL){goal(b.x>W/2?0:1);return}b.x=clamp(b.x,5,W-5);b.vx*=-.82;if(f)f.bounces++}
 let candidates=m.players.filter(p=>p.cool===0&&d(p,b)<(p.role===0?11:7)&&!(f?.from===p.id&&f.age<.45));
 if(candidates.length)receive(candidates.sort((p,q)=>d(p,m.ball)-d(q,m.ball))[0]);
 }
 function resume(deck=m.deck){if(m.phase!=='half')return false;m.deck=[...deck];m.half=2;m.phase='play';m.tokens=3;m.call=null;kickoff(1);return true}
 return Object.assign(m,{step,resume,command,debug:{kick,trigger,receive,goal,target}});
}
