export function scoreboard(m){
 const sec=Math.max(0,Math.min(5400,Math.floor(Number(m.matchSeconds)||0)));
 const clock=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
 const phase=m.phase==='halftime'?'HALF TIME':m.phase==='fulltime'?'FULL TIME':m.phase==='goal'?'GOAL!':m.phase==='kickoff'?'KICK OFF':m.phase==='play'?(m.half===2?'2ND HALF':'1ST HALF'):String(m.phase||'READY').toUpperCase();
 return {clock,phase,home:m.score[0],away:m.score[1]};
}
