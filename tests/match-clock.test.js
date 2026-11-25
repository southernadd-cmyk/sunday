import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreboard} from '../src/match-clock.js';
import {createSoccerMatch} from '../construct/scripts/engine.js';
test('scoreboard formats actual football clock and preserves home-away order',()=>{
 assert.deepEqual(scoreboard({matchSeconds:2700,phase:'halftime',score:[2,1]}),{clock:'45:00',phase:'HALF TIME',home:2,away:1});
 assert.deepEqual(scoreboard({matchSeconds:5400,phase:'fulltime',score:[2,3]}),{clock:'90:00',phase:'FULL TIME',home:2,away:3});
 assert.equal(scoreboard({matchSeconds:90,phase:'play',half:1,score:[0,0]}).clock,'01:30');
});
test('attacking match clock reaches halftime and fulltime and is monotonic',async()=>{
 const m=await createSoccerMatch(12345,[],0,90,5,'attack');let last=0,half=false;
 for(let i=0;i<20000&&!m.finished;i++){m.step();assert.ok(m.matchSeconds+1e-6>=last);last=m.matchSeconds;if(m.phase==='halftime'){half=true;assert.equal(scoreboard(m).clock,'45:00');}}
 assert.ok(half&&m.finished);assert.equal(scoreboard(m).clock,'90:00');assert.equal(m.flow.kickoffCrowdedTicks,0);
});
